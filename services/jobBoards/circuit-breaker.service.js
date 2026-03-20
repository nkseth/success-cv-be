import CircuitBreaker from 'opossum';
import logger from '../../middleware/logger.js';

/**
 * Circuit Breaker Service for Job Scrapers
 * 
 * Prevents cascading failures when external APIs are down or slow.
 * Each source gets its own circuit breaker with custom thresholds.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests
 * 
 * Benefits:
 * - Fast failure detection
 * - Automatic recovery testing
 * - Prevents resource exhaustion
 * - Improves overall system resilience
 */

// Circuit breaker configurations per source
const BREAKER_CONFIGS = {
    remoteok: {
        timeout: 30000,                 // 30s request timeout
        errorThresholdPercentage: 50,   // Open after 50% errors
        resetTimeout: 300000,           // Try again after 5 min
        rollingCountTimeout: 60000,     // 1 min rolling window
        volumeThreshold: 5,             // Min requests before tripping
        name: 'remoteok-breaker'
    },
    remotive: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'remotive-breaker'
    },
    weworkremotely: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'weworkremotely-breaker'
    },
    himalayas: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'himalayas-breaker'
    },
    jobicy: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'jobicy-breaker'
    },
    indeed: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'indeed-breaker'
    },
    // Indian boards — proxied through the Python Scrapling microservice
    naukri: {
        timeout: 120000,             // 2 min — browser scraper is slow
        errorThresholdPercentage: 50,
        resetTimeout: 600000,        // 10 min — Naukri rate-limits aggressively
        rollingCountTimeout: 120000, // 2 min rolling window
        volumeThreshold: 3,
        name: 'naukri-breaker'
    },
    internshala: {
        timeout: 60000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'internshala-breaker'
    },
    'linkedin-india': {
        timeout: 60000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'linkedin-india-breaker'
    },
    foundit: {
        timeout: 60000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'foundit-breaker'
    },
    shine: {
        timeout: 60000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: 'shine-breaker'
    }
};

// Store circuit breakers by source
const breakers = {};

/**
 * Create or get circuit breaker for a source.
 * The breaker action accepts { fn, opts } so each call binds its own scraperFn,
 * eliminating the shared-mutable-map race condition.
 * @param {string} source - Source name
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function getOrCreateBreaker(source) {
    const key = source.toLowerCase();
    
    if (breakers[key]) {
        return breakers[key];
    }
    
    const config = BREAKER_CONFIGS[key] || {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 300000,
        rollingCountTimeout: 60000,
        volumeThreshold: 3,
        name: `${key}-breaker`
    };
    
    // The breaker action receives { fn, opts } — fn is the caller's scraperFn
    // bound at fire()-time, so concurrent calls for the same source never
    // overwrite each other's function reference.
    const breaker = new CircuitBreaker(({ fn, opts }) => fn(opts), config);
    
    // Event listeners for monitoring
    breaker.on('open', () => {
        logger.error('Circuit breaker opened - too many failures', { 
            source: key,
            name: config.name
        });
    });
    
    breaker.on('halfOpen', () => {
        logger.warn('Circuit breaker half-open - testing recovery', { 
            source: key,
            name: config.name
        });
    });
    
    breaker.on('close', () => {
        logger.info('Circuit breaker closed - service recovered', { 
            source: key,
            name: config.name
        });
    });
    
    breaker.on('success', (result) => {
        logger.debug('Circuit breaker success', { 
            source: key,
            jobCount: result?.jobs?.length || 0
        });
    });
    
    breaker.on('failure', (error) => {
        logger.warn('Circuit breaker failure', { 
            source: key,
            error: error.message
        });
    });
    
    breaker.on('timeout', () => {
        logger.error('Circuit breaker timeout', { 
            source: key,
            timeout: config.timeout
        });
    });
    
    breaker.on('reject', () => {
        logger.error('Circuit breaker rejected request - circuit is open', { 
            source: key
        });
    });
    
    breakers[key] = breaker;
    return breaker;
}

/**
 * Wrap a scraper function with circuit breaker protection
 * @param {string} source - Source name
 * @param {Function} scraperFn - Scraper function to protect
 * @param {Object} options - Scraper options
 * @returns {Promise<Object>} Scraper result
 */
export async function withCircuitBreaker(source, scraperFn, options = {}) {
    const breaker = getOrCreateBreaker(source);
    
    try {
        // Pass scraperFn bound to this specific call so concurrent calls for the
        // same source each use their own function reference.
        const result = await breaker.fire({ fn: scraperFn, opts: options });
        return result;
    } catch (error) {
        // Check if error is from circuit being open (check state, not fragile string match)
        if (breaker.opened) {
            logger.error('Request rejected - circuit breaker is open', {
                source,
                message: 'Service is temporarily unavailable due to repeated failures'
            });
            
            // Return empty result instead of throwing
            return {
                jobs: [],
                stats: {
                    totalFetched: 0,
                    filtered: 0,
                    skipped: 0,
                    error: 'Circuit breaker open - service temporarily unavailable'
                }
            };
        }
        
        throw error;
    }
}

/**
 * Get circuit breaker status for a source
 * @param {string} source - Source name
 * @returns {Object} Status information
 */
export function getBreakerStatus(source) {
    const key = source.toLowerCase();
    const breaker = breakers[key];
    
    if (!breaker) {
        return { exists: false };
    }
    
    return {
        exists: true,
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: breaker.stats,
        options: {
            timeout: breaker.options.timeout,
            errorThresholdPercentage: breaker.options.errorThresholdPercentage,
            resetTimeout: breaker.options.resetTimeout
        }
    };
}

/**
 * Get all circuit breaker statuses
 * @returns {Object} Status for all sources
 */
export function getAllBreakerStatuses() {
    const statuses = {};
    
    for (const [source, breaker] of Object.entries(breakers)) {
        statuses[source] = {
            state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
            stats: breaker.stats
        };
    }
    
    return statuses;
}

/**
 * Reset a circuit breaker for a source
 * @param {string} source - Source name
 * @returns {boolean} Success status
 */
export function resetBreaker(source) {
    const key = source.toLowerCase();
    const breaker = breakers[key];
    
    if (!breaker) {
        return false;
    }
    
    breaker.close();
    logger.info('Circuit breaker manually reset', { source: key });
    return true;
}

/**
 * Shutdown all circuit breakers
 * Call this during app shutdown
 */
export function shutdownBreakers() {
    for (const [source, breaker] of Object.entries(breakers)) {
        breaker.shutdown();
        logger.info('Circuit breaker shut down', { source });
    }
}

export default {
    withCircuitBreaker,
    getBreakerStatus,
    getAllBreakerStatuses,
    resetBreaker,
    shutdownBreakers
};
