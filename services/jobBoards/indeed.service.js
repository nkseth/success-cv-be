import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import logger from '../../middleware/logger.js';

/**
 * Indeed RSS Job Feed Scraper
 * 
 * Indeed provides RSS feeds for job searches.
 * No authentication required, but limited data compared to API.
 * 
 * RSS Format: https://www.indeed.com/rss?q={query}&l={location}
 * 
 * Limitations:
 * - Basic job info only (title, company, location, description)
 * - No salary information
 * - No structured skills data
 * - Rate limits apply
 * 
 * @see https://www.indeed.com/rss
 */

const INDEED_RSS_BASE = 'https://www.indeed.com/rss';
const SOURCE_NAME = 'indeed';

/**
 * Scrape jobs from Indeed RSS feed
 * 
 * @param {Object} options - Scraping options
 * @param {string} options.query - Job search query (e.g., 'software engineer')
 * @param {string} options.location - Location (e.g., 'San Francisco, CA' or 'Remote')
 * @param {number} options.limit - Max number of jobs to return (default: 50)
 * @returns {Promise<Object>} - { jobs: Array, stats: Object }
 */
export async function scrapeIndeed(options = {}) {
    const { 
        query = 'software engineer', 
        location = 'United States', 
        limit = 50 
    } = options;
    
    logger.info('Starting Indeed RSS scraping', { query, location, limit });
    
    try {
        // Build RSS feed URL
        const feedUrl = buildRSSUrl(query, location);
        
        // Fetch RSS feed
        const response = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'SuccessCV-JobMatcher/1.0 (jobscraper@successcv.com)'
            },
            timeout: 30000
        });
        
        if (!response.data) {
            throw new Error('Empty response from Indeed RSS');
        }
        
        // Parse XML
        const parsedFeed = await parseStringPromise(response.data, {
            explicitArray: false,
            trim: true
        });
        
        if (!parsedFeed || !parsedFeed.rss || !parsedFeed.rss.channel || !parsedFeed.rss.channel.item) {
            throw new Error('Invalid RSS format from Indeed');
        }
        
        // Extract items
        let items = parsedFeed.rss.channel.item;
        
        // Ensure items is an array (xml2js returns object for single item)
        if (!Array.isArray(items)) {
            items = [items];
        }
        
        logger.info('Fetched jobs from Indeed RSS', { 
            totalJobs: items.length,
            source: SOURCE_NAME,
            query,
            location
        });
        
        // Process and normalize jobs
        const processedJobs = items
            .filter(item => isValidJob(item))
            .slice(0, limit)
            .map(item => normalizeJob(item, query, location));
        
        const stats = {
            totalFetched: items.length,
            filtered: processedJobs.length,
            skipped: items.length - processedJobs.length,
            query,
            location
        };
        
        logger.info('Indeed RSS scraping completed', stats);
        
        return {
            jobs: processedJobs,
            stats
        };
        
    } catch (error) {
        logger.error('Indeed RSS scraping failed', {
            error: error.message,
            stack: error.stack,
            query,
            location
        });
        throw error;
    }
}

/**
 * Build Indeed RSS feed URL
 */
function buildRSSUrl(query, location) {
    const params = new URLSearchParams({
        q: query,
        l: location,
        sort: 'date' // Sort by most recent
    });
    
    return `${INDEED_RSS_BASE}?${params.toString()}`;
}

/**
 * Validate if RSS item has required fields
 */
function isValidJob(item) {
    return (
        item &&
        item.title &&
        item.link &&
        item.description
    );
}

/**
 * Normalize Indeed RSS item to our schema format
 */
function normalizeJob(item, searchQuery, searchLocation) {
    // Extract job details from title (format: "Job Title - Company")
    const titleParts = item.title.split(' - ');
    const jobTitle = titleParts[0] || item.title;
    const company = titleParts[1] || 'Unknown Company';
    
    // Extract location from description (Indeed includes it in description)
    const location = extractLocation(item.description) || searchLocation;
    
    // Parse description to extract more details
    const description = stripHTML(item.description);
    
    // Extract skills from description (basic keyword matching)
    const skillsRequired = extractSkillsFromText(description);
    
    // Determine remote type
    const remoteType = determineRemoteType(jobTitle, description, location);
    
    // Determine experience level
    const experienceLevel = determineExperienceLevel(jobTitle, description);
    
    // Generate external ID from link (Indeed job ID is in URL)
    const externalId = extractJobIdFromUrl(item.link) || item.guid || item.link;
    
    return {
        externalId,
        source: SOURCE_NAME,
        title: jobTitle,
        company,
        companyLogo: null, // RSS doesn't provide logo
        location,
        remoteType,
        employmentType: determineEmploymentType(jobTitle, description),
        experienceLevel,
        
        // Compensation (not available in RSS)
        salaryMin: null,
        salaryMax: null,
        currency: 'USD',
        salaryPeriod: null,
        
        // Content
        description,
        requirements: null,
        responsibilities: null,
        benefits: null,
        
        // Skills
        skillsRequired,
        
        // Education & experience
        educationLevel: extractEducationLevel(description),
        yearsExperienceMin: deriveYearsFromLevel(experienceLevel, 'min'),
        yearsExperienceMax: deriveYearsFromLevel(experienceLevel, 'max'),
        
        // Links
        url: item.link,
        applyUrl: item.link,
        
        // Dates
        postedDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        expiresAt: null,
        
        // Status
        isActive: true,
        
        // Raw data for debugging
        rawData: item,
        
        // Metadata
        meta: {
            guid: item.guid,
            searchQuery,
            searchLocation,
            sourceFeed: 'rss'
        }
    };
}

/**
 * Extract job ID from Indeed URL
 * Format: https://www.indeed.com/viewjob?jk=JOBID
 */
function extractJobIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('jk');
    } catch {
        return null;
    }
}

/**
 * Strip HTML tags from text
 */
function stripHTML(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Extract location from description (Indeed often includes it)
 */
function extractLocation(description) {
    // Look for common location patterns
    const locationPattern = /(?:Location:|Based in:)\s*([^<\n]+)/i;
    const match = description.match(locationPattern);
    return match ? match[1].trim() : null;
}

/**
 * Extract skills from text using keyword matching
 */
function extractSkillsFromText(text) {
    const techSkills = [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'golang', 'rust', 'swift', 'kotlin',
        'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'asp.net',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'ci/cd',
        'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
        'machine learning', 'ai', 'data science', 'deep learning', 'tensorflow', 'pytorch'
    ];
    
    const softSkills = [
        'communication', 'leadership', 'teamwork', 'problem-solving', 'analytical', 'creative',
        'project management', 'agile', 'scrum', 'collaboration'
    ];
    
    const textLower = text.toLowerCase();
    
    const foundTech = techSkills.filter(skill => textLower.includes(skill));
    const foundSoft = softSkills.filter(skill => textLower.includes(skill));
    
    return {
        required: [...foundTech, ...foundSoft],
        preferred: [],
        technical: foundTech,
        soft: foundSoft
    };
}

/**
 * Determine remote type from job data
 */
function determineRemoteType(title, description, location) {
    const textLower = (title + ' ' + description + ' ' + location).toLowerCase();
    
    if (textLower.includes('remote') || textLower.includes('work from home')) {
        if (textLower.includes('hybrid')) return 'hybrid';
        return 'remote';
    }
    
    if (textLower.includes('on-site') || textLower.includes('onsite') || textLower.includes('in-office')) {
        return 'onsite';
    }
    
    return null;
}

/**
 * Determine experience level
 */
function determineExperienceLevel(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('staff')) {
        return 'senior';
    }
    if (text.includes('junior') || text.includes('entry') || text.includes('intern')) {
        return 'entry';
    }
    if (text.includes('mid') || text.includes('intermediate')) {
        return 'mid';
    }
    
    return 'mid';
}

/**
 * Determine employment type
 */
function determineEmploymentType(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('contract') || text.includes('freelance') || text.includes('consultant')) {
        return 'contract';
    }
    if (text.includes('part-time') || text.includes('part time')) {
        return 'part-time';
    }
    if (text.includes('intern')) {
        return 'internship';
    }
    
    return 'full-time';
}

/**
 * Extract education level from description
 */
function extractEducationLevel(description) {
    const textLower = description.toLowerCase();
    
    if (textLower.includes('phd') || textLower.includes('doctorate')) {
        return 'PhD';
    }
    if (textLower.includes('master') || textLower.includes('msc') || textLower.includes('mba')) {
        return 'Master';
    }
    if (textLower.includes('bachelor') || textLower.includes('bsc') || textLower.includes('ba ')) {
        return 'Bachelor';
    }
    if (textLower.includes('associate') || textLower.includes('diploma')) {
        return 'Associate';
    }
    
    return null;
}

/**
 * Derive years from experience level
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
export async function testIndeedScraper() {
    console.log('Testing Indeed RSS scraper...\n');
    
    try {
        const result = await scrapeIndeed({ 
            query: 'software engineer',
            location: 'Remote',
            limit: 5 
        });
        
        console.log('✅ Scraping successful!');
        console.log(`\nStats:`, result.stats);
        console.log(`\nSample jobs (first 2):\n`);
        
        result.jobs.slice(0, 2).forEach((job, index) => {
            console.log(`${index + 1}. ${job.title} at ${job.company}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Remote: ${job.remoteType}`);
            console.log(`   URL: ${job.url}`);
            console.log(`   Skills: ${job.skillsRequired.required.slice(0, 5).join(', ')}`);
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
    scrapeIndeed,
    testIndeedScraper,
    SOURCE_NAME
};
