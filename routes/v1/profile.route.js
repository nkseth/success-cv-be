import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { subdomainMiddleware } from "../../middleware/subdomain.js";
import { authenticateAdmin } from "../../middleware/admin-auth.js";
import { authenticateUser, authenticateCandidate } from "../../middleware/authenticate-routes.js";
import { getProfileController } from "../../controllers/profile.controller.js";

const router = Router();

// Health check
router.get('/health', (req, res) => {
    logger.info("Profile API health route accessed");
    sendSuccess(res, null, "Profile API is healthy");
});

/**
 * Unified Profile Route
 * 
 * GET /api/v1/profile
 * 
 * Uses JWT token type to determine which profile to fetch:
 * - Token type "admin" → Admin profile (from admin_users table)
 * - Token type "user" → User profile (from users table)
 * - Token type "candidate" → Candidate profile (from candidates table)
 * 
 * Works with frontend subdomains (admin.localhost, app.localhost, [org].localhost)
 * Backend uses token type, not subdomain
 */
router.get('/', 
    subdomainMiddleware,
    (req, res, next) => {
        // Apply appropriate authentication middleware based on token type
        const { isAdmin, isApp, isOrganisation } = req.subdomainContext || {};
        
        logger.info('[PROFILE] Context detected', {
            isAdmin,
            isApp,
            isOrganisation,
            userType: req.subdomainContext?.userType
        });
        
        if (isAdmin) {
            return authenticateAdmin(req, res, next);
        } else if (isApp) {
            return authenticateUser(req, res, next);
        } else if (isOrganisation) {
            return authenticateCandidate(req, res, next);
        } else {
            logger.error('[PROFILE] No valid context found');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
    },
    getProfileController
);

export const profileRoutes = router;
