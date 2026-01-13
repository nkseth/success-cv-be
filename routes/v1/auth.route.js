import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { candidateAuthRoutes } from "./candidate-auth.route.js";
import { confirmVerificationCodeController, forgotPasswordController, LoginController, refreshTokenController, registerController, resetPasswordController, sendVerificationCodeController } from "../../controllers/auth.controller.js";

/**
 * Auth Routes
 * Uses token-based context middleware for multi-tenant support
 * Token types: 'admin', 'user', 'candidate'
 */

const router = Router();

router.get('/health', (req, res, next) => {
    logger.info("API v1 AUTH health route accessed");
    sendSuccess(res, null, "Success-CV API v1 AUTH");
});

router.use('/candidate', candidateAuthRoutes)

router.post('/register', (req, res, next) => {
    logger.info("User registration endpoint hit");
    next();
}, registerController);

router.post('/login', (req, res, next) => {
    logger.info("User login endpoint hit");
    next();
}, LoginController);

router.get('/refresh-token', (req, res, next) => {
    logger.info("Token refresh endpoint hit");
    next();
}, refreshTokenController);

router.post('/verify/send', (req, res, next) => {
    logger.info("Send verification code endpoint hit");
    next();
}, sendVerificationCodeController);

router.get('/verify/:token', (req, res, next) => {
    logger.info("Confirm verification code endpoint hit");
    next();
}, confirmVerificationCodeController);

router.post('/forgot-password', (req, res, next) => {
    logger.info("Forgot password endpoint hit");
    next();
}, forgotPasswordController);

router.post('/forgot-password/:token', (req, res, next) => {
    logger.info("Reset password endpoint hit");
    next();
}, resetPasswordController);

export const authRoutes = router;
