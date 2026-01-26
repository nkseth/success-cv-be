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
 * Schedule periodic job scraping with per-source rate limiting
 * Each source has its own schedule based on API limits and data freshness
 * 
 * Source schedules:
 * - Remotive: Daily (data has 24h delay)
 * - RemoteOK: Every 6 hours (good data freshness)
 * - WeWorkRemotely: Every 2 hours (RSS feed, frequent updates)
 * - Himalayas: Every 4 hours (rate limited API)
 * - Jobicy: Every hour (API allows frequent polling, recommends ≤1/hour)
 * - Cleanup: Daily at 3 AM (mark stale jobs inactive)
 * 
 * Call this once at application startup
 */
export async function schedulePeriodicScraping() {
    try {
        // Remotive: Daily at midnight (data has 24h delay anyway)
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE,
            { source: 'remotive', options: { limit: 100 } },
            {
                repeat: {
                    pattern: '0 0 * * *', // Daily at midnight
                },
                jobId: 'scrape-remotive-recurring',
            }
        );

        // RemoteOK: Every 6 hours
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE,
            { source: 'remoteok', options: { limit: 100 } },
            {
                repeat: {
                    pattern: '0 */6 * * *', // Every 6 hours
                },
                jobId: 'scrape-remoteok-recurring',
            }
        );

        // We Work Remotely: Every 2 hours
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE,
            { source: 'weworkremotely', options: { limit: 100 } },
            {
                repeat: {
                    pattern: '0 */2 * * *', // Every 2 hours
                },
                jobId: 'scrape-weworkremotely-recurring',
            }
        );

        // Himalayas: Every 4 hours (rate limited)
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE,
            { source: 'himalayas', options: { limit: 20 } }, // API max is 20
            {
                repeat: {
                    pattern: '0 */4 * * *', // Every 4 hours
                },
                jobId: 'scrape-himalayas-recurring',
            }
        );

        // Jobicy: Every hour at minute 15 (recommended ≤1 req/hour)
        await queueService.addJob(
            'job-scraping',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE,
            { source: 'jobicy', options: { limit: 100 } },
            {
                repeat: {
                    pattern: '15 * * * *', // Every hour at :15
                },
                jobId: 'scrape-jobicy-recurring',
            }
        );
        
        // Schedule cleanup of stale jobs once per day at 3 AM
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
        
        logger.info('Periodic job scraping scheduled with per-source rate limits', {
            remotive: 'Daily at midnight',
            remoteok: 'Every 6 hours',
            weworkremotely: 'Every 2 hours',
            himalayas: 'Every 4 hours',
            jobicy: 'Hourly at :15',
            cleanup: 'Daily at 3 AM'
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
