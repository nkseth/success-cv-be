import { eq, and, isNull, desc, asc, sql, ilike, or } from "drizzle-orm";
import { db } from "../config/db.js";
import {
    adminUsersTable,
    systemSettingsTable,
    blockedUsersTable,
    adminActivityLogTable,
    usersTable,
    candidatesTable,
    organisationsTable,
    orgMembersTable
} from "../drizzle/schema.js";
import { excludeFields, hashPassword, comparePassword } from "../utils/security-helper.js";
import { validateEmail, validateInteger, validateString, validateSlug } from "../utils/validate-helper.js";
import { AppError } from "../middleware/error.js";
import { userTypeConstants, adminRoleConstants } from "../utils/constants.js";
import { createProfile } from "./profile.model.js";

// ==================== ADMIN USER MODELS ====================

/**
 * Create a new admin user
 */
export const createAdminModel = async (adminData) => {
    try {
        const { email, password, fullname, role = adminRoleConstants.ADMIN } = adminData;

        const validatedEmail = validateEmail(email);
        const validatedPassword = validateString(password, "Password", { minLength: 8 });
        const validatedFullname = validateString(fullname, "Full Name", { minLength: 2, maxLength: 100 });

        // Check if admin exists
        const existingAdmin = await getAdminByEmailModel(validatedEmail);
        if (existingAdmin) {
            throw new AppError('Admin with this email already exists', 409);
        }

        const [createdAdmin] = await db.insert(adminUsersTable).values({
            fullname: validatedFullname,
            email: validatedEmail,
            passwordHash: await hashPassword(validatedPassword),
            role: role,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        return excludeFields(createdAdmin, ['passwordHash', 'deletedAt']);
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create admin: ${error.message}`, 500);
    }
};

/**
 * Get admin by email
 */
export const getAdminByEmailModel = async (email) => {
    try {
        const validatedEmail = validateEmail(email);
        const [admin] = await db.select()
            .from(adminUsersTable)
            .where(and(
                eq(adminUsersTable.email, validatedEmail),
                isNull(adminUsersTable.deletedAt)
            ));
        return admin || null;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get admin by email: ${error.message}`, 500);
    }
};

/**
 * Get admin by ID
 */
export const getAdminByIdModel = async (id) => {
    try {
        const validId = validateInteger(id, "Admin ID", { min: 1 });
        const [admin] = await db.select()
            .from(adminUsersTable)
            .where(and(
                eq(adminUsersTable.id, validId),
                isNull(adminUsersTable.deletedAt)
            ));
        return admin ? excludeFields(admin, ['passwordHash', 'deletedAt']) : null;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get admin by ID: ${error.message}`, 500);
    }
};

/**
 * Update admin last login
 */
export const updateAdminLastLoginModel = async (id) => {
    try {
        const validId = validateInteger(id, "Admin ID", { min: 1 });
        const [updated] = await db.update(adminUsersTable)
            .set({ lastLoginAt: new Date(), updatedAt: new Date() })
            .where(eq(adminUsersTable.id, validId))
            .returning();
        return updated || null;
    } catch (error) {
        throw new AppError(`Failed to update admin login: ${error.message}`, 500);
    }
};

/**
 * List all admins with pagination
 */
export const listAdminsModel = async (options = {}) => {
    try {
        const { page = 1, limit = 20 } = options;
        const offset = (page - 1) * limit;

        const admins = await db.select({
            id: adminUsersTable.id,
            fullname: adminUsersTable.fullname,
            email: adminUsersTable.email,
            role: adminUsersTable.role,
            isActive: adminUsersTable.isActive,
            lastLoginAt: adminUsersTable.lastLoginAt,
            createdAt: adminUsersTable.createdAt
        })
            .from(adminUsersTable)
            .where(isNull(adminUsersTable.deletedAt))
            .orderBy(desc(adminUsersTable.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(adminUsersTable)
            .where(isNull(adminUsersTable.deletedAt));

        return {
            data: admins,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list admins: ${error.message}`, 500);
    }
};

// ==================== SYSTEM SETTINGS MODELS ====================

/**
 * Get a setting by key
 */
export const getSettingByKeyModel = async (key) => {
    try {
        const validatedKey = validateString(key, "Setting Key", { minLength: 1, maxLength: 255 });
        const [setting] = await db.select()
            .from(systemSettingsTable)
            .where(eq(systemSettingsTable.settingKey, validatedKey));
        return setting || null;
    } catch (error) {
        throw new AppError(`Failed to get setting: ${error.message}`, 500);
    }
};

/**
 * Create or update a setting
 */
export const upsertSettingModel = async (settingData, adminId) => {
    try {
        const { key, value, type = 'string', category = 'general', description, isPublic = false } = settingData;
        
        const validatedKey = validateString(key, "Setting Key", { minLength: 1, maxLength: 255 });

        const existingSetting = await getSettingByKeyModel(validatedKey);

        if (existingSetting) {
            const [updated] = await db.update(systemSettingsTable)
                .set({
                    settingValue: value,
                    settingType: type,
                    category,
                    description,
                    isPublic,
                    updatedBy: adminId,
                    updatedAt: new Date()
                })
                .where(eq(systemSettingsTable.settingKey, validatedKey))
                .returning();
            return updated;
        } else {
            const [created] = await db.insert(systemSettingsTable).values({
                settingKey: validatedKey,
                settingValue: value,
                settingType: type,
                category,
                description,
                isPublic,
                createdBy: adminId,
                updatedBy: adminId,
                createdAt: new Date(),
                updatedAt: new Date()
            }).returning();
            return created;
        }
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to upsert setting: ${error.message}`, 500);
    }
};

/**
 * Get all settings by category
 */
export const getSettingsByCategoryModel = async (category) => {
    try {
        const settings = await db.select()
            .from(systemSettingsTable)
            .where(eq(systemSettingsTable.category, category))
            .orderBy(asc(systemSettingsTable.settingKey));
        return settings;
    } catch (error) {
        throw new AppError(`Failed to get settings by category: ${error.message}`, 500);
    }
};

/**
 * Get all settings with optional filtering
 */
export const getAllSettingsModel = async (options = {}) => {
    try {
        const { category, isPublic, page = 1, limit = 50 } = options;
        const offset = (page - 1) * limit;

        let query = db.select().from(systemSettingsTable);
        const conditions = [];

        if (category) {
            conditions.push(eq(systemSettingsTable.category, category));
        }
        if (typeof isPublic === 'boolean') {
            conditions.push(eq(systemSettingsTable.isPublic, isPublic));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        const settings = await query
            .orderBy(asc(systemSettingsTable.category), asc(systemSettingsTable.settingKey))
            .limit(limit)
            .offset(offset);

        return settings;
    } catch (error) {
        throw new AppError(`Failed to get all settings: ${error.message}`, 500);
    }
};

/**
 * Delete a setting by key
 */
export const deleteSettingModel = async (key) => {
    try {
        const validatedKey = validateString(key, "Setting Key", { minLength: 1, maxLength: 255 });
        const [deleted] = await db.delete(systemSettingsTable)
            .where(eq(systemSettingsTable.settingKey, validatedKey))
            .returning();
        return deleted || null;
    } catch (error) {
        throw new AppError(`Failed to delete setting: ${error.message}`, 500);
    }
};

// ==================== BLOCKED USERS MODELS ====================

/**
 * Block a user or candidate
 */
export const blockUserModel = async (blockData, adminId) => {
    try {
        const { userId, candidateId, userType, reason } = blockData;

        // Check if already blocked
        const existingBlock = await getActiveBlockModel(userId, candidateId, userType);
        if (existingBlock) {
            throw new AppError('User is already blocked', 409);
        }

        const blockRecord = {
            userType,
            reason,
            blockedBy: adminId,
            blockedAt: new Date(),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (userType === userTypeConstants.USER && userId) {
            blockRecord.userID = validateInteger(userId, "User ID", { min: 1 });
        } else if (userType === userTypeConstants.CANDIDATE && candidateId) {
            blockRecord.candidateID = validateInteger(candidateId, "Candidate ID", { min: 1 });
        } else {
            throw new AppError('Invalid user type or missing ID', 400);
        }

        const [created] = await db.insert(blockedUsersTable).values(blockRecord).returning();
        return created;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to block user: ${error.message}`, 500);
    }
};

/**
 * Unblock a user or candidate
 */
export const unblockUserModel = async (blockId, adminId) => {
    try {
        const validId = validateInteger(blockId, "Block ID", { min: 1 });

        const [updated] = await db.update(blockedUsersTable)
            .set({
                isActive: false,
                unblockedAt: new Date(),
                unblockedBy: adminId,
                updatedAt: new Date()
            })
            .where(and(
                eq(blockedUsersTable.id, validId),
                eq(blockedUsersTable.isActive, true)
            ))
            .returning();

        return updated || null;
    } catch (error) {
        throw new AppError(`Failed to unblock user: ${error.message}`, 500);
    }
};

/**
 * Get active block for a user/candidate
 */
export const getActiveBlockModel = async (userId, candidateId, userType) => {
    try {
        let condition;
        
        if (userType === userTypeConstants.USER && userId) {
            condition = and(
                eq(blockedUsersTable.userID, userId),
                eq(blockedUsersTable.isActive, true)
            );
        } else if (userType === userTypeConstants.CANDIDATE && candidateId) {
            condition = and(
                eq(blockedUsersTable.candidateID, candidateId),
                eq(blockedUsersTable.isActive, true)
            );
        } else {
            return null;
        }

        const [block] = await db.select().from(blockedUsersTable).where(condition);
        return block || null;
    } catch (error) {
        throw new AppError(`Failed to check block status: ${error.message}`, 500);
    }
};

/**
 * Check if user is blocked
 */
export const isUserBlockedModel = async (userId, userType) => {
    try {
        let condition;
        
        if (userType === userTypeConstants.USER) {
            condition = and(
                eq(blockedUsersTable.userID, userId),
                eq(blockedUsersTable.isActive, true)
            );
        } else if (userType === userTypeConstants.CANDIDATE) {
            condition = and(
                eq(blockedUsersTable.candidateID, userId),
                eq(blockedUsersTable.isActive, true)
            );
        } else {
            return false;
        }

        const [block] = await db.select().from(blockedUsersTable).where(condition);
        return !!block;
    } catch (error) {
        throw new AppError(`Failed to check block status: ${error.message}`, 500);
    }
};

/**
 * List blocked users with pagination
 */
export const listBlockedUsersModel = async (options = {}) => {
    try {
        const { userType, isActive = true, page = 1, limit = 20 } = options;
        const offset = (page - 1) * limit;

        const conditions = [];
        
        if (typeof isActive === 'boolean') {
            conditions.push(eq(blockedUsersTable.isActive, isActive));
        }
        if (userType) {
            conditions.push(eq(blockedUsersTable.userType, userType));
        }

        const blocks = await db.select({
            id: blockedUsersTable.id,
            userID: blockedUsersTable.userID,
            candidateID: blockedUsersTable.candidateID,
            userType: blockedUsersTable.userType,
            reason: blockedUsersTable.reason,
            blockedBy: blockedUsersTable.blockedBy,
            blockedAt: blockedUsersTable.blockedAt,
            unblockedAt: blockedUsersTable.unblockedAt,
            unblockedBy: blockedUsersTable.unblockedBy,
            isActive: blockedUsersTable.isActive
        })
            .from(blockedUsersTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(blockedUsersTable.blockedAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(blockedUsersTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            data: blocks,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list blocked users: ${error.message}`, 500);
    }
};

// ==================== ADMIN ACTIVITY LOG MODELS ====================

/**
 * Log admin activity
 */
export const logAdminActivityModel = async (logData) => {
    try {
        const { adminId, action, resourceType, resourceId, details, ipAddress, userAgent } = logData;

        const [created] = await db.insert(adminActivityLogTable).values({
            adminId,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress,
            userAgent,
            createdAt: new Date()
        }).returning();

        return created;
    } catch (error) {
        // Don't throw on logging failures, just log the error
        console.error('Failed to log admin activity:', error.message);
        return null;
    }
};

/**
 * Get admin activity logs with filtering
 */
export const getAdminActivityLogsModel = async (options = {}) => {
    try {
        const { adminId, action, resourceType, page = 1, limit = 50 } = options;
        const offset = (page - 1) * limit;

        const conditions = [];
        
        if (adminId) {
            conditions.push(eq(adminActivityLogTable.adminId, adminId));
        }
        if (action) {
            conditions.push(eq(adminActivityLogTable.action, action));
        }
        if (resourceType) {
            conditions.push(eq(adminActivityLogTable.resourceType, resourceType));
        }

        const logs = await db.select()
            .from(adminActivityLogTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(adminActivityLogTable.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(adminActivityLogTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            data: logs,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to get activity logs: ${error.message}`, 500);
    }
};

// ==================== USER MANAGEMENT MODELS ====================

/**
 * List all users with pagination and search
 */
export const listAllUsersModel = async (options = {}) => {
    try {
        const { search, page = 1, limit = 20, includeDeleted = false } = options;
        const offset = (page - 1) * limit;

        const conditions = [];
        
        if (!includeDeleted) {
            conditions.push(isNull(usersTable.deletedAt));
        }
        if (search) {
            conditions.push(or(
                ilike(usersTable.fullname, `%${search}%`),
                ilike(usersTable.email, `%${search}%`)
            ));
        }

        const usersData = await db.select({
            id: usersTable.id,
            fullname: usersTable.fullname,
            email: usersTable.email,
            isVerified: usersTable.isVerified,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt,
            // Join with blocked_users to get block info
            blockId: blockedUsersTable.id,
            isBlocked: blockedUsersTable.isActive,
            blockedReason: blockedUsersTable.reason,
            blockedAt: blockedUsersTable.blockedAt
        })
            .from(usersTable)
            .leftJoin(
                blockedUsersTable,
                and(
                    eq(blockedUsersTable.userID, usersTable.id),
                    eq(blockedUsersTable.isActive, true),
                    eq(blockedUsersTable.userType, userTypeConstants.USER)
                )
            )
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(usersTable.createdAt))
            .limit(limit)
            .offset(offset);

        // Transform data to clean format
        const users = usersData.map(user => ({
            id: user.id,
            fullname: user.fullname,
            email: user.email,
            isVerified: user.isVerified,
            isBlocked: user.isBlocked || false,
            blockInfo: user.isBlocked ? {
                id: user.blockId,
                reason: user.blockedReason,
                blockedAt: user.blockedAt
            } : null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(usersTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            data: users,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list users: ${error.message}`, 500);
    }
};

/**
 * List all candidates with pagination and search
 */
export const listAllCandidatesModel = async (options = {}) => {
    try {
        const { search, organisationId, page = 1, limit = 20, includeDeleted = false } = options;
        const offset = (page - 1) * limit;

        const conditions = [];
        
        if (!includeDeleted) {
            conditions.push(isNull(candidatesTable.deletedAt));
        }
        if (search) {
            conditions.push(or(
                ilike(candidatesTable.fullname, `%${search}%`),
                ilike(candidatesTable.email, `%${search}%`)
            ));
        }
        if (organisationId) {
            conditions.push(eq(candidatesTable.organisationID, organisationId));
        }

        const candidatesData = await db.select({
            id: candidatesTable.id,
            fullname: candidatesTable.fullname,
            email: candidatesTable.email,
            organisationID: candidatesTable.organisationID,
            organisationName: organisationsTable.name,
            isVerified: candidatesTable.isVerified,
            createdAt: candidatesTable.createdAt,
            updatedAt: candidatesTable.updatedAt,
            // Join with blocked_users to get block info
            blockId: blockedUsersTable.id,
            isBlocked: blockedUsersTable.isActive,
            blockedReason: blockedUsersTable.reason,
            blockedAt: blockedUsersTable.blockedAt
        })
            .from(candidatesTable)
            .leftJoin(organisationsTable, eq(candidatesTable.organisationID, organisationsTable.id))
            .leftJoin(
                blockedUsersTable,
                and(
                    eq(blockedUsersTable.candidateID, candidatesTable.id),
                    eq(blockedUsersTable.isActive, true),
                    eq(blockedUsersTable.userType, userTypeConstants.CANDIDATE)
                )
            )
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(candidatesTable.createdAt))
            .limit(limit)
            .offset(offset);

        // Transform data to include organisation as an object
        const candidates = candidatesData.map(candidate => ({
            id: candidate.id,
            fullname: candidate.fullname,
            email: candidate.email,
            organisation: {
                id: candidate.organisationID,
                name: candidate.organisationName
            },
            isVerified: candidate.isVerified,
            isBlocked: candidate.isBlocked || false,
            blockInfo: candidate.isBlocked ? {
                id: candidate.blockId,
                reason: candidate.blockedReason,
                blockedAt: candidate.blockedAt
            } : null,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt
        }));

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(candidatesTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            data: candidates,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list candidates: ${error.message}`, 500);
    }
};

/**
 * List all organisations with pagination and search
 */
export const listAllOrganisationsModel = async (options = {}) => {
    try {
        const { search, page = 1, limit = 20, includeDeleted = false } = options;
        const offset = (page - 1) * limit;

        const conditions = [];
        
        if (!includeDeleted) {
            conditions.push(isNull(organisationsTable.deletedAt));
        }
        if (search) {
            conditions.push(or(
                ilike(organisationsTable.name, `%${search}%`),
                ilike(organisationsTable.slug, `%${search}%`)
            ));
        }

        const organisationsData = await db.select({
            id: organisationsTable.id,
            name: organisationsTable.name,
            slug: organisationsTable.slug,
            creatorID: organisationsTable.creatorID,
            creatorFullname: usersTable.fullname,
            creatorEmail: usersTable.email,
            address: organisationsTable.address,
            country: organisationsTable.country,
            state: organisationsTable.state,
            city: organisationsTable.city,
            createdAt: organisationsTable.createdAt,
            updatedAt: organisationsTable.updatedAt
        })
            .from(organisationsTable)
            .leftJoin(usersTable, eq(organisationsTable.creatorID, usersTable.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(organisationsTable.createdAt))
            .limit(limit)
            .offset(offset);

        // Transform data to include creator as an object
        const organisations = organisationsData.map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            creator: {
                id: org.creatorID,
                fullname: org.creatorFullname,
                email: org.creatorEmail
            },
            address: org.address,
            country: org.country,
            state: org.state,
            city: org.city,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt
        }));

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(organisationsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return {
            data: organisations,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list organisations: ${error.message}`, 500);
    }
};

// ==================== ADMIN USER/CANDIDATE/ORG CREATION MODELS ====================

/**
 * Create a new user (admin only)
 */
export const adminCreateUserModel = async (userData) => {
    try {
        const { email, password, fullname } = userData;

        const validatedEmail = validateEmail(email);
        const validatedPassword = validateString(password, "Password", { minLength: 6 });
        const validatedFullname = validateString(fullname, "Full Name", { minLength: 2, maxLength: 100 });

        // Check if user exists
        const [existingUser] = await db.select()
            .from(usersTable)
            .where(eq(usersTable.email, validatedEmail));
        
        if (existingUser) {
            throw new AppError('User with this email already exists', 409);
        }

        const [createdUser] = await db.insert(usersTable).values({
            fullname: validatedFullname,
            email: validatedEmail,
            passwordHash: await hashPassword(validatedPassword),
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        // Create profile for user
        if (createdUser && createdUser.id) {
            await createProfile({ userID: createdUser.id });
        }

        return excludeFields(createdUser, ['passwordHash', 'deletedAt']);
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create user: ${error.message}`, 500);
    }
};

/**
 * Create a new candidate (admin only)
 */
export const adminCreateCandidateModel = async (candidateData) => {
    try {
        const { email, password, fullname, organisationID } = candidateData;

        const validatedEmail = validateEmail(email);
        const validatedPassword = validateString(password, "Password", { minLength: 8 });
        const validatedFullname = validateString(fullname, "Full Name", { minLength: 2, maxLength: 255 });
        const validatedOrgID = validateInteger(organisationID, "Organisation ID", { min: 1 });

        // Check if organisation exists
        const [org] = await db.select()
            .from(organisationsTable)
            .where(eq(organisationsTable.id, validatedOrgID));
        
        if (!org) {
            throw new AppError('Organisation not found', 404);
        }

        // Check if candidate exists
        const [existingCandidate] = await db.select()
            .from(candidatesTable)
            .where(eq(candidatesTable.email, validatedEmail));
        
        if (existingCandidate) {
            throw new AppError('Candidate with this email already exists', 409);
        }

        const [createdCandidate] = await db.insert(candidatesTable).values({
            fullname: validatedFullname,
            email: validatedEmail,
            passwordHash: await hashPassword(validatedPassword),
            organisationID: validatedOrgID,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        // Create profile for candidate
        if (createdCandidate && createdCandidate.id) {
            await createProfile({ candidateID: createdCandidate.id });
        }

        return excludeFields(createdCandidate, ['passwordHash', 'deletedAt']);
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create candidate: ${error.message}`, 500);
    }
};

/**
 * Create a new organisation (admin only)
 */
export const adminCreateOrganisationModel = async (orgData) => {
    try {
        const { name, slug, creatorID, address, country, state, city } = orgData;

        const validatedName = validateString(name, "Organisation Name", { minLength: 2, maxLength: 100 });
        const validatedSlug = validateSlug(slug, "Organisation Slug", { minLength: 2, maxLength: 100 });
        const validatedCreatorID = validateInteger(creatorID, "Creator ID", { min: 1 });

        // Check if creator (user) exists
        const [creator] = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, validatedCreatorID));
        
        if (!creator) {
            throw new AppError('Creator user not found', 404);
        }

        // Check if organisation with slug exists
        const [existingOrg] = await db.select()
            .from(organisationsTable)
            .where(eq(organisationsTable.slug, validatedSlug));
        
        if (existingOrg) {
            throw new AppError('Organisation with this slug already exists', 409);
        }

        const [createdOrg] = await db.insert(organisationsTable).values({
            name: validatedName,
            slug: validatedSlug,
            creatorID: validatedCreatorID,
            address: address || null,
            country: country || null,
            state: state || null,
            city: city || null,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        // Add creator as admin member of the organisation
        await db.insert(orgMembersTable).values({
            userID: validatedCreatorID,
            organisationID: createdOrg.id,
            role: 'admin',
            joinedAt: new Date()
        });

        return excludeFields(createdOrg, ['deletedAt']);
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create organisation: ${error.message}`, 500);
    }
};

/**
 * Add a user to an organisation (admin only)
 */
export const adminAddUserToOrganisationModel = async (memberData) => {
    try {
        const { organisationId, userId, role } = memberData;

        const validatedOrgID = validateInteger(organisationId, "Organisation ID", { min: 1 });
        const validatedUserID = validateInteger(userId, "User ID", { min: 1 });
        const validatedRole = validateString(role, "Role", { minLength: 2, maxLength: 50 });

        // Check if organisation exists
        const [org] = await db.select()
            .from(organisationsTable)
            .where(eq(organisationsTable.id, validatedOrgID));
        
        if (!org) {
            throw new AppError('Organisation not found', 404);
        }

        // Check if user exists
        const [user] = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, validatedUserID));
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user is already a member
        const [existingMember] = await db.select()
            .from(orgMembersTable)
            .where(and(
                eq(orgMembersTable.organisationID, validatedOrgID),
                eq(orgMembersTable.userID, validatedUserID)
            ));
        
        if (existingMember) {
            throw new AppError('User is already a member of this organisation', 409);
        }

        const [createdMember] = await db.insert(orgMembersTable).values({
            userID: validatedUserID,
            organisationID: validatedOrgID,
            role: validatedRole,
            joinedAt: new Date()
        }).returning();

        return createdMember;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to add user to organisation: ${error.message}`, 500);
    }
};
