import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, asc, like, or, ilike, count, inArray, gte, lte, sql } from "drizzle-orm";
import logger from "../middleware/logger.js";
import { 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy 
} from "../utils/pagination-filter.js";
import {
    resumeThemesTable,
    userResumeThemeTable,
    resumeContentTable
} from "../drizzle/schema.js";
import { validateThemeConfig, DEFAULT_THEME } from "../utils/theme-schema.js";
import { validateString, validateInteger } from "../utils/validate-helper.js";

// ========== THEME OPERATIONS ==========

/**
 * Get all available themes with optional filters
 * @param {Object} options - Options including pagination, filters, search, sort
 * @returns {Promise<Object>} Object with themes array and totalCount
 */
export const getAllThemes = async (options = {}) => {
    try {
        const {
            pagination = { limit: 20, offset: 0 },
            filters = {},
            search = { query: '', fields: [] },
            sort = { field: 'usageCount', order: 'desc' }
        } = options;

        logger.info('[THEME_MODEL] Fetching themes', { options });

        // Build base where conditions - only show public themes
        const whereConditions = [eq(resumeThemesTable.isPublic, true)];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            resumeThemesTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Add search condition (search in name or description)
        const searchCondition = buildSearchCondition(
            search.query,
            [resumeThemesTable.name, resumeThemesTable.description],
            { or, ilike }
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(resumeThemesTable)
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, resumeThemesTable, { asc, desc });

        // Fetch paginated themes
        const themes = await db
            .select()
            .from(resumeThemesTable)
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        logger.info('[THEME_MODEL] ✅ Fetched themes', { count: themes.length, totalCount });
        return { themes, totalCount };
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to fetch themes', {
            error: error.message
        });
        throw new AppError(`Failed to fetch themes: ${error.message}`, 500);
    }
};

/**
 * Get theme by ID
 * @param {number} themeID - Theme ID
 * @returns {Promise<Object>} Theme data
 */
export const getThemeByID = async (themeID) => {
    try {
        const theme = await db
            .select()
            .from(resumeThemesTable)
            .where(eq(resumeThemesTable.id, themeID))
            .limit(1);

        if (!theme || theme.length === 0) {
            throw new AppError('Theme not found', 404);
        }

        return theme[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch theme: ${error.message}`, 500);
    }
};

/**
 * Get theme by slug
 * @param {string} slug - Theme slug
 * @returns {Promise<Object>} Theme data
 */
export const getThemeBySlug = async (slug) => {
    try {
        const theme = await db
            .select()
            .from(resumeThemesTable)
            .where(eq(resumeThemesTable.slug, slug))
            .limit(1);

        if (!theme || theme.length === 0) {
            throw new AppError('Theme not found', 404);
        }

        return theme[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch theme: ${error.message}`, 500);
    }
};

/**
 * Get themes by category
 * @param {string} category - Theme category
 * @param {number} limit - Result limit
 * @returns {Promise<Array>} List of themes
 */
export const getThemesByCategory = async (category, limit = 20) => {
    try {
        const themes = await db
            .select()
            .from(resumeThemesTable)
            .where(
                and(
                    eq(resumeThemesTable.category, category),
                    eq(resumeThemesTable.isPublic, true)
                )
            )
            .orderBy(desc(resumeThemesTable.usageCount))
            .limit(limit);

        return themes;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to fetch themes by category', {
            error: error.message,
            category
        });
        throw new AppError(`Failed to fetch themes: ${error.message}`, 500);
    }
};

/**
 * Get default theme for new resumes
 * Returns the most popular ATS-optimized theme, or the most popular theme overall
 * @returns {Promise<Object|null>} Default theme or null if no themes exist
 */
export const getDefaultTheme = async () => {
    try {
        // First, try to get the most popular ATS-optimized theme
        let [theme] = await db
            .select()
            .from(resumeThemesTable)
            .where(
                and(
                    eq(resumeThemesTable.isPublic, true),
                    eq(resumeThemesTable.isATSOptimized, true)
                )
            )
            .orderBy(desc(resumeThemesTable.usageCount))
            .limit(1);

        // If no ATS-optimized theme found, get the most popular professional theme
        if (!theme) {
            [theme] = await db
                .select()
                .from(resumeThemesTable)
                .where(
                    and(
                        eq(resumeThemesTable.isPublic, true),
                        eq(resumeThemesTable.category, 'professional')
                    )
                )
                .orderBy(desc(resumeThemesTable.usageCount))
                .limit(1);
        }

        // If still no theme, get any public theme
        if (!theme) {
            [theme] = await db
                .select()
                .from(resumeThemesTable)
                .where(eq(resumeThemesTable.isPublic, true))
                .orderBy(desc(resumeThemesTable.usageCount))
                .limit(1);
        }

        if (theme) {
            logger.info('[THEME_MODEL] Default theme selected', {
                themeID: theme.id,
                themeName: theme.name,
                isATSOptimized: theme.isATSOptimized
            });
        } else {
            logger.warn('[THEME_MODEL] No default theme available');
        }

        return theme || null;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to get default theme', {
            error: error.message
        });
        return null; // Don't throw - default theme is optional
    }
};

/**
 * Create a new theme (admin only)
 * @param {Object} themeData - Theme data
 * @returns {Promise<Object>} Created theme
 */
export const createTheme = async (themeData) => {
    try {
        const {
            name,
            slug,
            description,
            category,
            config,
            thumbnailURL = null,
            previewURL = null,
            isSystemTheme = true,
            isATSOptimized = false,
            isPublic = true
        } = themeData;

        const validatedName = validateString(name, "Theme Name", { minLength: 1, maxLength: 255 });
        
        // Generate slug if not provided
        const themeSlug = slug || validatedName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);

        // Validate theme config
        let validatedConfig = config;
        if (config) {
            const validation = validateThemeConfig(config);
            if (!validation.valid) {
                throw new AppError(`Invalid theme configuration: ${validation.errors.join(', ')}`, 400);
            }
            // Merge with defaults to ensure complete config
            validatedConfig = {
                layout: { ...DEFAULT_THEME.layout, ...config.layout },
                colors: { ...DEFAULT_THEME.colors, ...config.colors },
                typography: { ...DEFAULT_THEME.typography, ...config.typography },
                sections: { ...DEFAULT_THEME.sections, ...config.sections },
                style: { ...DEFAULT_THEME.style, ...config.style }
            };
        } else {
            validatedConfig = DEFAULT_THEME;
        }

        // Check if slug already exists
        const existing = await db
            .select({ id: resumeThemesTable.id })
            .from(resumeThemesTable)
            .where(eq(resumeThemesTable.slug, themeSlug))
            .limit(1);

        if (existing && existing.length > 0) {
            throw new AppError('Theme slug already exists', 400);
        }

        const [theme] = await db
            .insert(resumeThemesTable)
            .values({
                name: validatedName,
                slug: themeSlug,
                description,
                category: category || 'professional',
                config: validatedConfig,
                thumbnailURL,
                previewURL,
                isSystemTheme,
                isATSOptimized,
                isPublic,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('[THEME_MODEL] ✅ Theme created', {
            themeID: theme.id,
            name: theme.name
        });

        return theme;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to create theme', {
            error: error.message
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create theme: ${error.message}`, 500);
    }
};

/**
 * Update a theme (admin only)
 * @param {number} themeID - Theme ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated theme
 */
export const updateTheme = async (themeID, updateData) => {
    try {
        const validId = validateInteger(themeID, "Theme ID", { min: 1 });

        // Validate theme config if being updated
        if (updateData.config) {
            const validation = validateThemeConfig(updateData.config);
            if (!validation.valid) {
                throw new AppError(`Invalid theme configuration: ${validation.errors.join(', ')}`, 400);
            }
            // Merge with defaults to ensure complete config
            updateData.config = {
                layout: { ...DEFAULT_THEME.layout, ...updateData.config.layout },
                colors: { ...DEFAULT_THEME.colors, ...updateData.config.colors },
                typography: { ...DEFAULT_THEME.typography, ...updateData.config.typography },
                sections: { ...DEFAULT_THEME.sections, ...updateData.config.sections },
                style: { ...DEFAULT_THEME.style, ...updateData.config.style }
            };
        }

        // Validate name if being updated
        if (updateData.name) {
            updateData.name = validateString(updateData.name, "Theme Name", { minLength: 1, maxLength: 255 });
            // Generate slug if name is being updated and no slug provided
            if (!updateData.slug) {
                updateData.slug = updateData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .substring(0, 100);
            }
        }

        // Check if slug exists for another theme
        if (updateData.slug) {
            const existingSlug = await db
                .select({ id: resumeThemesTable.id })
                .from(resumeThemesTable)
                .where(and(
                    eq(resumeThemesTable.slug, updateData.slug),
                    sql`${resumeThemesTable.id} != ${validId}`
                ))
                .limit(1);

            if (existingSlug && existingSlug.length > 0) {
                throw new AppError('Theme slug already exists', 400);
            }
        }

        const [updated] = await db
            .update(resumeThemesTable)
            .set({
                ...updateData,
                updatedAt: new Date()
            })
            .where(eq(resumeThemesTable.id, validId))
            .returning();

        if (!updated) {
            throw new AppError('Theme not found', 404);
        }

        logger.info('[THEME_MODEL] ✅ Theme updated', {
            themeID: updated.id,
            name: updated.name
        });

        return updated;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to update theme', {
            error: error.message,
            themeID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update theme: ${error.message}`, 500);
    }
};

/**
 * Delete a theme (admin only) - hard delete
 * Note: User themes referencing this will have themeID set to null (cascade)
 * @param {number} themeID - Theme ID
 * @returns {Promise<Object>} Deleted theme
 */
export const deleteTheme = async (themeID) => {
    try {
        const validId = validateInteger(themeID, "Theme ID", { min: 1 });

        const [deleted] = await db
            .delete(resumeThemesTable)
            .where(eq(resumeThemesTable.id, validId))
            .returning();

        if (!deleted) {
            throw new AppError('Theme not found', 404);
        }

        logger.info('[THEME_MODEL] ✅ Theme deleted', {
            themeID: deleted.id,
            name: deleted.name
        });

        return deleted;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to delete theme', {
            error: error.message,
            themeID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to delete theme: ${error.message}`, 500);
    }
};

/**
 * List all themes for admin (including non-public)
 * @param {Object} options - Options including pagination, filters, search
 * @returns {Promise<Object>} Object with themes array and pagination info
 */
export const listAllThemesAdmin = async (options = {}) => {
    try {
        const { 
            category, 
            isATSOptimized, 
            isPublic,
            search, 
            page = 1, 
            limit = 20 
        } = options;
        const offset = (page - 1) * limit;

        const conditions = [];

        if (category) {
            conditions.push(eq(resumeThemesTable.category, category));
        }
        if (typeof isATSOptimized === 'boolean') {
            conditions.push(eq(resumeThemesTable.isATSOptimized, isATSOptimized));
        }
        if (typeof isPublic === 'boolean') {
            conditions.push(eq(resumeThemesTable.isPublic, isPublic));
        }
        if (search) {
            conditions.push(or(
                ilike(resumeThemesTable.name, `%${search}%`),
                ilike(resumeThemesTable.description, `%${search}%`)
            ));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const themes = await db
            .select()
            .from(resumeThemesTable)
            .where(whereClause)
            .orderBy(desc(resumeThemesTable.usageCount), desc(resumeThemesTable.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ total }] = await db
            .select({ total: count() })
            .from(resumeThemesTable)
            .where(whereClause);

        logger.info('[THEME_MODEL] ✅ Admin fetched themes', { count: themes.length, total });

        return {
            data: themes,
            pagination: {
                page,
                limit,
                total: Number(total),
                totalPages: Math.ceil(Number(total) / limit)
            }
        };
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to list themes for admin', {
            error: error.message
        });
        throw new AppError(`Failed to list themes: ${error.message}`, 500);
    }
};

/**
 * Increment theme usage count
 * @param {number} themeID - Theme ID
 */
export const incrementThemeUsage = async (themeID) => {
    try {
        await db
            .update(resumeThemesTable)
            .set({
                usageCount: db.raw`"usageCount" + 1`,
                updatedAt: new Date()
            })
            .where(eq(resumeThemesTable.id, themeID));
    } catch (error) {
        // Non-critical, just log
        logger.warn('[THEME_MODEL] Failed to increment usage count', {
            error: error.message,
            themeID
        });
    }
};

// ========== USER THEME OPERATIONS ==========

/**
 * Apply a theme to a resume
 * @param {number} userID - User ID
 * @param {number} resumeContentID - Resume content ID
 * @param {number} themeID - Theme ID to apply
 * @param {Object} customOverrides - Optional custom overrides
 * @returns {Promise<Object>} Created/updated user theme
 */
export const applyTheme = async (userID, resumeContentID, themeID, customOverrides = null) => {
    try {
        logger.info('[THEME_MODEL] Applying theme to resume', {
            userID,
            resumeContentID,
            themeID
        });

        // Verify resume content belongs to user
        const content = await db
            .select({ id: resumeContentTable.id })
            .from(resumeContentTable)
            .where(
                and(
                    eq(resumeContentTable.id, resumeContentID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (!content || content.length === 0) {
            throw new AppError('Resume content not found or unauthorized', 404);
        }

        // Verify theme exists
        await getThemeByID(themeID);

        // Check if user already has a theme for this resume
        const existing = await db
            .select()
            .from(userResumeThemeTable)
            .where(
                and(
                    eq(userResumeThemeTable.resumeContentID, resumeContentID),
                    eq(userResumeThemeTable.userID, userID)
                )
            )
            .limit(1);

        let userTheme;

        if (existing && existing.length > 0) {
            // Update existing - when changing themes, reset customOverrides unless explicitly provided
            // This is important because old customOverrides may not be compatible with new theme
            const isChangingTheme = existing[0].themeID !== themeID;
            
            [userTheme] = await db
                .update(userResumeThemeTable)
                .set({
                    themeID,
                    // Reset customOverrides when changing themes (unless new overrides are provided)
                    // Keep existing overrides only if staying on same theme and no new overrides given
                    customOverrides: isChangingTheme ? (customOverrides || null) : (customOverrides || existing[0].customOverrides),
                    // Also reset section settings when changing themes
                    sectionVisibility: isChangingTheme ? null : existing[0].sectionVisibility,
                    sectionOrder: isChangingTheme ? null : existing[0].sectionOrder,
                    updatedAt: new Date()
                })
                .where(eq(userResumeThemeTable.id, existing[0].id))
                .returning();
        } else {
            // Create new
            [userTheme] = await db
                .insert(userResumeThemeTable)
                .values({
                    userID,
                    resumeContentID,
                    themeID,
                    customOverrides,
                    isDraft: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .returning();

            // Increment theme usage
            await incrementThemeUsage(themeID);
        }

        logger.info('[THEME_MODEL] ✅ Theme applied', {
            userThemeID: userTheme.id
        });

        return userTheme;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to apply theme', {
            error: error.message,
            resumeContentID,
            themeID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to apply theme: ${error.message}`, 500);
    }
};

/**
 * Get user's applied theme for a resume
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object|null>} User theme with base theme config
 */
export const getUserTheme = async (resumeContentID, userID) => {
    try {
        const userTheme = await db
            .select({
                id: userResumeThemeTable.id,
                themeID: userResumeThemeTable.themeID,
                customOverrides: userResumeThemeTable.customOverrides,
                sectionVisibility: userResumeThemeTable.sectionVisibility,
                sectionOrder: userResumeThemeTable.sectionOrder,
                isDraft: userResumeThemeTable.isDraft,
                createdAt: userResumeThemeTable.createdAt,
                updatedAt: userResumeThemeTable.updatedAt,
                // Theme fields
                themeName: resumeThemesTable.name,
                themeSlug: resumeThemesTable.slug,
                themeCategory: resumeThemesTable.category,
                themeConfig: resumeThemesTable.config,
                isATSOptimized: resumeThemesTable.isATSOptimized
            })
            .from(userResumeThemeTable)
            .leftJoin(resumeThemesTable, eq(userResumeThemeTable.themeID, resumeThemesTable.id))
            .where(
                and(
                    eq(userResumeThemeTable.resumeContentID, resumeContentID),
                    eq(userResumeThemeTable.userID, userID)
                )
            )
            .limit(1);

        if (!userTheme || userTheme.length === 0) {
            return null;
        }

        return userTheme[0];
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to fetch user theme', {
            error: error.message,
            resumeContentID
        });
        throw new AppError(`Failed to fetch user theme: ${error.message}`, 500);
    }
};

/**
 * Update user's theme customizations
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated user theme
 */
export const updateUserTheme = async (resumeContentID, userID, updates) => {
    try {
        logger.info('[THEME_MODEL] Updating user theme', {
            resumeContentID,
            updateFields: Object.keys(updates)
        });

        const existing = await db
            .select()
            .from(userResumeThemeTable)
            .where(
                and(
                    eq(userResumeThemeTable.resumeContentID, resumeContentID),
                    eq(userResumeThemeTable.userID, userID)
                )
            )
            .limit(1);

        if (!existing || existing.length === 0) {
            throw new AppError('User theme not found. Apply a theme first.', 404);
        }

        // Handle customOverrides merge
        let customOverrides = updates.customOverrides;
        if (customOverrides && existing[0].customOverrides) {
            customOverrides = {
                ...existing[0].customOverrides,
                ...customOverrides
            };
        }

        const [updated] = await db
            .update(userResumeThemeTable)
            .set({
                ...updates,
                customOverrides: customOverrides || existing[0].customOverrides,
                updatedAt: new Date()
            })
            .where(eq(userResumeThemeTable.id, existing[0].id))
            .returning();

        logger.info('[THEME_MODEL] ✅ User theme updated', {
            userThemeID: updated.id
        });

        return updated;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to update user theme', {
            error: error.message,
            resumeContentID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update user theme: ${error.message}`, 500);
    }
};

/**
 * Restore a full theme configuration from a snapshot (used when switching rewrite versions)
 * This updates the userResumeThemeTable only, NOT the actual theme definitions
 * @param {number} userID - User ID
 * @param {number} resumeContentID - Resume content ID  
 * @param {Object} themeSnapshot - Full theme snapshot with themeID, customOverrides, sectionVisibility, sectionOrder
 * @returns {Promise<Object>} Updated user theme
 */
export const restoreThemeFromSnapshot = async (userID, resumeContentID, themeSnapshot) => {
    try {
        if (!themeSnapshot || !themeSnapshot.themeID) {
            logger.warn('[THEME_MODEL] No theme snapshot to restore', { resumeContentID });
            return null;
        }

        logger.info('[THEME_MODEL] Restoring theme from snapshot', {
            userID,
            resumeContentID,
            themeID: themeSnapshot.themeID,
            themeName: themeSnapshot.themeName
        });

        // Check if user already has a theme for this resume
        const existing = await db
            .select()
            .from(userResumeThemeTable)
            .where(
                and(
                    eq(userResumeThemeTable.resumeContentID, resumeContentID),
                    eq(userResumeThemeTable.userID, userID)
                )
            )
            .limit(1);

        let userTheme;

        if (existing && existing.length > 0) {
            // Update existing with full snapshot config
            [userTheme] = await db
                .update(userResumeThemeTable)
                .set({
                    themeID: themeSnapshot.themeID,
                    customOverrides: themeSnapshot.customOverrides || null,
                    sectionVisibility: themeSnapshot.sectionVisibility || null,
                    sectionOrder: themeSnapshot.sectionOrder || null,
                    updatedAt: new Date()
                })
                .where(eq(userResumeThemeTable.id, existing[0].id))
                .returning();
        } else {
            // Create new with full snapshot config
            [userTheme] = await db
                .insert(userResumeThemeTable)
                .values({
                    userID,
                    resumeContentID,
                    themeID: themeSnapshot.themeID,
                    customOverrides: themeSnapshot.customOverrides || null,
                    sectionVisibility: themeSnapshot.sectionVisibility || null,
                    sectionOrder: themeSnapshot.sectionOrder || null,
                    isDraft: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .returning();
        }

        logger.info('[THEME_MODEL] ✅ Theme restored from snapshot', {
            userThemeID: userTheme.id,
            themeID: themeSnapshot.themeID
        });

        return userTheme;
    } catch (error) {
        logger.error('[THEME_MODEL] Failed to restore theme from snapshot', {
            error: error.message,
            resumeContentID
        });
        // Non-critical - don't throw, just return null
        return null;
    }
};

/**
 * Publish user's resume (mark as not draft)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Updated user theme
 */
export const publishResume = async (resumeContentID, userID) => {
    try {
        const [updated] = await db
            .update(userResumeThemeTable)
            .set({
                isDraft: false,
                publishedAt: new Date(),
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(userResumeThemeTable.resumeContentID, resumeContentID),
                    eq(userResumeThemeTable.userID, userID)
                )
            )
            .returning();

        if (!updated) {
            throw new AppError('User theme not found', 404);
        }

        return updated;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to publish resume: ${error.message}`, 500);
    }
};

export default {
    // Theme operations (public)
    getAllThemes,
    getThemeByID,
    getThemeBySlug,
    getThemesByCategory,
    getDefaultTheme,
    incrementThemeUsage,
    // Admin theme operations
    createTheme,
    updateTheme,
    deleteTheme,
    listAllThemesAdmin,
    // User theme operations
    applyTheme,
    getUserTheme,
    updateUserTheme,
    restoreThemeFromSnapshot,
    publishResume
};
