import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, isNull } from "drizzle-orm";
import logger from "../middleware/logger.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
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
 * @returns {Promise<Object>} Created resume content
 */
export const createResumeContent = async (userID, analysisID, contentData) => {
    try {
        logger.info('[RESUME_MODEL] Creating resume content from analysis', {
            userID,
            analysisID
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
                version: 1,
                lastEditType: 'initial',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('[RESUME_MODEL] ✅ Resume content created', {
            contentID: content.id,
            analysisID
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
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of resume contents
 */
export const getAllResumeContents = async (userID, filters = {}) => {
    try {
        logger.info('[RESUME_MODEL] Fetching all resume contents for user', { userID, filters });

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
            .where(eq(resumeContentTable.userID, userID))
            .orderBy(desc(resumeContentTable.updatedAt))
            .limit(filters.limit || 50);

        logger.info('[RESUME_MODEL] ✅ Fetched resume contents', { count: contents.length });
        return contents;
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
 * Create a new rewrite job
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {number} resumeContentID - Resume content ID
 * @param {Object} options - Rewrite options
 * @returns {Promise<Object>} Created rewrite record
 */
export const createRewrite = async (userID, analysisID, resumeContentID, options = {}) => {
    try {
        logger.info('[RESUME_MODEL] Creating rewrite', {
            userID,
            analysisID,
            resumeContentID
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
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('[RESUME_MODEL] ✅ Rewrite created', {
            rewriteID: rewrite.id,
            version: nextVersion
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
 * @returns {Promise<Array>} List of rewrites
 */
export const getRewritesByAnalysisID = async (analysisID, userID) => {
    try {
        logger.info('[RESUME_MODEL] Fetching rewrites for analysis', { analysisID, userID });

        const rewrites = await db
            .select()
            .from(resumeRewritesTable)
            .where(
                and(
                    eq(resumeRewritesTable.analysisID, analysisID),
                    eq(resumeRewritesTable.userID, userID)
                )
            )
            .orderBy(desc(resumeRewritesTable.versionNumber));

        logger.info('[RESUME_MODEL] ✅ Fetched rewrites', { count: rewrites.length });
        return rewrites;
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
 * Apply a rewrite to resume content
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

        // Mark this rewrite as active
        await db
            .update(resumeRewritesTable)
            .set({
                isActive: true,
                appliedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(resumeRewritesTable.id, rewriteID));

        // Get current resume content version
        const currentContent = await getResumeContentByAnalysisID(rewrite.analysisID, userID);
        
        if (!currentContent) {
            throw new AppError('Resume content not found', 404);
        }

        // Update resume content with rewritten data
        const [updatedContent] = await db
            .update(resumeContentTable)
            .set({
                personalInfo: content.personalInfo || currentContent.personalInfo,
                summary: content.summary || currentContent.summary,
                experience: content.experience || currentContent.experience,
                education: content.education || currentContent.education,
                skills: content.skills || currentContent.skills,
                additionalSections: content.additionalSections || currentContent.additionalSections,
                currentScores: content.scores || currentContent.currentScores,
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
            newVersion: updatedContent.version
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
    getAnalysisDataForRewrite
};
