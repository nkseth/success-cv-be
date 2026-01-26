import axios from 'axios';
import logger from '../../middleware/logger.js';

/**
 * RemoteOK Job Board Scraper
 * 
 * RemoteOK provides a free JSON API with remote job listings.
 * No authentication required.
 * 
 * API: https://remoteok.com/api
 * Rate Limit: Be respectful, cache responses
 * 
 * @see https://remoteok.com/remote-jobs/api
 */

const REMOTEOK_API_URL = 'https://remoteok.com/api';
const SOURCE_NAME = 'remoteok';

/**
 * Scrape jobs from RemoteOK API
 * 
 * @param {Object} options - Scraping options
 * @param {number} options.limit - Max number of jobs to return (default: 100)
 * @param {string[]} options.tags - Filter by tags (e.g., ['javascript', 'react'])
 * @returns {Promise<Object>} - { jobs: Array, stats: Object }
 */
export async function scrapeRemoteOK(options = {}) {
    const { limit = 100, tags = [] } = options;
    
    logger.info('Starting RemoteOK scraping', { limit, tags });
    
    try {
        // Fetch jobs from RemoteOK API
        const response = await axios.get(REMOTEOK_API_URL, {
            headers: {
                'User-Agent': 'SuccessCV-JobMatcher/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000 // 30 seconds
        });
        
        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('Invalid response format from RemoteOK API');
        }
        
        // RemoteOK API returns an array where first element is metadata
        // Skip the first element and process the rest
        const rawJobs = response.data.slice(1);
        
        logger.info('Fetched jobs from RemoteOK', { 
            totalJobs: rawJobs.length,
            source: SOURCE_NAME 
        });
        
        // Process and normalize jobs
        const processedJobs = rawJobs
            .filter(job => isValidJob(job))
            .filter(job => {
                // Filter by tags if specified
                if (tags.length === 0) return true;
                if (!job.tags || !Array.isArray(job.tags)) return false;
                return tags.some(tag => job.tags.includes(tag));
            })
            .slice(0, limit)
            .map(job => normalizeJob(job));
        
        const stats = {
            totalFetched: rawJobs.length,
            filtered: processedJobs.length,
            skipped: rawJobs.length - processedJobs.length
        };
        
        logger.info('RemoteOK scraping completed', stats);
        
        return {
            jobs: processedJobs,
            stats
        };
        
    } catch (error) {
        logger.error('RemoteOK scraping failed', {
            error: error.message,
            stack: error.stack,
            url: REMOTEOK_API_URL
        });
        throw error;
    }
}

/**
 * Validate if job object has required fields
 */
function isValidJob(job) {
    return (
        job &&
        job.id &&
        job.position &&
        job.company &&
        job.url &&
        job.date
    );
}

/**
 * Normalize RemoteOK job to our schema format
 */
function normalizeJob(job) {
    // Extract salary information
    const salaryMin = job.salary_min || null;
    const salaryMax = job.salary_max || null;
    
    // Build description from multiple fields
    const descriptionParts = [];
    if (job.description) descriptionParts.push(job.description);
    if (job.requirements) descriptionParts.push(`\n\n**Requirements:**\n${job.requirements}`);
    if (job.benefits) descriptionParts.push(`\n\n**Benefits:**\n${job.benefits}`);
    
    const description = descriptionParts.join('') || 'No description provided';
    
    // Extract skills from tags
    const skillsRequired = {
        required: job.tags || [],
        preferred: [],
        technical: job.tags ? job.tags.filter(tag => 
            ['javascript', 'python', 'java', 'typescript', 'react', 'node', 'golang', 'rust', 'ruby'].includes(tag.toLowerCase())
        ) : [],
        soft: []
    };
    
    // Determine experience level from tags or title
    const experienceLevel = determineExperienceLevel(job);
    
    return {
        externalId: String(job.id),
        source: SOURCE_NAME,
        title: job.position,
        company: job.company,
        companyLogo: job.company_logo || null,
        location: job.location || 'Remote',
        remoteType: 'remote', // RemoteOK is all remote jobs
        employmentType: determineEmploymentType(job),
        experienceLevel,
        
        // Compensation
        salaryMin,
        salaryMax,
        currency: 'USD', // RemoteOK defaults to USD
        salaryPeriod: 'yearly',
        
        // Content
        description,
        requirements: job.requirements || null,
        responsibilities: null,
        benefits: job.benefits || null,
        
        // Skills
        skillsRequired,
        
        // Education & experience
        educationLevel: null,
        yearsExperienceMin: deriveYearsFromLevel(experienceLevel, 'min'),
        yearsExperienceMax: deriveYearsFromLevel(experienceLevel, 'max'),
        
        // Links
        url: job.url,
        applyUrl: job.apply_url || job.url,
        
        // Dates
        postedDate: new Date(job.date * 1000), // RemoteOK uses Unix timestamp
        expiresAt: null,
        
        // Status
        isActive: true,
        
        // Raw data for debugging
        rawData: job,
        
        // Metadata
        meta: {
            epoch: job.epoch,
            logoUrl: job.logo,
            tags: job.tags,
            locations: job.location ? [job.location] : []
        }
    };
}

/**
 * Determine experience level from job data
 */
function determineExperienceLevel(job) {
    const title = (job.position || '').toLowerCase();
    const tags = (job.tags || []).map(t => t.toLowerCase());
    
    // Check title for level indicators
    if (title.includes('senior') || title.includes('lead') || title.includes('principal') || title.includes('staff')) {
        return 'senior';
    }
    if (title.includes('junior') || title.includes('entry') || title.includes('intern')) {
        return 'entry';
    }
    if (title.includes('mid') || title.includes('intermediate')) {
        return 'mid';
    }
    
    // Check tags
    if (tags.includes('senior')) return 'senior';
    if (tags.includes('junior')) return 'entry';
    if (tags.includes('mid-level') || tags.includes('intermediate')) return 'mid';
    
    // Default to mid if no indicators
    return 'mid';
}

/**
 * Determine employment type from job data
 */
function determineEmploymentType(job) {
    const title = (job.position || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const tags = (job.tags || []).map(t => t.toLowerCase());
    
    // Check for contract/freelance
    if (
        title.includes('contract') || 
        title.includes('freelance') || 
        tags.includes('contract') || 
        tags.includes('freelance')
    ) {
        return 'contract';
    }
    
    // Check for part-time
    if (
        title.includes('part-time') || 
        title.includes('part time') || 
        description.includes('part-time') ||
        tags.includes('part-time')
    ) {
        return 'part-time';
    }
    
    // Check for internship
    if (
        title.includes('intern') || 
        tags.includes('internship')
    ) {
        return 'internship';
    }
    
    // Default to full-time
    return 'full-time';
}

/**
 * Derive minimum/maximum years of experience from level
 */
function deriveYearsFromLevel(level, type) {
    const ranges = {
        'entry': { min: 0, max: 2 },
        'mid': { min: 2, max: 5 },
        'senior': { min: 5, max: 15 },
        'lead': { min: 8, max: 20 }
    };
    
    const range = ranges[level] || ranges['mid'];
    return range[type];
}

/**
 * Test the scraper (for development/debugging)
 */
export async function testRemoteOKScraper() {
    console.log('Testing RemoteOK scraper...\n');
    
    try {
        const result = await scrapeRemoteOK({ limit: 5 });
        
        console.log('✅ Scraping successful!');
        console.log(`\nStats:`, result.stats);
        console.log(`\nSample jobs (first 2):\n`);
        
        result.jobs.slice(0, 2).forEach((job, index) => {
            console.log(`${index + 1}. ${job.title} at ${job.company}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   URL: ${job.url}`);
            console.log(`   Skills: ${job.skillsRequired.required.join(', ')}`);
            console.log();
        });
        
        return result;
    } catch (error) {
        console.error('❌ Scraping failed:', error.message);
        throw error;
    }
}

// Export for use in other modules
export default {
    scrapeRemoteOK,
    testRemoteOKScraper,
    SOURCE_NAME
};
