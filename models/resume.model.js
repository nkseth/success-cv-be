import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, asc, isNull, inArray, gte, lte, or, ilike, count } from "drizzle-orm";
import logger from "../middleware/logger.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import { 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy 
} from "../utils/pagination-filter.js";
import {
    resumeContentTable,
    resumeRewritesTable,
    analysisTable,
    processedAndRawDataTable,
    userDocumentTable
} from "../drizzle/schema.js";

// ========== RESUME CONTENT OPERATIONS ==========

/**
 * Create initial resume content from analysis data
 * Called after analysis is completed
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} contentData - Parsed resume content from analysis
 * @param {Object} analysisReport - Analysis report with issues and improvements (optional)
 * @returns {Promise<Object>} Created resume content
 */
export const createResumeContent = async (userID, analysisID, contentData, analysisReport = null) => {
    try {
        logger.info('[RESUME_MODEL] Creating resume content from analysis', {
            userID,
            analysisID,
            hasAnalysisReport: !!analysisReport
        });

        // Check if content already exists for this analysis
        const existing = await db
            .select({ id: resumeContentTable.id })
            .from(resumeContentTable)
            .where(
                and(
                    eq(resumeContentTable.analysisID, analysisID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (existing && existing.length > 0) {
            logger.warn('[RESUME_MODEL] Resume content already exists for analysis', {
                analysisID,
                existingID: existing[0].id
            });
            return await getResumeContentByID(existing[0].id, userID);
        }

        // Structure the content
        const {
            personalInfo = {},
            summary = {},
            experience = [],
            education = [],
            skills = {},
            additionalSections = [],
            scores = {}
        } = contentData;

        const [content] = await db
            .insert(resumeContentTable)
            .values({
                userID,
                analysisID,
                personalInfo,
                summary,
                experience,
                education,
                skills,
                additionalSections,
                currentScores: scores,
                analysisReport: analysisReport, // Embed initial analysis report
                version: 1,
                lastEditType: 'initial',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('[RESUME_MODEL] ✅ Resume content created', {
            contentID: content.id,
            analysisID,
            hasAnalysisReport: !!analysisReport
        });

        return content;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to create resume content', {
            error: error.message,
            userID,
            analysisID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create resume content: ${error.message}`, 500);
    }
};

/**
 * Get resume content by ID
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID for authorization
 * @returns {Promise<Object>} Resume content with related data
 */
export const getResumeContentByID = async (contentID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Fetching resume content', { contentID, userID });

        const content = await db
            .select({
                // Content fields
                id: resumeContentTable.id,
                userID: resumeContentTable.userID,
                analysisID: resumeContentTable.analysisID,
                personalInfo: resumeContentTable.personalInfo,
                summary: resumeContentTable.summary,
                experience: resumeContentTable.experience,
                education: resumeContentTable.education,
                skills: resumeContentTable.skills,
                additionalSections: resumeContentTable.additionalSections,
                currentScores: resumeContentTable.currentScores,
                analysisReport: resumeContentTable.analysisReport,
                version: resumeContentTable.version,
                lastEditType: resumeContentTable.lastEditType,
                lastEditedSection: resumeContentTable.lastEditedSection,
                activeRewriteID: resumeContentTable.activeRewriteID,
                createdAt: resumeContentTable.createdAt,
                updatedAt: resumeContentTable.updatedAt,
                // Document fields
                documentID: userDocumentTable.id,
                documentTitle: userDocumentTable.title,
                fileURL: userDocumentTable.fileURL
            })
            .from(resumeContentTable)
            .innerJoin(analysisTable, eq(resumeContentTable.analysisID, analysisTable.id))
            .innerJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .where(
                and(
                    eq(resumeContentTable.id, contentID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (!content || content.length === 0) {
            throw new AppError('Resume content not found or unauthorized', 404);
        }

        return content[0];
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch resume content', {
            error: error.message,
            contentID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch resume content: ${error.message}`, 500);
    }
};

/**
 * Get resume content by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID for authorization
 * @returns {Promise<Object|null>} Resume content or null
 */
export const getResumeContentByAnalysisID = async (analysisID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Fetching resume content by analysis', { analysisID, userID });

        const content = await db
            .select()
            .from(resumeContentTable)
            .where(
                and(
                    eq(resumeContentTable.analysisID, analysisID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (!content || content.length === 0) {
            return null;
        }

        return content[0];
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch resume content by analysis', {
            error: error.message,
            analysisID
        });
        throw new AppError(`Failed to fetch resume content: ${error.message}`, 500);
    }
};

/**
 * Get all resume contents for a user
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, search, sort
 * @returns {Promise<Object>} Object with resumes array and totalCount
 */
export const getAllResumeContents = async (userID, options = {}) => {
    try {
        const {
            pagination = { limit: 10, offset: 0 },
            filters = {},
            search = { query: '', fields: [] },
            sort = { field: 'updatedAt', order: 'desc' }
        } = options;

        logger.info('[RESUME_MODEL] Fetching all resume contents for user', { userID, options });

        // Build base where conditions
        const whereConditions = [eq(resumeContentTable.userID, userID)];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            resumeContentTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Add search condition (search in document title or personal info)
        const searchCondition = buildSearchCondition(
            search.query,
            [userDocumentTable.title],
            { or, ilike }
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(resumeContentTable)
            .innerJoin(analysisTable, eq(resumeContentTable.analysisID, analysisTable.id))
            .innerJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, resumeContentTable, { asc, desc });

        // Fetch paginated contents
        const contents = await db
            .select({
                id: resumeContentTable.id,
                analysisID: resumeContentTable.analysisID,
                personalInfo: resumeContentTable.personalInfo,
                currentScores: resumeContentTable.currentScores,
                version: resumeContentTable.version,
                lastEditType: resumeContentTable.lastEditType,
                createdAt: resumeContentTable.createdAt,
                updatedAt: resumeContentTable.updatedAt,
                documentID: userDocumentTable.id,
                documentTitle: userDocumentTable.title
            })
            .from(resumeContentTable)
            .innerJoin(analysisTable, eq(resumeContentTable.analysisID, analysisTable.id))
            .innerJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        logger.info('[RESUME_MODEL] ✅ Fetched resume contents', { count: contents.length, totalCount });
        return { resumes: contents, totalCount };
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch resume contents', {
            error: error.message,
            userID
        });
        throw new AppError(`Failed to fetch resume contents: ${error.message}`, 500);
    }
};

/**
 * Update a specific section of resume content
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {string} sectionName - Section to update
 * @param {Object} sectionData - New section data
 * @returns {Promise<Object>} Updated resume content
 */
export const updateResumeSection = async (contentID, userID, sectionName, sectionData) => {
    try {
        logger.info('[RESUME_MODEL] Updating resume section', {
            contentID,
            sectionName
        });

        // Validate section name
        const validSections = ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'];
        if (!validSections.includes(sectionName)) {
            throw new AppError(`Invalid section name: ${sectionName}`, 400);
        }

        // Verify ownership
        const existing = await db
            .select({ id: resumeContentTable.id, version: resumeContentTable.version })
            .from(resumeContentTable)
            .where(
                and(
                    eq(resumeContentTable.id, contentID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (!existing || existing.length === 0) {
            throw new AppError('Resume content not found or unauthorized', 404);
        }

        // Build update object dynamically
        const updateData = {
            [sectionName]: sectionData,
            version: existing[0].version + 1,
            lastEditType: 'manual',
            lastEditedSection: sectionName,
            updatedAt: new Date()
        };

        const [updated] = await db
            .update(resumeContentTable)
            .set(updateData)
            .where(eq(resumeContentTable.id, contentID))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Section updated', {
            contentID,
            sectionName,
            newVersion: updated.version
        });

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update section', {
            error: error.message,
            contentID,
            sectionName
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update section: ${error.message}`, 500);
    }
};

/**
 * Update multiple sections at once
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} sectionsData - Object with section names as keys
 * @returns {Promise<Object>} Updated resume content
 */
export const updateMultipleSections = async (contentID, userID, sectionsData) => {
    try {
        logger.info('[RESUME_MODEL] Updating multiple sections', {
            contentID,
            sections: Object.keys(sectionsData)
        });

        // Validate section names
        const validSections = ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'];
        const invalidSections = Object.keys(sectionsData).filter(s => !validSections.includes(s));
        
        if (invalidSections.length > 0) {
            throw new AppError(`Invalid section names: ${invalidSections.join(', ')}`, 400);
        }

        // Verify ownership
        const existing = await db
            .select({ id: resumeContentTable.id, version: resumeContentTable.version })
            .from(resumeContentTable)
            .where(
                and(
                    eq(resumeContentTable.id, contentID),
                    eq(resumeContentTable.userID, userID)
                )
            )
            .limit(1);

        if (!existing || existing.length === 0) {
            throw new AppError('Resume content not found or unauthorized', 404);
        }

        // Build update object
        const updateData = {
            ...sectionsData,
            version: existing[0].version + 1,
            lastEditType: 'manual',
            lastEditedSection: Object.keys(sectionsData).join(','),
            updatedAt: new Date()
        };

        const [updated] = await db
            .update(resumeContentTable)
            .set(updateData)
            .where(eq(resumeContentTable.id, contentID))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Multiple sections updated', {
            contentID,
            newVersion: updated.version
        });

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update sections', {
            error: error.message,
            contentID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update sections: ${error.message}`, 500);
    }
};

/**
 * Update scores after recalculation
 * @param {number} contentID - Resume content ID
 * @param {Object} scores - New scores
 * @returns {Promise<Object>} Updated resume content
 */
export const updateResumeScores = async (contentID, scores) => {
    try {
        const [updated] = await db
            .update(resumeContentTable)
            .set({
                currentScores: scores,
                updatedAt: new Date()
            })
            .where(eq(resumeContentTable.id, contentID))
            .returning();

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update scores', {
            error: error.message,
            contentID
        });
        throw new AppError(`Failed to update scores: ${error.message}`, 500);
    }
};

// ========== REWRITE OPERATIONS ==========

/**
 * Create a new rewrite job with source content snapshot
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {number} resumeContentID - Resume content ID
 * @param {Object} currentContent - Current resume content to snapshot
 * @param {Object} options - Rewrite options
 * @returns {Promise<Object>} Created rewrite record
 */
export const createRewrite = async (userID, analysisID, resumeContentID, currentContent = null, options = {}) => {
    try {
        logger.info('[RESUME_MODEL] Creating rewrite with content snapshot', {
            userID,
            analysisID,
            resumeContentID,
            hasContentSnapshot: !!currentContent
        });

        // Get current version number
        const existingRewrites = await db
            .select({ versionNumber: resumeRewritesTable.versionNumber })
            .from(resumeRewritesTable)
            .where(
                and(
                    eq(resumeRewritesTable.analysisID, analysisID),
                    eq(resumeRewritesTable.userID, userID)
                )
            )
            .orderBy(desc(resumeRewritesTable.versionNumber))
            .limit(1);

        const nextVersion = existingRewrites.length > 0 
            ? existingRewrites[0].versionNumber + 1 
            : 1;

        // Build source content snapshot (captures what AI will optimize from)
        const sourceContentSnapshot = currentContent ? {
            personalInfo: currentContent.personalInfo,
            summary: currentContent.summary,
            experience: currentContent.experience,
            education: currentContent.education,
            skills: currentContent.skills,
            additionalSections: currentContent.additionalSections,
            currentScores: currentContent.currentScores,
            version: currentContent.version,
            snapshotAt: new Date().toISOString()
        } : null;

        const [rewrite] = await db
            .insert(resumeRewritesTable)
            .values({
                userID,
                analysisID,
                resumeContentID,
                status: 'pending',
                versionNumber: nextVersion,
                versionLabel: options.versionLabel || `Rewrite v${nextVersion}`,
                optimizationSettings: options.optimizationSettings || {},
                sourceContentSnapshot,
                isActive: false,
                wasModifiedAfterApply: false,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('[RESUME_MODEL] ✅ Rewrite created with snapshot', {
            rewriteID: rewrite.id,
            version: nextVersion,
            hasSnapshot: !!sourceContentSnapshot
        });

        return rewrite;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to create rewrite', {
            error: error.message,
            userID,
            analysisID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create rewrite: ${error.message}`, 500);
    }
};

/**
 * Get rewrite by ID
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Rewrite record
 */
export const getRewriteByID = async (rewriteID, userID) => {
    try {
        const rewrite = await db
            .select()
            .from(resumeRewritesTable)
            .where(
                and(
                    eq(resumeRewritesTable.id, rewriteID),
                    eq(resumeRewritesTable.userID, userID)
                )
            )
            .limit(1);

        if (!rewrite || rewrite.length === 0) {
            throw new AppError('Rewrite not found or unauthorized', 404);
        }

        return rewrite[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch rewrite: ${error.message}`, 500);
    }
};

/**
 * Get all rewrites for an analysis
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, sort
 * @returns {Promise<Object>} Object with rewrites array and totalCount
 */
export const getRewritesByAnalysisID = async (analysisID, userID, options = {}) => {
    try {
        const {
            pagination = { limit: 10, offset: 0 },
            filters = {},
            sort = { field: 'createdAt', order: 'desc' }
        } = options;

        logger.info('[RESUME_MODEL] Fetching rewrites for analysis', { analysisID, userID, options });

        // Build base where conditions
        const whereConditions = [
            eq(resumeRewritesTable.analysisID, analysisID),
            eq(resumeRewritesTable.userID, userID)
        ];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            resumeRewritesTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(resumeRewritesTable)
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, resumeRewritesTable, { asc, desc });

        // Fetch paginated rewrites
        const rewrites = await db
            .select()
            .from(resumeRewritesTable)
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        logger.info('[RESUME_MODEL] ✅ Fetched rewrites', { count: rewrites.length, totalCount });
        return { rewrites, totalCount };
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch rewrites', {
            error: error.message,
            analysisID
        });
        throw new AppError(`Failed to fetch rewrites: ${error.message}`, 500);
    }
};

/**
 * Update rewrite status and content
 * @param {number} rewriteID - Rewrite ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated rewrite
 */
export const updateRewrite = async (rewriteID, updates) => {
    try {
        const [updated] = await db
            .update(resumeRewritesTable)
            .set({
                ...updates,
                updatedAt: new Date()
            })
            .where(eq(resumeRewritesTable.id, rewriteID))
            .returning();

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update rewrite', {
            error: error.message,
            rewriteID
        });
        throw new AppError(`Failed to update rewrite: ${error.message}`, 500);
    }
};

/**
 * Apply a rewrite to resume content (also handles version switching)
 * This marks the rewrite as active and updates the resume content with rewritten data
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Updated resume content
 */
export const applyRewrite = async (rewriteID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Applying rewrite to content', { rewriteID, userID });

        // Get the rewrite
        const rewrite = await getRewriteByID(rewriteID, userID);

        if (rewrite.status !== 'completed') {
            throw new AppError('Rewrite must be completed before applying', 400);
        }

        if (!rewrite.rewrittenContent) {
            throw new AppError('Rewrite has no content to apply', 400);
        }

        // Parse rewritten content
        const content = typeof rewrite.rewrittenContent === 'string'
            ? JSON.parse(rewrite.rewrittenContent)
            : rewrite.rewrittenContent;

        // Get current resume content
        const currentContent = await getResumeContentByAnalysisID(rewrite.analysisID, userID);
        
        if (!currentContent) {
            throw new AppError('Resume content not found', 404);
        }

        // If there was a previously active rewrite, save the current resume content 
        // back to that rewrite's rewrittenContent to preserve user's edits
        if (currentContent.activeRewriteID && currentContent.activeRewriteID !== rewriteID) {
            // Check if content was modified after the previous rewrite was applied
            const previousRewrite = await db
                .select({ 
                    appliedAt: resumeRewritesTable.appliedAt,
                    rewrittenContent: resumeRewritesTable.rewrittenContent 
                })
                .from(resumeRewritesTable)
                .where(eq(resumeRewritesTable.id, currentContent.activeRewriteID))
                .limit(1);

            if (previousRewrite.length > 0 && previousRewrite[0].appliedAt) {
                // Check if content was modified after the previous rewrite was applied
                const wasModified = currentContent.updatedAt > previousRewrite[0].appliedAt;
                
                // Save current resume content back to the previous rewrite's rewrittenContent
                // This preserves any edits the user made while this version was active
                const currentResumeSnapshot = {
                    personalInfo: currentContent.personalInfo,
                    summary: currentContent.summary,
                    experience: currentContent.experience,
                    education: currentContent.education,
                    skills: currentContent.skills,
                    additionalSections: currentContent.additionalSections,
                    scores: currentContent.currentScores
                };
                
                await db
                    .update(resumeRewritesTable)
                    .set({ 
                        rewrittenContent: currentResumeSnapshot,
                        wasModifiedAfterApply: wasModified, 
                        updatedAt: new Date() 
                    })
                    .where(eq(resumeRewritesTable.id, currentContent.activeRewriteID));
                
                logger.info('[RESUME_MODEL] Saved current content to previous rewrite', {
                    previousRewriteID: currentContent.activeRewriteID,
                    wasModified
                });
            }
        }

        // Deactivate all other rewrites for this analysis
        await db
            .update(resumeRewritesTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
                and(
                    eq(resumeRewritesTable.analysisID, rewrite.analysisID),
                    eq(resumeRewritesTable.userID, userID)
                )
            );

        // Mark this rewrite as active and reset modification flag
        await db
            .update(resumeRewritesTable)
            .set({
                isActive: true,
                appliedAt: new Date(),
                wasModifiedAfterApply: false,
                updatedAt: new Date()
            })
            .where(eq(resumeRewritesTable.id, rewriteID));

        // Get the analysis report from the rewrite (if available)
        const rewriteAnalysisReport = typeof rewrite.analysisReport === 'string'
            ? JSON.parse(rewrite.analysisReport)
            : rewrite.analysisReport;

        // Update resume content with rewritten data and analysis report
        const [updatedContent] = await db
            .update(resumeContentTable)
            .set({
                personalInfo: content.personalInfo || currentContent.personalInfo,
                summary: content.summary || content.professionalSummary || currentContent.summary,
                experience: content.experience || content.workExperience || currentContent.experience,
                education: content.education || currentContent.education,
                skills: content.skills || currentContent.skills,
                additionalSections: content.additionalSections || currentContent.additionalSections,
                currentScores: content.scores || currentContent.currentScores,
                // Update analysis report to show post-rewrite analysis
                analysisReport: rewriteAnalysisReport || currentContent.analysisReport,
                version: currentContent.version + 1,
                lastEditType: 'ai_rewrite',
                activeRewriteID: rewriteID,
                updatedAt: new Date()
            })
            .where(eq(resumeContentTable.id, currentContent.id))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Rewrite applied to content', {
            rewriteID,
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            versionNumber: rewrite.versionNumber
        });

        return updatedContent;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to apply rewrite', {
            error: error.message,
            rewriteID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to apply rewrite: ${error.message}`, 500);
    }
};

/**
 * Switch to a different rewrite version
 * Updates resume content with the selected rewrite's content
 * @param {number} rewriteID - Target rewrite ID to switch to
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Object with updated content and version info
 */
export const switchRewriteVersion = async (rewriteID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Switching rewrite version', { rewriteID, userID });

        // Get target rewrite
        const targetRewrite = await getRewriteByID(rewriteID, userID);

        if (targetRewrite.status !== 'completed') {
            throw new AppError('Cannot switch to an incomplete rewrite version', 400);
        }

        // If already active, just return current state
        if (targetRewrite.isActive) {
            const currentContent = await getResumeContentByAnalysisID(targetRewrite.analysisID, userID);
            return {
                content: currentContent,
                rewrite: targetRewrite,
                message: 'This version is already active'
            };
        }

        // Apply the rewrite (handles all the switching logic)
        const updatedContent = await applyRewrite(rewriteID, userID);

        // Get updated rewrite info
        const updatedRewrite = await getRewriteByID(rewriteID, userID);

        return {
            content: updatedContent,
            rewrite: {
                id: updatedRewrite.id,
                versionNumber: updatedRewrite.versionNumber,
                versionLabel: updatedRewrite.versionLabel,
                isActive: updatedRewrite.isActive,
                appliedAt: updatedRewrite.appliedAt
            },
            message: `Switched to rewrite version ${updatedRewrite.versionNumber}`
        };
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to switch rewrite version', {
            error: error.message,
            rewriteID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to switch rewrite version: ${error.message}`, 500);
    }
};

/**
 * Get the active rewrite for a resume/analysis
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Object|null>} Active rewrite or null
 */
export const getActiveRewrite = async (analysisID, userID) => {
    try {
        const activeRewrite = await db
            .select()
            .from(resumeRewritesTable)
            .where(
                and(
                    eq(resumeRewritesTable.analysisID, analysisID),
                    eq(resumeRewritesTable.userID, userID),
                    eq(resumeRewritesTable.isActive, true)
                )
            )
            .limit(1);

        return activeRewrite.length > 0 ? activeRewrite[0] : null;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to get active rewrite', {
            error: error.message,
            analysisID
        });
        throw new AppError(`Failed to get active rewrite: ${error.message}`, 500);
    }
};

/**
 * Clear active rewrite (revert to original/manual state)
 * This deactivates all rewrites and clears activeRewriteID from content
 * Also restores the initial analysis report
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID  
 * @returns {Promise<Object>} Updated content
 */
export const clearActiveRewrite = async (analysisID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Clearing active rewrite', { analysisID, userID });

        // Get current content
        const currentContent = await getResumeContentByAnalysisID(analysisID, userID);
        
        if (!currentContent) {
            throw new AppError('Resume content not found', 404);
        }

        // Get the original analysis data to restore the initial analysis report
        let initialAnalysisReport = null;
        try {
            const analysisData = await db
                .select({
                    processedData: processedAndRawDataTable.processedData
                })
                .from(processedAndRawDataTable)
                .where(eq(processedAndRawDataTable.analysisID, analysisID))
                .limit(1);

            if (analysisData.length > 0 && analysisData[0].processedData) {
                const parsedData = typeof analysisData[0].processedData === 'string'
                    ? JSON.parse(analysisData[0].processedData)
                    : analysisData[0].processedData;
                
                // Rebuild the initial analysis report structure
                initialAnalysisReport = {
                    criticalMistakes: (parsedData.critical_mistakes || []).map(m => ({
                        issue: m.issue || m.mistake || m,
                        impact: m.impact || 'High - may cause resume rejection',
                        fixSuggestion: m.fix_suggestion || m.suggestion || m.fix || ''
                    })),
                    majorIssues: (parsedData.major_issues || []).map(i => ({
                        issue: i.issue || i,
                        impact: i.impact || 'Medium - reduces resume effectiveness',
                        fixSuggestion: i.fix_suggestion || i.suggestion || i.fix || ''
                    })),
                    minorImprovements: (parsedData.minor_improvements || []).map(i => ({
                        area: i.area || i.section || 'General',
                        suggestion: i.suggestion || i.improvement || i
                    })),
                    resumeQuality: {
                        atsCompatibilityScore: parsedData.resume_quality?.ats_compatibility_score || 0,
                        contentQualityScore: parsedData.resume_quality?.content_quality_score || 0,
                        overallQualityScore: parsedData.resume_quality?.overall_quality_score || 0
                    },
                    version: 'initial',
                    restoredAt: new Date().toISOString()
                };
            }
        } catch (err) {
            logger.warn('[RESUME_MODEL] Could not restore initial analysis report', { error: err.message });
        }

        // Deactivate all rewrites for this analysis
        await db
            .update(resumeRewritesTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
                and(
                    eq(resumeRewritesTable.analysisID, analysisID),
                    eq(resumeRewritesTable.userID, userID)
                )
            );

        // Clear activeRewriteID from content and restore initial analysis report
        const updateData = {
            activeRewriteID: null,
            lastEditType: 'manual',
            version: currentContent.version + 1,
            updatedAt: new Date()
        };
        
        // Only update analysisReport if we were able to restore it
        if (initialAnalysisReport) {
            updateData.analysisReport = initialAnalysisReport;
        }

        const [updatedContent] = await db
            .update(resumeContentTable)
            .set(updateData)
            .where(eq(resumeContentTable.id, currentContent.id))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Active rewrite cleared', {
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            restoredInitialAnalysis: !!initialAnalysisReport
        });

        return updatedContent;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to clear active rewrite', {
            error: error.message,
            analysisID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to clear active rewrite: ${error.message}`, 500);
    }
};

/**
 * Get analysis data needed for creating rewrites
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Analysis data with processed content
 */
export const getAnalysisDataForRewrite = async (analysisID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Fetching analysis data for rewrite', { analysisID, userID });

        const analysisData = await db
            .select({
                analysisID: analysisTable.id,
                analysisStatus: analysisTable.status,
                documentID: userDocumentTable.id,
                documentTitle: userDocumentTable.title,
                fileURL: userDocumentTable.fileURL,
                processedDataID: processedAndRawDataTable.id,
                rawData: processedAndRawDataTable.rawData,
                processedData: processedAndRawDataTable.processedData
            })
            .from(analysisTable)
            .innerJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .innerJoin(processedAndRawDataTable, eq(analysisTable.id, processedAndRawDataTable.analysisID))
            .where(
                and(
                    eq(analysisTable.id, analysisID),
                    eq(analysisTable.userID, userID)
                )
            )
            .limit(1);

        if (!analysisData || analysisData.length === 0) {
            throw new AppError('Analysis not found or unauthorized', 404);
        }

        if (analysisData[0].analysisStatus !== 'completed') {
            throw new AppError('Analysis must be completed before rewriting', 400);
        }

        logger.info('[RESUME_MODEL] ✅ Analysis data fetched successfully');
        return analysisData[0];
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch analysis data', {
            error: error.message,
            analysisID
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch analysis data: ${error.message}`, 500);
    }
};

export default {
    // Content operations
    createResumeContent,
    getResumeContentByID,
    getResumeContentByAnalysisID,
    getAllResumeContents,
    updateResumeSection,
    updateMultipleSections,
    updateResumeScores,
    // Rewrite operations
    createRewrite,
    getRewriteByID,
    getRewritesByAnalysisID,
    updateRewrite,
    applyRewrite,
    switchRewriteVersion,
    getActiveRewrite,
    clearActiveRewrite,
    getAnalysisDataForRewrite
};
