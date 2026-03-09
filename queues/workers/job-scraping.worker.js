import { Worker } from 'bullmq';
import { bullMQConnection } from '../../config/redis.config.js';
import logger from '../../middleware/logger.js';
import { JOB_SCRAPING_TYPES, addScrapeSourceJob } from '../job-scraping.queue.js';
import jobBoardsService from '../../services/jobBoards/index.js';
import { db } from '../../config/db.js';
import { jobsTable, jobScrapingLogsTable } from '../../drizzle/schema.js';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';

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
            case JOB_SCRAPING_TYPES.SCRAPE_INDIAN_SOURCE: // Indian boards share the same single-source handler
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

    // Scrape from all remote/international sources
    const result = await jobBoardsService.scrapeAllSources(globalOptions);

    // Enqueue individual SCRAPE_SOURCE jobs for all 5 Indian boards so each
    // gets its own retry budget, concurrency slot, and scraping-log entry.
    const indianBoardDefaults = {
        locations: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'India'],
        limit: globalOptions.limit || 50,
    };
    const indianBoards = [
        { source: 'naukri',        options: indianBoardDefaults },
        { source: 'linkedin-india', options: indianBoardDefaults },
        { source: 'internshala',   options: { ...indianBoardDefaults, include_internships: true, include_jobs: true } },
        { source: 'foundit',       options: indianBoardDefaults },
        { source: 'shine',         options: indianBoardDefaults },
    ];
    await Promise.allSettled(
        indianBoards.map(board =>
            addScrapeSourceJob(
                { source: board.source, options: { ...globalOptions, ...board.options } },
                { jobId: `scrape-${board.source}-${jobId}-${Date.now()}`, priority: 5 }
            ).catch(err => logger.warn('Failed to enqueue Indian board job', { source: board.source, error: err.message }))
        )
    );
    logger.info('Indian board scraping jobs enqueued', { boards: indianBoards.map(b => b.source) });

    // Process results from each remote source
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
 * 
 * Uses batch upsert with ON CONFLICT for performance:
 * - 300 jobs: 1 query instead of 600-900 queries
 * - Wrapped in transaction for atomicity
 */
async function upsertJobs(jobs) {
    if (jobs.length === 0) {
        return { jobsNew: 0, jobsUpdated: 0 };
    }

    try {
        // Get current counts before upsert to calculate new vs updated.
        // Use inArray() on externalId (parameterized — no sql.raw) then filter
        // in-memory by source to avoid composite-tuple SQL injection.
        const externalIdList = [...new Set(jobs.map(j => j.externalId))];
        const sourceSet = new Set(jobs.map(j => j.source));

        const existingJobs = await db.select({
            externalId: jobsTable.externalId,
            source: jobsTable.source
        })
        .from(jobsTable)
        .where(inArray(jobsTable.externalId, externalIdList));

        // Further narrow to the exact sources in this batch (in-memory — cheap)
        const filteredExisting = existingJobs.filter(j => sourceSet.has(j.source));

        const existingKeys = new Set(filteredExisting.map(j => `${j.externalId}:${j.source}`));
        const jobsUpdated = jobs.filter(j => existingKeys.has(`${j.externalId}:${j.source}`)).length;
        const jobsNew = jobs.length - jobsUpdated;

        // Prepare jobs for upsert
        const now = new Date();
        const jobsToUpsert = jobs.map(job => ({
            ...job,
            lastScrapedAt: now,
            updatedAt: now,
            createdAt: now, // Only used on insert
            isActive: true
        }));

        // Batch upsert with ON CONFLICT
        await db.transaction(async (tx) => {
            await tx.insert(jobsTable)
                .values(jobsToUpsert)
                .onConflictDoUpdate({
                    target: [jobsTable.externalId, jobsTable.source],
                    set: {
                        title: sql`EXCLUDED.title`,
                        company: sql`EXCLUDED.company`,
                        companyLogo: sql`EXCLUDED.company_logo`,
                        location: sql`EXCLUDED.location`,
                        remoteType: sql`EXCLUDED.remote_type`,
                        employmentType: sql`EXCLUDED.employment_type`,
                        experienceLevel: sql`EXCLUDED.experience_level`,
                        salaryMin: sql`EXCLUDED.salary_min`,
                        salaryMax: sql`EXCLUDED.salary_max`,
                        currency: sql`EXCLUDED.currency`,
                        salaryPeriod: sql`EXCLUDED.salary_period`,
                        description: sql`EXCLUDED.description`,
                        requirements: sql`EXCLUDED.requirements`,
                        responsibilities: sql`EXCLUDED.responsibilities`,
                        benefits: sql`EXCLUDED.benefits`,
                        skillsRequired: sql`EXCLUDED.skills_required`,
                        educationLevel: sql`EXCLUDED.education_level`,
                        yearsExperienceMin: sql`EXCLUDED.years_experience_min`,
                        yearsExperienceMax: sql`EXCLUDED.years_experience_max`,
                        url: sql`EXCLUDED.url`,
                        applyUrl: sql`EXCLUDED.apply_url`,
                        postedDate: sql`EXCLUDED.posted_date`,
                        expiresAt: sql`EXCLUDED.expires_at`,
                        lastScrapedAt: now,
                        isActive: true,
                        rawData: sql`EXCLUDED.raw_data`,
                        meta: sql`EXCLUDED.meta`,
                        updatedAt: now
                    }
                });
        });

        logger.info('Batch upsert completed', { 
            total: jobs.length, 
            jobsNew, 
            jobsUpdated 
        });

        return { jobsNew, jobsUpdated };

    } catch (error) {
        logger.error('Batch upsert failed', {
            error: error.message,
            stack: error.stack,
            jobCount: jobs.length
        });
        throw error;
    }
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

    // Hard-delete very old inactive jobs to prevent unbounded table growth
    const purgeResult = await db.execute(
        sql`DELETE FROM jobs WHERE is_active = false AND updated_at < now() - interval '90 days'`
    );
    const jobsPurged = Number(purgeResult.rowCount ?? 0);

    const duration = Date.now() - startTime;

    logger.info('Stale jobs cleaned up', { 
        jobsDeactivated,
        jobsPurged,
        daysOld,
        duration: `${duration}ms`
    });

    return {
        success: true,
        jobsDeactivated,
        jobsPurged,
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
