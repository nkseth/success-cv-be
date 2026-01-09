import { AppError, asyncHandler } from "../middleware/error.js";
import { acceptInvite, addOrganisationMemberByUserId, getAllMembersofOrganisation, getAllInvitesOfOrganisation, inviteSingleMember, ResendInvite } from "../models/invite-member.model.js";
import { createOrg, getOrgsByUserID, getOrgByID } from "../models/organisation.model.js";
import { getProfileByUserId } from "../models/profile.model.js";
import { getUserByIDModel } from "../models/user.model.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { memberTypeConstants } from "../utils/constants.js";
import { excludeFields } from "../utils/security-helper.js";
import { validateEmail, validateInteger } from "../utils/validate-helper.js";
import { 
    parseQueryParams, 
    getPaginationMeta, 
    formatPaginatedResponse 
} from "../utils/pagination-filter.js";



export const createOrgByUserIDController = asyncHandler(async (req, res, next) => {

    // const { id } = req.params;
    const id = req.userID
    console.log("USERID", req.userID);

    const validatedId = validateInteger(id, 'User ID');
    const user = await getUserByIDModel(validatedId);
    if (!user) {
        return next(new AppError('User not found', 404));
    }

    const createdOrg = await createOrg(validatedId, req.body);

    if (!createdOrg) {
        return next(new AppError('Organisation creation failed', 500));
    }
    const createMember = await addOrganisationMemberByUserId(createdOrg.id, validatedId, null, memberTypeConstants.ADMIN);
    sendSuccess(res, createdOrg, "Organisation created successfully");
});

export const inviteAMemberController = asyncHandler(async (req, res, next) => {

    const { email, role = memberTypeConstants.MEMBER } = req.body;
    const { id } = req.params;

    const validatedOrgId = validateInteger(id, 'Organisation ID');
    const validatedEmail = validateEmail(email);

    const result = await inviteSingleMember(req.userID, validatedOrgId, validatedEmail, role);

    sendSuccess(res, result.inviteLink, "Member invited successfully", 200);
})

export const acceptInviteController = asyncHandler(async (req, res, next) => {
    const { inviteID } = req.params;
    const userId = req.userID;

    const result = await acceptInvite(inviteID, userId);

    sendSuccess(res, result, "Invite accepted successfully", 200);
});

export const resendInviteController = asyncHandler(async (req, res, next) => {
    const { inviteID } = req.params;
    const userId = req.userID;

    const result = await ResendInvite(inviteID);

    sendSuccess(res, result.inviteLink, "Invite resent successfully", 200);
});

/**
 * Get all members of an organisation with pagination and filtering
 * GET /api/v1/organisations/:id/members
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - q: Search in user name or email
 * - role: Filter by role (admin, member) - supports multiple: ?role=admin,member
 * - userIsVerified: Filter by user verification status - supports multiple: ?userIsVerified=true,false
 * - joinedAt: Date range filter ?joinedAt=2025-01-01,2025-12-31
 * - sortBy: Sort field (joinedAt, userName, userEmail, role)
 * - sortOrder: Sort order (asc, desc)
 */
export const getAllMembersofOrganisationController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        filterableFields: {
            role: 'array',
            userIsVerified: 'boolean',
            joinedAt: 'dateRange',
        },
        sortableFields: ['joinedAt', 'userName', 'userEmail', 'role', 'userIsVerified'],
        defaultSort: { field: 'joinedAt', order: 'desc' }
    });

    const { members, totalCount } = await getAllMembersofOrganisation(id, {
        pagination,
        filters,
        search,
        sort
    });

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(members, paginationMeta, filters);

    sendSuccess(res, response, "Organisation members retrieved successfully", 200);
});

/**
 * Get all invites of an organisation with pagination and filtering
 * GET /api/v1/organisations/:id/invites
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - q: Search in email
 * - type: Filter by invite type (admin, member) - supports multiple
 * - isAccepted: Filter by acceptance status - supports multiple: ?isAccepted=true,false
 * - createdAt: Date range filter
 * - expiresAt: Date range filter
 * - sortBy: Sort field (createdAt, expiresAt, email)
 * - sortOrder: Sort order (asc, desc)
 */
export const getAllInvitesOfOrganisationController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        filterableFields: {
            type: 'array',
            isAccepted: 'boolean',
            createdAt: 'dateRange',
            expiresAt: 'dateRange',
        },
        sortableFields: ['createdAt', 'expiresAt', 'email', 'type', 'isAccepted'],
        defaultSort: { field: 'createdAt', order: 'desc' }
    });

    const { invites, totalCount } = await getAllInvitesOfOrganisation(id, {
        pagination,
        filters,
        search,
        sort
    });

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(invites, paginationMeta, filters);

    sendSuccess(res, response, "Organisation invites retrieved successfully", 200);
});

export const getOrgByIDController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const validatedOrgId = validateInteger(id, 'Organisation ID');
    const organisation = await getOrgByID(validatedOrgId);

    if (!organisation) {
        return next(new AppError('Organisation not found', 404));
    }

    sendSuccess(res, organisation, "Organisation details retrieved successfully", 200);
});

export const getOrgsByUserIDController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const validatedId = validateInteger(id, 'User ID');
    const user = await getUserByIDModel(validatedId);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    const organisations = await getOrgsByUserID(validatedId);

    sendSuccess(res, organisations, "User organisations retrieved successfully", 200);
});

export const getAllCandidatesOfOrganisationController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const validatedOrgId = validateInteger(id, 'Organisation ID');

    // Import the function dynamically to avoid circular dependencies
    const { getCandidatesByOrganisationId } = await import('../models/candidate.model.js');
    const candidates = await getCandidatesByOrganisationId(validatedOrgId);

    sendSuccess(res, candidates, "Organisation candidates retrieved successfully", 200);
});
