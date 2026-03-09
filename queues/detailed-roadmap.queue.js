import { Queue } from 'bullmq';
import { bullMQConnection } from '../config/redis.config.js';
import logger from '../middleware/logger.js';

/**
 * Detailed Career Roadmap Queue
 * Handles jobs for generating deeply detailed career roadmaps using AI web search.
 */
export const detailedRoadmapQueue = new Queue('detailed-roadmap', {
    connection: bullMQConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

detailedRoadmapQueue.on('error', (err) => {
    logger.error('Detailed Career Roadmap Queue error', {
        error: err.message,
    });
});

/**
 * Add a job to generate a detailed career roadmap
 * @param {Object} jobData
 * @param {number} jobData.roadmapID
 * @param {number} jobData.userID
 * @param {number} jobData.pathIndex
 * @param {Object} [options]
 */
export async function addDetailedRoadmapJob(jobData, options = {}) {
    try {
        const job = await detailedRoadmapQueue.add('generate-detailed-roadmap', jobData, options);

        logger.info('Detailed roadmap job added to queue', {
            jobId: job.id,
            roadmapID: jobData.roadmapID,
            userID: jobData.userID,
        });

        return job;
    } catch (error) {
        logger.error('Failed to add detailed roadmap job to queue', {
            error: error.message,
            roadmapID: jobData.roadmapID,
        });
        throw error;
    }
}
