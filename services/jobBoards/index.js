/**
 * Job Boards Aggregation Service
 * 
 * Central module for scraping jobs from multiple sources.
 * 
 * Supported sources:
 * - RemoteOK: Free JSON API, remote jobs
 * - Indeed: RSS feeds, general jobs (limited data)
 * - Adzuna: API with free tier (5000 calls/month) - TODO
 * - StackOverflow: Jobs RSS - TODO
 * - AngelList/Wellfound: Startup jobs - TODO
 */

import remoteokService from './remoteok.service.js';
import indeedService from './indeed.service.js';
import logger from '../../middleware/logger.js';

/**
 * Scrape jobs from a specific source
 * 
 * @param {string} source - Source name ('remoteok', 'indeed', etc.)
 * @param {Object} options - Source-specific options
 * @returns {Promise<Object>} - { jobs: Array, stats: Object, source: string }
 */
export async function scrapeJobsFromSource(source, options = {}) {
    logger.info('Scraping jobs from source', { source, options });
    
    try {
        let result;
        
        switch (source.toLowerCase()) {
            case 'remoteok':
                result = await remoteokService.scrapeRemoteOK(options);
                break;
                
            case 'indeed':
                result = await indeedService.scrapeIndeed(options);
                break;
                
            default:
                throw new Error(`Unsupported job source: ${source}`);
        }
        
        return {
            ...result,
            source
        };
        
    } catch (error) {
        logger.error('Job scraping failed', {
            source,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Scrape jobs from multiple sources in parallel
 * 
 * @param {Array<Object>} sources - Array of { source: string, options: Object }
 * @returns {Promise<Object>} - { results: Array, totalJobs: number, errors: Array }
 */
export async function scrapeJobsFromMultipleSources(sources) {
    logger.info('Scraping jobs from multiple sources', { 
        sources: sources.map(s => s.source) 
    });
    
    const results = [];
    const errors = [];
    
    // Scrape sources in parallel
    const promises = sources.map(async ({ source, options }) => {
        try {
            const result = await scrapeJobsFromSource(source, options);
            results.push(result);
        } catch (error) {
            errors.push({
                source,
                error: error.message
            });
        }
    });
    
    await Promise.allSettled(promises);
    
    const totalJobs = results.reduce((sum, r) => sum + r.jobs.length, 0);
    
    logger.info('Multi-source scraping completed', {
        totalSources: sources.length,
        successfulSources: results.length,
        failedSources: errors.length,
        totalJobs
    });
    
    return {
        results,
        totalJobs,
        errors,
        timestamp: new Date()
    };
}

/**
 * Scrape all available sources with default options
 * 
 * @param {Object} globalOptions - Options applied to all sources
 * @returns {Promise<Object>} - Aggregated results
 */
export async function scrapeAllSources(globalOptions = {}) {
    const sources = [
        {
            source: 'remoteok',
            options: {
                limit: globalOptions.limit || 100,
                tags: globalOptions.tags || []
            }
        },
        {
            source: 'indeed',
            options: {
                query: globalOptions.query || 'software engineer',
                location: globalOptions.location || 'United States',
                limit: globalOptions.limit || 50
            }
        }
    ];
    
    return await scrapeJobsFromMultipleSources(sources);
}

/**
 * Get list of supported job sources
 */
export function getSupportedSources() {
    return [
        {
            name: 'remoteok',
            displayName: 'RemoteOK',
            type: 'api',
            description: 'Remote jobs from RemoteOK',
            features: ['free', 'no-auth', 'remote-only'],
            limits: 'Rate limit recommended'
        },
        {
            name: 'indeed',
            displayName: 'Indeed',
            type: 'rss',
            description: 'General jobs from Indeed RSS feeds',
            features: ['free', 'no-auth', 'limited-data'],
            limits: 'RSS feeds only, basic data'
        }
    ];
}

// Export individual scrapers for direct use
export { remoteokService, indeedService };

export default {
    scrapeJobsFromSource,
    scrapeJobsFromMultipleSources,
    scrapeAllSources,
    getSupportedSources,
    remoteokService,
    indeedService
};
