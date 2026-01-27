import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';

/**
 * Manual Resume Analysis Queue
 * Handles analysis jobs for manually-created (blank) resumes
 * Unlike the regular analysis queue, this doesn't extract content from files
 * but analyzes existing structured resume content
 */

// Register the manual resume analysis queue
export const manualAnalysisQueue = queueService.registerQueue('manual-resume-analysis', {
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
 * Add a manual resume analysis job to the queue
 * @param {Object} data - Job data
 * @param {number} data.analysisID - Analysis ID to update
 * @param {number} data.userID - User ID (for users) or Candidate ID (for candidates)
 * @param {string} data.userType - 'user' | 'candidate'
 * @param {number} data.resumeContentID - Resume content ID
 * @param {number} data.documentID - Document ID
 * @param {number} data.creditTransactionID - Credit transaction ID for billing
 * @param {Object} options - Job options (optional)
 * @returns {Promise<Job>}
 */
export async function addManualAnalysisJob(data, options = {}) {
    const jobId = options.jobId || `manual-analysis-${data.resumeContentID}-${Date.now()}`;
    
    logger.info('[MANUAL_ANALYSIS_QUEUE] Adding job', {
        jobId,
        analysisID: data.analysisID,
        userID: data.userID,
        userType: data.userType,
        resumeContentID: data.resumeContentID,
        creditTransactionID: data.creditTransactionID
    });
    
    return queueService.addJob('manual-resume-analysis', 'analyze-manual-resume', data, {
        priority: options.priority || 10,
        jobId,
        ...options,
    });
}

/**
 * Remove a manual analysis job
 * @param {string} jobId - Job ID to remove
 * @returns {Promise<void>}
 */
export async function removeManualAnalysisJob(jobId) {
    return queueService.removeJob('manual-resume-analysis', jobId);
}

/**
 * Get job status by job ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>}
 */
export async function getManualAnalysisJobStatus(jobId) {
    return queueService.getJobStatus('manual-resume-analysis', jobId);
}

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
export async function getManualAnalysisQueueStats() {
    return queueService.getQueueStats('manual-resume-analysis');
}

/**
 * Retry a failed job
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function retryManualAnalysisJob(jobId) {
    return queueService.retryJob('manual-resume-analysis', jobId);
}

/**
 * Clean old completed/failed jobs from the queue
 * @param {number} grace - Grace period in milliseconds (default: 24 hours)
 * @returns {Promise<Array>}
 */
export async function cleanManualAnalysisQueue(grace = 86400000) {
    const [completedIds, failedIds] = await Promise.all([
        queueService.cleanQueue('manual-resume-analysis', grace, 'completed'),
        queueService.cleanQueue('manual-resume-analysis', grace * 7, 'failed'),
    ]);
    
    logger.info('[MANUAL_ANALYSIS_QUEUE] Queue cleaned', {
        completedRemoved: completedIds?.length || 0,
        failedRemoved: failedIds?.length || 0
    });
    
    return { completedIds, failedIds };
}

/**
 * Pause the queue
 * @returns {Promise<void>}
 */
export async function pauseManualAnalysisQueue() {
    return queueService.pauseQueue('manual-resume-analysis');
}

/**
 * Resume the queue
 * @returns {Promise<void>}
 */
export async function resumeManualAnalysisQueue() {
    return queueService.resumeQueue('manual-resume-analysis');
}

/**
 * Close the queue
 * @returns {Promise<void>}
 */
export async function closeManualAnalysisQueue() {
    return queueService.closeQueue('manual-resume-analysis');
}

export default {
    manualAnalysisQueue,
    addManualAnalysisJob,
    removeManualAnalysisJob,
    getManualAnalysisJobStatus,
    getManualAnalysisQueueStats,
    retryManualAnalysisJob,
    cleanManualAnalysisQueue,
    pauseManualAnalysisQueue,
    resumeManualAnalysisQueue,
    closeManualAnalysisQueue
};
