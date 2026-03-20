import { Worker } from 'bullmq';
import { bullMQConnection } from '../../config/redis.config.js';
import logger from '../../middleware/logger.js';
import { matchJobsForUser } from '../../services/job-matching.service.js';
import { JOB_TYPES } from '../job-matching.queue.js';
import { JOB_MATCHING_ENABLED } from '../../config/featureFlags.js';

const QUEUE_NAME = 'job-matching';

if (!JOB_MATCHING_ENABLED) {
    logger.warn('Job matching is disabled - worker is idle. Set JOB_MATCHING_ENABLED=true and restart to activate.');
    // Keep process alive but idle so PM2/Docker doesn't restart it in a loop.
    // The process will stay alive doing nothing until manually restarted with the flag enabled.
    setInterval(() => {}, 60000);
}

/**
 * Job Matching Worker
 * 
 * Processes job matching tasks:
 * - MATCH_FOR_USER: Match jobs for a single user
 * - REMATCH_FOR_USER: Re-match jobs (after preference change)
 * - BATCH_MATCH: Match jobs for multiple users
 */

/**
 * Process job matching job
 */
async function processJobMatchingJob(job) {
    const { type, userId, analysisId, userType, users, options } = job.data;

    logger.info('Processing job matching job', {
        jobId: job.id,
        type,
        userId,
        analysisId,
        userType,
        usersCount: users?.length
    });

    try {
        switch (type) {
            case JOB_TYPES.MATCH_FOR_USER:
            case JOB_TYPES.REMATCH_FOR_USER:
                return await matchSingleUser(userId, analysisId, userType, options);

            case JOB_TYPES.BATCH_MATCH:
                return await matchBatchUsers(users, options);

            default:
                throw new Error(`Unknown job type: ${type}`);
        }
    } catch (error) {
        logger.error('Job matching job failed', {
            jobId: job.id,
            type,
            userId,
            analysisId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Match jobs for a single user
 */
async function matchSingleUser(userId, analysisId, userType, options) {
    const startTime = Date.now();

    logger.info('Starting job matching for user', {
        userId,
        analysisId,
        userType,
        options
    });

    try {
        const matches = await matchJobsForUser(userId, analysisId, userType, options);

        const duration = Date.now() - startTime;

        logger.info('Job matching completed successfully', {
            userId,
            analysisId,
            userType,
            matchCount: matches.length,
            duration: `${duration}ms`,
            topScore: matches.length > 0 ? matches[0].matchScore : null,
            averageScore: matches.length > 0
                ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
                : null
        });

        return {
            success: true,
            userId,
            analysisId,
            userType,
            matchCount: matches.length,
            duration,
            matches: matches.slice(0, 10) // Return top 10 for job result
        };
    } catch (error) {
        logger.error('Job matching failed for user', {
            userId,
            analysisId,
            userType,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Match jobs for multiple users in batch
 */
async function matchBatchUsers(users, options) {
    const startTime = Date.now();

    logger.info('Starting batch job matching', {
        userCount: users.length,
        options
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
        try {
            const matches = await matchJobsForUser(
                user.userId,
                user.analysisId,
                user.userType || 'user',
                options
            );

            results.push({
                userId: user.userId,
                analysisId: user.analysisId,
                success: true,
                matchCount: matches.length
            });

            successCount++;

            logger.info('Batch matching succeeded for user', {
                userId: user.userId,
                analysisId: user.analysisId,
                matchCount: matches.length
            });
        } catch (error) {
            results.push({
                userId: user.userId,
                analysisId: user.analysisId,
                success: false,
                error: error.message
            });

            failureCount++;

            logger.error('Batch matching failed for user', {
                userId: user.userId,
                analysisId: user.analysisId,
                error: error.message
            });
        }
    }

    const duration = Date.now() - startTime;

    logger.info('Batch job matching completed', {
        userCount: users.length,
        successCount,
        failureCount,
        duration: `${duration}ms`
    });

    return {
        success: true,
        totalUsers: users.length,
        successCount,
        failureCount,
        duration,
        results
    };
}

/**
 * Create and start job matching worker
 */
function createJobMatchingWorker() {
    const worker = new Worker(
        QUEUE_NAME,
        processJobMatchingJob,
        {
            connection: bullMQConnection,
            concurrency: 5, // Process 5 matching jobs concurrently
            limiter: {
                max: 20, // Max 20 jobs per duration
                duration: 60000 // Per minute
            }
        }
    );

    worker.on('completed', (job, returnvalue) => {
        logger.info('Job matching job completed', {
            jobId: job.id,
            returnvalue: {
                ...returnvalue,
                matches: returnvalue.matches ? `${returnvalue.matches.length} matches` : undefined
            }
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Job matching job failed', {
            jobId: job?.id,
            error: err.message,
            stack: err.stack
        });
    });

    worker.on('error', (err) => {
        logger.error('Job matching worker error', {
            error: err.message,
            stack: err.stack
        });
    });

    logger.info('Job matching worker started', {
        queueName: QUEUE_NAME,
        concurrency: 5
    });

    return worker;
}

// Create and export worker — only when job matching is enabled.
// When disabled the idle setInterval above keeps the process alive without
// connecting to Redis or creating a BullMQ Worker.
const jobMatchingWorker = JOB_MATCHING_ENABLED ? createJobMatchingWorker() : null;

export default jobMatchingWorker;
