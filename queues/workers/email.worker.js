import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

import { Worker } from 'bullmq';
import logger from '../../middleware/logger.js';
import { EMAIL_JOB_TYPES } from '../email.queue.js';

// Dynamic import to ensure env vars are loaded before redis config
const { bullMQConnection } = await import('../../config/redis.config.js');

// Dynamic import of email service
const { sendEmail } = await import('../../services/email/setBrevo.js');

// Debug: Log Redis configuration
logger.info('Email Worker starting with Redis config', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    clusterMode: process.env.REDIS_CLUSTER_MODE,
    hasPassword: !!process.env.REDIS_PASSWORD,
});

/**
 * Build email content for verification emails
 */
function buildVerificationEmailContent(name, verificationUrl) {
    const subject = "Verify your email address";
    const text = `Hi ${name},\n\nPlease verify your email address by clicking the link below:\n${verificationUrl}\n\nThank you!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Hi ${name}!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser:<br/>${verificationUrl}</p>
            <p>Thank you!</p>
        </div>
    `;
    return { subject, text, html };
}

/**
 * Build email content for candidate verification emails
 */
function buildCandidateVerificationEmailContent(name, password, verificationUrl, email) {
    const subject = "Welcome! Verify your email to get started";
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Welcome to Success CV, ${name}!</h2>
            <p>Your account has been created successfully. Here are your login details:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
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
    const text = `Welcome to Success CV, ${name}!\n\nYour account has been created successfully.\n\nLogin details:\nEmail: ${email}\nPassword: ${password}\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThank you!`;
    return { subject, text, html };
}

/**
 * Build email content for password reset emails
 */
function buildPasswordResetEmailContent(name, resetUrl) {
    const subject = "Password Reset Request";
    const text = `Hi ${name},\n\nYou can reset your password by clicking the link below:\n${resetUrl}\n\nIf you did not request a password reset, please ignore this email.\n\nThank you!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Hi ${name}!</h2>
            <p>You requested to reset your password. Click the button below to proceed:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #FF5722; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser:<br/>${resetUrl}</p>
            <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
            <p>Thank you!</p>
        </div>
    `;
    return { subject, text, html };
}

/**
 * Process email jobs
 */
async function processEmailJob(job) {
    const { data } = job;
    const jobType = job.name;

    logger.info('Processing email job', { 
        jobId: job.id, 
        jobType, 
        recipient: data.to 
    });

    try {
        let emailContent;

        switch (jobType) {
            case EMAIL_JOB_TYPES.VERIFICATION:
                emailContent = buildVerificationEmailContent(data.name, data.verificationUrl);
                break;

            case EMAIL_JOB_TYPES.CANDIDATE_VERIFICATION:
                emailContent = buildCandidateVerificationEmailContent(
                    data.name, 
                    data.password, 
                    data.verificationUrl,
                    data.to
                );
                break;

            case EMAIL_JOB_TYPES.PASSWORD_RESET:
                emailContent = buildPasswordResetEmailContent(data.name, data.resetUrl);
                break;

            case EMAIL_JOB_TYPES.GENERIC:
                emailContent = {
                    subject: data.subject,
                    text: data.text,
                    html: data.html || data.text,
                };
                break;

            default:
                throw new Error(`Unknown email job type: ${jobType}`);
        }

        // Send the email
        const result = await sendEmail(data.to, emailContent.subject, emailContent.html || emailContent.text);

        logger.info('Send email result', {
            jobId: job.id,
            success: result.success,
            messageId: result.messageId,
            hasResponse: !!result.response
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to send email');
        }

        logger.info('Email sent successfully', { 
            jobId: job.id, 
            jobType, 
            recipient: data.to,
            messageId: result.messageId 
        });

        return {
            success: true,
            messageId: result.messageId,
            recipient: data.to,
            jobType,
        };

    } catch (error) {
        logger.error('Failed to process email job', {
            jobId: job.id,
            jobType,
            recipient: data.to,
            error: error.message,
            stack: error.stack,
        });
        throw error; // This will trigger job retry
    }
}

/**
 * Create and configure the email worker
 */
const emailWorker = new Worker('email', processEmailJob, {
    connection: bullMQConnection,
    concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5'), // Process 5 emails concurrently
    limiter: {
        max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '10'), // Max 10 emails
        duration: parseInt(process.env.EMAIL_RATE_LIMIT_DURATION || '60000'), // per 60 seconds
    },
});

/**
 * Worker event handlers
 */
emailWorker.on('completed', (job, result) => {
    logger.info('Email job completed', {
        jobId: job.id,
        recipient: result.recipient,
        jobType: result.jobType,
        messageId: result.messageId,
        duration: `${job.finishedOn - job.processedOn}ms`,
    });
});

emailWorker.on('failed', (job, error) => {
    logger.error('Email job failed', {
        jobId: job?.id,
        recipient: job?.data?.to,
        error: error.message,
        attemptsMade: job?.attemptsMade,
        attemptsLeft: (job?.opts?.attempts || 3) - (job?.attemptsMade || 0),
    });
});

emailWorker.on('stalled', (jobId) => {
    logger.warn('Email job stalled', { jobId });
});

emailWorker.on('error', (error) => {
    logger.error('Email worker error', {
        error: error.message,
        stack: error.stack,
    });
});

emailWorker.on('ready', () => {
    logger.info('✅ Email worker is ready and waiting for jobs');
});

emailWorker.on('paused', () => {
    logger.warn('Email worker paused');
});

emailWorker.on('resumed', () => {
    logger.info('Email worker resumed');
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing email worker gracefully...');
    await emailWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing email worker gracefully...');
    await emailWorker.close();
    process.exit(0);
});

logger.info('🚀 Email worker started successfully', {
    concurrency: emailWorker.opts.concurrency,
    rateLimit: emailWorker.opts.limiter,
});

export default emailWorker;
