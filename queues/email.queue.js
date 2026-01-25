import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';

/**
 * Email Queue
 * Handles asynchronous email sending jobs to make email delivery non-blocking
 */

// Register the email queue
export const emailQueue = queueService.registerQueue('email', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 seconds, then 4s, 8s
        },
        removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
            age: 604800, // Keep failed jobs for 7 days for debugging
        },
    },
});

/**
 * Email job types
 */
export const EMAIL_JOB_TYPES = {
    VERIFICATION: 'send-verification-email',
    PASSWORD_RESET: 'send-password-reset-email',
    CANDIDATE_VERIFICATION: 'send-candidate-verification-email',
    GENERIC: 'send-generic-email',
};

/**
 * Add a verification email job to the queue
 * @param {Object} data - Job data
 * @param {string} data.to - Recipient email address
 * @param {string} data.name - Recipient name
 * @param {string} data.verificationUrl - Verification URL
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addVerificationEmailJob(data, options = {}) {
    try {
        const job = await queueService.addJob('email', EMAIL_JOB_TYPES.VERIFICATION, data, {
            priority: options.priority || 5, // Higher priority for verification emails
            jobId: options.jobId || `verification-email-${Date.now()}`,
            ...options,
        });
        
        logger.info('Verification email job added to queue', { 
            jobId: job.id, 
            recipient: data.to 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add verification email job', { 
            error: error.message, 
            data 
        });
        throw error;
    }
}

/**
 * Add a candidate verification email job to the queue
 * @param {Object} data - Job data
 * @param {string} data.to - Recipient email address
 * @param {string} data.name - Recipient name
 * @param {string} data.password - Temporary password
 * @param {string} data.verificationUrl - Verification URL
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addCandidateVerificationEmailJob(data, options = {}) {
    try {
        const job = await queueService.addJob('email', EMAIL_JOB_TYPES.CANDIDATE_VERIFICATION, data, {
            priority: options.priority || 5,
            jobId: options.jobId || `candidate-verification-email-${Date.now()}`,
            ...options,
        });
        
        logger.info('Candidate verification email job added to queue', { 
            jobId: job.id, 
            recipient: data.to 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add candidate verification email job', { 
            error: error.message, 
            data 
        });
        throw error;
    }
}

/**
 * Add a password reset email job to the queue
 * @param {Object} data - Job data
 * @param {string} data.to - Recipient email address
 * @param {string} data.name - Recipient name
 * @param {string} data.resetUrl - Password reset URL
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addPasswordResetEmailJob(data, options = {}) {
    try {
        const job = await queueService.addJob('email', EMAIL_JOB_TYPES.PASSWORD_RESET, data, {
            priority: options.priority || 5, // Higher priority for password reset
            jobId: options.jobId || `password-reset-email-${Date.now()}`,
            ...options,
        });
        
        logger.info('Password reset email job added to queue', { 
            jobId: job.id, 
            recipient: data.to 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add password reset email job', { 
            error: error.message, 
            data 
        });
        throw error;
    }
}

/**
 * Add a generic email job to the queue
 * @param {Object} data - Job data
 * @param {string} data.to - Recipient email address
 * @param {string} data.subject - Email subject
 * @param {string} data.text - Email text content
 * @param {string} data.html - Email HTML content (optional)
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addGenericEmailJob(data, options = {}) {
    try {
        const job = await queueService.addJob('email', EMAIL_JOB_TYPES.GENERIC, data, {
            priority: options.priority || 10, // Lower priority for generic emails
            jobId: options.jobId || `email-${Date.now()}`,
            ...options,
        });
        
        logger.info('Generic email job added to queue', { 
            jobId: job.id, 
            recipient: data.to 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add generic email job', { 
            error: error.message, 
            data 
        });
        throw error;
    }
}

/**
 * Get email job status by job ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>}
 */
export async function getJobStatus(jobId) {
    return queueService.getJobStatus('email', jobId);
}

/**
 * Get email queue statistics
 * @returns {Promise<Object>}
 */
export async function getQueueStats() {
    return queueService.getQueueStats('email');
}

/**
 * Remove an email job from the queue
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function removeJob(jobId) {
    return queueService.removeJob('email', jobId);
}

/**
 * Retry a failed email job
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function retryJob(jobId) {
    return queueService.retryJob('email', jobId);
}

/**
 * Clean old completed/failed jobs from the queue
 * @param {number} grace - Grace period in milliseconds (default: 24 hours)
 * @returns {Promise<Array>}
 */
export async function cleanQueue(grace = 86400000) {
    const [completedIds, failedIds] = await Promise.all([
        queueService.cleanQueue('email', grace, 'completed'),
        queueService.cleanQueue('email', grace * 7, 'failed'),
    ]);

    return [completedIds, failedIds];
}

/**
 * Pause the queue
 * @returns {Promise<void>}
 */
export async function pauseQueue() {
    return queueService.pauseQueue('email');
}

/**
 * Resume the queue
 * @returns {Promise<void>}
 */
export async function resumeQueue() {
    return queueService.resumeQueue('email');
}

/**
 * Close the queue connection
 * @returns {Promise<void>}
 */
export async function closeQueue() {
    return queueService.closeQueue('email');
}

export default {
    emailQueue,
    addVerificationEmailJob,
    addCandidateVerificationEmailJob,
    addPasswordResetEmailJob,
    addGenericEmailJob,
    getJobStatus,
    getQueueStats,
    removeJob,
    retryJob,
    cleanQueue,
    pauseQueue,
    resumeQueue,
    closeQueue,
    EMAIL_JOB_TYPES,
};
