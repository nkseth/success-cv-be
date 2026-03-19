import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';
import { JOB_MATCHING_ENABLED } from '../config/featureFlags.js';

/**
 * Job Matching Queue
 * 
 * Handles background job matching tasks:
 * - Match jobs for a user after resume analysis
 * - Re-match jobs when preferences change
 * - Batch match jobs for multiple users
 */

const QUEUE_NAME = 'job-matching';

// Job types
export const JOB_TYPES = {
    MATCH_FOR_USER: 'MATCH_FOR_USER',
    REMATCH_FOR_USER: 'REMATCH_FOR_USER',
    BATCH_MATCH: 'BATCH_MATCH'
};

/**
 * Get job matching queue instance
 */
export function getJobMatchingQueue() {
    if (!JOB_MATCHING_ENABLED) {
        logger.warn('Job matching is disabled - queue access blocked');
        return null;
    }
    return queueService.getQueue(QUEUE_NAME);
}

/**
 * Add job to match jobs for a specific user
 * 
 * @param {number} userId - User ID
 * @param {number} analysisId - Resume analysis ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} options - Matching options
 * @param {number} options.minScore - Minimum match score (default: 50)
 * @param {number} options.maxResults - Maximum results (default: 50)
 * @param {boolean} options.replaceExisting - Replace existing matches (default: true)
 * @returns {Promise<Object>} Job object
 */
export async function addMatchJobsForUserJob(userId, analysisId, userType = 'user', options = {}) {
    if (!JOB_MATCHING_ENABLED) {
        logger.info('Job matching is disabled - skipping match job creation', { userId, analysisId, userType });
        return null;
    }
    const queue = getJobMatchingQueue();
    if (!queue) {
        return null;
    }
    
    const jobData = {
        type: JOB_TYPES.MATCH_FOR_USER,
        userId,
        analysisId,
        userType,
        options: {
            minScore: options.minScore || 50,
            maxResults: options.maxResults || 50,
            replaceExisting: options.replaceExisting === true
        }
    };

    const job = await queueService.addJob(QUEUE_NAME, JOB_TYPES.MATCH_FOR_USER, jobData, {
        jobId: `match-${userId}-${analysisId}-${Date.now()}`,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            age: 86400 // Keep for 1 day
        },
        removeOnFail: false
    });

    logger.info('Job matching job added to queue', {
        jobId: job.id,
        userId,
        analysisId,
        userType,
        options: jobData.options
    });

    return job;
}

/**
 * Add job to re-match jobs for a user (e.g., after preference change)
 * 
 * @param {number} userId - User ID
 * @param {number} analysisId - Resume analysis ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} options - Matching options
 * @returns {Promise<Object>} Job object
 */
export async function addRematchJobsForUserJob(userId, analysisId, userType = 'user', options = {}) {
    if (!JOB_MATCHING_ENABLED) {
        logger.info('Job matching is disabled - skipping rematch job creation', { userId, analysisId, userType });
        return null;
    }
    const queue = getJobMatchingQueue();
    if (!queue) {
        return null;
    }
    
    const jobData = {
        type: JOB_TYPES.REMATCH_FOR_USER,
        userId,
        analysisId,
        userType,
        options: {
            minScore: options.minScore || 50,
            maxResults: options.maxResults || 50,
            replaceExisting: true // Always replace on rematch
        }
    };

    const job = await queueService.addJob(QUEUE_NAME, JOB_TYPES.REMATCH_FOR_USER, jobData, {
        jobId: `rematch-${userId}-${analysisId}-${Date.now()}`,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            age: 86400
        },
        removeOnFail: false
    });

    logger.info('Re-matching job added to queue', {
        jobId: job.id,
        userId,
        analysisId,
        userType
    });

    return job;
}

/**
 * Add job to batch match for multiple users
 * 
 * @param {Array<Object>} users - Array of {userId, analysisId, userType}
 * @param {Object} options - Matching options
 * @returns {Promise<Object>} Job object
 */
export async function addBatchMatchJob(users, options = {}) {
    if (!JOB_MATCHING_ENABLED) {
        logger.info('Job matching is disabled - skipping batch match job creation', { userCount: users.length });
        return null;
    }
    const queue = getJobMatchingQueue();
    if (!queue) {
        return null;
    }
    
    const jobData = {
        type: JOB_TYPES.BATCH_MATCH,
        users,
        options: {
            minScore: options.minScore || 50,
            maxResults: options.maxResults || 50,
            replaceExisting: options.replaceExisting !== false
        }
    };

    const job = await queueService.addJob(QUEUE_NAME, JOB_TYPES.BATCH_MATCH, jobData, {
        jobId: `batch-match-${Date.now()}`,
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 10000
        },
        removeOnComplete: {
            age: 86400
        },
        removeOnFail: false
    });

    logger.info('Batch matching job added to queue', {
        jobId: job.id,
        userCount: users.length
    });

    return job;
}

/**
 * Trigger job matching after resume analysis completes
 * Called from resume-analysis.worker.js
 * 
 * @param {number} userId - User ID
 * @param {number} analysisId - Resume analysis ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {boolean} autoMatch - Whether to auto-match (default: true)
 */
export async function triggerMatchingAfterAnalysis(userId, analysisId, userType, autoMatch = true) {
    if (!JOB_MATCHING_ENABLED) {
        logger.info('Job matching is disabled - skipping trigger', { userId, analysisId, userType });
        return;
    }
    if (!autoMatch) {
        logger.info('Auto-matching disabled for analysis', { userId, analysisId });
        return;
    }

    logger.info('Triggering job matching after analysis completion', {
        userId,
        analysisId,
        userType
    });

    try {
        await addMatchJobsForUserJob(userId, analysisId, userType, {
            minScore: 50,
            maxResults: 50,
            replaceExisting: true
        });
    } catch (error) {
        logger.error('Failed to trigger job matching after analysis', {
            userId,
            analysisId,
            userType,
            error: error.message
        });
        // Don't throw - analysis succeeded, matching failure is non-critical
    }
}

export default {
    getJobMatchingQueue,
    addMatchJobsForUserJob,
    addRematchJobsForUserJob,
    addBatchMatchJob,
    triggerMatchingAfterAnalysis,
    JOB_TYPES
};
