import { Router } from "express";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { authRoutes } from "./auth.route.js";
import logger from "../../middleware/logger.js";
import { userRoutes } from "./user.route.js";
import { organisationRoutes } from "./organisation.route.js";
import { invitesRoutes } from "./invites.route.js";
import { healthRoutes } from "./health.route.js";
import healthScrapingRoutes from "./health-scraping.route.js";
import sseRoutes from "./sse.route.js";
import { uploadRoutes } from "./upload.route.js";
import { resumeAnalysisRoutes } from "./resume-analysis.route.js";
import { resumeRoutes } from "./resume.route.js";
import { adminRoutes } from "./admin.route.js";
import { profileRoutes } from "./profile.route.js";
import { dashboardRoutes } from "./dashboard.route.js";
import jobRoutes from "./job.route.js";
import billingRoutes from "./billing.route.js";

const router = Router();

router.get('/health', (req, res) => {
    logger.info("API v1 health route accessed");

    const apiInfo = {
        version: "v1",
        endpoints: [
            "GET /api/v1/health",
            "GET /api/v1/health/redis",
            "GET /api/v1/health/queue",
            "GET /api/v1/health/cache",
            "GET /api/v1/health/full"
        ]
    };

    sendSuccess(res, apiInfo, "Success-CV API v1");
});

router.use('/health', healthRoutes);
router.use('/health', healthScrapingRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/user', userRoutes);
router.use('/organisations', organisationRoutes);
router.use('/invites', invitesRoutes);
router.use('/sse', sseRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/dashboard', dashboardRoutes);

// Resume routes
router.use('/resume-analysis', resumeAnalysisRoutes);
router.use('/resumes', resumeRoutes);

// Billing routes
router.use('/billing', billingRoutes);

// Job routes
router.use('/', jobRoutes);

export default router;

export const routerV1 = router;