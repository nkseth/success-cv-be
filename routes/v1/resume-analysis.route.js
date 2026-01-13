import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import {
    getResumeAnalysisController,
    updateResumeAnalysisController,
    getAllResumeAnalysesController
} from "../../controllers/resume-analysis.controller.js";

/**
 * Resume Analysis Routes
 */

const router = Router();

router.use(commonAuthenticate);

// Health check route
router.get('/health', (req, res, next) => {
    logger.info("API v1 Resume Analysis health route accessed");
    sendSuccess(res, null, "Success-CV API v1 Resume Analysis is healthy");
});

// Get all resume analyses for the authenticated user
router.get('/', getAllResumeAnalysesController);

// Get specific resume analysis details by ID
router.get('/:analysisId', getResumeAnalysisController);

// Update resume analysis processed data
router.put('/:analysisId', updateResumeAnalysisController);

export const resumeAnalysisRoutes = router;
