import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import logger from '../../middleware/logger.js';

/**
 * Remotive RSS Job Feed
 * 
 * RSS docs: https://remotive.com/remote-jobs/rss-feed
 * Full feed: https://remotive.com/remote-jobs/feed
 * Category feed: https://remotive.com/remote-jobs/feed/{category}
 * 
 * Notes:
 * - Jobs are delayed by ~24 hours
 * - Attribution required; do not redistribute to restricted job aggregators
 */

const REMOTIVE_RSS_BASE = 'https://remotive.com/remote-jobs/feed';
const SOURCE_NAME = 'remotive';

export async function scrapeRemotive(options = {}) {
    const { category, limit = 100 } = options;

    logger.info('Starting Remotive RSS scraping', { category, limit });

    try {
        const feedUrl = category
            ? `${REMOTIVE_RSS_BASE}/${encodeURIComponent(category)}`
            : REMOTIVE_RSS_BASE;

        const response = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'SuccessCV-JobScraper/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000
        });

        if (!response.data) {
            throw new Error('Empty response from Remotive RSS');
        }

        const parsedFeed = await parseStringPromise(response.data, {
            explicitArray: false,
            trim: true
        });

        const items = normalizeItems(parsedFeed);

        logger.info('Fetched jobs from Remotive RSS', {
            totalJobs: items.length,
            category
        });

        const processedJobs = items
            .filter(isValidItem)
            .slice(0, limit)
            .map((item) => normalizeJob(item, category));

        return {
            jobs: processedJobs,
            stats: {
                totalFetched: items.length,
                filtered: processedJobs.length,
                skipped: items.length - processedJobs.length
            }
        };
    } catch (error) {
        logger.error('Remotive RSS scraping failed', {
            error: error.message,
            stack: error.stack,
            category
        });
        throw error;
    }
}

function normalizeItems(parsedFeed) {
    const channel = parsedFeed?.rss?.channel;
    if (!channel?.item) return [];

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    return items;
}

function isValidItem(item) {
    return !!(item?.title && item?.link);
}

function normalizeJob(item, category) {
    const title = stripCdata(item.title);
    const description = stripCdata(item.description || item['content:encoded'] || '');
    const company = extractCompanyFromTitle(title) || 'Unknown Company';
    const jobTitle = extractTitleFromTitle(title) || title;
    const externalId = item.guid?._ || item.guid || item.link;

    const experienceLevel = determineExperienceLevel(jobTitle, description);

    return {
        externalId,
        source: SOURCE_NAME,
        title: jobTitle,
        company,
        companyLogo: null,
        location: 'Remote',
        remoteType: 'remote',
        employmentType: determineEmploymentType(title, description),
        experienceLevel,
        salaryMin: null,
        salaryMax: null,
        currency: 'USD',
        salaryPeriod: null,
        description: description || 'No description provided',
        requirements: null,
        responsibilities: null,
        benefits: null,
        skillsRequired: buildSkillsFromCategory(category),
        educationLevel: null,
        yearsExperienceMin: deriveYearsFromLevel(experienceLevel, 'min'),
        yearsExperienceMax: deriveYearsFromLevel(experienceLevel, 'max'),
        url: item.link,
        applyUrl: item.link,
        postedDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        expiresAt: null,
        isActive: true,
        rawData: item,
        meta: {
            sourceUrl: item.link,
            sourceAttribution: 'Remotive',
            category
        }
    };
}

function stripCdata(value) {
    if (!value) return '';
    return typeof value === 'string' ? value : value?._ || '';
}

function extractCompanyFromTitle(title) {
    if (!title) return null;
    const parts = title.split(' - ');
    return parts.length > 1 ? parts.pop().trim() : null;
}

function extractTitleFromTitle(title) {
    if (!title) return null;
    const parts = title.split(' - ');
    if (parts.length > 1) parts.pop(); // Remove company (last part)
    return parts.join(' - ').trim();
}

function determineEmploymentType(title = '', description = '') {
    const text = `${title} ${description}`.toLowerCase();
    if (text.includes('contract')) return 'contract';
    if (text.includes('part-time') || text.includes('part time')) return 'part-time';
    if (text.includes('intern')) return 'internship';
    if (text.includes('temporary')) return 'temporary';
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

function buildSkillsFromCategory(category) {
    if (!category) return { required: [], preferred: [], technical: [], soft: [] };
    return {
        required: [],
        preferred: [],
        technical: [category],
        soft: []
    };
}

export default {
    scrapeRemotive
};
