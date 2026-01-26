import { Worker } from 'bullmq';
import { bullMQConnection } from '../../config/redis.config.js';
import logger from '../../middleware/logger.js';
import { JOB_SCRAPING_TYPES } from '../job-scraping.queue.js';
import jobBoardsService from '../../services/jobBoards/index.js';
import db from '../../config/db.js';
import { jobsTable, jobScrapingLogsTable } from '../../drizzle/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';

/**
 * Job Scraping Worker
 * 
 * Processes job scraping tasks:
 * 1. Scrapes jobs from external sources (RemoteOK, Indeed, etc.)
 * 2. Deduplicates by external_id + source
 * 3. Inserts/updates jobs in database
 * 4. Logs scraping runs for monitoring
 * 5. Cleans up stale jobs
 */

// Worker configuration
const WORKER_CONCURRENCY = parseInt(process.env.JOB_SCRAPING_WORKER_CONCURRENCY || '2');

/**
 * Process job scraping job
 */
async function processJobScrapingJob(job) {
    const { data } = job;
    const jobType = job.name;

    logger.info('Processing job scraping job', { 
        jobId: job.id, 
        jobType,
        data
    });

    try {
        let result;

        switch (jobType) {
            case JOB_SCRAPING_TYPES.SCRAPE_SOURCE:
                result = await scrapeSingleSource(job.id, data);
                break;

            case JOB_SCRAPING_TYPES.SCRAPE_ALL:
                result = await scrapeAllSources(job.id, data);
                break;

            case JOB_SCRAPING_TYPES.CLEANUP_STALE:
                result = await cleanupStaleJobs(job.id, data);
                break;

            default:
                throw new Error(`Unknown job scraping type: ${jobType}`);
        }

        logger.info('Job scraping job completed', { 
            jobId: job.id, 
            jobType,
            result
        });

        return result;

    } catch (error) {
        logger.error('Failed to process job scraping job', {
            jobId: job.id,
            jobType,
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

/**
 * Scrape jobs from a single source
 */
async function scrapeSingleSource(jobId, data) {
    const { source, options = {} } = data;
    const startTime = Date.now();
    
    // Create scraping log entry
    const [logEntry] = await db.insert(jobScrapingLogsTable).values({
        source,
        status: 'running',
        startedAt: new Date(),
        workerID: jobId,
        requestParams: options
    }).returning();

    try {
        logger.info('Scraping jobs from source', { source, options });

        // Scrape jobs from external source
        const scraped = await jobBoardsService.scrapeJobsFromSource(source, options);
        const scrapedJobs = scraped.jobs;

        logger.info('Jobs scraped from source', { 
            source, 
            count: scrapedJobs.length 
        });

        // Process and store jobs with deduplication
        const { jobsNew, jobsUpdated } = await upsertJobs(scrapedJobs);

        const duration = Date.now() - startTime;

        // Update log entry with success
        await db.update(jobScrapingLogsTable)
            .set({
                status: 'completed',
                jobsFound: scrapedJobs.length,
                jobsNew,
                jobsUpdated,
                completedAt: new Date(),
                duration
            })
            .where(eq(jobScrapingLogsTable.id, logEntry.id));

        return {
            success: true,
            source,
            jobsFound: scrapedJobs.length,
            jobsNew,
            jobsUpdated,
            duration: `${duration}ms`
        };

    } catch (error) {
        const duration = Date.now() - startTime;

        // Update log entry with failure
        await db.update(jobScrapingLogsTable)
            .set({
                status: 'failed',
                errorMessage: error.message,
                errorStack: error.stack,
                completedAt: new Date(),
                duration
            })
            .where(eq(jobScrapingLogsTable.id, logEntry.id));

        throw error;
    }
}

/**
 * Scrape jobs from all supported sources
 */
async function scrapeAllSources(jobId, data) {
    const { globalOptions = {} } = data;
    const startTime = Date.now();

    logger.info('Scraping jobs from all sources', { globalOptions });

    // Scrape from all sources
    const result = await jobBoardsService.scrapeAllSources(globalOptions);

    // Process results from each source
    const sourceResults = [];
    let totalNew = 0;
    let totalUpdated = 0;

    for (const sourceResult of result.results) {
        try {
            const { jobsNew, jobsUpdated } = await upsertJobs(sourceResult.jobs);
            
            totalNew += jobsNew;
            totalUpdated += jobsUpdated;

            sourceResults.push({
                source: sourceResult.source,
                success: true,
                jobsFound: sourceResult.jobs.length,
                jobsNew,
                jobsUpdated
            });

            // Log individual source success
            await db.insert(jobScrapingLogsTable).values({
                source: sourceResult.source,
                status: 'completed',
                jobsFound: sourceResult.jobs.length,
                jobsNew,
                jobsUpdated,
                startedAt: new Date(startTime),
                completedAt: new Date(),
                duration: Date.now() - startTime,
                workerID: jobId,
                requestParams: globalOptions
            });

        } catch (error) {
            sourceResults.push({
                source: sourceResult.source,
                success: false,
                error: error.message
            });

            // Log individual source failure
            await db.insert(jobScrapingLogsTable).values({
                source: sourceResult.source,
                status: 'failed',
                errorMessage: error.message,
                errorStack: error.stack,
                startedAt: new Date(startTime),
                completedAt: new Date(),
                duration: Date.now() - startTime,
                workerID: jobId
            });
        }
    }

    const duration = Date.now() - startTime;

    return {
        success: true,
        totalSources: result.results.length,
        totalJobsFound: result.totalJobs,
        totalNew,
        totalUpdated,
        errors: result.errors,
        sourceResults,
        duration: `${duration}ms`
    };
}

/**
 * Upsert jobs into database with deduplication
 * Returns counts of new and updated jobs
 */
async function upsertJobs(jobs) {
    let jobsNew = 0;
    let jobsUpdated = 0;

    for (const job of jobs) {
        try {
            // Check if job already exists (by external_id + source)
            const [existing] = await db.select()
                .from(jobsTable)
                .where(and(
                    eq(jobsTable.externalId, job.externalId),
                    eq(jobsTable.source, job.source)
                ))
                .limit(1);

            if (existing) {
                // Update existing job
                await db.update(jobsTable)
                    .set({
                        ...job,
                        lastScrapedAt: new Date(),
                        updatedAt: new Date(),
                        isActive: true // Reactivate if was inactive
                    })
                    .where(eq(jobsTable.id, existing.id));

                jobsUpdated++;
            } else {
                // Insert new job
                await db.insert(jobsTable).values({
                    ...job,
                    lastScrapedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                jobsNew++;
            }
        } catch (error) {
            logger.error('Failed to upsert job', {
                job: {
                    externalId: job.externalId,
                    source: job.source,
                    title: job.title
                },
                error: error.message
            });
            // Continue processing other jobs
        }
    }

    return { jobsNew, jobsUpdated };
}

/**
 * Cleanup stale jobs
 * Mark jobs as inactive if not scraped recently
 */
async function cleanupStaleJobs(jobId, data) {
    const { daysOld = 30 } = data;
    const startTime = Date.now();

    logger.info('Cleaning up stale jobs', { daysOld });

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Update stale jobs to inactive
    const result = await db.update(jobsTable)
        .set({
            isActive: false,
            updatedAt: new Date()
        })
        .where(and(
            eq(jobsTable.isActive, true),
            lt(jobsTable.lastScrapedAt, cutoffDate)
        ))
        .returning({ id: jobsTable.id });

    const jobsDeactivated = result.length;
    const duration = Date.now() - startTime;

    logger.info('Stale jobs cleaned up', { 
        jobsDeactivated, 
        daysOld,
        duration: `${duration}ms`
    });

    return {
        success: true,
        jobsDeactivated,
        daysOld,
        cutoffDate,
        duration: `${duration}ms`
    };
}

/**
 * Create and configure the job scraping worker
 */
const jobScrapingWorker = new Worker('job-scraping', processJobScrapingJob, {
    connection: bullMQConnection,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per 60 seconds (1 minute)
    },
});

// Worker event handlers
jobScrapingWorker.on('completed', (job, result) => {
    logger.info('Job scraping job completed successfully', {
        jobId: job.id,
        jobType: job.name,
        result
    });
});

jobScrapingWorker.on('failed', (job, error) => {
    logger.error('Job scraping job failed', {
        jobId: job?.id,
        jobType: job?.name,
        error: error.message,
        stack: error.stack,
        attemptsMade: job?.attemptsMade,
        attemptsMax: job?.opts?.attempts
    });
});

jobScrapingWorker.on('error', (error) => {
    logger.error('Job scraping worker error', {
        error: error.message,
        stack: error.stack
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing job scraping worker gracefully');
    await jobScrapingWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing job scraping worker gracefully');
    await jobScrapingWorker.close();
    process.exit(0);
});

logger.info('Job scraping worker started', {
    concurrency: WORKER_CONCURRENCY,
    rateLimit: '10 jobs per minute'
});

export default jobScrapingWorker;
