import { AppError } from "../../middleware/error.js";
import { sendEmail } from "./setBrevo.js";

export const sendVerificationEmail = async (to, name, loginUrl) => {
    const subject = "Verify your email address";
    const text = `Hi ${name},\n\nPlease verify your email address by clicking the link below:\n${loginUrl}\n\nThank you!`;
    const result = await sendEmail(to, subject, text);
    if (!result.success) {
        throw new AppError(result.error || 'Failed to send verification email', 500);
    }
    return result;
}

/**
 * Send candidate verification email with their details and temporary password
 */
export const sendCandidateVerificationEmail = async (to, name, password, verificationUrl) => {
    const subject = "Welcome! Verify your email to get started";
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Welcome to Success CV, ${name}!</h2>
            <p>Your account has been created successfully. Here are your login details:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
                <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
            </div>
            <p style="color: #666; font-size: 14px;">Please keep these credentials safe. We recommend changing your password after your first login.</p>
            <p>Please verify your email by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser:<br/>${verificationUrl}</p>
            <p>Thank you!</p>
        </div>
    `;
    const result = await sendEmail(to, subject, htmlContent);
    if (!result.success) {
        throw new AppError(result.error || 'Failed to send candidate verification email', 500);
    }
    return result;
}

export const sendPasswordResetEmail = async (to, name, resetUrl) => {
    const subject = "Password Reset Request";
    const text = `Hi ${name},\n\nYou can reset your password by clicking the link below:\n${resetUrl}\n\nIf you did not request a password reset, please ignore this email.\n\nThank you!`;
    const result = await sendEmail(to, subject, text);
    if (!result.success) {
        throw new AppError(result.error || 'Failed to send password reset email', 500);
    }
    return result;
}