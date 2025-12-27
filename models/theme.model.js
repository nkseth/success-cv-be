import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, like, or } from "drizzle-orm";
import logger from "../middleware/logger.js";
import {
    resumeThemesTable,
    userResumeThemeTable,
    resumeContentTable
} from "../drizzle/schema.js";

// ========== THEME OPERATIONS ==========

/**
 * Get all available themes with optional filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of themes
 */
export const getAllThemes = async (filters = {}) => {
    try {
        const {
            category = null,
            isATSOptimized = null,
            search = null,
            sortBy = 'usageCount',
            sortOrder = 'desc',
            limit = 50,
            offset = 0
        } = filters;

        logger.info('[THEME_MODEL] Fetching themes', { filters });

        let query = db
            .select()
            .from(resumeThemesTable)
            .where(eq(resumeThemesTable.isPublic, true));

        // Build conditions
        const conditions = [eq(resumeThemesTable.isPublic, true)];

        if (category) {
            conditions.push(eq(resumeThemesTable.category, category));
        }

        if (isATSOptimized !== null) {
            conditions.push(eq(resumeThemesTable.isATSOptimized, isATSOptimized));
        }

        if (search) {
            conditions.push(
                or(
                    like(resumeThemesTable.name, `%${search}%`),
                    like(resumeThemesTable.description, `%${search}%`)
                )
            );
        }

        // Apply conditions
        if (conditions.length > 0) {
            query = db
                .select()
                .from(resumeThemesTable)
                .where(and(...conditions));
        }

        // Apply sorting and pagination
        const themes = await query
            .orderBy(sortOrder === 'desc' ? desc(resumeThemesTable[sortBy] || resumeThemesTable.usageCount) : resumeThemesTable[sortBy])
            .limit(limit)
            .offset(offset);

        logger.info('[THEME_MODEL] ✅ Fetched themes', { count: themes.length });
        return themes;
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

        // Check if slug already exists
        const existing = await db
            .select({ id: resumeThemesTable.id })
            .from(resumeThemesTable)
            .where(eq(resumeThemesTable.slug, slug))
            .limit(1);

        if (existing && existing.length > 0) {
            throw new AppError('Theme slug already exists', 400);
        }

        const [theme] = await db
            .insert(resumeThemesTable)
            .values({
                name,
                slug,
                description,
                category,
                config,
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
            // Update existing
            [userTheme] = await db
                .update(userResumeThemeTable)
                .set({
                    themeID,
                    customOverrides: customOverrides || existing[0].customOverrides,
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
    // Theme operations
    getAllThemes,
    getThemeByID,
    getThemeBySlug,
    getThemesByCategory,
    createTheme,
    incrementThemeUsage,
    // User theme operations
    applyTheme,
    getUserTheme,
    updateUserTheme,
    publishResume
};
