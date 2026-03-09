/**
 * Indian Job Boards Service
 *
 * Node.js HTTP client for the Python Scrapling microservice.
 * Called by the BullMQ job-scraping worker exactly like any other scraper.
 *
 * Architecture:
 *   BullMQ worker → scrapeJobsFromSource('naukri', opts)
 *                 → this service → POST SCRAPER_SERVICE_URL/api/v1/scrape
 *                 → Python FastAPI (Scrapling)
 *                 → returns { jobs: [...] }   ← camelCase, ready for upsertJobs()
 *
 * Separation of concerns:
 *  - Python service scrapes and returns raw jobs
 *  - Node.js does the DB upsert (same upsertJobs() used for all sources)
 *
 * Future separate-server support:
 *  - Just change SCRAPER_SERVICE_URL in .env — zero code changes needed
 */

import logger from '../../middleware/logger.js';
import { withCircuitBreaker } from './circuit-breaker.service.js';

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:8001';
const SCRAPER_SERVICE_SECRET = process.env.SCRAPER_SERVICE_SECRET || '';
const REQUEST_TIMEOUT_MS = 120_000; // 2 min — browser scrapers can be slow

/**
 * Map of snake_case keys returned by Python → camelCase expected by upsertJobs()
 */
const SNAKE_TO_CAMEL = {
    external_id: 'externalId',
    company_logo: 'companyLogo',
    remote_type: 'remoteType',
    employment_type: 'employmentType',
    experience_level: 'experienceLevel',
    salary_min: 'salaryMin',
    salary_max: 'salaryMax',
    salary_period: 'salaryPeriod',
    skills_required: 'skillsRequired',
    education_level: 'educationLevel',
    years_experience_min: 'yearsExperienceMin',
    years_experience_max: 'yearsExperienceMax',
    apply_url: 'applyUrl',
    posted_date: 'postedDate',
    expires_at: 'expiresAt',
    raw_data: 'rawData',
};

function normaliseCamelCase(job) {
    const out = {};
    for (const [k, v] of Object.entries(job)) {
        out[SNAKE_TO_CAMEL[k] ?? k] = v;
    }
    return out;
}

/**
 * Scrape jobs from an Indian job board via the Python microservice.
 *
 * @param {string} source   - One of: 'naukri', 'internshala', 'linkedin-india', 'foundit', 'shine'
 * @param {Object} options  - { keywords?: string[], locations?: string[], limit?: number, ...extras }
 * @returns {Promise<{ jobs: Object[], stats: Object }>}
 *   - jobs: camelCase job objects ready for upsertJobs()
 *   - stats: { jobsFound, durationMs }
 */
async function _doScrape(source, options = {}) {
    const url = `${SCRAPER_SERVICE_URL}/api/v1/scrape`;

    logger.info('[IndianBoards] Calling Python scraper', { source, url, options });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': SCRAPER_SERVICE_SECRET,
            },
            body: JSON.stringify({ source, options }),
        });

        clearTimeout(timer);

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Python scraper returned HTTP ${response.status}: ${body}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(`Python scraper error for ${source}: ${data.error || 'unknown error'}`);
        }

        const jobs = (data.jobs || []).map(normaliseCamelCase);

        logger.info('[IndianBoards] Scrape complete', {
            source,
            jobsFound: jobs.length,
            durationMs: data.duration_ms,
        });

        return {
            jobs,
            stats: {
                jobsFound: data.jobs_found ?? jobs.length,
                durationMs: data.duration_ms,
            },
        };
    } catch (error) {
        clearTimeout(timer);

        if (error.name === 'AbortError') {
            throw new Error(`Python scraper timed out for source: ${source}`);
        }

        logger.error('[IndianBoards] Scrape failed', { source, error: error.message });
        throw error;
    }
}

/**
 * Scrape jobs from an Indian job board via the Python microservice,
 * wrapped in a per-source circuit breaker.
 *
 * A Python service crash (HTTP 5xx, timeout, connection refused) trips the
 * breaker and immediately returns { jobs: [], stats: { error: '...' } } for
 * the reset window — so the BullMQ worker does not burn through all retries.
 *
 * @param {string} source   - One of: 'naukri', 'internshala', 'linkedin-india', 'foundit', 'shine'
 * @param {Object} options  - { keywords?, locations?, limit?, ...extras }
 * @returns {Promise<{ jobs: Object[], stats: Object }>}
 */
export async function scrapeIndianSource(source, options = {}) {
    return withCircuitBreaker(
        source,
        (opts) => _doScrape(source, opts),
        options,
    );
}

/**
 * Check if the Python scraper service is reachable.
 * Called at startup by the worker (optional health-check).
 *
 * @returns {Promise<boolean>}
 */
export async function isScrapeServiceHealthy() {
    try {
        const res = await fetch(`${SCRAPER_SERVICE_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
        return res.ok;
    } catch {
        return false;
    }
}

export default { scrapeIndianSource, isScrapeServiceHealthy };
