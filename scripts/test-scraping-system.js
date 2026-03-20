#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Comprehensive Test Script — Job Scraping System
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Tests every layer of the scraping pipeline end-to-end:
 *
 *    1. Individual source scrapers (RemoteOK, Remotive, WWR, Himalayas, Jobicy)
 *    2. Indian board scrapers via Python microservice (Naukri, Internshala, etc.)
 *    3. Multi-source aggregation (scrapeAllSources)
 *    4. Circuit breaker service (status, open/close states)
 *    5. Cache service (set, get, invalidate, stats)
 *    6. Queue system (addJob, getStatus, getQueueStats)
 *    7. Health endpoint (GET /api/v1/health/scraping)
 *    8. Job schema validation (normalised fields check)
 *    9. Python scraper health check
 *
 *  Usage:
 *    node scripts/test-scraping-system.js                 # Run all tests
 *    node scripts/test-scraping-system.js --sources       # Source scrapers only
 *    node scripts/test-scraping-system.js --indian        # Indian boards only
 *    node scripts/test-scraping-system.js --cache         # Cache tests only
 *    node scripts/test-scraping-system.js --circuit       # Circuit breaker tests
 *    node scripts/test-scraping-system.js --queue         # Queue tests only
 *    node scripts/test-scraping-system.js --health        # Health endpoint only
 *    node scripts/test-scraping-system.js --fast          # Skip slow scrapers
 *    node scripts/test-scraping-system.js --source=remoteok  # Single source
 *
 *  Environment:
 *    Requires REDIS_HOST (for cache & queue tests)
 *    Requires DATABASE_URL (for queue worker tests)
 *    Optional SCRAPER_SERVICE_URL (for Indian board tests)
 *    Optional BASE_URL (for health endpoint tests, default http://localhost:3000)
 *
 *  Exit codes:
 *    0 = all tests passed
 *    1 = one or more tests failed
 * ═══════════════════════════════════════════════════════════════════════════
 */

import dotenv from 'dotenv';
dotenv.config();

import logger from '../middleware/logger.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:8001';

const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️';
const WARN = '⚠️';
const INFO = 'ℹ️';

let totalTests = 0;
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function parseArgs() {
    const args = process.argv.slice(2);
    const flags = {};
    for (const arg of args) {
        if (arg.startsWith('--source=')) {
            flags.singleSource = arg.split('=')[1];
        } else if (arg.startsWith('--')) {
            flags[arg.replace('--', '')] = true;
        }
    }
    // If no specific flag, run all
    if (!flags.sources && !flags.indian && !flags.cache && !flags.circuit && !flags.queue && !flags.health && !flags.singleSource) {
        flags.all = true;
    }
    return flags;
}

function logResult(name, success, detail = '') {
    totalTests++;
    if (success === 'skip') {
        skipped++;
        console.log(`  ${SKIP} ${name} — SKIPPED${detail ? ` (${detail})` : ''}`);
    } else if (success) {
        passed++;
        console.log(`  ${PASS} ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
        failed++;
        failures.push({ name, detail });
        console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function section(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

/**
 * Standard job schema fields that every normalised job must contain
 */
const REQUIRED_JOB_FIELDS = [
    'externalId', 'source', 'title', 'company', 'url'
];
const OPTIONAL_JOB_FIELDS = [
    'companyLogo', 'location', 'remoteType', 'employmentType', 'experienceLevel',
    'salaryMin', 'salaryMax', 'currency', 'salaryPeriod',
    'description', 'requirements', 'responsibilities', 'benefits',
    'skillsRequired', 'educationLevel',
    'yearsExperienceMin', 'yearsExperienceMax',
    'applyUrl', 'postedDate', 'expiresAt',
    'isActive', 'rawData', 'meta'
];

function validateJobSchema(job, source) {
    const issues = [];
    for (const field of REQUIRED_JOB_FIELDS) {
        if (job[field] === undefined || job[field] === null || job[field] === '') {
            issues.push(`missing required field: ${field}`);
        }
    }
    if (job.source !== source) {
        issues.push(`source mismatch: expected '${source}', got '${job.source}'`);
    }
    // Check types
    if (job.salaryMin !== null && job.salaryMin !== undefined && typeof job.salaryMin !== 'number') {
        issues.push(`salaryMin should be number, got ${typeof job.salaryMin}`);
    }
    if (job.salaryMax !== null && job.salaryMax !== undefined && typeof job.salaryMax !== 'number') {
        issues.push(`salaryMax should be number, got ${typeof job.salaryMax}`);
    }
    if (job.postedDate && !(job.postedDate instanceof Date) && isNaN(new Date(job.postedDate).getTime())) {
        issues.push(`postedDate is not a valid date: ${job.postedDate}`);
    }
    // Check remoteType enum
    const validRemoteTypes = ['remote', 'hybrid', 'onsite', null, undefined];
    if (job.remoteType && !validRemoteTypes.includes(job.remoteType)) {
        issues.push(`invalid remoteType: '${job.remoteType}'`);
    }
    // Check employmentType enum
    const validEmploymentTypes = ['full-time', 'part-time', 'contract', 'internship', 'temporary', 'freelance', null, undefined];
    if (job.employmentType && !validEmploymentTypes.includes(job.employmentType)) {
        issues.push(`invalid employmentType: '${job.employmentType}'`);
    }
    // Check experienceLevel enum
    const validExpLevels = ['entry', 'mid', 'senior', 'lead', 'executive', null, undefined];
    if (job.experienceLevel && !validExpLevels.includes(job.experienceLevel)) {
        issues.push(`invalid experienceLevel: '${job.experienceLevel}'`);
    }
    return issues;
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Individual Source Scrapers ────────────────────────────────────────────

async function testSourceScraper(source, options = {}) {
    const { scrapeJobsFromSource } = await import('../services/jobBoards/index.js');

    const startTime = Date.now();
    try {
        const result = await scrapeJobsFromSource(source, {
            limit: options.limit || 5,
            skipCache: true,
            ...options,
        });
        const duration = Date.now() - startTime;

        // Test: result structure
        logResult(
            `[${source}] Returns valid result object`,
            result && typeof result === 'object' && Array.isArray(result.jobs),
            `${result.jobs.length} jobs in ${duration}ms`
        );

        // Test: jobs are present (some sources may return 0 if API is down)
        logResult(
            `[${source}] Returns at least 1 job`,
            result.jobs.length > 0,
            `${result.jobs.length} jobs`
        );

        // Test: source tag is correct
        logResult(
            `[${source}] Source tag is set correctly`,
            result.source === source,
            `source = '${result.source}'`
        );

        // Test: schema validation on first job
        if (result.jobs.length > 0) {
            const issues = validateJobSchema(result.jobs[0], source);
            logResult(
                `[${source}] First job passes schema validation`,
                issues.length === 0,
                issues.length > 0 ? issues.join('; ') : 'all fields valid'
            );

            // Test: no duplicate externalIds
            const ids = result.jobs.map(j => j.externalId);
            const uniqueIds = new Set(ids);
            logResult(
                `[${source}] No duplicate externalIds`,
                ids.length === uniqueIds.size,
                `${ids.length} jobs, ${uniqueIds.size} unique`
            );
        }

        // Test: fromCache flag is false (we used skipCache)
        logResult(
            `[${source}] skipCache=true → fromCache=false`,
            result.fromCache === false,
            `fromCache = ${result.fromCache}`
        );

        // Test: stats object exists
        logResult(
            `[${source}] Stats object is present`,
            result.stats && typeof result.stats === 'object',
            result.stats ? `totalFetched=${result.stats.totalFetched}` : 'missing'
        );

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logResult(`[${source}] Scrape completes without error`, false, `${error.message} (${duration}ms)`);
        return null;
    }
}

async function testAllSources(flags) {
    section('1. Individual Source Scrapers');

    const remoteSources = ['remoteok', 'remotive', 'weworkremotely', 'himalayas', 'jobicy'];

    if (flags.singleSource) {
        await testSourceScraper(flags.singleSource);
        return;
    }

    for (const source of remoteSources) {
        console.log(`\n  ── ${source} ──`);
        await testSourceScraper(source);
    }
}

// ── 2. Indian Board Scrapers ────────────────────────────────────────────────

async function testIndianScraper(source) {
    const { scrapeJobsFromSource } = await import('../services/jobBoards/index.js');

    const startTime = Date.now();
    try {
        const result = await scrapeJobsFromSource(source, {
            limit: 3,
            skipCache: true,
            keywords: ['software engineer'],
            locations: ['Bangalore'],
        });
        const duration = Date.now() - startTime;

        logResult(
            `[${source}] Returns valid result`,
            result && typeof result === 'object' && Array.isArray(result.jobs),
            `${result.jobs.length} jobs in ${duration}ms`
        );

        if (result.jobs.length > 0) {
            const issues = validateJobSchema(result.jobs[0], source);
            logResult(
                `[${source}] First job passes schema validation`,
                issues.length === 0,
                issues.length > 0 ? issues.join('; ') : 'all fields valid'
            );
        } else {
            logResult(
                `[${source}] Returns jobs (may be 0 if Python service unavailable)`,
                false,
                '0 jobs returned — check Python scraper service'
            );
        }

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logResult(`[${source}] Scrape completes without error`, false, `${error.message} (${duration}ms)`);
        return null;
    }
}

async function testIndianBoards(flags) {
    section('2. Indian Job Board Scrapers (Python Microservice)');

    // First check if the Python service is reachable
    console.log(`\n  ── Health Check: ${SCRAPER_SERVICE_URL} ──`);
    let scraperHealthy = false;
    try {
        const { default: indianBoardsService } = await import('../services/jobBoards/indianBoards.service.js');
        scraperHealthy = await indianBoardsService.isScrapeServiceHealthy();
        logResult(
            'Python scraper service is reachable',
            scraperHealthy,
            scraperHealthy ? 'healthy' : `not reachable at ${SCRAPER_SERVICE_URL}`
        );
    } catch (error) {
        logResult('Python scraper service health check', false, error.message);
    }

    if (!scraperHealthy) {
        console.log(`  ${WARN} Skipping Indian board tests — Python service not running`);
        const indianSources = ['naukri', 'internshala', 'linkedin-india', 'foundit', 'shine'];
        for (const source of indianSources) {
            logResult(`[${source}] Scrape test`, 'skip', 'Python service unavailable');
        }
        return;
    }

    const indianSources = ['naukri', 'internshala', 'linkedin-india', 'foundit', 'shine'];
    for (const source of indianSources) {
        console.log(`\n  ── ${source} ──`);
        await testIndianScraper(source);
    }
}

// ── 3. Multi-Source Aggregation ──────────────────────────────────────────────

async function testMultiSourceAggregation() {
    section('3. Multi-Source Aggregation');

    const { scrapeAllSources, getSupportedSources } = await import('../services/jobBoards/index.js');

    // Test: getSupportedSources
    try {
        const sources = getSupportedSources();
        logResult(
            'getSupportedSources() returns list',
            Array.isArray(sources) && sources.length > 0,
            `${sources.length} sources registered`
        );

        // Check all expected sources exist
        const expectedNames = ['remoteok', 'remotive', 'weworkremotely', 'himalayas', 'jobicy', 'indeed',
            'naukri', 'internshala', 'linkedin-india', 'foundit', 'shine'];
        const sourceNames = sources.map(s => s.name);
        const missing = expectedNames.filter(n => !sourceNames.includes(n));
        logResult(
            'All 11 sources registered',
            missing.length === 0,
            missing.length > 0 ? `missing: ${missing.join(', ')}` : '11/11 present'
        );

        // Check Indian sources have country=IN
        const indianSources = sources.filter(s => s.country === 'IN');
        logResult(
            'Indian sources have country="IN"',
            indianSources.length === 5,
            `${indianSources.length} Indian sources`
        );
    } catch (error) {
        logResult('getSupportedSources()', false, error.message);
    }

    // Test: scrapeAllSources (uses only remote sources, enqueues Indian)
    console.log(`\n  ── scrapeAllSources (remote only, limit=3) ──`);
    try {
        const startTime = Date.now();
        const result = await scrapeAllSources({ limit: 3 });
        const duration = Date.now() - startTime;

        logResult(
            'scrapeAllSources() returns valid result',
            result && typeof result === 'object' && Array.isArray(result.results),
            `${result.results.length} sources scraped, ${result.totalJobs} total jobs in ${duration}ms`
        );

        logResult(
            'scrapeAllSources() errors array exists',
            Array.isArray(result.errors),
            `${result.errors.length} source errors`
        );

        logResult(
            'scrapeAllSources() has timestamp',
            !!result.timestamp,
            `timestamp = ${result.timestamp}`
        );
    } catch (error) {
        logResult('scrapeAllSources()', false, error.message);
    }
}

// ── 4. Circuit Breaker Service ──────────────────────────────────────────────

async function testCircuitBreaker() {
    section('4. Circuit Breaker Service');

    const circuitBreakerService = (await import('../services/jobBoards/circuit-breaker.service.js')).default;

    // Test: getAllBreakerStatuses
    try {
        const statuses = circuitBreakerService.getAllBreakerStatuses();
        logResult(
            'getAllBreakerStatuses() returns object',
            typeof statuses === 'object',
            `${Object.keys(statuses).length} breakers registered`
        );

        // After running source tests, some breakers should exist
        for (const [source, status] of Object.entries(statuses)) {
            const validStates = ['CLOSED', 'OPEN', 'HALF_OPEN'];
            logResult(
                `[${source}] breaker has valid state`,
                validStates.includes(status.state),
                `state = ${status.state}`
            );
        }
    } catch (error) {
        logResult('getAllBreakerStatuses()', false, error.message);
    }

    // Test: getBreakerStatus for known source
    try {
        const status = circuitBreakerService.getBreakerStatus('remoteok');
        if (status.exists) {
            logResult(
                'getBreakerStatus("remoteok") returns details',
                status.state && status.options,
                `state=${status.state}, timeout=${status.options.timeout}ms`
            );
        } else {
            logResult(
                'getBreakerStatus("remoteok") breaker exists',
                'skip',
                'no breaker created yet (run source tests first)'
            );
        }
    } catch (error) {
        logResult('getBreakerStatus("remoteok")', false, error.message);
    }

    // Test: getBreakerStatus for unknown source
    try {
        const status = circuitBreakerService.getBreakerStatus('nonexistent-source');
        logResult(
            'getBreakerStatus("nonexistent-source") returns {exists: false}',
            status.exists === false,
            `exists = ${status.exists}`
        );
    } catch (error) {
        logResult('getBreakerStatus("nonexistent-source")', false, error.message);
    }

    // Test: withCircuitBreaker wraps a function correctly
    try {
        const { withCircuitBreaker } = await import('../services/jobBoards/circuit-breaker.service.js');

        // Successful call
        const result = await withCircuitBreaker('test-source', async (opts) => ({
            jobs: [{ title: 'Test Job' }],
            stats: { totalFetched: 1, filtered: 1, skipped: 0 }
        }), {});

        logResult(
            'withCircuitBreaker() wraps successful function',
            result.jobs.length === 1,
            `returned ${result.jobs.length} jobs`
        );
    } catch (error) {
        logResult('withCircuitBreaker() successful wrap', false, error.message);
    }

    // Test: resetBreaker
    try {
        const success = circuitBreakerService.resetBreaker('test-source');
        logResult(
            'resetBreaker("test-source") succeeds',
            success === true,
            `result = ${success}`
        );

        const failReset = circuitBreakerService.resetBreaker('does-not-exist');
        logResult(
            'resetBreaker("does-not-exist") returns false',
            failReset === false,
            `result = ${failReset}`
        );
    } catch (error) {
        logResult('resetBreaker()', false, error.message);
    }
}

// ── 5. Cache Service ────────────────────────────────────────────────────────

async function testCacheService() {
    section('5. Cache Service');

    let cacheAvailable = false;

    try {
        const cacheService = (await import('../services/jobBoards/cache.service.js')).default;

        // Test: setCachedJobs
        const testData = {
            jobs: [{ externalId: 'test-1', title: 'Test Job', source: 'test' }],
            stats: { totalFetched: 1, filtered: 1, skipped: 0 }
        };

        const setResult = await cacheService.setCachedJobs('test-source', { limit: 5 }, testData);
        logResult(
            'setCachedJobs() succeeds',
            setResult === true,
            `result = ${setResult}`
        );
        cacheAvailable = setResult;

        if (!cacheAvailable) {
            console.log(`  ${WARN} Redis not available — skipping remaining cache tests`);
            logResult('getCachedJobs()', 'skip', 'Redis unavailable');
            logResult('invalidateCache()', 'skip', 'Redis unavailable');
            logResult('getCacheStats()', 'skip', 'Redis unavailable');
            return;
        }

        // Test: getCachedJobs — should return the data we just set
        let ranGetCachedJobs = false;
        let ranInvalidateCache = false;
        let ranGetCacheStats = false;

        const cached = await cacheService.getCachedJobs('test-source', { limit: 5 });
        ranGetCachedJobs = true;
        logResult(
            'getCachedJobs() returns cached data',
            cached && cached.jobs && cached.jobs.length === 1,
            cached ? `${cached.jobs.length} jobs, cachedAt=${cached.cachedAt}` : 'null'
        );

        // Test: getCachedJobs with different options — should be a miss
        const cacheMiss = await cacheService.getCachedJobs('test-source', { limit: 10 });
        logResult(
            'getCachedJobs() returns null for different options (cache miss)',
            cacheMiss === null,
            `result = ${cacheMiss}`
        );

        // Test: invalidateCache
        const invalidated = await cacheService.invalidateCache('test-source');
        ranInvalidateCache = true;
        logResult(
            'invalidateCache() clears cache entries',
            invalidated >= 1,
            `${invalidated} keys deleted`
        );

        // Verify invalidation
        const afterInvalidate = await cacheService.getCachedJobs('test-source', { limit: 5 });
        logResult(
            'getCachedJobs() returns null after invalidation',
            afterInvalidate === null,
            `result = ${afterInvalidate}`
        );

        // Test: getCacheStats
        const stats = await cacheService.getCacheStats();
        ranGetCacheStats = true;
        logResult(
            'getCacheStats() returns stats object',
            typeof stats === 'object',
            `${Object.keys(stats).length} sources tracked`
        );
    } catch (error) {
        logResult('Cache service initialization', false, error.message);
        if (!cacheAvailable && !ranGetCachedJobs) {
            logResult('getCachedJobs()', 'skip', 'Redis unavailable');
        }
        if (!cacheAvailable && !ranInvalidateCache) {
            logResult('invalidateCache()', 'skip', 'Redis unavailable');
        }
        if (!cacheAvailable && !ranGetCacheStats) {
            logResult('getCacheStats()', 'skip', 'Redis unavailable');
        }
    }
}

// ── 6. Queue System ─────────────────────────────────────────────────────────

async function testQueueSystem() {
    section('6. Queue System');

    try {
        const {
            addScrapeSourceJob,
            addScrapeAllSourcesJob,
            addCleanupStaleJobsJob,
            getQueueStats,
            JOB_SCRAPING_TYPES
        } = await import('../queues/job-scraping.queue.js');

        // Test: JOB_SCRAPING_TYPES enum
        logResult(
            'JOB_SCRAPING_TYPES has expected values',
            JOB_SCRAPING_TYPES.SCRAPE_SOURCE && JOB_SCRAPING_TYPES.SCRAPE_ALL && JOB_SCRAPING_TYPES.CLEANUP_STALE,
            `SCRAPE_SOURCE='${JOB_SCRAPING_TYPES.SCRAPE_SOURCE}', SCRAPE_ALL='${JOB_SCRAPING_TYPES.SCRAPE_ALL}'`
        );

        logResult(
            'JOB_SCRAPING_TYPES includes SCRAPE_INDIAN_SOURCE',
            !!JOB_SCRAPING_TYPES.SCRAPE_INDIAN_SOURCE,
            `SCRAPE_INDIAN_SOURCE='${JOB_SCRAPING_TYPES.SCRAPE_INDIAN_SOURCE}'`
        );

        // Test: addScrapeSourceJob
        try {
            const job = await addScrapeSourceJob(
                { source: 'remoteok', options: { limit: 1 } },
                { jobId: `test-scrape-${Date.now()}` }
            );
            logResult(
                'addScrapeSourceJob() enqueues job',
                job && job.id,
                `jobId = ${job.id}`
            );

            // Clean up: remove the test job
            try { await job.remove(); } catch (_e) { /* ignore */ }
        } catch (error) {
            logResult('addScrapeSourceJob()', false, error.message);
        }

        // Test: addScrapeAllSourcesJob
        try {
            const job = await addScrapeAllSourcesJob(
                { globalOptions: { limit: 1 } },
                { jobId: `test-scrape-all-${Date.now()}` }
            );
            logResult(
                'addScrapeAllSourcesJob() enqueues job',
                job && job.id,
                `jobId = ${job.id}`
            );
            try { await job.remove(); } catch (_e) { /* ignore */ }
        } catch (error) {
            logResult('addScrapeAllSourcesJob()', false, error.message);
        }

        // Test: addCleanupStaleJobsJob
        try {
            const job = await addCleanupStaleJobsJob(
                { daysOld: 30 },
                { jobId: `test-cleanup-${Date.now()}` }
            );
            logResult(
                'addCleanupStaleJobsJob() enqueues job',
                job && job.id,
                `jobId = ${job.id}`
            );
            try { await job.remove(); } catch (_e) { /* ignore */ }
        } catch (error) {
            logResult('addCleanupStaleJobsJob()', false, error.message);
        }

        // Test: getQueueStats
        try {
            const stats = await getQueueStats();
            logResult(
                'getQueueStats() returns stats',
                stats && typeof stats === 'object',
                stats ? `waiting=${stats.waiting}, active=${stats.active}, completed=${stats.completed}, failed=${stats.failed}` : 'null'
            );
        } catch (error) {
            logResult('getQueueStats()', false, error.message);
        }
    } catch (error) {
        logResult('Queue system import', false, `${error.message} — is Redis running?`);
    }
}

// ── 7. Health Endpoint ──────────────────────────────────────────────────────

async function testHealthEndpoint() {
    section('7. Health / Monitoring Endpoints');

    // Test: GET /api/v1/health/scraping
    try {
        const res = await fetch(`${BASE_URL}/api/v1/health/scraping`);
        const data = await res.json();

        logResult(
            'GET /api/v1/health/scraping returns 200',
            res.status === 200,
            `status = ${res.status}`
        );

        logResult(
            'Health response has success field',
            data.success !== undefined,
            `success = ${data.success}`
        );

        if (data.data) {
            logResult(
                'Health response includes source health data',
                data.data.sources || data.data.sourceHealth,
                'source health present'
            );
        }
    } catch (error) {
        logResult('GET /api/v1/health/scraping', false, `${error.message} — is the server running on ${BASE_URL}?`);
    }

    // Test: GET /api/v1/health/scraping/sources
    try {
        const res = await fetch(`${BASE_URL}/api/v1/health/scraping/sources`);
        logResult(
            'GET /api/v1/health/scraping/sources returns 200',
            res.status === 200,
            `status = ${res.status}`
        );
    } catch (error) {
        logResult('GET /api/v1/health/scraping/sources', false, `${error.message}`);
    }

    // Test: GET /api/v1/health/scraping/logs
    try {
        const res = await fetch(`${BASE_URL}/api/v1/health/scraping/logs`);
        logResult(
            'GET /api/v1/health/scraping/logs returns 200',
            res.status === 200,
            `status = ${res.status}`
        );
    } catch (error) {
        logResult('GET /api/v1/health/scraping/logs', false, `${error.message}`);
    }

    // Test: Python scraper health (direct call)
    try {
        const res = await fetch(`${SCRAPER_SERVICE_URL}/api/v1/health`);
        const data = await res.json();
        logResult(
            `Python scraper health (${SCRAPER_SERVICE_URL})`,
            res.status === 200 && data.status === 'ok',
            `status="${data.status}", version="${data.version}"`
        );
    } catch (error) {
        logResult(
            `Python scraper health (${SCRAPER_SERVICE_URL})`,
            'skip',
            `not reachable — ${error.message}`
        );
    }
}

// ── 8. Job Schema Validation (Deep) ────────────────────────────────────────

async function testJobSchemaValidation() {
    section('8. Job Schema Validation (Cross-Source)');

    const { scrapeJobsFromSource } = await import('../services/jobBoards/index.js');

    // Pick one fast source for deep validation
    try {
        const result = await scrapeJobsFromSource('remoteok', { limit: 10, skipCache: true });

        if (result.jobs.length === 0) {
            logResult('Schema validation', 'skip', 'no jobs to validate');
            return;
        }

        let schemaIssueCount = 0;
        for (const job of result.jobs) {
            const issues = validateJobSchema(job, 'remoteok');
            if (issues.length > 0) schemaIssueCount++;
        }

        logResult(
            `All ${result.jobs.length} RemoteOK jobs pass schema validation`,
            schemaIssueCount === 0,
            schemaIssueCount > 0 ? `${schemaIssueCount} jobs have issues` : 'all valid'
        );

        // Check skillsRequired structure (should be object with required/technical arrays)
        const jobWithSkills = result.jobs.find(j => j.skillsRequired);
        if (jobWithSkills) {
            const skills = jobWithSkills.skillsRequired;
            const isObject = typeof skills === 'object' && !Array.isArray(skills);
            const hasRequiredArray = isObject && Array.isArray(skills.required);
            const hasTechnicalArray = isObject && Array.isArray(skills.technical);

            logResult(
                'skillsRequired is structured object {required:[], technical:[]}',
                isObject && hasRequiredArray,
                isObject
                    ? `required=[${skills.required?.length || 0}], technical=[${skills.technical?.length || 0}]`
                    : `got ${Array.isArray(skills) ? 'array (BUG-002!)' : typeof skills}`
            );
        } else {
            logResult('skillsRequired structure check', 'skip', 'no jobs with skills found');
        }

        // Check for null externalIds
        const nullIds = result.jobs.filter(j => !j.externalId);
        logResult(
            'No jobs with null externalId',
            nullIds.length === 0,
            nullIds.length > 0 ? `${nullIds.length} null IDs` : 'all have IDs'
        );

        // Check URL validity
        const invalidUrls = result.jobs.filter(j => {
            try { new URL(j.url); return false; } catch { return true; }
        });
        logResult(
            'All jobs have valid URLs',
            invalidUrls.length === 0,
            invalidUrls.length > 0 ? `${invalidUrls.length} invalid URLs` : 'all valid'
        );

    } catch (error) {
        logResult('Schema validation suite', false, error.message);
    }
}

// ── 9. Snake→CamelCase Normalisation (Indian boards) ────────────────────────

async function testSnakeToCamelNormalisation() {
    section('9. Indian Board snake_case → camelCase Normalisation');

    try {
        // Import the normalisation function indirectly by testing indianBoards.service.js
        const { default: indianBoardsService } = await import('../services/jobBoards/indianBoards.service.js');

        const healthy = await indianBoardsService.isScrapeServiceHealthy();
        if (!healthy) {
            logResult('Snake→CamelCase test', 'skip', 'Python service not running');
            return;
        }

        // Scrape one job from Naukri with minimal options
        const result = await indianBoardsService.scrapeIndianSource('naukri', {
            keywords: ['python'],
            locations: ['Mumbai'],
            limit: 1,
        });

        if (result.jobs.length === 0) {
            logResult('Snake→CamelCase normalisation', 'skip', 'no jobs returned');
            return;
        }

        const job = result.jobs[0];

        // Check that keys are camelCase (no underscores)
        const snakeCaseKeys = Object.keys(job).filter(k => k.includes('_'));
        logResult(
            'Indian board job has no snake_case keys',
            snakeCaseKeys.length === 0,
            snakeCaseKeys.length > 0 ? `snake_case keys found: ${snakeCaseKeys.join(', ')}` : 'all camelCase'
        );

        // Check specific camelCase fields
        const expectedCamelKeys = ['externalId', 'source', 'title', 'company'];
        const missingKeys = expectedCamelKeys.filter(k => !(k in job));
        logResult(
            'Indian board job has required camelCase fields',
            missingKeys.length === 0,
            missingKeys.length > 0 ? `missing: ${missingKeys.join(', ')}` : 'all present'
        );

    } catch (error) {
        logResult('Snake→CamelCase normalisation', false, error.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
    const flags = parseArgs();

    // Compute a content width that fits the longest value without breaking the box.
    const modeStr = flags.all ? 'ALL TESTS' : Object.keys(flags).join(', ');
    const contentWidth = Math.max(
        45,
        BASE_URL.length,
        SCRAPER_SERVICE_URL.length,
        modeStr.length
    );
    const pad = (s) => s.length > contentWidth ? s.slice(0, contentWidth - 3) + '...' : s.padEnd(contentWidth);
    const border = '═'.repeat(contentWidth + 17);

    console.log('\n');
    console.log(`╔${border}╗`);
    console.log(`║     🧪  Job Scraping System — Comprehensive Test Suite     ║`);
    console.log(`╠${border}╣`);
    console.log(`║  Date:      ${pad(new Date().toISOString().slice(0, 19))}║`);
    console.log(`║  Base URL:  ${pad(BASE_URL)}║`);
    console.log(`║  Scraper:   ${pad(SCRAPER_SERVICE_URL)}║`);
    console.log(`║  Mode:      ${pad(modeStr)}║`);
    console.log(`╚${border}╝`);

    const start = Date.now();

    try {
        // 1. Source scrapers
        if (flags.all || flags.sources || flags.singleSource) {
            await testAllSources(flags);
        }

        // 2. Indian boards
        if (flags.all || flags.indian) {
            await testIndianBoards(flags);
        }

        // 3. Multi-source aggregation (only if running all — it's slow)
        if (flags.all && !flags.fast) {
            await testMultiSourceAggregation();
        }

        // 4. Circuit breakers
        if (flags.all || flags.circuit) {
            await testCircuitBreaker();
        }

        // 5. Cache
        if (flags.all || flags.cache) {
            await testCacheService();
        }

        // 6. Queue
        if (flags.all || flags.queue) {
            await testQueueSystem();
        }

        // 7. Health endpoints
        if (flags.all || flags.health) {
            await testHealthEndpoint();
        }

        // 8. Schema validation
        if (flags.all || flags.sources) {
            await testJobSchemaValidation();
        }

        // 9. Indian normalisation
        if (flags.all || flags.indian) {
            await testSnakeToCamelNormalisation();
        }

    } catch (error) {
        console.error(`\n${FAIL} Unexpected error: ${error.message}`);
        console.error(error.stack);
    }

    const totalDuration = Date.now() - start;

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total:     ${String(totalTests).padEnd(45)}║`);
    console.log(`║  ${PASS} Passed:   ${String(passed).padEnd(45)}║`);
    console.log(`║  ${FAIL} Failed:   ${String(failed).padEnd(45)}║`);
    console.log(`║  ${SKIP} Skipped:  ${String(skipped).padEnd(45)}║`);
    console.log(`║  Duration:  ${(totalDuration / 1000).toFixed(1)}s${' '.repeat(42 - (totalDuration / 1000).toFixed(1).length)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (failures.length > 0) {
        console.log(`\n${FAIL} Failed tests:`);
        for (const { name, detail } of failures) {
            console.log(`   • ${name}: ${detail}`);
        }
    }

    console.log(`\n${failed === 0 ? '🎉 All tests passed!' : `💥 ${failed} test(s) failed.`}\n`);

    // Graceful exit — close any open handles
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 1000);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
