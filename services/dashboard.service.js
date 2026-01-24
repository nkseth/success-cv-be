import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import dashboardModel from "../models/dashboard.model.js";
import { checkOrgMemberExists } from "../models/invite-member.model.js";
import { userTypeConstants } from "../utils/constants.js";
import cacheService from "./cache.service.js";

/**
 * Dashboard Service
 * 
 * Provides analytics and statistics for:
 * - Individual users (B2C)
 * - Candidates (B2B - individual view)
 * - Organisations (B2B - org-wide view)
 * 
 * Uses dynamic tables pattern - same endpoints work for both users and candidates.
 * For candidates, organisation dashboard is automatically available via their organisationID.
 * 
 * CACHING STRATEGY:
 * - User dashboard data cached for 5 minutes (300s)
 * - Organisation dashboard data cached for 5 minutes (300s) 
 * - Activity timelines cached for 10 minutes (600s) since they're date-based
 * - Cache invalidation should be triggered when resumes/rewrites are created/updated
 */

// Cache TTL constants (in seconds)
const CACHE_TTL = {
    DASHBOARD: 300,      // 5 minutes for full dashboard
    STATS: 300,          // 5 minutes for stats
    SCORES: 300,         // 5 minutes for score analytics
    RESUMES: 180,        // 3 minutes for recent resumes (more dynamic)
    REWRITES: 300,       // 5 minutes for rewrite analytics
    ACTIVITY: 600,       // 10 minutes for activity timeline
    ORG_DASHBOARD: 300,  // 5 minutes for org dashboard
    ORG_STATS: 300,      // 5 minutes for org stats
    ORG_CANDIDATES: 180, // 3 minutes for recent candidates
    ORG_RESUMES: 180     // 3 minutes for org recent resumes
};

// Cache key builders
const buildCacheKey = {
    userDashboard: (userID, userType) => `dashboard:${userType}:${userID}:full`,
    userStats: (userID, userType) => `dashboard:${userType}:${userID}:stats`,
    userScores: (userID, userType) => `dashboard:${userType}:${userID}:scores`,
    userResumes: (userID, userType, limit) => `dashboard:${userType}:${userID}:resumes:${limit}`,
    userRewrites: (userID, userType) => `dashboard:${userType}:${userID}:rewrites`,
    userActivity: (userID, userType, days) => `dashboard:${userType}:${userID}:activity:${days}`,
    orgDashboard: (orgID) => `dashboard:org:${orgID}:full`,
    orgStats: (orgID) => `dashboard:org:${orgID}:stats`,
    orgScores: (orgID) => `dashboard:org:${orgID}:scores`,
    orgCandidates: (orgID, limit) => `dashboard:org:${orgID}:candidates:${limit}`,
    orgResumes: (orgID, limit) => `dashboard:org:${orgID}:resumes:${limit}`,
    orgActivity: (orgID, days) => `dashboard:org:${orgID}:activity:${days}`
};

// ========== HELPER FUNCTIONS ==========

/**
 * Verify user has access to organisation dashboard
 * For regular users: must be a member of the organisation
 * For candidates: automatically have access to their own organisation
 * @param {number} organisationID - Organisation ID
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @throws {AppError} If user does not have access
 */
const verifyOrgAccess = async (organisationID, userID, userType) => {
    // Candidates automatically have access to their own org
    if (userType === userTypeConstants.CANDIDATE) {
        const candidateOrgID = await dashboardModel.getCandidateOrganisationID(userID);
        if (candidateOrgID !== organisationID) {
            throw new AppError('You do not have access to this organisation dashboard', 403);
        }
        return;
    }
    
    // Regular users must be org members
    const isMember = await checkOrgMemberExists(organisationID, userID, null);
    if (!isMember) {
        throw new AppError('You do not have access to this organisation dashboard', 403);
    }
};

/**
 * Get the organisation ID for the current user
 * For candidates: returns their organisationID
 * For users: returns null (they must specify which org)
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<number|null>} Organisation ID or null
 */
const getAutoOrganisationID = async (userID, userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return await dashboardModel.getCandidateOrganisationID(userID);
    }
    return null;
};

// ========== CACHE INVALIDATION HELPERS ==========

/**
 * Invalidate all dashboard cache for a user
 * Call this when a user's resume/rewrite data changes
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 */
export const invalidateUserDashboardCache = async (userID, userType = userTypeConstants.USER) => {
    try {
        const pattern = `dashboard:${userType}:${userID}:*`;
        const deleted = await cacheService.deletePattern(pattern);
        logger.info('[DASHBOARD_SERVICE] User dashboard cache invalidated', { userID, userType, deleted });
        return deleted;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to invalidate user dashboard cache', {
            error: error.message,
            userID,
            userType
        });
        return 0;
    }
};

/**
 * Invalidate all dashboard cache for an organisation
 * Call this when organisation-level data changes
 * @param {number} organisationID - Organisation ID
 */
export const invalidateOrgDashboardCache = async (organisationID) => {
    try {
        const pattern = `dashboard:org:${organisationID}:*`;
        const deleted = await cacheService.deletePattern(pattern);
        logger.info('[DASHBOARD_SERVICE] Organisation dashboard cache invalidated', { organisationID, deleted });
        return deleted;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to invalidate org dashboard cache', {
            error: error.message,
            organisationID
        });
        return 0;
    }
};

// ========== USER/CANDIDATE DASHBOARD SERVICES ==========

/**
 * Get complete dashboard data for a user/candidate
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete dashboard data
 */
export const getUserDashboard = async (userID, userType = userTypeConstants.USER) => {
    const cacheKey = buildCacheKey.userDashboard(userID, userType);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.info('[DASHBOARD_SERVICE] ✅ User dashboard served from cache', { userID, userType });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user dashboard from DB', { userID, userType });

        // Fetch all dashboard components in parallel
        const [stats, scores, recentResumes, rewriteAnalytics] = await Promise.all([
            dashboardModel.getUserDashboardStats(userID, userType),
            dashboardModel.getUserScoreAnalytics(userID, userType),
            dashboardModel.getUserRecentResumes(userID, userType, 5),
            dashboardModel.getUserRewriteAnalytics(userID, userType)
        ]);

        const dashboard = {
            stats,
            scores,
            recentResumes,
            rewriteAnalytics
        };

        // Cache the result
        await cacheService.set(cacheKey, dashboard, CACHE_TTL.DASHBOARD);

        logger.info('[DASHBOARD_SERVICE] ✅ User dashboard fetched and cached', { userID, userType });

        return dashboard;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user dashboard', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

/**
 * Get summary statistics for dashboard cards
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Summary stats
 */
export const getUserDashboardStats = async (userID, userType = userTypeConstants.USER) => {
    const cacheKey = buildCacheKey.userStats(userID, userType);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] User stats served from cache', { userID, userType });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user dashboard stats from DB', { userID, userType });
        
        const stats = await dashboardModel.getUserDashboardStats(userID, userType);
        
        // Cache the result
        await cacheService.set(cacheKey, stats, CACHE_TTL.STATS);
        
        return stats;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user dashboard stats', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

/**
 * Get score analytics for charts
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Score analytics
 */
export const getUserScoreAnalytics = async (userID, userType = userTypeConstants.USER) => {
    const cacheKey = buildCacheKey.userScores(userID, userType);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] User scores served from cache', { userID, userType });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user score analytics from DB', { userID, userType });
        
        const scores = await dashboardModel.getUserScoreAnalytics(userID, userType);
        
        // Cache the result
        await cacheService.set(cacheKey, scores, CACHE_TTL.SCORES);
        
        return scores;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user score analytics', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

/**
 * Get recent resumes list
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} limit - Number of resumes to return
 * @returns {Promise<Array>} Recent resumes
 */
export const getUserRecentResumes = async (userID, userType = userTypeConstants.USER, limit = 5) => {
    const cacheKey = buildCacheKey.userResumes(userID, userType, limit);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] User recent resumes served from cache', { userID, userType, limit });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user recent resumes from DB', { userID, userType, limit });
        
        const resumes = await dashboardModel.getUserRecentResumes(userID, userType, limit);
        
        // Cache the result (shorter TTL since this is more dynamic)
        await cacheService.set(cacheKey, resumes, CACHE_TTL.RESUMES);
        
        return resumes;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user recent resumes', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

/**
 * Get rewrite analytics
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Rewrite analytics
 */
export const getUserRewriteAnalytics = async (userID, userType = userTypeConstants.USER) => {
    const cacheKey = buildCacheKey.userRewrites(userID, userType);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] User rewrite analytics served from cache', { userID, userType });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user rewrite analytics from DB', { userID, userType });
        
        const analytics = await dashboardModel.getUserRewriteAnalytics(userID, userType);
        
        // Cache the result
        await cacheService.set(cacheKey, analytics, CACHE_TTL.REWRITES);
        
        return analytics;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user rewrite analytics', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

/**
 * Get activity timeline data
 * @param {number} userID - User or Candidate ID
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity timeline
 */
export const getUserActivityTimeline = async (userID, userType = userTypeConstants.USER, days = 30) => {
    const cacheKey = buildCacheKey.userActivity(userID, userType, days);
    
    try {
        // Check cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] User activity timeline served from cache', { userID, userType, days });
            return cached;
        }

        logger.info('[DASHBOARD_SERVICE] Fetching user activity timeline from DB', { userID, userType, days });
        
        const timeline = await dashboardModel.getUserActivityTimeline(userID, userType, days);
        
        // Cache the result (longer TTL since this is date-based historical data)
        await cacheService.set(cacheKey, timeline, CACHE_TTL.ACTIVITY);
        
        return timeline;
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch user activity timeline', {
            error: error.message,
            userID,
            userType
        });
        throw error;
    }
};

// ========== ORGANISATION DASHBOARD SERVICES ==========

/**
 * Get complete organisation dashboard data
 * For candidates: organisationID can be null (auto-detected from their record)
 * For users: organisationID is required
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete organisation dashboard
 */
export const getOrganisationDashboard = async (organisationID, userID, userType = userTypeConstants.USER) => {
    try {
        // Auto-detect org for candidates if not provided
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }

        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification for security)
        const cacheKey = buildCacheKey.orgDashboard(orgID);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.info('[DASHBOARD_SERVICE] ✅ Organisation dashboard served from cache', { organisationID: orgID });
            return { organisationID: orgID, ...cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation dashboard from DB', { organisationID: orgID, userID, userType });

        // Fetch all dashboard components in parallel
        const [stats, scores, recentCandidates, recentResumes] = await Promise.all([
            dashboardModel.getOrganisationDashboardStats(orgID),
            dashboardModel.getOrganisationScoreAnalytics(orgID),
            dashboardModel.getOrganisationRecentCandidates(orgID, 10),
            dashboardModel.getOrganisationRecentResumes(orgID, 10)
        ]);

        const dashboard = {
            stats,
            scores,
            recentCandidates,
            recentResumes
        };

        // Cache the result
        await cacheService.set(cacheKey, dashboard, CACHE_TTL.ORG_DASHBOARD);

        logger.info('[DASHBOARD_SERVICE] ✅ Organisation dashboard fetched and cached', { organisationID: orgID });

        return {
            organisationID: orgID,
            ...dashboard
        };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation dashboard', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

/**
 * Get organisation summary statistics
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Organisation stats
 */
export const getOrganisationStats = async (organisationID, userID, userType = userTypeConstants.USER) => {
    try {
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }
        
        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification)
        const cacheKey = buildCacheKey.orgStats(orgID);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] Organisation stats served from cache', { organisationID: orgID });
            return { organisationID: orgID, ...cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation stats from DB', { organisationID: orgID });
        
        const stats = await dashboardModel.getOrganisationDashboardStats(orgID);
        
        // Cache the result
        await cacheService.set(cacheKey, stats, CACHE_TTL.ORG_STATS);
        
        return { organisationID: orgID, ...stats };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation stats', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

/**
 * Get organisation-wide score analytics
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Score analytics
 */
export const getOrganisationScoreAnalytics = async (organisationID, userID, userType = userTypeConstants.USER) => {
    try {
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }
        
        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification)
        const cacheKey = buildCacheKey.orgScores(orgID);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] Organisation scores served from cache', { organisationID: orgID });
            return { organisationID: orgID, ...cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation score analytics from DB', { organisationID: orgID });
        
        const scores = await dashboardModel.getOrganisationScoreAnalytics(orgID);
        
        // Cache the result
        await cacheService.set(cacheKey, scores, CACHE_TTL.ORG_STATS);
        
        return { organisationID: orgID, ...scores };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation score analytics', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

/**
 * Get recent candidates in organisation
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} limit - Number of candidates to return
 * @returns {Promise<Object>} Recent candidates with orgID
 */
export const getOrganisationRecentCandidates = async (organisationID, userID, userType = userTypeConstants.USER, limit = 10) => {
    try {
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }
        
        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification)
        const cacheKey = buildCacheKey.orgCandidates(orgID, limit);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] Organisation recent candidates served from cache', { organisationID: orgID, limit });
            return { organisationID: orgID, candidates: cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation recent candidates from DB', { organisationID: orgID, limit });
        
        const candidates = await dashboardModel.getOrganisationRecentCandidates(orgID, limit);
        
        // Cache the result
        await cacheService.set(cacheKey, candidates, CACHE_TTL.ORG_CANDIDATES);
        
        return { organisationID: orgID, candidates };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation recent candidates', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

/**
 * Get recent resumes across organisation
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} limit - Number of resumes to return
 * @returns {Promise<Object>} Recent resumes with orgID
 */
export const getOrganisationRecentResumes = async (organisationID, userID, userType = userTypeConstants.USER, limit = 10) => {
    try {
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }
        
        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification)
        const cacheKey = buildCacheKey.orgResumes(orgID, limit);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] Organisation recent resumes served from cache', { organisationID: orgID, limit });
            return { organisationID: orgID, resumes: cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation recent resumes from DB', { organisationID: orgID, limit });
        
        const resumes = await dashboardModel.getOrganisationRecentResumes(orgID, limit);
        
        // Cache the result
        await cacheService.set(cacheKey, resumes, CACHE_TTL.ORG_RESUMES);
        
        return { organisationID: orgID, resumes };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation recent resumes', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

/**
 * Get organisation activity timeline
 * @param {number|null} organisationID - Organisation ID (optional for candidates)
 * @param {number} userID - Requesting user ID (for permission check)
 * @param {string} userType - 'user' | 'candidate'
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity timeline with orgID
 */
export const getOrganisationActivityTimeline = async (organisationID, userID, userType = userTypeConstants.USER, days = 30) => {
    try {
        let orgID = organisationID;
        if (!orgID && userType === userTypeConstants.CANDIDATE) {
            orgID = await getAutoOrganisationID(userID, userType);
        }
        
        if (!orgID) {
            throw new AppError('Organisation ID is required', 400);
        }
        
        // Verify user has access to this organisation
        await verifyOrgAccess(orgID, userID, userType);

        // Check cache first (after access verification)
        const cacheKey = buildCacheKey.orgActivity(orgID, days);
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.debug('[DASHBOARD_SERVICE] Organisation activity timeline served from cache', { organisationID: orgID, days });
            return { organisationID: orgID, ...cached };
        }

        logger.info('[DASHBOARD_SERVICE] Fetching organisation activity timeline from DB', { organisationID: orgID, days });
        
        const timeline = await dashboardModel.getOrganisationActivityTimeline(orgID, days);
        
        // Cache the result (longer TTL since this is historical data)
        await cacheService.set(cacheKey, timeline, CACHE_TTL.ACTIVITY);
        
        return { organisationID: orgID, ...timeline };
    } catch (error) {
        logger.error('[DASHBOARD_SERVICE] Failed to fetch organisation activity timeline', {
            error: error.message,
            organisationID
        });
        throw error;
    }
};

export default {
    // User/Candidate dashboard
    getUserDashboard,
    getUserDashboardStats,
    getUserScoreAnalytics,
    getUserRecentResumes,
    getUserRewriteAnalytics,
    getUserActivityTimeline,
    // Organisation dashboard
    getOrganisationDashboard,
    getOrganisationStats,
    getOrganisationScoreAnalytics,
    getOrganisationRecentCandidates,
    getOrganisationRecentResumes,
    getOrganisationActivityTimeline,
    // Cache invalidation
    invalidateUserDashboardCache,
    invalidateOrgDashboardCache
};
