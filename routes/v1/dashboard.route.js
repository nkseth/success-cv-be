import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import {
    // User/Candidate dashboard endpoints
    getDashboardController,
    getDashboardStatsController,
    getDashboardScoresController,
    getDashboardRecentResumesController,
    getDashboardRewritesController,
    getDashboardActivityController,
    // Organisation dashboard endpoints
    getOrganisationDashboardController,
    getOrganisationStatsController,
    getOrganisationScoresController,
    getOrganisationRecentCandidatesController,
    getOrganisationRecentResumesController,
    getOrganisationActivityController
} from "../../controllers/dashboard.controller.js";

const router = Router();

// ========== HEALTH CHECK ==========

router.get('/health', (req, res) => {
    logger.info("API v1 Dashboard health route accessed");
    sendSuccess(res, null, "Success-CV API v1 Dashboard System is healthy");
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========

router.use(commonAuthenticate);

// ========== USER/CANDIDATE DASHBOARD ROUTES ==========
// These work for both regular users (B2C) and candidates (B2B)
// The userType is determined from the auth token (req.type)

/**
 * @route GET /api/v1/dashboard
 * @desc Get complete dashboard data for authenticated user/candidate
 * @access Private
 * @returns {Object} { stats, scores, recentResumes, rewriteAnalytics }
 */
router.get('/', getDashboardController);

/**
 * @route GET /api/v1/dashboard/stats
 * @desc Get summary statistics for dashboard cards
 * @access Private
 * @returns {Object} { totalResumes, totalDocuments, totalRewrites, activeRewrites, analysisByStatus, rewritesByStatus }
 */
router.get('/stats', getDashboardStatsController);

/**
 * @route GET /api/v1/dashboard/scores
 * @desc Get score analytics for charts (ATS scores, distributions)
 * @access Private
 * @returns {Object} { averageScores, scoreDistribution, bestScore, worstScore, totalAnalyzed }
 */
router.get('/scores', getDashboardScoresController);

/**
 * @route GET /api/v1/dashboard/resumes/recent
 * @desc Get list of recently updated resumes
 * @access Private
 * @query limit - Number of resumes (default: 5, max: 20)
 * @returns {Array} Recent resumes with id, title, atsScore, status, timestamps
 */
router.get('/resumes/recent', getDashboardRecentResumesController);

/**
 * @route GET /api/v1/dashboard/rewrites
 * @desc Get rewrite analytics and statistics
 * @access Private
 * @returns {Object} { totalRewrites, completedRewrites, activeRewrites, averageScoreImprovement, issuesResolved }
 */
router.get('/rewrites', getDashboardRewritesController);

/**
 * @route GET /api/v1/dashboard/activity
 * @desc Get activity timeline for charts
 * @access Private
 * @query days - Number of days to look back (default: 30, max: 90)
 * @returns {Object} { period, resumesCreated, rewritesCreated, documentsUploaded }
 */
router.get('/activity', getDashboardActivityController);

// ========== ORGANISATION DASHBOARD ROUTES ==========
// These work for both:
// - Candidates: organisationId is OPTIONAL (auto-detected from their record)
// - Users (org members): organisationId is REQUIRED

/**
 * @route GET /api/v1/dashboard/organisation
 * @desc Get complete organisation dashboard (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 * @returns {Object} { organisationID, stats, scores, recentCandidates, recentResumes }
 */
router.get('/organisation', getOrganisationDashboardController);

/**
 * @route GET /api/v1/dashboard/organisation/stats
 * @desc Get organisation summary statistics (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 */
router.get('/organisation/stats', getOrganisationStatsController);

/**
 * @route GET /api/v1/dashboard/organisation/scores
 * @desc Get organisation-wide score analytics (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 */
router.get('/organisation/scores', getOrganisationScoresController);

/**
 * @route GET /api/v1/dashboard/organisation/candidates/recent
 * @desc Get recently joined candidates (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 * @query limit - Number of candidates (default: 10, max: 50)
 */
router.get('/organisation/candidates/recent', getOrganisationRecentCandidatesController);

/**
 * @route GET /api/v1/dashboard/organisation/resumes/recent
 * @desc Get recent resumes across organisation (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 * @query limit - Number of resumes (default: 10, max: 50)
 */
router.get('/organisation/resumes/recent', getOrganisationRecentResumesController);

/**
 * @route GET /api/v1/dashboard/organisation/activity
 * @desc Get organisation activity timeline (auto-detect org for candidates)
 * @access Private (Candidates or Org members)
 * @query days - Number of days to look back (default: 30, max: 90)
 */
router.get('/organisation/activity', getOrganisationActivityController);

// ========== ORGANISATION DASHBOARD ROUTES WITH EXPLICIT ORG ID ==========
// For users who are members of multiple orgs, or want to specify explicitly

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId
 * @desc Get complete organisation dashboard for specific org
 * @access Private (Org members only)
 */
router.get('/organisation/:organisationId', getOrganisationDashboardController);

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId/stats
 * @desc Get organisation summary statistics for specific org
 * @access Private (Org members only)
 */
router.get('/organisation/:organisationId/stats', getOrganisationStatsController);

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId/scores
 * @desc Get organisation-wide score analytics for specific org
 * @access Private (Org members only)
 */
router.get('/organisation/:organisationId/scores', getOrganisationScoresController);

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId/candidates/recent
 * @desc Get recently joined candidates for specific org
 * @access Private (Org members only)
 * @query limit - Number of candidates (default: 10, max: 50)
 */
router.get('/organisation/:organisationId/candidates/recent', getOrganisationRecentCandidatesController);

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId/resumes/recent
 * @desc Get recent resumes for specific org
 * @access Private (Org members only)
 * @query limit - Number of resumes (default: 10, max: 50)
 */
router.get('/organisation/:organisationId/resumes/recent', getOrganisationRecentResumesController);

/**
 * @route GET /api/v1/dashboard/organisation/:organisationId/activity
 * @desc Get organisation activity timeline for specific org
 * @access Private (Org members only)
 * @query days - Number of days to look back (default: 30, max: 90)
 */
router.get('/organisation/:organisationId/activity', getOrganisationActivityController);

export const dashboardRoutes = router;
