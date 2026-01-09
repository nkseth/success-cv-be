import { eq, and, or, ilike, inArray, gte, lte, desc, asc, count } from "drizzle-orm";
import { db } from "../config/db.js";
import { inviteTable, orgMembersTable, usersTable } from "../drizzle/schema.js";
import { AppError } from "../middleware/error.js";
import { getUserByEmailModel, getUserByIDModel } from "./user.model.js";
import { getOrgByID } from "./organisation.model.js";
import { generateInviteLink } from "../services/email/emailInviteLinks.js";
import { sendEmail } from "../services/email/setBrevo.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import { excludeFields } from "../utils/security-helper.js";
import { memberTypeConstants } from "../utils/constants.js";
import { 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy 
} from "../utils/pagination-filter.js";


export const inviteSingleMember = async (userId, orgID, email, role = memberType.MEMBER) => {

    try {

        const ifExists = await checkOrgMemberExists(orgID, null, email);
        if (ifExists) {
            throw new AppError('Member with this email is a part of the organisation', 409);
        }

        const orgExist = await getOrgByID(orgID);
        if (!orgExist) {
            throw new AppError('Organisation not found', 404);
        }

        const checkInvite = await checkExistingInvite(orgID, email);

        if (checkInvite) {
            throw new AppError('Invite already exists for this email', 409);
        }

        const invite = await createSingleInvite(userId, orgID, email, role);
        let inviteLink = generateInviteLink(invite.id);

        sendEmail(
            email,
            'You have been invited to join an organisation',
            `<p>Click the link below to accept your invitation:</p><p><a href="${inviteLink}">${inviteLink}</a></p>`
        );
        return { invite, inviteLink };

    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to get organisation by ID: ${error.message}`, 500);
    }
}

export const checkExistingInvite = async (orgID, email) => {
    try {
        const [invite] = await db.select()
            .from(inviteTable)
            .where(and(

                eq(inviteTable.organisationID, orgID),
                eq(inviteTable.email, email),
                eq(inviteTable.isAccepted, false)
            )
            ).limit(1);

        return !!invite;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to check existing invite: ${error.message}`, 500);
    }
}

export const checkOrgMemberExists = async (orgID, userID, email) => {
    let checkID = userID
    if (!checkID && email) {
        // get user by email and set checkID

        const user = await getUserByEmailModel(email);
        checkID = user?.id;
        if (!checkID) {
            return false;
        }
    }
    try {
        const [member] = await db.select()
            .from(orgMembersTable)
            .where(
                and(
                    eq(orgMembersTable.organisationID, orgID),
                    eq(orgMembersTable.userID, checkID)
                )
            ).limit(1);
        return !!member;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to check organisation member exists: ${error.message}`, 500);
    }
}

export const createSingleInvite = async (generatedBy, organisationID, email, type) => {

    const validExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    // Create the invite
    const invite = {
        generatedBy: generatedBy,
        organisationID: organisationID,
        type: type,
        email: email,
        isAccepted: false,
        acceptedCount: 0,
        expiresAt: validExpiresAt
    };

    const result = await db.insert(inviteTable).values(invite).returning();

    if (!result) {
        throw new AppError('Failed to create invite', 500);
    }

    return result[0];
}
export const getInviteById = async (id) => {
    const validId = validateString(id, 'Invite ID');

    const invite = await db.select().from(inviteTable).where(eq(inviteTable.id, validId));

    if (!invite || invite.length === 0) {
        throw new AppError('Invite not found', 404);
    }

    return invite[0] || null;
}

export const acceptInvite = async (id, userID) => {
    // Validate invite ID
    const validId = validateString(id, 'Invite ID');

    // Check if the invite exists
    const invite = await getInviteById(validId);
    const validUserID = validateInteger(userID, 'User ID');
    const user = await getUserByIDModel(validUserID);

    if (!invite) {
        throw new AppError(invite.message || 'Invite not found', 404);
    }

    if (invite.isAccepted) {
        throw new AppError('Invite has already been accepted', 400);
    }

    if (invite.email !== user.email) {
        throw new AppError('This invite is not valid for your email', 403);
    }

    const createMember = await addOrganisationMemberByUserId(invite.organisationID, userID, invite.id);
    if (!createMember) {
        throw new AppError(createMember.message || 'Failed to add member to organisation', 500);
    }

    // Update invite as accepted
    const updatedInvite = await db.update(inviteTable)
        .set({
            isAccepted: true,
            acceptedCount: invite.acceptedCount + 1
        })
        .where(eq(inviteTable.id, validId))
        .returning();

    if (!updatedInvite) {
        throw new AppError('Failed to update invite', 500);
    }

    return true;
}

export const addOrganisationMemberByUserId = async (orgID, userID, refID = null, role = memberTypeConstants.MEMBER) => {
    // Validate inputs
    const validatedOrgID = validateInteger(orgID, 'Organisation ID');
    const validatedUserID = validateInteger(userID, 'User ID');

    const organization = await getOrgByID(validatedOrgID);

    if (!organization) {
        throw new AppError('Organisation not found', 404);
    }

    // Check if user is already a member of this organisation
    const existingMember = await checkOrgMemberExists(validatedOrgID, validatedUserID, null);

    if (existingMember) {
        throw new AppError('User is already a member of this organisation', 409);
    }

    // Add user as member
    const memberValues = {
        organisationID: validatedOrgID,
        userID: validatedUserID,
        role: role,
    };

    if (refID) {
        memberValues.inviteRef = refID;
    }

    const newMember = await db.insert(orgMembersTable).values(memberValues).returning();
    const memberData = excludeFields(newMember[0], ['deleted_at']);

    return memberData;
};

export const ResendInvite = async (id) => {

    const invite = await getInviteById(id);
    if (!invite) {
        throw new AppError(invite.message || 'Invite not found', 404);
    }
    let inviteLink = generateInviteLink(invite.id);

    sendEmail(
        invite.email,
        'You have been invited to join an organisation',
        `<p>Click the link below to accept your invitation:</p><p><a href="${inviteLink}">${inviteLink}</a></p>`
    );
    return { invite, inviteLink };

}

export const getAllMembersofOrganisation = async (orgID, options = {}) => {
    const validOrgID = validateInteger(orgID, 'Organisation ID');
    const existingOrg = await getOrgByID(validOrgID);
    if (!existingOrg) {
        throw new AppError('Organisation not found', 404);
    }

    const {
        pagination = { limit: 10, offset: 0 },
        filters = {},
        search = { query: '', fields: [] },
        sort = { field: 'joinedAt', order: 'desc' }
    } = options;

    try {
        // Build base where conditions
        const whereConditions = [eq(orgMembersTable.organisationID, validOrgID)];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            { ...orgMembersTable, userIsVerified: usersTable.isVerified },
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Add search condition (search in user name or email)
        const searchCondition = buildSearchCondition(
            search.query,
            [usersTable.fullname, usersTable.email],
            { or, ilike }
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(orgMembersTable)
            .innerJoin(usersTable, eq(orgMembersTable.userID, usersTable.id))
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(
            sort,
            { ...orgMembersTable, userName: usersTable.fullname, userEmail: usersTable.email, userIsVerified: usersTable.isVerified },
            { asc, desc }
        );

        // Fetch paginated members
        const members = await db.select({
            id: orgMembersTable.id,
            userID: orgMembersTable.userID,
            organisationID: orgMembersTable.organisationID,
            role: orgMembersTable.role,
            inviteRef: orgMembersTable.inviteRef,
            joinedAt: orgMembersTable.joinedAt,
            // User details from join
            userName: usersTable.fullname,
            userEmail: usersTable.email,
            userIsVerified: usersTable.isVerified
        })
            .from(orgMembersTable)
            .innerJoin(usersTable, eq(orgMembersTable.userID, usersTable.id))
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        return { members, totalCount };
    } catch (error) {
        throw new AppError('Failed to retrieve organisation members', 500);
    }
}

export const getAllInvitesOfOrganisation = async (orgID, options = {}) => {
    const validOrgID = validateInteger(orgID, 'Organisation ID');
    const existingOrg = await getOrgByID(validOrgID);
    if (!existingOrg) {
        throw new AppError('Organisation not found', 404);
    }

    const {
        pagination = { limit: 10, offset: 0 },
        filters = {},
        search = { query: '', fields: [] },
        sort = { field: 'createdAt', order: 'desc' }
    } = options;

    try {
        // Build base where conditions
        const whereConditions = [eq(inviteTable.organisationID, validOrgID)];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            inviteTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Add search condition (search in email)
        const searchCondition = buildSearchCondition(
            search.query,
            [inviteTable.email],
            { or, ilike }
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(inviteTable)
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, inviteTable, { asc, desc });

        // Fetch paginated invites
        const invites = await db.select()
            .from(inviteTable)
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        return { invites, totalCount };
    } catch (error) {
        throw new AppError('Failed to retrieve organisation invites', 500);
    }
}