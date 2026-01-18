import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { forgotPasswordController, LoginControllerCandidate, registerSingleController, registerBulkController, resetPasswordControllerCandidate, verifyCandidateController } from "../../controllers/candidate.auth.controller.js";

const router = Router();

router.get('/health', (req, res, next) => {
    logger.info("API v1 AUTH health route accessed");
    sendSuccess(res, null, "Success-CV API v1 AUTH");
});

router.post('/register', (req, res, next) => {
    logger.info("Single candidate registration endpoint hit");
    next();
}, registerSingleController);

router.post('/register/bulk', (req, res, next) => {
    logger.info("Bulk candidate registration endpoint hit");
    next();
}, registerBulkController);

router.post('/login', (req, res, next) => {
    logger.info("Candidate login endpoint hit");
    next();
}, LoginControllerCandidate);

router.post('/verify/send', (req, res, next) => {
    logger.info("Send verification code endpoint hit");
    sendSuccess(res, null, "Verification code sent successfully");
});

router.post('/verify', (req, res, next) => {
    logger.info("Confirm verification code endpoint hit");
    next();
}, verifyCandidateController);

router.post('/forgot-password', (req, res, next) => {
    logger.info("Forgot password endpoint hit");
    next();
}, forgotPasswordController);

router.post('/forgot-password/:token', (req, res, next) => {
    logger.info("Reset password endpoint hit");
    next();
}, resetPasswordControllerCandidate);

export const candidateAuthRoutes = router;
