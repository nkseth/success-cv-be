import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, asc, count, sql, gte, lte, isNull } from "drizzle-orm";
import logger from "../middleware/logger.js";
import {
    // User tables
    resumeContentTable,
    resumeRewritesTable,
    analysisTable,
    userDocumentTable,
    usersTable,
    // Candidate tables
    candidateResumeContentTable,
    candidateResumeRewritesTable,
    candidateAnalysisTable,
    candidateDocumentTable,
    candidatesTable,
    // Organisation tables
    organisationsTable,
    orgMembersTable,
    inviteTable,
    // Theme tables
    resumeThemesTable,
    userResumeThemeTable,
    candidateResumeThemeTable
} from "../drizzle/schema.js";
import { userTypeConstants } from "../utils/constants.js";
import {
    getResumeContentTable,
    getResumeRewritesTable,
    getAnalysisTable,
    getDocumentTable,
    isCandidate as checkIsCandidate
} from "../utils/dynamic-tables.js";

// ========== HELPER FUNCTIONS ==========

/**
 * Get candidate's organisation ID
 * @param {number} candidateID - Candidate ID
 * @returns {Promise<number|null>} Organisation ID or null
 */
export const getCandidateOrganisationID = async (candidateID) => {
    try {
        const [candidate] = await db
            .select({ organisationID: candidatesTable.organisationID })
            .from(candidatesTable)
            .where(eq(candidatesTable.id, candidateID))
            .limit(1);
        
        return candidate?.organisationID || null;
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get candidate organisation ID', {
            error: error.message,
            candidateID
        });
        return null;
    }
};

// ========== USER/CANDIDATE DASHBOARD QUERIES ==========

/**
 * Get summary statistics for a user
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Summary stats
 */
export const getUserDashboardStats = async (userID, userType = 'user') => {
    try {
        const isCandidate = userType === 'candidate';
        const contentTable = isCandidate ? candidateResumeContentTable : resumeContentTable;
        const rewritesTable = isCandidate ? candidateResumeRewritesTable : resumeRewritesTable;
        const analysisTableRef = isCandidate ? candidateAnalysisTable : analysisTable;
        const documentTable = isCandidate ? candidateDocumentTable : userDocumentTable;
        const entityIDField = isCandidate ? 'candidateID' : 'userID';

        // Total resumes count
        const [resumeCount] = await db
            .select({ count: count() })
            .from(contentTable)
            .where(eq(contentTable[entityIDField], userID));

        // Resumes by analysis status
        const statusCounts = await db
            .select({
                status: analysisTableRef.status,
                count: count()
            })
            .from(analysisTableRef)
            .where(eq(analysisTableRef[entityIDField], userID))
            .groupBy(analysisTableRef.status);

        // Total rewrites count
        const [rewriteCount] = await db
            .select({ count: count() })
            .from(rewritesTable)
            .where(eq(rewritesTable[entityIDField], userID));

        // Rewrites by status
        const rewriteStatusCounts = await db
            .select({
                status: rewritesTable.status,
                count: count()
            })
            .from(rewritesTable)
            .where(eq(rewritesTable[entityIDField], userID))
            .groupBy(rewritesTable.status);

        // Active rewrites count
        const [activeRewriteCount] = await db
            .select({ count: count() })
            .from(rewritesTable)
            .where(
                and(
                    eq(rewritesTable[entityIDField], userID),
                    eq(rewritesTable.isActive, true)
                )
            );

        // Documents count
        const [documentCount] = await db
            .select({ count: count() })
            .from(documentTable)
            .where(
                and(
                    eq(documentTable[entityIDField], userID),
                    isNull(documentTable.deletedAt)
                )
            );

        return {
            totalResumes: resumeCount?.count || 0,
            totalDocuments: documentCount?.count || 0,
            totalRewrites: rewriteCount?.count || 0,
            activeRewrites: activeRewriteCount?.count || 0,
            analysisByStatus: statusCounts.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {}),
            rewritesByStatus: rewriteStatusCounts.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {})
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get user dashboard stats', {
            error: error.message,
            userID,
            userType
        });
        throw new AppError(`Failed to get dashboard stats: ${error.message}`, 500);
    }
};

/**
 * Get ATS score analytics for a user
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Score analytics
 */
export const getUserScoreAnalytics = async (userID, userType = 'user') => {
    try {
        const isCandidate = userType === 'candidate';
        const contentTable = isCandidate ? candidateResumeContentTable : resumeContentTable;
        const entityIDField = isCandidate ? 'candidateID' : 'userID';

        // Get all resumes with scores
        const resumes = await db
            .select({
                id: contentTable.id,
                currentScores: contentTable.currentScores,
                createdAt: contentTable.createdAt,
                updatedAt: contentTable.updatedAt
            })
            .from(contentTable)
            .where(eq(contentTable[entityIDField], userID));

        // Calculate score statistics
        let totalAtsScore = 0;
        let totalContentScore = 0;
        let totalFormatScore = 0;
        let totalOverallScore = 0;
        let scoreCount = 0;
        const scoreDistribution = {
            excellent: 0,  // 90-100
            good: 0,       // 70-89
            average: 0,    // 50-69
            needsWork: 0   // 0-49
        };

        resumes.forEach(resume => {
            const scores = resume.currentScores || {};
            if (scores.atsScore !== undefined) {
                totalAtsScore += scores.atsScore || 0;
                totalContentScore += scores.contentScore || 0;
                totalFormatScore += scores.formatScore || 0;
                totalOverallScore += scores.overallScore || 0;
                scoreCount++;

                // Categorize ATS score
                const ats = scores.atsScore || 0;
                if (ats >= 90) scoreDistribution.excellent++;
                else if (ats >= 70) scoreDistribution.good++;
                else if (ats >= 50) scoreDistribution.average++;
                else scoreDistribution.needsWork++;
            }
        });

        const avgAtsScore = scoreCount > 0 ? Math.round(totalAtsScore / scoreCount) : 0;
        const avgContentScore = scoreCount > 0 ? Math.round(totalContentScore / scoreCount) : 0;
        const avgFormatScore = scoreCount > 0 ? Math.round(totalFormatScore / scoreCount) : 0;
        const avgOverallScore = scoreCount > 0 ? Math.round(totalOverallScore / scoreCount) : 0;

        // Find best and worst scores
        let bestScore = null;
        let worstScore = null;
        resumes.forEach(resume => {
            const ats = resume.currentScores?.atsScore;
            if (ats !== undefined) {
                if (!bestScore || ats > bestScore.score) {
                    bestScore = { resumeId: resume.id, score: ats };
                }
                if (!worstScore || ats < worstScore.score) {
                    worstScore = { resumeId: resume.id, score: ats };
                }
            }
        });

        return {
            averageScores: {
                atsScore: avgAtsScore,
                contentScore: avgContentScore,
                formatScore: avgFormatScore,
                overallScore: avgOverallScore
            },
            scoreDistribution,
            bestScore,
            worstScore,
            totalAnalyzed: scoreCount
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get user score analytics', {
            error: error.message,
            userID,
            userType
        });
        throw new AppError(`Failed to get score analytics: ${error.message}`, 500);
    }
};

/**
 * Get recent resumes for a user
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} limit - Number of resumes to return
 * @returns {Promise<Array>} Recent resumes
 */
export const getUserRecentResumes = async (userID, userType = 'user', limit = 5) => {
    try {
        const isCandidate = userType === 'candidate';
        const contentTable = isCandidate ? candidateResumeContentTable : resumeContentTable;
        const analysisTableRef = isCandidate ? candidateAnalysisTable : analysisTable;
        const documentTable = isCandidate ? candidateDocumentTable : userDocumentTable;
        const entityIDField = isCandidate ? 'candidateID' : 'userID';

        const resumes = await db
            .select({
                id: contentTable.id,
                analysisID: contentTable.analysisID,
                personalInfo: contentTable.personalInfo,
                currentScores: contentTable.currentScores,
                version: contentTable.version,
                lastEditType: contentTable.lastEditType,
                createdAt: contentTable.createdAt,
                updatedAt: contentTable.updatedAt,
                documentTitle: documentTable.title,
                analysisStatus: analysisTableRef.status
            })
            .from(contentTable)
            .innerJoin(analysisTableRef, eq(contentTable.analysisID, analysisTableRef.id))
            .innerJoin(documentTable, eq(analysisTableRef.documentID, documentTable.id))
            .where(eq(contentTable[entityIDField], userID))
            .orderBy(desc(contentTable.updatedAt))
            .limit(limit);

        return resumes.map(resume => ({
            id: resume.id,
            analysisID: resume.analysisID,
            title: resume.documentTitle || resume.personalInfo?.fullName || 'Untitled Resume',
            fullName: resume.personalInfo?.fullName || '',
            atsScore: resume.currentScores?.atsScore || 0,
            overallScore: resume.currentScores?.overallScore || 0,
            version: resume.version,
            lastEditType: resume.lastEditType,
            status: resume.analysisStatus,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt
        }));
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get recent resumes', {
            error: error.message,
            userID,
            userType
        });
        throw new AppError(`Failed to get recent resumes: ${error.message}`, 500);
    }
};

/**
 * Get rewrite analytics for a user
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Rewrite analytics
 */
export const getUserRewriteAnalytics = async (userID, userType = 'user') => {
    try {
        const isCandidate = userType === 'candidate';
        const rewritesTable = isCandidate ? candidateResumeRewritesTable : resumeRewritesTable;
        const entityIDField = isCandidate ? 'candidateID' : 'userID';

        // Get all completed rewrites with improvements data
        const rewrites = await db
            .select({
                id: rewritesTable.id,
                improvements: rewritesTable.improvements,
                rewriteSummary: rewritesTable.rewriteSummary,
                status: rewritesTable.status,
                isActive: rewritesTable.isActive,
                createdAt: rewritesTable.createdAt,
                completedAt: rewritesTable.completedAt
            })
            .from(rewritesTable)
            .where(eq(rewritesTable[entityIDField], userID));

        let totalScoreImprovement = 0;
        let improvementCount = 0;
        let totalCriticalResolved = 0;
        let totalMajorResolved = 0;
        let totalMinorResolved = 0;

        rewrites.forEach(rewrite => {
            if (rewrite.status === 'completed' && rewrite.improvements) {
                const before = rewrite.improvements.before?.atsScore || 0;
                const after = rewrite.improvements.after?.atsScore || 0;
                if (after > before) {
                    totalScoreImprovement += (after - before);
                    improvementCount++;
                }
            }
            if (rewrite.rewriteSummary?.resolvedCounts) {
                totalCriticalResolved += rewrite.rewriteSummary.resolvedCounts.critical || 0;
                totalMajorResolved += rewrite.rewriteSummary.resolvedCounts.major || 0;
                totalMinorResolved += rewrite.rewriteSummary.resolvedCounts.minor || 0;
            }
        });

        const completedRewrites = rewrites.filter(r => r.status === 'completed').length;
        const avgImprovement = improvementCount > 0 
            ? Math.round(totalScoreImprovement / improvementCount) 
            : 0;

        return {
            totalRewrites: rewrites.length,
            completedRewrites,
            activeRewrites: rewrites.filter(r => r.isActive).length,
            pendingRewrites: rewrites.filter(r => r.status === 'pending' || r.status === 'processing').length,
            failedRewrites: rewrites.filter(r => r.status === 'failed').length,
            averageScoreImprovement: avgImprovement,
            issuesResolved: {
                critical: totalCriticalResolved,
                major: totalMajorResolved,
                minor: totalMinorResolved,
                total: totalCriticalResolved + totalMajorResolved + totalMinorResolved
            }
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get rewrite analytics', {
            error: error.message,
            userID,
            userType
        });
        throw new AppError(`Failed to get rewrite analytics: ${error.message}`, 500);
    }
};

/**
 * Get activity timeline for a user
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity data
 */
export const getUserActivityTimeline = async (userID, userType = 'user', days = 30) => {
    try {
        const isCandidate = userType === 'candidate';
        const contentTable = isCandidate ? candidateResumeContentTable : resumeContentTable;
        const rewritesTable = isCandidate ? candidateResumeRewritesTable : resumeRewritesTable;
        const documentTable = isCandidate ? candidateDocumentTable : userDocumentTable;
        const entityIDField = isCandidate ? 'candidateID' : 'userID';

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get resumes created in period
        const resumesCreated = await db
            .select({
                date: sql`DATE(${contentTable.createdAt})`.as('date'),
                count: count()
            })
            .from(contentTable)
            .where(
                and(
                    eq(contentTable[entityIDField], userID),
                    gte(contentTable.createdAt, startDate)
                )
            )
            .groupBy(sql`DATE(${contentTable.createdAt})`);

        // Get rewrites created in period
        const rewritesCreated = await db
            .select({
                date: sql`DATE(${rewritesTable.createdAt})`.as('date'),
                count: count()
            })
            .from(rewritesTable)
            .where(
                and(
                    eq(rewritesTable[entityIDField], userID),
                    gte(rewritesTable.createdAt, startDate)
                )
            )
            .groupBy(sql`DATE(${rewritesTable.createdAt})`);

        // Get documents uploaded in period
        const documentsUploaded = await db
            .select({
                date: sql`DATE(${documentTable.createdAt})`.as('date'),
                count: count()
            })
            .from(documentTable)
            .where(
                and(
                    eq(documentTable[entityIDField], userID),
                    gte(documentTable.createdAt, startDate),
                    isNull(documentTable.deletedAt)
                )
            )
            .groupBy(sql`DATE(${documentTable.createdAt})`);

        return {
            period: { startDate, endDate: new Date(), days },
            resumesCreated: resumesCreated.map(r => ({ date: r.date, count: Number(r.count) })),
            rewritesCreated: rewritesCreated.map(r => ({ date: r.date, count: Number(r.count) })),
            documentsUploaded: documentsUploaded.map(r => ({ date: r.date, count: Number(r.count) }))
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get activity timeline', {
            error: error.message,
            userID,
            userType
        });
        throw new AppError(`Failed to get activity timeline: ${error.message}`, 500);
    }
};

// ========== ORGANISATION DASHBOARD QUERIES ==========

/**
 * Get organisation summary statistics
 * @param {number} organisationID - Organisation ID
 * @returns {Promise<Object>} Organisation stats
 */
export const getOrganisationDashboardStats = async (organisationID) => {
    try {
        // Total candidates in organisation
        const [candidateCount] = await db
            .select({ count: count() })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            );

        // Verified vs unverified candidates
        const candidateVerificationStats = await db
            .select({
                isVerified: candidatesTable.isVerified,
                count: count()
            })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            )
            .groupBy(candidatesTable.isVerified);

        // Total resumes across all candidates
        const candidateIds = await db
            .select({ id: candidatesTable.id })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            );

        const candidateIdList = candidateIds.map(c => c.id);

        let totalResumes = 0;
        let totalRewrites = 0;
        let analysisStatusCounts = {};

        if (candidateIdList.length > 0) {
            // Total resumes for org candidates
            const [resumeCount] = await db
                .select({ count: count() })
                .from(candidateResumeContentTable)
                .where(sql`${candidateResumeContentTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`);
            totalResumes = resumeCount?.count || 0;

            // Total rewrites for org candidates
            const [rewriteCount] = await db
                .select({ count: count() })
                .from(candidateResumeRewritesTable)
                .where(sql`${candidateResumeRewritesTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`);
            totalRewrites = rewriteCount?.count || 0;

            // Analysis status distribution
            const statusCounts = await db
                .select({
                    status: candidateAnalysisTable.status,
                    count: count()
                })
                .from(candidateAnalysisTable)
                .where(sql`${candidateAnalysisTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`)
                .groupBy(candidateAnalysisTable.status);

            analysisStatusCounts = statusCounts.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {});
        }

        // Organisation members count
        const [memberCount] = await db
            .select({ count: count() })
            .from(orgMembersTable)
            .where(eq(orgMembersTable.organisationID, organisationID));

        // Pending invites
        const [pendingInvites] = await db
            .select({ count: count() })
            .from(inviteTable)
            .where(
                and(
                    eq(inviteTable.organisationID, organisationID),
                    eq(inviteTable.isAccepted, false),
                    gte(inviteTable.expiresAt, new Date())
                )
            );

        return {
            totalCandidates: candidateCount?.count || 0,
            verifiedCandidates: candidateVerificationStats.find(s => s.isVerified)?.count || 0,
            unverifiedCandidates: candidateVerificationStats.find(s => !s.isVerified)?.count || 0,
            totalResumes,
            totalRewrites,
            analysisByStatus: analysisStatusCounts,
            totalMembers: memberCount?.count || 0,
            pendingInvites: pendingInvites?.count || 0
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get organisation dashboard stats', {
            error: error.message,
            organisationID
        });
        throw new AppError(`Failed to get organisation stats: ${error.message}`, 500);
    }
};

/**
 * Get organisation-wide score analytics
 * @param {number} organisationID - Organisation ID
 * @returns {Promise<Object>} Score analytics
 */
export const getOrganisationScoreAnalytics = async (organisationID) => {
    try {
        // Get all candidate IDs for org
        const candidateIds = await db
            .select({ id: candidatesTable.id })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            );

        const candidateIdList = candidateIds.map(c => c.id);

        if (candidateIdList.length === 0) {
            return {
                averageScores: { atsScore: 0, contentScore: 0, formatScore: 0, overallScore: 0 },
                scoreDistribution: { excellent: 0, good: 0, average: 0, needsWork: 0 },
                topPerformers: [],
                needsAttention: [],
                totalAnalyzed: 0
            };
        }

        // Get all resumes with scores
        const resumes = await db
            .select({
                id: candidateResumeContentTable.id,
                candidateID: candidateResumeContentTable.candidateID,
                currentScores: candidateResumeContentTable.currentScores,
                personalInfo: candidateResumeContentTable.personalInfo
            })
            .from(candidateResumeContentTable)
            .where(sql`${candidateResumeContentTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`);

        // Calculate aggregated scores
        let totalAtsScore = 0;
        let totalContentScore = 0;
        let totalFormatScore = 0;
        let totalOverallScore = 0;
        let scoreCount = 0;
        const scoreDistribution = {
            excellent: 0,
            good: 0,
            average: 0,
            needsWork: 0
        };
        const candidateScores = [];

        resumes.forEach(resume => {
            const scores = resume.currentScores || {};
            if (scores.atsScore !== undefined) {
                totalAtsScore += scores.atsScore || 0;
                totalContentScore += scores.contentScore || 0;
                totalFormatScore += scores.formatScore || 0;
                totalOverallScore += scores.overallScore || 0;
                scoreCount++;

                const ats = scores.atsScore || 0;
                if (ats >= 90) scoreDistribution.excellent++;
                else if (ats >= 70) scoreDistribution.good++;
                else if (ats >= 50) scoreDistribution.average++;
                else scoreDistribution.needsWork++;

                candidateScores.push({
                    resumeId: resume.id,
                    candidateID: resume.candidateID,
                    name: resume.personalInfo?.fullName || 'Unknown',
                    atsScore: ats
                });
            }
        });

        // Sort for top performers and needs attention
        candidateScores.sort((a, b) => b.atsScore - a.atsScore);
        const topPerformers = candidateScores.slice(0, 5);
        const needsAttention = [...candidateScores].sort((a, b) => a.atsScore - b.atsScore).slice(0, 5);

        return {
            averageScores: {
                atsScore: scoreCount > 0 ? Math.round(totalAtsScore / scoreCount) : 0,
                contentScore: scoreCount > 0 ? Math.round(totalContentScore / scoreCount) : 0,
                formatScore: scoreCount > 0 ? Math.round(totalFormatScore / scoreCount) : 0,
                overallScore: scoreCount > 0 ? Math.round(totalOverallScore / scoreCount) : 0
            },
            scoreDistribution,
            topPerformers,
            needsAttention,
            totalAnalyzed: scoreCount
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get organisation score analytics', {
            error: error.message,
            organisationID
        });
        throw new AppError(`Failed to get organisation score analytics: ${error.message}`, 500);
    }
};

/**
 * Get recent candidates for organisation
 * @param {number} organisationID - Organisation ID
 * @param {number} limit - Number of candidates to return
 * @returns {Promise<Array>} Recent candidates
 */
export const getOrganisationRecentCandidates = async (organisationID, limit = 10) => {
    try {
        const candidates = await db
            .select({
                id: candidatesTable.id,
                fullname: candidatesTable.fullname,
                email: candidatesTable.email,
                isVerified: candidatesTable.isVerified,
                createdAt: candidatesTable.createdAt
            })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            )
            .orderBy(desc(candidatesTable.createdAt))
            .limit(limit);

        // Get resume counts for each candidate
        const candidatesWithStats = await Promise.all(
            candidates.map(async (candidate) => {
                const [resumeCount] = await db
                    .select({ count: count() })
                    .from(candidateResumeContentTable)
                    .where(eq(candidateResumeContentTable.candidateID, candidate.id));

                // Get latest resume score
                const latestResume = await db
                    .select({ currentScores: candidateResumeContentTable.currentScores })
                    .from(candidateResumeContentTable)
                    .where(eq(candidateResumeContentTable.candidateID, candidate.id))
                    .orderBy(desc(candidateResumeContentTable.updatedAt))
                    .limit(1);

                return {
                    ...candidate,
                    resumeCount: resumeCount?.count || 0,
                    latestAtsScore: latestResume[0]?.currentScores?.atsScore || null
                };
            })
        );

        return candidatesWithStats;
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get recent candidates', {
            error: error.message,
            organisationID
        });
        throw new AppError(`Failed to get recent candidates: ${error.message}`, 500);
    }
};

/**
 * Get recent resumes across organisation
 * @param {number} organisationID - Organisation ID
 * @param {number} limit - Number of resumes to return
 * @returns {Promise<Array>} Recent resumes
 */
export const getOrganisationRecentResumes = async (organisationID, limit = 10) => {
    try {
        // Get candidate IDs for org
        const candidateIds = await db
            .select({ id: candidatesTable.id, fullname: candidatesTable.fullname })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            );

        const candidateIdList = candidateIds.map(c => c.id);
        const candidateMap = candidateIds.reduce((acc, c) => {
            acc[c.id] = c.fullname;
            return acc;
        }, {});

        if (candidateIdList.length === 0) {
            return [];
        }

        const resumes = await db
            .select({
                id: candidateResumeContentTable.id,
                candidateID: candidateResumeContentTable.candidateID,
                analysisID: candidateResumeContentTable.analysisID,
                personalInfo: candidateResumeContentTable.personalInfo,
                currentScores: candidateResumeContentTable.currentScores,
                lastEditType: candidateResumeContentTable.lastEditType,
                createdAt: candidateResumeContentTable.createdAt,
                updatedAt: candidateResumeContentTable.updatedAt,
                documentTitle: candidateDocumentTable.title,
                analysisStatus: candidateAnalysisTable.status
            })
            .from(candidateResumeContentTable)
            .innerJoin(candidateAnalysisTable, eq(candidateResumeContentTable.analysisID, candidateAnalysisTable.id))
            .innerJoin(candidateDocumentTable, eq(candidateAnalysisTable.documentID, candidateDocumentTable.id))
            .where(sql`${candidateResumeContentTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`)
            .orderBy(desc(candidateResumeContentTable.updatedAt))
            .limit(limit);

        return resumes.map(resume => ({
            id: resume.id,
            candidateID: resume.candidateID,
            candidateName: candidateMap[resume.candidateID] || 'Unknown',
            title: resume.documentTitle || resume.personalInfo?.fullName || 'Untitled Resume',
            atsScore: resume.currentScores?.atsScore || 0,
            overallScore: resume.currentScores?.overallScore || 0,
            lastEditType: resume.lastEditType,
            status: resume.analysisStatus,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt
        }));
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get organisation recent resumes', {
            error: error.message,
            organisationID
        });
        throw new AppError(`Failed to get organisation resumes: ${error.message}`, 500);
    }
};

/**
 * Get organisation activity timeline
 * @param {number} organisationID - Organisation ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity data
 */
export const getOrganisationActivityTimeline = async (organisationID, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get candidate IDs
        const candidateIds = await db
            .select({ id: candidatesTable.id })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    isNull(candidatesTable.deletedAt)
                )
            );

        const candidateIdList = candidateIds.map(c => c.id);

        // Candidates joined over time
        const candidatesJoined = await db
            .select({
                date: sql`DATE(${candidatesTable.createdAt})`.as('date'),
                count: count()
            })
            .from(candidatesTable)
            .where(
                and(
                    eq(candidatesTable.organisationID, organisationID),
                    gte(candidatesTable.createdAt, startDate),
                    isNull(candidatesTable.deletedAt)
                )
            )
            .groupBy(sql`DATE(${candidatesTable.createdAt})`);

        let resumesCreated = [];
        let rewritesCreated = [];

        if (candidateIdList.length > 0) {
            // Resumes created over time
            resumesCreated = await db
                .select({
                    date: sql`DATE(${candidateResumeContentTable.createdAt})`.as('date'),
                    count: count()
                })
                .from(candidateResumeContentTable)
                .where(
                    and(
                        sql`${candidateResumeContentTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`,
                        gte(candidateResumeContentTable.createdAt, startDate)
                    )
                )
                .groupBy(sql`DATE(${candidateResumeContentTable.createdAt})`);

            // Rewrites created over time
            rewritesCreated = await db
                .select({
                    date: sql`DATE(${candidateResumeRewritesTable.createdAt})`.as('date'),
                    count: count()
                })
                .from(candidateResumeRewritesTable)
                .where(
                    and(
                        sql`${candidateResumeRewritesTable.candidateID} IN (${sql.join(candidateIdList, sql`, `)})`,
                        gte(candidateResumeRewritesTable.createdAt, startDate)
                    )
                )
                .groupBy(sql`DATE(${candidateResumeRewritesTable.createdAt})`);
        }

        return {
            period: { startDate, endDate: new Date(), days },
            candidatesJoined: candidatesJoined.map(r => ({ date: r.date, count: Number(r.count) })),
            resumesCreated: resumesCreated.map(r => ({ date: r.date, count: Number(r.count) })),
            rewritesCreated: rewritesCreated.map(r => ({ date: r.date, count: Number(r.count) }))
        };
    } catch (error) {
        logger.error('[DASHBOARD_MODEL] Failed to get organisation activity timeline', {
            error: error.message,
            organisationID
        });
        throw new AppError(`Failed to get organisation activity: ${error.message}`, 500);
    }
};

export default {
    // Helper
    getCandidateOrganisationID,
    // User/Candidate dashboard
    getUserDashboardStats,
    getUserScoreAnalytics,
    getUserRecentResumes,
    getUserRewriteAnalytics,
    getUserActivityTimeline,
    // Organisation dashboard
    getOrganisationDashboardStats,
    getOrganisationScoreAnalytics,
    getOrganisationRecentCandidates,
    getOrganisationRecentResumes,
    getOrganisationActivityTimeline
};
