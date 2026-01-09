import { eq, and, isNull, desc, asc, sql, ilike, or } from "drizzle-orm";
import { db } from "../config/db.js";
import {
    adminUsersTable,
    systemSettingsTable,
    resumeTemplatesTable,
    blockedUsersTable,
    adminActivityLogTable,
    usersTable,
    candidatesTable,
    organisationsTable
} from "../drizzle/schema.js";
import { excludeFields, hashPassword, comparePassword } from "../utils/security-helper.js";
import { validateEmail, validateInteger, validateString } from "../utils/validate-helper.js";
import { AppError } from "../middleware/error.js";
import { userTypeConstants, adminRoleConstants } from "../utils/constants.js";

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

// ==================== RESUME TEMPLATES MODELS ====================

/**
 * Create a new resume template
 */
export const createResumeTemplateModel = async (templateData, adminId) => {
    try {
        const { name, description, thumbnailUrl, templateFileUrl, templateType = 'pdf', category = 'general', isPremium = false, metadata } = templateData;

        const validatedName = validateString(name, "Template Name", { minLength: 1, maxLength: 255 });

        const [created] = await db.insert(resumeTemplatesTable).values({
            name: validatedName,
            description,
            thumbnailUrl,
            templateFileUrl,
            templateType,
            category,
            isPremium,
            metadata,
            createdBy: adminId,
            updatedBy: adminId,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        return created;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create resume template: ${error.message}`, 500);
    }
};

/**
 * Get resume template by ID
 */
export const getResumeTemplateByIdModel = async (id) => {
    try {
        const validId = validateInteger(id, "Template ID", { min: 1 });
        const [template] = await db.select()
            .from(resumeTemplatesTable)
            .where(and(
                eq(resumeTemplatesTable.id, validId),
                isNull(resumeTemplatesTable.deletedAt)
            ));
        return template || null;
    } catch (error) {
        throw new AppError(`Failed to get resume template: ${error.message}`, 500);
    }
};

/**
 * List all resume templates with filtering
 */
export const listResumeTemplatesModel = async (options = {}) => {
    try {
        const { category, isActive, isPremium, page = 1, limit = 20, includeInactive = false } = options;
        const offset = (page - 1) * limit;

        const conditions = [isNull(resumeTemplatesTable.deletedAt)];

        if (!includeInactive) {
            conditions.push(eq(resumeTemplatesTable.isActive, true));
        }
        if (category) {
            conditions.push(eq(resumeTemplatesTable.category, category));
        }
        if (typeof isActive === 'boolean') {
            conditions.push(eq(resumeTemplatesTable.isActive, isActive));
        }
        if (typeof isPremium === 'boolean') {
            conditions.push(eq(resumeTemplatesTable.isPremium, isPremium));
        }

        const templates = await db.select()
            .from(resumeTemplatesTable)
            .where(and(...conditions))
            .orderBy(asc(resumeTemplatesTable.sortOrder), desc(resumeTemplatesTable.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db.select({ count: sql`count(*)` })
            .from(resumeTemplatesTable)
            .where(and(...conditions));

        return {
            data: templates,
            pagination: {
                page,
                limit,
                total: Number(count),
                totalPages: Math.ceil(Number(count) / limit)
            }
        };
    } catch (error) {
        throw new AppError(`Failed to list resume templates: ${error.message}`, 500);
    }
};

/**
 * Update resume template
 */
export const updateResumeTemplateModel = async (id, updateData, adminId) => {
    try {
        const validId = validateInteger(id, "Template ID", { min: 1 });

        const [updated] = await db.update(resumeTemplatesTable)
            .set({
                ...updateData,
                updatedBy: adminId,
                updatedAt: new Date()
            })
            .where(and(
                eq(resumeTemplatesTable.id, validId),
                isNull(resumeTemplatesTable.deletedAt)
            ))
            .returning();

        return updated || null;
    } catch (error) {
        throw new AppError(`Failed to update resume template: ${error.message}`, 500);
    }
};

/**
 * Soft delete resume template
 */
export const deleteResumeTemplateModel = async (id) => {
    try {
        const validId = validateInteger(id, "Template ID", { min: 1 });

        const [deleted] = await db.update(resumeTemplatesTable)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(resumeTemplatesTable.id, validId))
            .returning();

        return deleted || null;
    } catch (error) {
        throw new AppError(`Failed to delete resume template: ${error.message}`, 500);
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

        const users = await db.select({
            id: usersTable.id,
            fullname: usersTable.fullname,
            email: usersTable.email,
            isVerified: usersTable.isVerified,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt
        })
            .from(usersTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(usersTable.createdAt))
            .limit(limit)
            .offset(offset);

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

        const candidates = await db.select({
            id: candidatesTable.id,
            fullname: candidatesTable.fullname,
            email: candidatesTable.email,
            organisationID: candidatesTable.organisationID,
            isVerified: candidatesTable.isVerified,
            createdAt: candidatesTable.createdAt,
            updatedAt: candidatesTable.updatedAt
        })
            .from(candidatesTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(candidatesTable.createdAt))
            .limit(limit)
            .offset(offset);

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

        const organisations = await db.select({
            id: organisationsTable.id,
            name: organisationsTable.name,
            slug: organisationsTable.slug,
            creatorID: organisationsTable.creatorID,
            address: organisationsTable.address,
            country: organisationsTable.country,
            state: organisationsTable.state,
            city: organisationsTable.city,
            createdAt: organisationsTable.createdAt,
            updatedAt: organisationsTable.updatedAt
        })
            .from(organisationsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(organisationsTable.createdAt))
            .limit(limit)
            .offset(offset);

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
