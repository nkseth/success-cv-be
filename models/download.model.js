import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, count } from "drizzle-orm";
import logger from "../middleware/logger.js";
import {
    resumeContentTable,
    resumeRewritesTable,
    analysisTable,
    userDocumentTable,
    candidateResumeContentTable,
    candidateResumeRewritesTable,
    candidateAnalysisTable,
    candidateDocumentTable
} from "../drizzle/schema.js";
import themeModel from "./theme.model.js";
import { isCandidate as checkIsCandidate } from "../utils/dynamic-tables.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Get tables for user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} Object with table references and flags
 */
function getTablesForUserType(userType) {
    const isCandidateUser = checkIsCandidate(userType);
    return {
        contentTable: isCandidateUser ? candidateResumeContentTable : resumeContentTable,
        rewritesTable: isCandidateUser ? candidateResumeRewritesTable : resumeRewritesTable,
        analysisTable: isCandidateUser ? candidateAnalysisTable : analysisTable,
        documentTable: isCandidateUser ? candidateDocumentTable : userDocumentTable,
        entityIDColumn: isCandidateUser ? 'candidateID' : 'userID',
        isCandidate: isCandidateUser
    };
}

// ========== DOWNLOAD DATA OPERATIONS ==========

/**
 * Get complete resume data for PDF generation
 * Includes content, theme, and metadata needed for rendering
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID or Candidate ID for authorization
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete resume data for PDF rendering
 */
export const getResumeForDownload = async (resumeContentID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[DOWNLOAD_MODEL] Fetching resume for download', { 
            resumeContentID, 
            userID,
            userType
        });

        // Get resume content with document info
        const contentResult = await db
            .select({
                // Resume content fields
                id: tables.contentTable.id,
                entityID: tables.contentTable[entityIDField],
                analysisID: tables.contentTable.analysisID,
                personalInfo: tables.contentTable.personalInfo,
                summary: tables.contentTable.summary,
                experience: tables.contentTable.experience,
                education: tables.contentTable.education,
                skills: tables.contentTable.skills,
                additionalSections: tables.contentTable.additionalSections,
                currentScores: tables.contentTable.currentScores,
                version: tables.contentTable.version,
                lastEditType: tables.contentTable.lastEditType,
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
                    eq(tables.contentTable.id, resumeContentID),
                    eq(tables.contentTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!contentResult || contentResult.length === 0) {
            throw new AppError('Resume not found or unauthorized', 404);
        }

        const content = contentResult[0];

        // Get user's applied theme
        const userTheme = await themeModel.getUserTheme(resumeContentID, userID, userType);

        // Build the complete resume data object
        const resumeData = {
            content: {
                personalInfo: content.personalInfo || {},
                summary: content.summary || {},
                experience: content.experience || [],
                education: content.education || [],
                skills: content.skills || {},
                additionalSections: content.additionalSections || []
            },
            metadata: {
                id: content.id,
                analysisID: content.analysisID,
                version: content.version,
                lastEditType: content.lastEditType,
                activeRewriteID: content.activeRewriteID,
                documentTitle: content.documentTitle,
                createdAt: content.createdAt,
                updatedAt: content.updatedAt
            },
            theme: userTheme ? {
                id: userTheme.id,
                themeID: userTheme.themeID,
                name: userTheme.themeName,
                category: userTheme.themeCategory,
                config: userTheme.themeConfig,
                customOverrides: userTheme.customOverrides,
                sectionVisibility: userTheme.sectionVisibility,
                sectionOrder: userTheme.sectionOrder,
                isATSOptimized: userTheme.isATSOptimized,
                updatedAt: userTheme.updatedAt
            } : null,
            scores: content.currentScores || {}
        };

        logger.info('[DOWNLOAD_MODEL] ✅ Resume data fetched for download', {
            resumeContentID,
            hasTheme: !!userTheme,
            experienceCount: resumeData.content.experience.length,
            educationCount: resumeData.content.education.length,
            userType
        });

        return resumeData;
    } catch (error) {
        logger.error('[DOWNLOAD_MODEL] Failed to fetch resume for download', {
            error: error.message,
            resumeContentID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch resume for download: ${error.message}`, 500);
    }
};

/**
 * Get resume data by analysis ID for download
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID or Candidate ID for authorization
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete resume data for PDF rendering
 */
export const getResumeForDownloadByAnalysisID = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[DOWNLOAD_MODEL] Fetching resume for download by analysis', { 
            analysisID, 
            userID,
            userType
        });

        // First get the resume content ID
        const content = await db
            .select({ id: tables.contentTable.id })
            .from(tables.contentTable)
            .where(
                and(
                    eq(tables.contentTable.analysisID, analysisID),
                    eq(tables.contentTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!content || content.length === 0) {
            throw new AppError('Resume not found for this analysis', 404);
        }

        // Use the main function to get full data
        return await getResumeForDownload(content[0].id, userID, userType);
    } catch (error) {
        logger.error('[DOWNLOAD_MODEL] Failed to fetch resume for download by analysis', {
            error: error.message,
            analysisID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch resume for download: ${error.message}`, 500);
    }
};

/**
 * Get a specific rewrite version for download
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID or Candidate ID for authorization
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete resume data with rewrite content
 */
export const getRewriteForDownload = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        const tables = getTablesForUserType(userType);
        const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
        
        logger.info('[DOWNLOAD_MODEL] Fetching rewrite for download', { 
            rewriteID, 
            userID,
            userType
        });

        // Get the rewrite with its content
        const rewriteResult = await db
            .select({
                id: tables.rewritesTable.id,
                analysisID: tables.rewritesTable.analysisID,
                resumeContentID: tables.rewritesTable.resumeContentID,
                status: tables.rewritesTable.status,
                versionNumber: tables.rewritesTable.versionNumber,
                versionLabel: tables.rewritesTable.versionLabel,
                rewrittenContent: tables.rewritesTable.rewrittenContent,
                improvements: tables.rewritesTable.improvements,
                isActive: tables.rewritesTable.isActive,
                createdAt: tables.rewritesTable.createdAt,
                completedAt: tables.rewritesTable.completedAt
            })
            .from(tables.rewritesTable)
            .where(
                and(
                    eq(tables.rewritesTable.id, rewriteID),
                    eq(tables.rewritesTable[entityIDField], userID)
                )
            )
            .limit(1);

        if (!rewriteResult || rewriteResult.length === 0) {
            throw new AppError('Rewrite not found or unauthorized', 404);
        }

        const rewrite = rewriteResult[0];

        if (rewrite.status !== 'completed') {
            throw new AppError('Rewrite is not completed yet', 400);
        }

        if (!rewrite.rewrittenContent) {
            throw new AppError('Rewrite has no content', 400);
        }

        // Parse rewritten content
        const rewrittenContent = typeof rewrite.rewrittenContent === 'string'
            ? JSON.parse(rewrite.rewrittenContent)
            : rewrite.rewrittenContent;

        // Get user's applied theme for the resume
        const userTheme = rewrite.resumeContentID 
            ? await themeModel.getUserTheme(rewrite.resumeContentID, userID, userType)
            : null;

        // Build the resume data from rewrite content
        const resumeData = {
            content: {
                personalInfo: rewrittenContent.personalInfo || rewrittenContent.personal_info || {},
                summary: rewrittenContent.summary || rewrittenContent.professionalSummary || {},
                experience: rewrittenContent.experience || rewrittenContent.workExperience || [],
                education: rewrittenContent.education || [],
                skills: rewrittenContent.skills || {},
                additionalSections: rewrittenContent.additionalSections || []
            },
            metadata: {
                id: rewrite.resumeContentID,
                analysisID: rewrite.analysisID,
                rewriteID: rewrite.id,
                versionNumber: rewrite.versionNumber,
                versionLabel: rewrite.versionLabel,
                isRewrite: true,
                createdAt: rewrite.createdAt,
                completedAt: rewrite.completedAt
            },
            theme: userTheme ? {
                id: userTheme.id,
                themeID: userTheme.themeID,
                name: userTheme.themeName,
                category: userTheme.themeCategory,
                config: userTheme.themeConfig,
                customOverrides: userTheme.customOverrides,
                sectionVisibility: userTheme.sectionVisibility,
                sectionOrder: userTheme.sectionOrder,
                isATSOptimized: userTheme.isATSOptimized,
                updatedAt: userTheme.updatedAt
            } : null,
            scores: rewrittenContent.scores || rewrite.improvements?.after || {}
        };

        logger.info('[DOWNLOAD_MODEL] ✅ Rewrite data fetched for download', {
            rewriteID,
            versionNumber: rewrite.versionNumber,
            hasTheme: !!userTheme,
            userType
        });

        return resumeData;
    } catch (error) {
        logger.error('[DOWNLOAD_MODEL] Failed to fetch rewrite for download', {
            error: error.message,
            rewriteID,
            userType
        });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to fetch rewrite for download: ${error.message}`, 500);
    }
};

/**
 * Get default theme config for download when no theme is applied
 * @returns {Object} Default theme configuration
 */
export const getDefaultThemeConfig = () => {
    return {
        layout: {
            orientation: 'portrait',
            pageSize: 'A4',
            columns: 1,
            margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 },
            spacing: { section: 16, item: 10, line: 6 }
        },
        colors: {
            primary: '#2563eb',
            secondary: '#1e293b',
            accent: '#0ea5e9',
            text: '#1f2937',
            textLight: '#6b7280',
            background: '#ffffff',
            border: '#e5e7eb',
            headerBg: '#f8fafc'
        },
        typography: {
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            baseFontSize: 10
        },
        sections: {
            order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
            visibility: {
                personalInfo: true,
                summary: true,
                experience: true,
                education: true,
                skills: true,
                additionalSections: true
            }
        },
        style: {
            headingStyle: 'underline',
            bulletStyle: 'disc',
            skillsLayout: 'pills'
        }
    };
};

export default {
    getResumeForDownload,
    getResumeForDownloadByAnalysisID,
    getRewriteForDownload,
    getDefaultThemeConfig
};
