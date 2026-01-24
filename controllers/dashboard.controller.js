import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import dashboardService from "../services/dashboard.service.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Dashboard Controller
 * 
 * Handles dashboard analytics requests for:
 * - Individual users (B2C) and candidates (B2B individual view)
 * - Organisations (B2B org-wide view)
 */

// ========== USER/CANDIDATE DASHBOARD ENDPOINTS ==========

/**
 * Get complete dashboard for authenticated user/candidate
 * GET /api/v1/dashboard
 * 
 * Returns: stats, scores, recentResumes, rewriteAnalytics
 */
export const getDashboardController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[DASHBOARD_CONTROLLER] Fetching complete dashboard', { userID, userType });

    const dashboard = await dashboardService.getUserDashboard(userID, userType);

    sendSuccess(res, dashboard, 'Dashboard fetched successfully', 200);
});

/**
 * Get dashboard summary stats (for quick stat cards)
 * GET /api/v1/dashboard/stats
 * 
 * Returns: totalResumes, totalDocuments, totalRewrites, activeRewrites, analysisByStatus, rewritesByStatus
 */
export const getDashboardStatsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[DASHBOARD_CONTROLLER] Fetching dashboard stats', { userID, userType });

    const stats = await dashboardService.getUserDashboardStats(userID, userType);

    sendSuccess(res, stats, 'Dashboard stats fetched successfully', 200);
});

/**
 * Get score analytics for charts
 * GET /api/v1/dashboard/scores
 * 
 * Returns: averageScores, scoreDistribution, bestScore, worstScore, totalAnalyzed
 */
export const getDashboardScoresController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[DASHBOARD_CONTROLLER] Fetching score analytics', { userID, userType });

    const scores = await dashboardService.getUserScoreAnalytics(userID, userType);

    sendSuccess(res, scores, 'Score analytics fetched successfully', 200);
});

/**
 * Get recent resumes list
 * GET /api/v1/dashboard/resumes/recent
 * @query limit - Number of resumes to return (default: 5, max: 20)
 * 
 * Returns: Array of recent resumes with id, title, atsScore, status, etc.
 */
export const getDashboardRecentResumesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    logger.info('[DASHBOARD_CONTROLLER] Fetching recent resumes', { userID, userType, limit });

    const resumes = await dashboardService.getUserRecentResumes(userID, userType, limit);

    sendSuccess(res, resumes, 'Recent resumes fetched successfully', 200);
});

/**
 * Get rewrite analytics
 * GET /api/v1/dashboard/rewrites
 * 
 * Returns: totalRewrites, completedRewrites, activeRewrites, averageScoreImprovement, issuesResolved
 */
export const getDashboardRewritesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[DASHBOARD_CONTROLLER] Fetching rewrite analytics', { userID, userType });

    const rewriteAnalytics = await dashboardService.getUserRewriteAnalytics(userID, userType);

    sendSuccess(res, rewriteAnalytics, 'Rewrite analytics fetched successfully', 200);
});

/**
 * Get activity timeline for charts
 * GET /api/v1/dashboard/activity
 * @query days - Number of days to look back (default: 30, max: 90)
 * 
 * Returns: resumesCreated, rewritesCreated, documentsUploaded (by date)
 */
export const getDashboardActivityController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    logger.info('[DASHBOARD_CONTROLLER] Fetching activity timeline', { userID, userType, days });

    const activity = await dashboardService.getUserActivityTimeline(userID, userType, days);

    sendSuccess(res, activity, 'Activity timeline fetched successfully', 200);
});

// ========== ORGANISATION DASHBOARD ENDPOINTS ==========
// These work for both users (with org ID) and candidates (auto-detect org)

/**
 * Get complete organisation dashboard
 * GET /api/v1/dashboard/organisation
 * GET /api/v1/dashboard/organisation/:organisationId
 * 
 * For candidates: organisationId is optional (auto-detected from their record)
 * For users: organisationId is required
 * 
 * Returns: stats, scores, recentCandidates, recentResumes
 */
export const getOrganisationDashboardController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    // Parse org ID - optional for candidates
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation dashboard', { userID, userType, organisationID });

    const dashboard = await dashboardService.getOrganisationDashboard(organisationID, userID, userType);

    sendSuccess(res, dashboard, 'Organisation dashboard fetched successfully', 200);
});

/**
 * Get organisation summary stats
 * GET /api/v1/dashboard/organisation/stats
 * GET /api/v1/dashboard/organisation/:organisationId/stats
 * 
 * Returns: totalCandidates, verifiedCandidates, totalResumes, totalRewrites, etc.
 */
export const getOrganisationStatsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation stats', { userID, userType, organisationID });

    const stats = await dashboardService.getOrganisationStats(organisationID, userID, userType);

    sendSuccess(res, stats, 'Organisation stats fetched successfully', 200);
});

/**
 * Get organisation score analytics
 * GET /api/v1/dashboard/organisation/scores
 * GET /api/v1/dashboard/organisation/:organisationId/scores
 * 
 * Returns: averageScores, scoreDistribution, topPerformers, needsAttention
 */
export const getOrganisationScoresController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation score analytics', { userID, userType, organisationID });

    const scores = await dashboardService.getOrganisationScoreAnalytics(organisationID, userID, userType);

    sendSuccess(res, scores, 'Organisation score analytics fetched successfully', 200);
});

/**
 * Get recent candidates in organisation
 * GET /api/v1/dashboard/organisation/candidates/recent
 * GET /api/v1/dashboard/organisation/:organisationId/candidates/recent
 * @query limit - Number of candidates to return (default: 10, max: 50)
 * 
 * Returns: Array of recent candidates with resume counts and scores
 */
export const getOrganisationRecentCandidatesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation recent candidates', { userID, userType, organisationID, limit });

    const result = await dashboardService.getOrganisationRecentCandidates(organisationID, userID, userType, limit);

    sendSuccess(res, result, 'Recent candidates fetched successfully', 200);
});

/**
 * Get recent resumes across organisation
 * GET /api/v1/dashboard/organisation/resumes/recent
 * GET /api/v1/dashboard/organisation/:organisationId/resumes/recent
 * @query limit - Number of resumes to return (default: 10, max: 50)
 * 
 * Returns: Array of recent resumes with candidate info and scores
 */
export const getOrganisationRecentResumesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation recent resumes', { userID, userType, organisationID, limit });

    const result = await dashboardService.getOrganisationRecentResumes(organisationID, userID, userType, limit);

    sendSuccess(res, result, 'Recent resumes fetched successfully', 200);
});

/**
 * Get organisation activity timeline
 * GET /api/v1/dashboard/organisation/activity
 * GET /api/v1/dashboard/organisation/:organisationId/activity
 * @query days - Number of days to look back (default: 30, max: 90)
 * 
 * Returns: candidatesJoined, resumesCreated, rewritesCreated (by date)
 */
export const getOrganisationActivityController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const organisationID = req.params.organisationId ? parseInt(req.params.organisationId) : null;
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    logger.info('[DASHBOARD_CONTROLLER] Fetching organisation activity timeline', { userID, userType, organisationID, days });

    const result = await dashboardService.getOrganisationActivityTimeline(organisationID, userID, userType, days);

    sendSuccess(res, result, 'Organisation activity timeline fetched successfully', 200);
});

export default {
    // User/Candidate dashboard
    getDashboardController,
    getDashboardStatsController,
    getDashboardScoresController,
    getDashboardRecentResumesController,
    getDashboardRewritesController,
    getDashboardActivityController,
    // Organisation dashboard
    getOrganisationDashboardController,
    getOrganisationStatsController,
    getOrganisationScoresController,
    getOrganisationRecentCandidatesController,
    getOrganisationRecentResumesController,
    getOrganisationActivityController
};
