import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import logger from '../../middleware/logger.js';

/**
 * We Work Remotely RSS Feed
 * 
 * RSS docs: https://weworkremotely.com/remote-job-rss-feed
 * Full feed: https://weworkremotely.com/remote-jobs.rss
 * Category feeds listed on docs page.
 */

const WWR_RSS_BASE = 'https://weworkremotely.com/remote-jobs.rss';
const SOURCE_NAME = 'weworkremotely';

const CATEGORY_FEEDS = {
    customerSupport: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
    product: 'https://weworkremotely.com/categories/remote-product-jobs.rss',
    fullStack: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
    backend: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
    frontend: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
    programming: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    salesMarketing: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
    managementFinance: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss',
    design: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
    devops: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
    allOther: 'https://weworkremotely.com/categories/all-other-remote-jobs.rss'
};

export async function scrapeWeWorkRemotely(options = {}) {
    const { category, limit = 100 } = options;
    const feedUrl = category && CATEGORY_FEEDS[category] ? CATEGORY_FEEDS[category] : WWR_RSS_BASE;

    logger.info('Starting We Work Remotely RSS scraping', { category, limit });

    try {
        const response = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'SuccessCV-JobScraper/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000
        });

        if (!response.data) {
            throw new Error('Empty response from We Work Remotely RSS');
        }

        const parsedFeed = await parseStringPromise(response.data, {
            explicitArray: false,
            trim: true
        });

        const items = normalizeItems(parsedFeed);

        logger.info('Fetched jobs from We Work Remotely RSS', {
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
        logger.error('We Work Remotely RSS scraping failed', {
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
    return Array.isArray(channel.item) ? channel.item : [channel.item];
}

function isValidItem(item) {
    return !!(item?.title && item?.link);
}

function normalizeJob(item, category) {
    const title = stripCdata(item.title);
    const description = stripCdata(item.description || item['content:encoded'] || '');
    const { jobTitle, company } = extractTitleCompany(title);
    const experienceLevel = determineExperienceLevel(jobTitle, description);

    return {
        externalId: item.guid?._ || item.guid || item.link,
        source: SOURCE_NAME,
        title: jobTitle,
        company: company || 'Unknown Company',
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
            sourceAttribution: 'We Work Remotely',
            category
        }
    };
}

function stripCdata(value) {
    if (!value) return '';
    return typeof value === 'string' ? value : value?._ || '';
}

function extractTitleCompany(title) {
    if (!title) return { jobTitle: '', company: '' };
    const parts = title.split(' - ');
    return {
        jobTitle: parts[0]?.trim() || title,
        company: parts[1]?.trim() || ''
    };
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
    if (!category) return null;
    return {
        required: [],
        preferred: [],
        technical: [category],
        soft: []
    };
}

export default {
    scrapeWeWorkRemotely
};
