import queueService from '../services/queue.service.js';
import logger from '../middleware/logger.js';

/**
 * Job Scraping Queue
 * Handles periodic job scraping from external sources (RemoteOK, Indeed, etc.)
 * 
 * Jobs are scraped on a schedule (every 6 hours) and deduplicated before insertion.
 */

// Register the job-scraping queue with cron schedule
export const jobScrapingQueue = queueService.registerQueue('job-scraping', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 seconds, then 10s, 20s
        },
        removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
            age: 604800, // Keep failed jobs for 7 days for debugging
        },
    },
});

/**
 * Job scraping types
 */
export const JOB_SCRAPING_TYPES = {
    SCRAPE_SOURCE: 'scrape-job-source', // Scrape a specific source
    SCRAPE_ALL: 'scrape-all-sources', // Scrape all sources
    CLEANUP_STALE: 'cleanup-stale-jobs', // Mark old jobs as inactive
};

/**
 * Add a job to scrape a specific source
 * 
 * @param {Object} data - Job data
 * @param {string} data.source - Source name ('remoteok', 'indeed', etc.)
 * @param {Object} data.options - Source-specific scraping options
 * @param {Object} jobOptions - BullMQ job options (optional)
 * @returns {Promise<Job>}
 */
export async function addScrapeSourceJob(data, jobOptions = {}) {
    try {
        const job = await queueService.addJob(
            'job-scraping', 
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE, 
            data, 
            {
                priority: jobOptions.priority || 5,
                jobId: jobOptions.jobId || `scrape-${data.source}-${Date.now()}`,
                ...jobOptions,
            }
        );
        
        logger.info('Job scraping job added to queue', { 
            jobId: job.id, 
            source: data.source 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add job scraping job', { 
            error: error.message, 
            data 
        });
        throw error;
    }
}

/**
 * Add a job to scrape all supported sources
 * 
 * @param {Object} data - Job data
 * @param {Object} data.globalOptions - Options applied to all sources
 * @param {Object} jobOptions - BullMQ job options (optional)
 * @returns {Promise<Job>}
 */
export async function addScrapeAllSourcesJob(data = {}, jobOptions = {}) {
    try {
        const job = await queueService.addJob(
            'job-scraping', 
            JOB_SCRAPING_TYPES.SCRAPE_ALL, 
            data, 
            {
                priority: jobOptions.priority || 3,
                jobId: jobOptions.jobId || `scrape-all-${Date.now()}`,
                ...jobOptions,
            }
        );
        
        logger.info('Scrape all sources job added to queue', { 
            jobId: job.id 
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add scrape all sources job', { 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Add a job to cleanup stale jobs (mark as inactive)
 * Jobs not seen in recent scrapes are considered expired.
 * 
 * @param {Object} data - Job data
 * @param {number} data.daysOld - Mark jobs inactive if not scraped in X days (default: 30)
 * @param {Object} jobOptions - BullMQ job options (optional)
 * @returns {Promise<Job>}
 */
export async function addCleanupStaleJobsJob(data = {}, jobOptions = {}) {
    try {
        const job = await queueService.addJob(
            'job-scraping', 
            JOB_SCRAPING_TYPES.CLEANUP_STALE, 
            { daysOld: data.daysOld || 30 }, 
            {
                priority: jobOptions.priority || 1,
                jobId: jobOptions.jobId || `cleanup-stale-${Date.now()}`,
                ...jobOptions,
            }
        );
        
        logger.info('Cleanup stale jobs job added to queue', { 
            jobId: job.id,
            daysOld: data.daysOld || 30
        });
        
        return job;
    } catch (error) {
        logger.error('Failed to add cleanup stale jobs job', { 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Schedule periodic job scraping
 * Adds recurring jobs that run on a cron schedule
 * 
 * Call this once at application startup
 */
export async function schedulePeriodicScraping() {
    try {
        // Schedule scraping all sources every 6 hours
        // Cron: "0 */6 * * *" = At minute 0 past every 6th hour (00:00, 06:00, 12:00, 18:00)
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_ALL,
            { globalOptions: { limit: 100 } },
            {
                repeat: {
                    pattern: '0 */6 * * *', // Every 6 hours
                },
                jobId: 'scrape-all-recurring',
            }
        );
        
        // Schedule cleanup of stale jobs once per day at 3 AM
        // Cron: "0 3 * * *" = At 3:00 AM every day
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.CLEANUP_STALE,
            { daysOld: 30 },
            {
                repeat: {
                    pattern: '0 3 * * *', // Daily at 3 AM
                },
                jobId: 'cleanup-stale-recurring',
            }
        );
        
        logger.info('Periodic job scraping scheduled', {
            scrapeSchedule: 'Every 6 hours',
            cleanupSchedule: 'Daily at 3 AM'
        });
    } catch (error) {
        logger.error('Failed to schedule periodic scraping', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Get job status by job ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>}
 */
export async function getJobStatus(jobId) {
    return queueService.getJobStatus('job-scraping', jobId);
}

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
export async function getQueueStats() {
    return queueService.getQueueStats('job-scraping');
}

/**
 * Retry a failed job
 * @param {string} jobId - Job ID
 * @returns {Promise<Job>}
 */
export async function retryJob(jobId) {
    return queueService.retryJob('job-scraping', jobId);
}

/**
 * Clean completed/failed jobs
 * @param {number} grace - Grace period in milliseconds
 * @param {number} limit - Max number of jobs to clean
 * @returns {Promise<string[]>}
 */
export async function cleanQueue(grace = 0, limit = 1000) {
    return queueService.cleanQueue('job-scraping', grace, limit);
}

/**
 * Pause the queue
 * @returns {Promise<void>}
 */
export async function pauseQueue() {
    return queueService.pauseQueue('job-scraping');
}

/**
 * Resume the queue
 * @returns {Promise<void>}
 */
export async function resumeQueue() {
    return queueService.resumeQueue('job-scraping');
}

/**
 * Close the queue connection
 * @returns {Promise<void>}
 */
export async function closeQueue() {
    return queueService.closeQueue('job-scraping');
}

export default {
    jobScrapingQueue,
    JOB_SCRAPING_TYPES,
    addScrapeSourceJob,
    addScrapeAllSourcesJob,
    addCleanupStaleJobsJob,
    schedulePeriodicScraping,
    getJobStatus,
    getQueueStats,
    retryJob,
    cleanQueue,
    pauseQueue,
    resumeQueue,
    closeQueue
};
