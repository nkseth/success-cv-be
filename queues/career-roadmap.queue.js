import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';

/**
 * Career Roadmap Queue
 * Handles asynchronous AI career roadmap generation jobs
 */

// Register the career roadmap queue
export const careerRoadmapQueue = queueService.registerQueue('career-roadmap', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2s, then 4s, 8s
        },
        removeOnComplete: {
            age: 86400,   // Keep completed jobs for 24 hours
            count: 1000,  // Keep max 1000 completed jobs
        },
        removeOnFail: {
            age: 604800,  // Keep failed jobs for 7 days
        },
    },
});

/**
 * Add a career roadmap generation job to the queue
 * @param {Object} data - Job data
 * @param {number} data.roadmapID       - careerRoadmaps record ID
 * @param {number} data.userID          - User ID
 * @param {number} data.resumeContentID - Resume content ID (source of truth)
 * @param {Object} data.questionnaire   - User's questionnaire answers
 * @param {number} data.creditTransactionID - Credit transaction for billing
 * @param {Object} options - BullMQ job options (optional)
 * @returns {Promise<Job>}
 */
export async function addCareerRoadmapJob(data, options = {}) {
    logger.info('[ROADMAP_QUEUE] Adding career roadmap job', {
        roadmapID: data.roadmapID,
        userID: data.userID,
        resumeContentID: data.resumeContentID,
    });

    return queueService.addJob('career-roadmap', 'generate-career-roadmap', data, {
        priority: options.priority || 10,
        jobId: options.jobId || `roadmap-${data.roadmapID}-${Date.now()}`,
        ...options,
    });
}

/**
 * Get job status by job ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>}
 */
export async function getJobStatus(jobId) {
    return queueService.getJobStatus('career-roadmap', jobId);
}

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
export async function getQueueStats() {
    return queueService.getQueueStats('career-roadmap');
}

/**
 * Close the queue connection
 * @returns {Promise<void>}
 */
export async function closeQueue() {
    return queueService.closeQueue('career-roadmap');
}

export default {
    careerRoadmapQueue,
    addCareerRoadmapJob,
    getJobStatus,
    getQueueStats,
    closeQueue,
};
