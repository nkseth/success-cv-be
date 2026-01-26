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
import remotiveService from './remotive.service.js';
import weworkremotelyService from './weworkremotely.service.js';
import himalayasService from './himalayas.service.js';
import jobicyService from './jobicy.service.js';
import cacheService from './cache.service.js';
import circuitBreakerService from './circuit-breaker.service.js';
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
        // Check cache first (unless skipCache option is true)
        if (!options.skipCache) {
            const cached = await cacheService.getCachedJobs(source, options);
            if (cached) {
                logger.info('Using cached jobs', { source, jobCount: cached.jobs?.length || 0 });
                return {
                    ...cached,
                    source,
                    fromCache: true
                };
            }
        }

        let result;
        
        switch (source.toLowerCase()) {
            case 'remoteok':
                result = await circuitBreakerService.withCircuitBreaker(
                    'remoteok',
                    remoteokService.scrapeRemoteOK,
                    options
                );
                break;

            case 'remotive':
                result = await circuitBreakerService.withCircuitBreaker(
                    'remotive',
                    remotiveService.scrapeRemotive,
                    options
                );
                break;

            case 'weworkremotely':
                result = await circuitBreakerService.withCircuitBreaker(
                    'weworkremotely',
                    weworkremotelyService.scrapeWeWorkRemotely,
                    options
                );
                break;

            case 'himalayas':
                result = await circuitBreakerService.withCircuitBreaker(
                    'himalayas',
                    himalayasService.scrapeHimalayas,
                    options
                );
                break;

            case 'jobicy':
                result = await circuitBreakerService.withCircuitBreaker(
                    'jobicy',
                    jobicyService.scrapeJobicy,
                    options
                );
                break;
                
            case 'indeed':
                result = await circuitBreakerService.withCircuitBreaker(
                    'indeed',
                    indeedService.scrapeIndeed,
                    options
                );
                break;
                
            default:
                throw new Error(`Unsupported job source: ${source}`);
        }

        // Cache the fresh result
        await cacheService.setCachedJobs(source, options, result);
        
        return {
            ...result,
            source,
            fromCache: false
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
            source: 'remotive',
            options: {
                category: globalOptions.remotiveCategory,
                limit: globalOptions.limit || 100
            }
        },
        {
            source: 'weworkremotely',
            options: {
                category: globalOptions.wwrCategory,
                limit: globalOptions.limit || 100
            }
        },
        {
            source: 'himalayas',
            options: {
                limit: Math.min(globalOptions.limit || 20, 20),
                offset: globalOptions.offset || 0
            }
        },
        {
            source: 'jobicy',
            options: {
                count: Math.min(globalOptions.limit || 100, 100),
                geo: globalOptions.geo,
                industry: globalOptions.industry,
                tag: globalOptions.tag
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
            name: 'remotive',
            displayName: 'Remotive',
            type: 'rss',
            description: 'Remote jobs from Remotive RSS feed',
            features: ['free', 'no-auth', 'remote-only'],
            limits: '24-hour delay, attribution required'
        },
        {
            name: 'weworkremotely',
            displayName: 'We Work Remotely',
            type: 'rss',
            description: 'Remote jobs from We Work Remotely RSS feed',
            features: ['free', 'no-auth', 'remote-only'],
            limits: 'Attribution required'
        },
        {
            name: 'himalayas',
            displayName: 'Himalayas',
            type: 'api',
            description: 'Remote jobs from Himalayas public API',
            features: ['free', 'no-auth', 'remote-only'],
            limits: 'Max 20 per request, rate limited'
        },
        {
            name: 'jobicy',
            displayName: 'Jobicy',
            type: 'api',
            description: 'Remote jobs from Jobicy public API',
            features: ['free', 'no-auth', 'remote-only'],
            limits: '6-hour delay, rate limiting recommended'
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
export { remoteokService, indeedService, remotiveService, weworkremotelyService, himalayasService, jobicyService };

export default {
    scrapeJobsFromSource,
    scrapeJobsFromMultipleSources,
    scrapeAllSources,
    getSupportedSources,
    remoteokService,
    indeedService,
    remotiveService,
    weworkremotelyService,
    himalayasService,
    jobicyService
};
