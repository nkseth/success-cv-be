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
    userDocumentTable,
    candidateResumeContentTable,
    candidateResumeRewritesTable,
    candidateAnalysisTable,
    candidateProcessedAndRawDataTable,
    candidateDocumentTable
} from "../drizzle/schema.js";
import { getUserTheme, restoreThemeFromSnapshot } from "./theme.model.js";
import { getDynamicTables, isCandidate as checkIsCandidate } from "../utils/dynamic-tables.js";
import { userTypeConstants } from "../utils/constants.js";

// ========== DYNAMIC TABLE HELPERS ==========

/**
 * Get the appropriate tables based on user type
 * This allows the same model functions to work for both users and candidates
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} Object containing appropriate tables
 */
const getTablesForUserType = (userType) => {
    const isCandidateUser = checkIsCandidate(userType);
    return {
        contentTable: isCandidateUser ? candidateResumeContentTable : resumeContentTable,
        rewritesTable: isCandidateUser ? candidateResumeRewritesTable : resumeRewritesTable,
        analysisTable: isCandidateUser ? candidateAnalysisTable : analysisTable,
        processedDataTable: isCandidateUser ? candidateProcessedAndRawDataTable : processedAndRawDataTable,
        documentTable: isCandidateUser ? candidateDocumentTable : userDocumentTable,
        entityIDColumn: isCandidateUser ? 'candidateID' : 'userID',
        isCandidate: isCandidateUser
    };
};

// ========== RESUME CONTENT OPERATIONS ==========

/**
 * Create initial resume content from analysis data
 * Called after analysis is completed
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} contentData - Parsed resume content from analysis
 * @param {Object} analysisSummary - Lightweight summary of analysis issues (optional)
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Created resume content
 */
export const createResumeContent = async (userID, analysisID, contentData, analysisSummary = null, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Creating resume content from analysis', {
            userID,
            analysisID,
            hasAnalysisSummary: !!analysisSummary,
            userType
        });

        // Check if content already exists for this analysis
        const existing = await db
            .select({ id: tables.contentTable.id })
            .from(tables.contentTable)
            .where(
                and(
                    eq(tables.contentTable.analysisID, analysisID),
                    eq(tables.contentTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (existing && existing.length > 0) {
            logger.warn('[RESUME_MODEL] Resume content already exists for analysis', {
                analysisID,
                existingID: existing[0].id
            });
            return await getResumeContentByID(existing[0].id, userID, userType);
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

        const insertValues = {
            [entityIDField]: userID,
            analysisID,
            personalInfo,
            summary,
            experience,
            education,
            skills,
            additionalSections,
            currentScores: scores,
            analysisSummary: analysisSummary, // Lightweight summary of analysis issues
            version: 1,
            lastEditType: 'initial',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const [content] = await db
            .insert(tables.contentTable)
            .values(insertValues)
            .returning();

        logger.info('[RESUME_MODEL] ✅ Resume content created', {
            contentID: content.id,
            analysisID,
            hasAnalysisSummary: !!analysisSummary,
            userType
        });

        return content;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to create resume content', {
            error: error.message,
            userID,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create resume content: ${error.message}`, 500);
    }
};

/**
 * Get resume content by ID
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID for authorization
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Resume content with related data
 */
export const getResumeContentByID = async (contentID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Fetching resume content', { contentID, userID, userType });

        const content = await db
            .select({
                // Content fields
                id: tables.contentTable.id,
                userID: tables.contentTable[entityIDField],
                analysisID: tables.contentTable.analysisID,
                personalInfo: tables.contentTable.personalInfo,
                summary: tables.contentTable.summary,
                experience: tables.contentTable.experience,
                education: tables.contentTable.education,
                skills: tables.contentTable.skills,
                additionalSections: tables.contentTable.additionalSections,
                currentScores: tables.contentTable.currentScores,
                analysisSummary: tables.contentTable.analysisSummary,
                version: tables.contentTable.version,
                lastEditType: tables.contentTable.lastEditType,
                lastEditedSection: tables.contentTable.lastEditedSection,
                activeRewriteID: tables.contentTable.activeRewriteID,
                createdAt: tables.contentTable.createdAt,
                updatedAt: tables.contentTable.updatedAt,
                // Document fields
                documentID: tables.documentTable.id,
                documentTitle: tables.documentTable.title,
                fileURL: tables.documentTable.fileURL
            })
            .from(tables.contentTable)
            .innerJoin(tables.analysisTable, eq(tables.contentTable.analysisID, tables.analysisTable.id))
            .innerJoin(tables.documentTable, eq(tables.analysisTable.documentID, tables.documentTable.id))
            .where(
                and(
                    eq(tables.contentTable.id, contentID),
                    eq(tables.contentTable[entityIDField], userID)
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
            contentID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch resume content: ${error.message}`, 500);
    }
};

/**
 * Get resume content by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID for authorization
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object|null>} Resume content or null
 */
export const getResumeContentByAnalysisID = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Fetching resume content by analysis', { analysisID, userID, userType });

        const content = await db
            .select()
            .from(tables.contentTable)
            .where(
                and(
                    eq(tables.contentTable.analysisID, analysisID),
                    eq(tables.contentTable[entityIDField], userID)
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
            analysisID,
            userType
        });
        throw new AppError(`Failed to fetch resume content: ${error.message}`, 500);
    }
};

/**
 * Get all resume contents for a user
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, search, sort, userType
 * @returns {Promise<Object>} Object with resumes array and totalCount
 */
export const getAllResumeContents = async (userID, options = {}) => {
    try {
        const {
            pagination = { limit: 10, offset: 0 },
            filters = {},
            search = { query: '', fields: [] },
            sort = { field: 'updatedAt', order: 'desc' },
            userType = userTypeConstants.USER
        } = options;

        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';

        logger.info('[RESUME_MODEL] Fetching all resume contents for user', { userID, options, userType });

        // Build base where conditions
        const whereConditions = [eq(tables.contentTable[entityIDField], userID)];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            tables.contentTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Add search condition (search in document title or personal info)
        const searchCondition = buildSearchCondition(
            search.query,
            [tables.documentTable.title],
            { or, ilike }
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(tables.contentTable)
            .innerJoin(tables.analysisTable, eq(tables.contentTable.analysisID, tables.analysisTable.id))
            .innerJoin(tables.documentTable, eq(tables.analysisTable.documentID, tables.documentTable.id))
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, tables.contentTable, { asc, desc });

        // Check if sorting by atsScore (which is in JSON currentScores field)
        const sortingByAtsScore = sort.field === 'atsScore';
        
        let contents;
        if (sortingByAtsScore) {
            // Fetch all matching records for in-memory sorting
            contents = await db
                .select({
                    id: tables.contentTable.id,
                    analysisID: tables.contentTable.analysisID,
                    personalInfo: tables.contentTable.personalInfo,
                    currentScores: tables.contentTable.currentScores,
                    version: tables.contentTable.version,
                    lastEditType: tables.contentTable.lastEditType,
                    createdAt: tables.contentTable.createdAt,
                    updatedAt: tables.contentTable.updatedAt,
                    documentID: tables.documentTable.id,
                    documentTitle: tables.documentTable.title,
                    analysisStatus: tables.analysisTable.status,
                    analysisCompletedAt: tables.analysisTable.completedAt
                })
                .from(tables.contentTable)
                .innerJoin(tables.analysisTable, eq(tables.contentTable.analysisID, tables.analysisTable.id))
                .innerJoin(tables.documentTable, eq(tables.analysisTable.documentID, tables.documentTable.id))
                .where(and(...whereConditions));
        } else {
            // Fetch paginated contents with SQL sorting
            contents = await db
                .select({
                    id: tables.contentTable.id,
                    analysisID: tables.contentTable.analysisID,
                    personalInfo: tables.contentTable.personalInfo,
                    currentScores: tables.contentTable.currentScores,
                    version: tables.contentTable.version,
                    lastEditType: tables.contentTable.lastEditType,
                    createdAt: tables.contentTable.createdAt,
                    updatedAt: tables.contentTable.updatedAt,
                    documentID: tables.documentTable.id,
                    documentTitle: tables.documentTable.title,
                    analysisStatus: tables.analysisTable.status,
                    analysisCompletedAt: tables.analysisTable.completedAt
                })
                .from(tables.contentTable)
                .innerJoin(tables.analysisTable, eq(tables.contentTable.analysisID, tables.analysisTable.id))
                .innerJoin(tables.documentTable, eq(tables.analysisTable.documentID, tables.documentTable.id))
                .where(and(...whereConditions))
                .orderBy(...orderByClause)
                .limit(pagination.limit)
                .offset(pagination.offset);
        }

        // Format the results to extract scores and add status/completedAt
        const formattedContents = contents.map(content => {
            let scores = null;
            let atsScore = null;
            
            if (content.currentScores) {
                scores = typeof content.currentScores === 'string' 
                    ? JSON.parse(content.currentScores) 
                    : content.currentScores;
                atsScore = scores?.atsScore || null;
            }
            
            return {
                id: content.id,
                analysisID: content.analysisID,
                personalInfo: content.personalInfo,
                scores, // Parsed scores object
                atsScore, // Extracted for sorting/filtering
                version: content.version,
                lastEditType: content.lastEditType,
                createdAt: content.createdAt,
                updatedAt: content.updatedAt,
                completedAt: content.analysisCompletedAt,
                status: content.analysisStatus,
                document: {
                    id: content.documentID,
                    title: content.documentTitle
                }
            };
        });

        // If sorting by atsScore, sort in memory and apply pagination
        let paginatedContents = formattedContents;
        if (sortingByAtsScore) {
            // Sort by atsScore (handle null values by placing them at the end)
            paginatedContents.sort((a, b) => {
                const scoreA = a.atsScore ?? -Infinity;
                const scoreB = b.atsScore ?? -Infinity;
                
                if (sort.order === 'asc') {
                    return scoreA === -Infinity ? 1 : scoreB === -Infinity ? -1 : scoreA - scoreB;
                } else {
                    return scoreB === -Infinity ? 1 : scoreA === -Infinity ? -1 : scoreB - scoreA;
                }
            });

            // Apply pagination after sorting
            paginatedContents = paginatedContents.slice(pagination.offset, pagination.offset + pagination.limit);
        }

        logger.info('[RESUME_MODEL] ✅ Fetched resume contents', { count: paginatedContents.length, totalCount, userType });
        return { resumes: paginatedContents, totalCount };
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated resume content
 */
export const updateResumeSection = async (contentID, userID, sectionName, sectionData, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Updating resume section', {
            contentID,
            sectionName,
            userType
        });

        // Validate section name
        const validSections = ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'];
        if (!validSections.includes(sectionName)) {
            throw new AppError(`Invalid section name: ${sectionName}`, 400);
        }

        // Verify ownership
        const existing = await db
            .select({ id: tables.contentTable.id, version: tables.contentTable.version })
            .from(tables.contentTable)
            .where(
                and(
                    eq(tables.contentTable.id, contentID),
                    eq(tables.contentTable[entityIDField], userID)
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
            .update(tables.contentTable)
            .set(updateData)
            .where(eq(tables.contentTable.id, contentID))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Section updated', {
            contentID,
            sectionName,
            newVersion: updated.version,
            userType
        });

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update section', {
            error: error.message,
            contentID,
            sectionName,
            userType
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated resume content
 */
export const updateMultipleSections = async (contentID, userID, sectionsData, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Updating multiple sections', {
            contentID,
            sections: Object.keys(sectionsData),
            userType
        });

        // Validate section names
        const validSections = ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'];
        const invalidSections = Object.keys(sectionsData).filter(s => !validSections.includes(s));
        
        if (invalidSections.length > 0) {
            throw new AppError(`Invalid section names: ${invalidSections.join(', ')}`, 400);
        }

        // Verify ownership
        const existing = await db
            .select({ id: tables.contentTable.id, version: tables.contentTable.version })
            .from(tables.contentTable)
            .where(
                and(
                    eq(tables.contentTable.id, contentID),
                    eq(tables.contentTable[entityIDField], userID)
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
            .update(tables.contentTable)
            .set(updateData)
            .where(eq(tables.contentTable.id, contentID))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Multiple sections updated', {
            contentID,
            newVersion: updated.version,
            userType
        });

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update sections', {
            error: error.message,
            contentID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update sections: ${error.message}`, 500);
    }
};

/**
 * Update scores after recalculation
 * @param {number} contentID - Resume content ID
 * @param {Object} scores - New scores
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated resume content
 */
export const updateResumeScores = async (contentID, scores, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        
        const [updated] = await db
            .update(tables.contentTable)
            .set({
                currentScores: scores,
                updatedAt: new Date()
            })
            .where(eq(tables.contentTable.id, contentID))
            .returning();

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update scores', {
            error: error.message,
            contentID,
            userType
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Created rewrite record
 */
export const createRewrite = async (userID, analysisID, resumeContentID, currentContent = null, options = {}, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Creating rewrite with content snapshot', {
            userID,
            analysisID,
            resumeContentID,
            hasContentSnapshot: !!currentContent,
            userType
        });

        // Get current version number
        const existingRewrites = await db
            .select({ versionNumber: tables.rewritesTable.versionNumber })
            .from(tables.rewritesTable)
            .where(
                and(
                    eq(tables.rewritesTable.analysisID, analysisID),
                    eq(tables.rewritesTable[entityIDField], userID)
                )
            )
            .orderBy(desc(tables.rewritesTable.versionNumber))
            .limit(1);

        const nextVersion = existingRewrites.length > 0 
            ? existingRewrites[0].versionNumber + 1 
            : 1;

        // Get current theme for this resume (to snapshot with the content)
        let themeSnapshot = null;
        if (resumeContentID) {
            try {
                const currentTheme = await getUserTheme(resumeContentID, userID, userType);
                if (currentTheme) {
                    themeSnapshot = {
                        themeID: currentTheme.themeID,
                        themeName: currentTheme.themeName,
                        themeSlug: currentTheme.themeSlug,
                        themeCategory: currentTheme.themeCategory,
                        themeConfig: currentTheme.themeConfig,
                        customOverrides: currentTheme.customOverrides,
                        sectionVisibility: currentTheme.sectionVisibility,
                        sectionOrder: currentTheme.sectionOrder,
                        isATSOptimized: currentTheme.isATSOptimized
                    };
                }
            } catch (themeError) {
                logger.warn('[RESUME_MODEL] Could not fetch theme for snapshot', { error: themeError.message });
            }
        }

        // Build source content snapshot (captures what AI will optimize from)
        const sourceContentSnapshot = currentContent ? {
            personalInfo: currentContent.personalInfo,
            summary: currentContent.summary,
            experience: currentContent.experience,
            education: currentContent.education,
            skills: currentContent.skills,
            additionalSections: currentContent.additionalSections,
            currentScores: currentContent.currentScores,
            analysisSummary: currentContent.analysisSummary,
            theme: themeSnapshot,
            version: currentContent.version,
            snapshotAt: new Date().toISOString()
        } : null;

        const insertValues = {
            [entityIDField]: userID,
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
        };

        const [rewrite] = await db
            .insert(tables.rewritesTable)
            .values(insertValues)
            .returning();

        logger.info('[RESUME_MODEL] ✅ Rewrite created with snapshot', {
            rewriteID: rewrite.id,
            version: nextVersion,
            hasSnapshot: !!sourceContentSnapshot,
            userType
        });

        return rewrite;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to create rewrite', {
            error: error.message,
            userID,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create rewrite: ${error.message}`, 500);
    }
};

/**
 * Get rewrite by ID
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Rewrite record with theme info
 */
export const getRewriteByID = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        const rewrite = await db
            .select()
            .from(tables.rewritesTable)
            .where(
                and(
                    eq(tables.rewritesTable.id, rewriteID),
                    eq(tables.rewritesTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!rewrite || rewrite.length === 0) {
            throw new AppError('Rewrite not found or unauthorized', 404);
        }

        const rewriteData = rewrite[0];
        
        // Extract theme from rewrittenContent if available
        let theme = null;
        if (rewriteData.rewrittenContent) {
            const content = typeof rewriteData.rewrittenContent === 'string'
                ? JSON.parse(rewriteData.rewrittenContent)
                : rewriteData.rewrittenContent;
            if (content.theme) {
                theme = content.theme;
            }
        }
        
        // If no theme in rewrittenContent, check sourceContentSnapshot
        if (!theme && rewriteData.sourceContentSnapshot) {
            const snapshot = typeof rewriteData.sourceContentSnapshot === 'string'
                ? JSON.parse(rewriteData.sourceContentSnapshot)
                : rewriteData.sourceContentSnapshot;
            if (snapshot.theme) {
                theme = snapshot.theme;
            }
        }

        return {
            ...rewriteData,
            theme
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch rewrite: ${error.message}`, 500);
    }
};

/**
 * Get all rewrites for an analysis
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, sort, userType
 * @returns {Promise<Object>} Object with rewrites array and totalCount
 */
export const getRewritesByAnalysisID = async (analysisID, userID, options = {}) => {
    try {
        const {
            pagination = { limit: 10, offset: 0 },
            filters = {},
            sort = { field: 'createdAt', order: 'desc' },
            userType = userTypeConstants.USER
        } = options;

        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';

        logger.info('[RESUME_MODEL] Fetching rewrites for analysis', { analysisID, userID, options, userType });

        // Build base where conditions
        const whereConditions = [
            eq(tables.rewritesTable.analysisID, analysisID),
            eq(tables.rewritesTable[entityIDField], userID)
        ];

        // Add filter conditions
        const filterConditions = buildWhereConditions(
            filters,
            tables.rewritesTable,
            { eq, inArray, gte, lte, or, and }
        );
        whereConditions.push(...filterConditions);

        // Get total count
        const [{ totalCount }] = await db
            .select({ totalCount: count() })
            .from(tables.rewritesTable)
            .where(and(...whereConditions));

        // Build order by
        const orderByClause = buildOrderBy(sort, tables.rewritesTable, { asc, desc });

        // Fetch paginated rewrites
        const rewrites = await db
            .select()
            .from(tables.rewritesTable)
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);

        logger.info('[RESUME_MODEL] ✅ Fetched rewrites', { count: rewrites.length, totalCount, userType });
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated rewrite
 */
export const updateRewrite = async (rewriteID, updates, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        
        const [updated] = await db
            .update(tables.rewritesTable)
            .set({
                ...updates,
                updatedAt: new Date()
            })
            .where(eq(tables.rewritesTable.id, rewriteID))
            .returning();

        return updated;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to update rewrite', {
            error: error.message,
            rewriteID,
            userType
        });
        throw new AppError(`Failed to update rewrite: ${error.message}`, 500);
    }
};

/**
 * Apply a rewrite to resume content (also handles version switching)
 * This marks the rewrite as active and updates the resume content with rewritten data
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated resume content
 */
export const applyRewrite = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Applying rewrite to content', { rewriteID, userID, userType });

        // Get the rewrite
        const rewrite = await getRewriteByID(rewriteID, userID, userType);

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
        const currentContent = await getResumeContentByAnalysisID(rewrite.analysisID, userID, userType);
        
        if (!currentContent) {
            throw new AppError('Resume content not found', 404);
        }

        // If there was a previously active rewrite, save the current resume content 
        // back to that rewrite's rewrittenContent to preserve user's edits
        if (currentContent.activeRewriteID && currentContent.activeRewriteID !== rewriteID) {
            // Check if content was modified after the previous rewrite was applied
            const previousRewrite = await db
                .select({ 
                    appliedAt: tables.rewritesTable.appliedAt,
                    rewrittenContent: tables.rewritesTable.rewrittenContent 
                })
                .from(tables.rewritesTable)
                .where(eq(tables.rewritesTable.id, currentContent.activeRewriteID))
                .limit(1);

            if (previousRewrite.length > 0 && previousRewrite[0].appliedAt) {
                // Check if content was modified after the previous rewrite was applied
                const wasModified = currentContent.updatedAt > previousRewrite[0].appliedAt;
                
                // Get current theme to save with the previous rewrite
                let currentThemeSnapshot = null;
                try {
                    const currentTheme = await getUserTheme(currentContent.id, userID, userType);
                    if (currentTheme) {
                        currentThemeSnapshot = {
                            themeID: currentTheme.themeID,
                            themeName: currentTheme.themeName,
                            themeSlug: currentTheme.themeSlug,
                            themeCategory: currentTheme.themeCategory,
                            themeConfig: currentTheme.themeConfig,
                            customOverrides: currentTheme.customOverrides,
                            sectionVisibility: currentTheme.sectionVisibility,
                            sectionOrder: currentTheme.sectionOrder,
                            isATSOptimized: currentTheme.isATSOptimized
                        };
                    }
                } catch (themeError) {
                    logger.warn('[RESUME_MODEL] Could not fetch theme for previous rewrite snapshot', { 
                        error: themeError.message 
                    });
                }
                
                // Save current resume content back to the previous rewrite
                // This preserves any edits the user made while this version was active
                // Includes: sections, scores, analysisSummary, AND theme
                const currentResumeSnapshot = {
                    personalInfo: currentContent.personalInfo,
                    summary: currentContent.summary,
                    experience: currentContent.experience,
                    education: currentContent.education,
                    skills: currentContent.skills,
                    additionalSections: currentContent.additionalSections,
                    scores: currentContent.currentScores,
                    theme: currentThemeSnapshot
                };
                
                // Also save the current analysisSummary to the previous rewrite as rewriteSummary
                const currentAnalysisSummary = currentContent.analysisSummary;
                
                await db
                    .update(tables.rewritesTable)
                    .set({ 
                        rewrittenContent: currentResumeSnapshot,
                        rewriteSummary: currentAnalysisSummary,
                        wasModifiedAfterApply: wasModified, 
                        updatedAt: new Date() 
                    })
                    .where(eq(tables.rewritesTable.id, currentContent.activeRewriteID));
                
                logger.info('[RESUME_MODEL] Saved current content, scores, analysisSummary, and theme to previous rewrite', {
                    previousRewriteID: currentContent.activeRewriteID,
                    wasModified,
                    hasScores: !!currentContent.currentScores,
                    hasAnalysisSummary: !!currentAnalysisSummary,
                    hasTheme: !!currentThemeSnapshot
                });
            }
        }

        // Deactivate all other rewrites for this analysis
        await db
            .update(tables.rewritesTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
                and(
                    eq(tables.rewritesTable.analysisID, rewrite.analysisID),
                    eq(tables.rewritesTable[entityIDField], userID)
                )
            );

        // Mark this rewrite as active and reset modification flag
        await db
            .update(tables.rewritesTable)
            .set({
                isActive: true,
                appliedAt: new Date(),
                wasModifiedAfterApply: false,
                updatedAt: new Date()
            })
            .where(eq(tables.rewritesTable.id, rewriteID));

        // Get the rewrite summary from the rewrite (if available)
        const rewriteSummary = typeof rewrite.rewriteSummary === 'string'
            ? JSON.parse(rewrite.rewriteSummary)
            : rewrite.rewriteSummary;

        // Update resume content with rewritten data and analysisSummary
        const [updatedContent] = await db
            .update(tables.contentTable)
            .set({
                personalInfo: content.personalInfo || currentContent.personalInfo,
                summary: content.summary || content.professionalSummary || currentContent.summary,
                experience: content.experience || content.workExperience || currentContent.experience,
                education: content.education || currentContent.education,
                skills: content.skills || currentContent.skills,
                additionalSections: content.additionalSections || currentContent.additionalSections,
                currentScores: content.scores || currentContent.currentScores,
                // Update analysisSummary to show post-rewrite summary
                analysisSummary: rewriteSummary || currentContent.analysisSummary,
                version: currentContent.version + 1,
                lastEditType: 'ai_rewrite',
                activeRewriteID: rewriteID,
                updatedAt: new Date()
            })
            .where(eq(tables.contentTable.id, currentContent.id))
            .returning();

        // Restore theme if the rewrite has theme info stored
        // This updates userResumeThemeTable (user's theme config), NOT the actual theme definitions
        if (content.theme && content.theme.themeID) {
            await restoreThemeFromSnapshot(userID, updatedContent.id, content.theme, userType);
            logger.info('[RESUME_MODEL] Restored theme from rewrite', {
                rewriteID,
                themeID: content.theme.themeID,
                themeName: content.theme.themeName,
                hasCustomOverrides: !!content.theme.customOverrides,
                hasSectionVisibility: !!content.theme.sectionVisibility,
                hasSectionOrder: !!content.theme.sectionOrder
            });
        }

        logger.info('[RESUME_MODEL] ✅ Rewrite applied to content', {
            rewriteID,
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            versionNumber: rewrite.versionNumber,
            hasTheme: !!(content.theme && content.theme.themeID),
            userType
        });

        return updatedContent;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to apply rewrite', {
            error: error.message,
            rewriteID,
            userType
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Object with updated content and version info
 */
export const switchRewriteVersion = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_MODEL] Switching rewrite version', { rewriteID, userID, userType });

        // Get target rewrite
        const targetRewrite = await getRewriteByID(rewriteID, userID, userType);

        if (targetRewrite.status !== 'completed') {
            throw new AppError('Cannot switch to an incomplete rewrite version', 400);
        }

        // If already active, just return current state with theme
        if (targetRewrite.isActive) {
            const currentContent = await getResumeContentByAnalysisID(targetRewrite.analysisID, userID, userType);
            const currentTheme = await getUserTheme(currentContent.id, userID, userType);
            return {
                content: currentContent,
                rewrite: targetRewrite,
                theme: currentTheme,
                message: 'This version is already active'
            };
        }

        // Apply the rewrite (handles all the switching logic including theme restoration)
        const updatedContent = await applyRewrite(rewriteID, userID, userType);

        // Get updated rewrite info (now includes theme)
        const updatedRewrite = await getRewriteByID(rewriteID, userID, userType);
        
        // Get the current theme after restoration
        const restoredTheme = await getUserTheme(updatedContent.id, userID, userType);

        return {
            content: updatedContent,
            rewrite: {
                id: updatedRewrite.id,
                versionNumber: updatedRewrite.versionNumber,
                versionLabel: updatedRewrite.versionLabel,
                isActive: updatedRewrite.isActive,
                appliedAt: updatedRewrite.appliedAt,
                theme: updatedRewrite.theme
            },
            theme: restoredTheme,
            message: `Switched to rewrite version ${updatedRewrite.versionNumber}`
        };
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to switch rewrite version', {
            error: error.message,
            rewriteID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to switch rewrite version: ${error.message}`, 500);
    }
};

/**
 * Get the active rewrite for a resume/analysis
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object|null>} Active rewrite or null
 */
export const getActiveRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        const activeRewrite = await db
            .select()
            .from(tables.rewritesTable)
            .where(
                and(
                    eq(tables.rewritesTable.analysisID, analysisID),
                    eq(tables.rewritesTable[entityIDField], userID),
                    eq(tables.rewritesTable.isActive, true)
                )
            )
            .limit(1);

        return activeRewrite.length > 0 ? activeRewrite[0] : null;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to get active rewrite', {
            error: error.message,
            analysisID,
            userType
        });
        throw new AppError(`Failed to get active rewrite: ${error.message}`, 500);
    }
};

/**
 * Clear active rewrite (revert to original/manual state)
 * This deactivates all rewrites and clears activeRewriteID from content
 * Also restores the initial analysis summary
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID  
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated content
 */
export const clearActiveRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Clearing active rewrite', { analysisID, userID, userType });

        // Get current content
        const currentContent = await getResumeContentByAnalysisID(analysisID, userID, userType);
        
        if (!currentContent) {
            throw new AppError('Resume content not found', 404);
        }

        // Get the original analysis data to restore the initial analysis summary
        let initialAnalysisSummary = null;
        try {
            const analysisData = await db
                .select({
                    processedData: tables.processedDataTable.processedData
                })
                .from(tables.processedDataTable)
                .where(eq(tables.processedDataTable.analysisID, analysisID))
                .limit(1);

            if (analysisData.length > 0 && analysisData[0].processedData) {
                const parsedData = typeof analysisData[0].processedData === 'string'
                    ? JSON.parse(analysisData[0].processedData)
                    : analysisData[0].processedData;
                
                // Build lightweight initial analysis summary
                initialAnalysisSummary = {
                    issuesCounts: {
                        critical: (parsedData.critical_mistakes || []).length,
                        major: (parsedData.major_issues || []).length,
                        minor: (parsedData.minor_improvements || []).length
                    },
                    improvementSummary: 'Original analysis - no rewrites applied',
                    scoreChange: null,
                    version: 'initial',
                    updatedAt: new Date().toISOString()
                };
            }
        } catch (err) {
            logger.warn('[RESUME_MODEL] Could not restore initial analysis summary', { error: err.message });
        }

        // Deactivate all rewrites for this analysis
        await db
            .update(tables.rewritesTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
                and(
                    eq(tables.rewritesTable.analysisID, analysisID),
                    eq(tables.rewritesTable[entityIDField], userID)
                )
            );

        // Clear activeRewriteID from content and restore initial analysis summary
        const updateData = {
            activeRewriteID: null,
            lastEditType: 'manual',
            version: currentContent.version + 1,
            updatedAt: new Date()
        };
        
        // Only update analysisSummary if we were able to restore it
        if (initialAnalysisSummary) {
            updateData.analysisSummary = initialAnalysisSummary;
        }

        const [updatedContent] = await db
            .update(tables.contentTable)
            .set(updateData)
            .where(eq(tables.contentTable.id, currentContent.id))
            .returning();

        logger.info('[RESUME_MODEL] ✅ Active rewrite cleared', {
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            restoredInitialSummary: !!initialAnalysisSummary,
            userType
        });

        return updatedContent;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to clear active rewrite', {
            error: error.message,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to clear active rewrite: ${error.message}`, 500);
    }
};

/**
 * Get analysis data needed for creating rewrites
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Analysis data with processed content
 */
export const getAnalysisDataForRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Fetching analysis data for rewrite', { analysisID, userID, userType });

        const analysisData = await db
            .select({
                analysisID: tables.analysisTable.id,
                analysisStatus: tables.analysisTable.status,
                documentID: tables.documentTable.id,
                documentTitle: tables.documentTable.title,
                fileURL: tables.documentTable.fileURL,
                processedDataID: tables.processedDataTable.id,
                rawData: tables.processedDataTable.rawData,
                processedData: tables.processedDataTable.processedData
            })
            .from(tables.analysisTable)
            .innerJoin(tables.documentTable, eq(tables.analysisTable.documentID, tables.documentTable.id))
            .innerJoin(tables.processedDataTable, eq(tables.analysisTable.id, tables.processedDataTable.analysisID))
            .where(
                and(
                    eq(tables.analysisTable.id, analysisID),
                    eq(tables.analysisTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!analysisData || analysisData.length === 0) {
            throw new AppError('Analysis not found or unauthorized', 404);
        }

        if (analysisData[0].analysisStatus !== 'completed') {
            throw new AppError('Analysis must be completed before rewriting', 400);
        }

        logger.info('[RESUME_MODEL] ✅ Analysis data fetched successfully', { userType });
        return analysisData[0];
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch analysis data', {
            error: error.message,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch analysis data: ${error.message}`, 500);
    }
};

/**
 * Get ONLY analysis issues for rewrites (optimized - excludes resume content)
 * This is a lightweight fetch that only retrieves the analysis results
 * (mistakes, issues, scores) without duplicating resume content that
 * already exists in resume_content table.
 * 
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Analysis issues only (no resume content)
 */
export const getAnalysisIssuesForRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Fetching analysis issues for rewrite (optimized)', { analysisID, userID, userType });

        const analysisData = await db
            .select({
                analysisID: tables.analysisTable.id,
                analysisStatus: tables.analysisTable.status,
                processedData: tables.processedDataTable.processedData
            })
            .from(tables.analysisTable)
            .innerJoin(tables.processedDataTable, eq(tables.analysisTable.id, tables.processedDataTable.analysisID))
            .where(
                and(
                    eq(tables.analysisTable.id, analysisID),
                    eq(tables.analysisTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!analysisData || analysisData.length === 0) {
            throw new AppError('Analysis not found or unauthorized', 404);
        }

        if (analysisData[0].analysisStatus !== 'completed') {
            throw new AppError('Analysis must be completed before rewriting', 400);
        }

        // Parse processedData and extract ONLY analysis-related fields
        const fullData = typeof analysisData[0].processedData === 'string'
            ? JSON.parse(analysisData[0].processedData)
            : analysisData[0].processedData;

        // Extract only analysis issues and scores (NOT resume content)
        const analysisIssues = {
            // Issues identified by AI
            critical_mistakes: fullData.critical_mistakes || [],
            major_issues: fullData.major_issues || [],
            minor_improvements: fullData.minor_improvements || [],
            optimization_opportunities: fullData.optimization_opportunities || [],
            
            // Scores and quality metrics
            relevance: fullData.relevance || {},
            resume_quality: fullData.resume_quality || {},
            JobFitScore: fullData.JobFitScore || 0,
            
            // Recommendations
            recommendations: fullData.recommendations || [],
            improvement_suggestions: fullData.improvement_suggestions || []
        };

        logger.info('[RESUME_MODEL] ✅ Analysis issues fetched (optimized)', {
            criticalCount: analysisIssues.critical_mistakes.length,
            majorCount: analysisIssues.major_issues.length,
            minorCount: analysisIssues.minor_improvements.length,
            userType
        });

        return analysisIssues;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch analysis issues', {
            error: error.message,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch analysis issues: ${error.message}`, 500);
    }
};

/**
 * Get raw text data for rewrite context (when AI needs original text)
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<string>} Raw extracted text
 */
export const getRawDataForRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[RESUME_MODEL] Fetching raw data for rewrite', { analysisID, userID, userType });

        const data = await db
            .select({
                rawData: tables.processedDataTable.rawData
            })
            .from(tables.analysisTable)
            .innerJoin(tables.processedDataTable, eq(tables.analysisTable.id, tables.processedDataTable.analysisID))
            .where(
                and(
                    eq(tables.analysisTable.id, analysisID),
                    eq(tables.analysisTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!data || data.length === 0) {
            throw new AppError('Analysis not found or unauthorized', 404);
        }

        logger.info('[RESUME_MODEL] ✅ Raw data fetched', { 
            dataLength: data[0].rawData?.length || 0,
            userType 
        });

        return data[0].rawData;
    } catch (error) {
        logger.error('[RESUME_MODEL] Failed to fetch raw data', {
            error: error.message,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch raw data: ${error.message}`, 500);
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
    // Analysis data fetching (original + optimized)
    getAnalysisDataForRewrite,      // Full fetch (legacy)
    getAnalysisIssuesForRewrite,    // Optimized: issues only
    getRawDataForRewrite            // Optimized: raw text only
};
