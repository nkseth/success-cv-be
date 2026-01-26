import axios from 'axios';
import logger from '../../middleware/logger.js';

/**
 * Himalayas Jobs API Scraper
 * 
 * Documentation: https://himalayas.app/api
 * Endpoint: https://himalayas.app/jobs/api
 * Max limit per request: 20
 * Rate limited
 * 
 * Required Attribution: Link back to Himalayas and mention as source
 */

const HIMALAYAS_API_URL = 'https://himalayas.app/jobs/api';
const SOURCE_NAME = 'himalayas';

/**
 * Scrape jobs from Himalayas API
 * @param {Object} options - Scraping options
 * @param {number} options.limit - Max jobs to return (max 20)
 * @param {number} options.offset - Number of jobs to skip
 * @returns {Promise<Object>} - { jobs: Array, stats: Object }
 */
export async function scrapeHimalayas(options = {}) {
    const { limit = 20, offset = 0 } = options;

    logger.info('Starting Himalayas API scraping', { limit, offset });

    try {
        const response = await axios.get(HIMALAYAS_API_URL, {
            params: {
                limit: Math.min(limit, 20), // API max is 20
                offset
            },
            headers: {
                'User-Agent': 'SuccessCV-JobScraper/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000
        });

        if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid response format from Himalayas API');
        }

        // API returns { jobs: [...], offset, limit, totalCount, updatedAt, comments }
        const { jobs: rawJobs = [], totalCount = 0 } = response.data;

        if (!Array.isArray(rawJobs)) {
            throw new Error('Jobs array not found in Himalayas API response');
        }

        logger.info('Fetched jobs from Himalayas API', {
            totalJobs: rawJobs.length,
            totalAvailable: totalCount
        });

        const processedJobs = rawJobs
            .filter(isValidJob)
            .map(normalizeJob);

        return {
            jobs: processedJobs,
            stats: {
                totalFetched: rawJobs.length,
                filtered: processedJobs.length,
                skipped: rawJobs.length - processedJobs.length,
                totalAvailable: totalCount
            }
        };
    } catch (error) {
        logger.error('Himalayas API scraping failed', {
            error: error.message,
            stack: error.stack,
            limit,
            offset
        });
        throw error;
    }
}

/**
 * Validate if job has required fields
 */
function isValidJob(job) {
    return !!(job?.guid && job?.title && job?.companyName && job?.applicationLink);
}

/**
 * Normalize Himalayas job to standard format
 */
function normalizeJob(job) {
    // Use seniority field if available, otherwise infer from title/description
    const experienceLevel = job.seniority && job.seniority.length > 0
        ? mapSeniorityToLevel(job.seniority[0])
        : determineExperienceLevel(job.title, job.description || '');
    
    const location = buildLocation(job.locationRestrictions, job.timezoneRestrictions);

    return {
        externalId: job.guid,
        source: SOURCE_NAME,
        title: job.title,
        company: job.companyName,
        companyLogo: job.companyLogo || null,
        location: location || 'Remote',
        remoteType: 'remote',
        employmentType: normalizeEmploymentType(job.employmentType),
        experienceLevel,
        salaryMin: job.minSalary || null,
        salaryMax: job.maxSalary || null,
        currency: job.currency || 'USD',
        salaryPeriod: 'yearly',
        description: job.description || job.excerpt || 'No description provided',
        requirements: null,
        responsibilities: null,
        benefits: null,
        skillsRequired: buildSkills(job.categories, job.parentCategories),
        educationLevel: null,
        yearsExperienceMin: deriveYearsFromLevel(experienceLevel, 'min'),
        yearsExperienceMax: deriveYearsFromLevel(experienceLevel, 'max'),
        url: job.applicationLink,
        applyUrl: job.applicationLink,
        postedDate: job.pubDate ? new Date(job.pubDate) : new Date(),
        expiresAt: job.expiryDate ? new Date(job.expiryDate) : null,
        isActive: true,
        rawData: job,
        meta: {
            sourceUrl: job.applicationLink,
            sourceAttribution: 'Himalayas',
            categories: job.categories || [],
            parentCategories: job.parentCategories || [],
            seniority: job.seniority || []
        }
    };
}

/**
 * Normalize employment type
 */
function normalizeEmploymentType(type) {
    if (!type) return 'full-time';
    const normalized = type.toLowerCase();
    if (normalized.includes('part')) return 'part-time';
    if (normalized.includes('contract')) return 'contract';
    if (normalized.includes('intern')) return 'internship';
    if (normalized.includes('temporary')) return 'temporary';
    return 'full-time';
}

/**
 * Map Himalayas seniority to our experience level
 */
function mapSeniorityToLevel(seniority) {
    if (!seniority) return 'mid';
    const normalized = seniority.toLowerCase();
    if (normalized.includes('entry') || normalized.includes('junior')) return 'entry';
    if (normalized.includes('mid') || normalized.includes('intermediate')) return 'mid';
    if (normalized.includes('senior')) return 'senior';
    if (normalized.includes('lead') || normalized.includes('principal') || normalized.includes('staff')) return 'lead';
    return 'mid';
}

/**
 * Determine experience level from title/description
 */
function determineExperienceLevel(title = '', description = '') {
    const text = `${title} ${description}`.toLowerCase();
    if (/(intern|junior|jr\.|entry)/.test(text)) return 'entry';
    if (/(lead|principal|staff|manager|head)/.test(text)) return 'lead';
    if (/(senior|sr\.|expert)/.test(text)) return 'senior';
    return 'mid';
}

/**
 * Derive years of experience from level
 */
function deriveYearsFromLevel(level, bound) {
    const ranges = {
        entry: { min: 0, max: 2 },
        mid: { min: 2, max: 5 },
        senior: { min: 5, max: 8 },
        lead: { min: 8, max: 12 }
    };
    const range = ranges[level] || ranges.mid;
    return bound === 'min' ? range.min : range.max;
}

/**
 * Build location string from restrictions
 */
function buildLocation(locationRestrictions, timezoneRestrictions) {
    const locations = Array.isArray(locationRestrictions) ? locationRestrictions : [];
    const timezones = Array.isArray(timezoneRestrictions) ? timezoneRestrictions : [];

    if (locations.length > 0) return locations.join(', ');
    if (timezones.length > 0) return `UTC ${timezones.join(', ')}`;
    return null;
}

/**
 * Build skills object from categories
 */
function buildSkills(categories, parentCategories) {
    const skills = new Set();
    (categories || []).forEach((c) => skills.add(c));
    (parentCategories || []).forEach((c) => skills.add(c));

    if (skills.size === 0) return null;

    return {
        required: [],
        preferred: [],
        technical: Array.from(skills),
        soft: []
    };
}

export default {
    scrapeHimalayas
};
