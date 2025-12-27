import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';

/**
 * Resume Rewrite Queue
 * Handles asynchronous resume rewriting and optimization jobs
 */

// Register the resume rewrite queue
export const resumeRewriteQueue = queueService.registerQueue('resume-rewrite', {
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
            age: 604800, // Keep failed jobs for 7 days
        },
    },
});

/**
 * Add a resume rewrite job to the queue
 * @param {Object} data - Job data
 * @param {number} data.rewriteID - Rewrite record ID
 * @param {number} data.analysisID - Analysis ID
 * @param {number} data.userID - User ID
 * @param {number} data.resumeContentID - Resume content ID
 * @param {string|Object} data.analysisData - Processed analysis data
 * @param {string} data.rawData - Raw extracted text data
 * @param {Object} data.currentContent - Current resume content sections
 * @param {Object} data.optimizationOptions - Optimization preferences
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addResumeRewriteJob(data, options = {}) {
    logger.info('[REWRITE_QUEUE] Adding rewrite job', { 
        rewriteID: data.rewriteID,
        analysisID: data.analysisID 
    });

    return queueService.addJob('resume-rewrite', 'optimize-resume', data, {
        priority: options.priority || 10,
        jobId: options.jobId || `rewrite-${data.rewriteID}-${Date.now()}`,
        ...options,
    });
}

/**
 * Remove a resume rewrite job
 * @param {string} jobId - Job ID to remove
 * @returns {Promise<void>}
 */
export async function removeResumeRewriteJob(jobId) {
    return queueService.removeJob('resume-rewrite', jobId);
}

/**
 * Get job status by job ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>}
 */
export async function getJobStatus(jobId) {
    return queueService.getJobStatus('resume-rewrite', jobId);
}

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
export async function getQueueStats() {
    return queueService.getQueueStats('resume-rewrite');
}

/**
 * Remove a job from the queue
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function removeJob(jobId) {
    return queueService.removeJob('resume-rewrite', jobId);
}

/**
 * Retry a failed job
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function retryJob(jobId) {
    return queueService.retryJob('resume-rewrite', jobId);
}

/**
 * Clean old completed/failed jobs from the queue
 * @param {number} grace - Grace period in milliseconds (default: 24 hours)
 * @returns {Promise<Array>}
 */
export async function cleanQueue(grace = 86400000) {
    const [completedIds, failedIds] = await Promise.all([
        queueService.cleanQueue('resume-rewrite', grace, 'completed'),
        queueService.cleanQueue('resume-rewrite', grace * 7, 'failed'),
    ]);

    return [completedIds, failedIds];
}

/**
 * Pause the queue
 * @returns {Promise<void>}
 */
export async function pauseQueue() {
    return queueService.pauseQueue('resume-rewrite');
}

/**
 * Resume the queue
 * @returns {Promise<void>}
 */
export async function resumeQueue() {
    return queueService.resumeQueue('resume-rewrite');
}

/**
 * Close the queue connection
 * @returns {Promise<void>}
 */
export async function closeQueue() {
    return queueService.closeQueue('resume-rewrite');
}

export default {
    resumeRewriteQueue,
    addResumeRewriteJob,
    removeResumeRewriteJob,
    getJobStatus,
    getQueueStats,
    removeJob,
    retryJob,
    cleanQueue,
    pauseQueue,
    resumeQueue,
    closeQueue,
};
