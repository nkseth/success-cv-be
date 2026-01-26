import { Router } from 'express';
import { sendSuccess, sendError } from '../../utils/apiHelpers.js';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { jobsTable, jobScrapingLogsTable } from '../../drizzle/schema.js';
import { sql, desc, eq, and, gte } from 'drizzle-orm';
import cacheService from '../../services/jobBoards/cache.service.js';
import circuitBreakerService from '../../services/jobBoards/circuit-breaker.service.js';
import { getQueueStats } from '../../queues/job-scraping.queue.js';

const router = Router();

/**
 * GET /api/v1/health/scraping
 * 
 * Comprehensive health check for job scraping system
 * Returns:
 * - Last successful scrape times per source
 * - Job counts per source
 * - Circuit breaker statuses
 * - Cache statistics
 * - Queue statistics
 * - Recent errors
 */
router.get('/scraping', async (req, res) => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // 1. Get last successful scrapes per source
        const lastScrapes = await db.select({
            source: jobScrapingLogsTable.source,
            lastSuccessAt: sql`MAX(${jobScrapingLogsTable.completedAt})`,
            jobsFound: sql`SUM(${jobScrapingLogsTable.jobsFound})::int`,
            jobsNew: sql`SUM(${jobScrapingLogsTable.jobsNew})::int`,
            jobsUpdated: sql`SUM(${jobScrapingLogsTable.jobsUpdated})::int`,
            totalRuns: sql`COUNT(*)::int`
        })
        .from(jobScrapingLogsTable)
        .where(and(
            eq(jobScrapingLogsTable.status, 'completed'),
            gte(jobScrapingLogsTable.completedAt, oneDayAgo)
        ))
        .groupBy(jobScrapingLogsTable.source);

        // 2. Get active job counts per source
        const jobCounts = await db.select({
            source: jobsTable.source,
            activeJobs: sql`COUNT(*)::int`,
            lastScraped: sql`MAX(${jobsTable.lastScrapedAt})`
        })
        .from(jobsTable)
        .where(eq(jobsTable.isActive, true))
        .groupBy(jobsTable.source);

        // 3. Get recent failures (last hour)
        const recentFailures = await db.select({
            source: jobScrapingLogsTable.source,
            failureCount: sql`COUNT(*)::int`,
            lastError: sql`MAX(${jobScrapingLogsTable.errorMessage})`
        })
        .from(jobScrapingLogsTable)
        .where(and(
            eq(jobScrapingLogsTable.status, 'failed'),
            gte(jobScrapingLogsTable.completedAt, oneHourAgo)
        ))
        .groupBy(jobScrapingLogsTable.source);

        // 4. Get circuit breaker statuses
        const circuitBreakerStatuses = circuitBreakerService.getAllBreakerStatuses();

        // 5. Get cache statistics
        const cacheStats = await cacheService.getCacheStats();

        // 6. Get queue statistics
        const queueStats = await getQueueStats();

        // 7. Calculate overall health
        const sourceHealth = {};
        const sources = ['remoteok', 'remotive', 'weworkremotely', 'himalayas', 'jobicy'];
        
        for (const source of sources) {
            const lastScrape = lastScrapes.find(s => s.source === source);
            const jobCount = jobCounts.find(s => s.source === source);
            const failures = recentFailures.find(s => s.source === source);
            const breaker = circuitBreakerStatuses[source];
            
            const lastScrapeTime = lastScrape?.lastSuccessAt || jobCount?.lastScraped;
            const timeSinceLastScrape = lastScrapeTime 
                ? Math.floor((now - new Date(lastScrapeTime)) / 1000 / 60) // minutes
                : null;
            
            // Determine health status
            let status = 'healthy';
            const issues = [];
            
            if (!lastScrapeTime) {
                status = 'unknown';
                issues.push('No scraping history found');
            } else if (timeSinceLastScrape > 1440) { // > 24 hours
                status = 'critical';
                issues.push(`No successful scrape in ${Math.floor(timeSinceLastScrape / 60)} hours`);
            } else if (timeSinceLastScrape > 360) { // > 6 hours
                status = 'degraded';
                issues.push(`Last scrape was ${Math.floor(timeSinceLastScrape / 60)} hours ago`);
            }
            
            if (breaker?.state === 'OPEN') {
                status = 'critical';
                issues.push('Circuit breaker is OPEN - service unavailable');
            } else if (breaker?.state === 'HALF_OPEN') {
                status = status === 'critical' ? 'critical' : 'degraded';
                issues.push('Circuit breaker is HALF_OPEN - testing recovery');
            }
            
            if (failures && failures.failureCount > 0) {
                if (failures.failureCount >= 3) {
                    status = status === 'critical' ? 'critical' : 'degraded';
                    issues.push(`${failures.failureCount} failures in last hour`);
                }
            }
            
            if ((jobCount?.activeJobs || 0) === 0 && lastScrape) {
                status = status === 'critical' ? 'critical' : 'degraded';
                issues.push('No active jobs in database');
            }
            
            sourceHealth[source] = {
                status,
                issues: issues.length > 0 ? issues : ['All systems operational'],
                metrics: {
                    activeJobs: jobCount?.activeJobs || 0,
                    lastScrapedAt: lastScrapeTime,
                    timeSinceLastScrape: timeSinceLastScrape ? `${timeSinceLastScrape} minutes` : 'Never',
                    last24h: {
                        totalRuns: lastScrape?.totalRuns || 0,
                        jobsFound: lastScrape?.jobsFound || 0,
                        jobsNew: lastScrape?.jobsNew || 0,
                        jobsUpdated: lastScrape?.jobsUpdated || 0
                    },
                    recentFailures: failures?.failureCount || 0,
                    lastError: failures?.lastError || null
                },
                circuitBreaker: breaker || { state: 'NOT_INITIALIZED' }
            };
        }

        // Overall system health
        const statuses = Object.values(sourceHealth).map(s => s.status);
        const overallStatus = statuses.includes('critical') ? 'critical' 
            : statuses.includes('degraded') ? 'degraded' 
            : statuses.includes('unknown') ? 'unknown'
            : 'healthy';

        const response = {
            overallStatus,
            timestamp: now,
            sources: sourceHealth,
            system: {
                cache: cacheStats,
                queue: {
                    waiting: queueStats.waiting || 0,
                    active: queueStats.active || 0,
                    completed: queueStats.completed || 0,
                    failed: queueStats.failed || 0
                }
            }
        };

        const httpStatus = overallStatus === 'critical' ? 503 
            : overallStatus === 'degraded' ? 200 
            : 200;

        if (overallStatus === 'healthy') {
            sendSuccess(res, response, 'Job scraping system is healthy', httpStatus);
        } else {
            sendSuccess(res, response, `Job scraping system status: ${overallStatus}`, httpStatus);
        }

    } catch (error) {
        logger.error('Job scraping health check failed', {
            error: error.message,
            stack: error.stack
        });
        sendError(res, 'Health check failed', 500, { error: error.message });
    }
});

/**
 * GET /api/v1/health/scraping/sources
 * 
 * Get detailed source information
 */
router.get('/scraping/sources', async (req, res) => {
    try {
        const sources = await db.select({
            source: jobsTable.source,
            totalJobs: sql`COUNT(*)::int`,
            activeJobs: sql`COUNT(*) FILTER (WHERE ${jobsTable.isActive} = true)::int`,
            inactiveJobs: sql`COUNT(*) FILTER (WHERE ${jobsTable.isActive} = false)::int`,
            oldestJob: sql`MIN(${jobsTable.createdAt})`,
            newestJob: sql`MAX(${jobsTable.createdAt})`,
            lastScraped: sql`MAX(${jobsTable.lastScrapedAt})`
        })
        .from(jobsTable)
        .groupBy(jobsTable.source);

        sendSuccess(res, sources, 'Source statistics retrieved');
    } catch (error) {
        logger.error('Source stats retrieval failed', {
            error: error.message
        });
        sendError(res, 'Failed to retrieve source statistics', 500);
    }
});

/**
 * GET /api/v1/health/scraping/logs
 * 
 * Get recent scraping logs
 */
router.get('/scraping/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const source = req.query.source;

        let query = db.select()
            .from(jobScrapingLogsTable)
            .orderBy(desc(jobScrapingLogsTable.createdAt))
            .limit(limit);

        if (source) {
            query = query.where(eq(jobScrapingLogsTable.source, source));
        }

        const logs = await query;

        sendSuccess(res, logs, 'Scraping logs retrieved');
    } catch (error) {
        logger.error('Scraping logs retrieval failed', {
            error: error.message
        });
        sendError(res, 'Failed to retrieve scraping logs', 500);
    }
});

/**
 * POST /api/v1/health/scraping/circuit-breaker/reset/:source
 * 
 * Manually reset circuit breaker for a source
 */
router.post('/scraping/circuit-breaker/reset/:source', async (req, res) => {
    try {
        const { source } = req.params;
        const success = circuitBreakerService.resetBreaker(source);

        if (success) {
            sendSuccess(res, { source, reset: true }, `Circuit breaker reset for ${source}`);
        } else {
            sendError(res, `Circuit breaker not found for ${source}`, 404);
        }
    } catch (error) {
        logger.error('Circuit breaker reset failed', {
            error: error.message,
            source: req.params.source
        });
        sendError(res, 'Failed to reset circuit breaker', 500);
    }
});

export default router;
