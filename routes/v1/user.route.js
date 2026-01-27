import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import { checkAndReserveCredits } from "../../middleware/billing.middleware.js";
import { getUserByIdController } from "../../controllers/user.controller.js";
import { createOrgByUserIDController, getOrgsByUserIDController } from "../../controllers/organisation.controller.js";
import { createResumeController } from "../../controllers/resume-analysis.controller.js";

/**
 * User Routes
 * All routes require authentication (supports both users and candidates)
 */

const router = Router();

router.use(commonAuthenticate);

router.get('/health', (req, res, next) => {
    logger.info("API v1 AUTH User health route accessed");
    sendSuccess(res, null, "Success-CV API v1 AUTH User is healthy");
});

router.post('/', (req, res, next) => {
    logger.info("API v1 AUTH User route accessed for creating user");
    sendSuccess(res, null, "Success-CV API v1 AUTH User created");
});

router.get('/:id', (req, res, next) => {
    logger.info(`API v1 AUTH User route accessed for user ID: ${req.params.id}`);
    next();
}, getUserByIdController);

router.put('/:id', (req, res, next) => {
    const userId = req.params.id;
    logger.info(`API v1 AUTH User route accessed for updating user ID: ${userId}`);
    sendSuccess(res, { userId }, `Success-CV API v1 AUTH User updated for ID: ${userId}`);
});

router.get('/:id/organisations', (req, res, next) => {
    const userId = req.params.id;
    logger.info(`API v1 AUTH User organisations route accessed for user ID: ${userId}`);
    next();
}, getOrgsByUserIDController);

router.post('/:id/organisations', (req, res, next) => {
    const userId = req.params.id;
    logger.info(`API v1 AUTH User organisations route accessed for user ID: ${userId}`);
    next();
}, createOrgByUserIDController);

router.post('/:id/resumes', (req, res, next) => {
    const userId = req.params.id;
    logger.info(`API v1 AUTH User resumes route accessed for user ID: ${userId}`);
    next();
}, checkAndReserveCredits('analysis'), createResumeController);

export const userRoutes = router;
