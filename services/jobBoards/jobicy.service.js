import axios from 'axios';
import logger from '../../middleware/logger.js';

/**
 * Jobicy Remote Jobs API
 * 
 * Docs: https://jobicy.com/jobs-rss-feed
 * Endpoint: https://jobicy.com/api/v2/remote-jobs
 */

const JOBICY_API_URL = 'https://jobicy.com/api/v2/remote-jobs';
const SOURCE_NAME = 'jobicy';

export async function scrapeJobicy(options = {}) {
    const { count = 100, geo, industry, tag } = options;

    logger.info('Starting Jobicy API scraping', { count, geo, industry, tag });

    try {
        const response = await axios.get(JOBICY_API_URL, {
            params: {
                count: Math.min(count, 100),
                ...(geo && { geo }),
                ...(industry && { industry }),
                ...(tag && { tag })
            },
            headers: {
                'User-Agent': 'SuccessCV-JobScraper/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000
        });

        if (!response.data || !Array.isArray(response.data.jobs)) {
            throw new Error('Invalid response format from Jobicy API');
        }

        const rawJobs = response.data.jobs;

        logger.info('Fetched jobs from Jobicy API', {
            totalJobs: rawJobs.length
        });

        const processedJobs = rawJobs
            .filter(isValidJob)
            .map(normalizeJob);

        return {
            jobs: processedJobs,
            stats: {
                totalFetched: rawJobs.length,
                filtered: processedJobs.length,
                skipped: rawJobs.length - processedJobs.length
            }
        };
    } catch (error) {
        logger.error('Jobicy API scraping failed', {
            error: error.message,
            stack: error.stack,
            count,
            geo,
            industry,
            tag
        });
        throw error;
    }
}

function isValidJob(job) {
    return !!(job?.id && job?.jobTitle && job?.companyName && job?.url);
}

function normalizeJob(job) {
    const experienceLevel = determineExperienceLevel(job.jobTitle, job.jobDescription);

    return {
        externalId: String(job.id),
        source: SOURCE_NAME,
        title: job.jobTitle,
        company: job.companyName,
        companyLogo: job.companyLogo || null,
        location: job.jobGeo || 'Remote',
        remoteType: 'remote',
        employmentType: normalizeEmploymentType(job.jobType),
        experienceLevel,
        salaryMin: job.salaryMin ?? job.annualSalaryMin ?? null,
        salaryMax: job.salaryMax ?? job.annualSalaryMax ?? null,
        currency: job.salaryCurrency || 'USD',
        salaryPeriod: job.salaryPeriod || 'yearly',
        description: job.jobDescription || job.jobExcerpt || 'No description provided',
        requirements: null,
        responsibilities: null,
        benefits: null,
        skillsRequired: buildSkills(job.jobIndustry),
        educationLevel: null,
        yearsExperienceMin: deriveYearsFromLevel(experienceLevel, 'min'),
        yearsExperienceMax: deriveYearsFromLevel(experienceLevel, 'max'),
        url: job.url,
        applyUrl: job.url,
        postedDate: job.pubDate ? new Date(job.pubDate) : new Date(),
        expiresAt: null,
        isActive: true,
        rawData: job,
        meta: {
            sourceUrl: job.url,
            sourceAttribution: 'Jobicy',
            industry: job.jobIndustry,
            geo: job.jobGeo
        }
    };
}

function normalizeEmploymentType(type) {
    if (!type) return 'full-time';
    // Handle array (Jobicy returns jobType as array like ["Full-Time"])
    const typeStr = Array.isArray(type) ? (type[0] || '') : type;
    const normalized = typeStr.toLowerCase();
    if (normalized.includes('part')) return 'part-time';
    if (normalized.includes('contract')) return 'contract';
    if (normalized.includes('intern')) return 'internship';
    if (normalized.includes('temporary')) return 'temporary';
    return 'full-time';
}

function determineExperienceLevel(title = '', description = '') {
    const text = `${title} ${description}`.toLowerCase();
    if (/(intern|junior|jr\.|entry)/.test(text)) return 'entry';
    if (/(lead|principal|staff|manager|head)/.test(text)) return 'lead';
    if (/(senior|sr\.|expert)/.test(text)) return 'senior';
    return 'mid';
}

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

function buildSkills(industry) {
    if (!industry) return { required: [], preferred: [], technical: [], soft: [] };
    // industry can be a string or an array — flatten to avoid nested arrays
    const industries = Array.isArray(industry) ? industry : [industry];
    return {
        required: [],
        preferred: [],
        technical: industries,
        soft: []
    };
}

export default {
    scrapeJobicy
};
