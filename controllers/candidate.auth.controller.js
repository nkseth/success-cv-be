import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from "../middleware/error.js";
import { sendPasswordResetEmail } from "../services/email/emailTrigger.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { userTypeConstants } from "../utils/constants.js";
import { validateEmail, validateString } from "../utils/validate-helper.js";
import { comparePassword } from '../utils/security-helper.js';
import { createCandidate, createCandidatesBulk, forgotpasswordTokenGenerationCandidate, getCandidateByEmail, resetPasswordUsingToken, verifyCandidateByToken } from '../models/candidate.model.js';

export const registerSingleController = asyncHandler(async (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        return next(new AppError('Invalid request body', 400));
    }

    const { fullname, email, password, organisationID } = req.body;

    if (!fullname || !email || !password || !organisationID) {
        return next(new AppError('All fields are required: fullname, email, password, organisationID', 400));
    }

    try {
        const candidate = await createCandidate({ fullname, email, password, organisationID });

        sendSuccess(res, candidate, 'Candidate registered successfully', 201);
    } catch (error) {
        console.log('Single candidate registration error:', error);
        return next(error);
    }
});

export const registerBulkController = asyncHandler(async (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        return next(new AppError('Invalid request body', 400));
    }

    const { candidates } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return next(new AppError('Candidates array is required and must not be empty', 400));
    }

    if (candidates.length > 1000) {
        return next(new AppError('Maximum 1000 candidates can be registered at once', 400));
    }

    try {
        const startTime = new Date();
        console.log(`Starting bulk registration: ${candidates.length} candidates`);

        // Direct call to bulk create - no batching needed in controller
        const results = await createCandidatesBulk(candidates);

        const endTime = new Date();
        const duration = endTime - startTime;

        console.log(`Bulk registration completed: ${results.successful}/${candidates.length} successful in ${duration}ms`);

        // Determine status code based on results
        const statusCode = results.failed === 0 ? 201 : (results.successful === 0 ? 400 : 207);

        // Create a more informative message
        let message = `Bulk registration completed: ${results.successful} successful, ${results.failed} failed`;
        
        // If all failed and there are duplicates, make it clear
        if (results.successful === 0 && results.duplicateEmails.length > 0) {
            if (results.duplicateEmails.length === candidates.length) {
                message = 'All candidates already exist in the system';
            } else {
                message = `Bulk registration failed: ${results.duplicateEmails.length} candidate(s) already exist`;
            }
        }

        sendSuccess(res, {
            summary: {
                total: candidates.length,
                successful: results.successful,
                failed: results.failed,
                successRate: `${((results.successful / candidates.length) * 100).toFixed(2)}%`,
                duration: `${duration}ms`,
                duplicateEmails: results.duplicateEmails.length
            },
            successfulCandidates: results.successfulCandidates,
            failures: results.failures,
            duplicateEmails: results.duplicateEmails
        }, message, statusCode);

    } catch (error) {
        console.log('Bulk registration error:', error);
        return next(new AppError(`Bulk registration failed: ${error.message}`, 500));
    }
});

export const forgotPasswordController = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return next(new AppError('Email is required', 400));
    }
    let user = await getCandidateByEmail(email);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    // add forgot password token generation and storage logic here (if needed)
    const resetToken = await forgotpasswordTokenGenerationCandidate(user.id);
    if (!resetToken) {
        return next(new AppError('Failed to generate password reset token', 500));
    }
    // Send password reset email
    await sendPasswordResetEmail(email, user.fullname, `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);

    sendSuccess(res, null, 'Password reset link has been sent to your email', 200);

})

export const resetPasswordControllerCandidate = asyncHandler(async (req, res, next) => {
    const { newPassword } = req.body;
    const { token } = req.params;

    if (!token || !newPassword) {
        return next(new AppError('Token and new password are required', 400));
    }

    // Check if the token is valid
    const response = await resetPasswordUsingToken(token, newPassword);

    if (!response) {
        return next(new AppError('Invalid or expired token', 400));
    }

    sendSuccess(res, null, 'Password has been reset successfully', 200);
});

export const LoginControllerCandidate = asyncHandler(async (req, res, next) => {
    // Validate body
    if (!req.body || typeof req.body !== 'object') {
        return next(new AppError('Invalid request body', 400));
    }

    // Validate inputs
    const { email, password } = req.body;
    const validatedEmail = validateEmail(email);
    const validatedPassword = validateString(password, 'Password');

    // Check if user exists (with password hash for verification)
    const user = await getCandidateByEmail(validatedEmail, true);
    if (!user) {
        return next(new AppError('This user does not exist', 401));
    }

    // if (user.isVerified === false) {
    //     return next(new AppError('User is not verified. Please verify your email before logging in.', 401));
    // }

    if (user.deletedAt) {
        return next(new AppError('User account has been deleted.', 401));
    }

    // Verify password using secure utility
    const isPasswordValid = await comparePassword(validatedPassword, user.passwordHash);
    if (!isPasswordValid) {
        return next(new AppError('Invalid credentials', 401));
    }

    // Generate tokens
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, type: userTypeConstants.CANDIDATE },
        process.env.JWT_SECRET_ACCESS_KEY,
        { expiresIn: process.env.ACCESS_EXPIRES_IN }
    );
    const refreshToken = jwt.sign(
        { id: user.id, email: user.email, type: userTypeConstants.CANDIDATE },
        process.env.JWT_SECRET_REFRESH_KEY,
        { expiresIn: process.env.REFRESH_EXPIRES_IN }
    );

    let data = {
        user: { id: user.id, fullname: user.fullname, email: user.email, isVerified: user.isVerified },
        accessToken,
        refreshToken
    }
    sendSuccess(res, data, "Login successful", 200)
});

export const verifyCandidateController = asyncHandler(async (req, res, next) => {
    const { token } = req.body;

    if (!token) {
        return next(new AppError('Verification token is required', 400));
    }

    const verifiedCandidate = await verifyCandidateByToken(token);

    sendSuccess(res, {
        candidate: {
            id: verifiedCandidate.id,
            email: verifiedCandidate.email,
            fullname: verifiedCandidate.fullname,
            isVerified: verifiedCandidate.isVerified
        }
    }, 'Email verified successfully. You can now login.', 200);
});