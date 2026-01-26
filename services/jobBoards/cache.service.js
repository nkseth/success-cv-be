import { getCacheRedis } from '../../config/redis.config.js';
import logger from '../../middleware/logger.js';
import crypto from 'crypto';

// Get Redis client lazily
const getRedisClient = () => getCacheRedis();

/**
 * Job Scraping Cache Service
 * 
 * Caches API responses to reduce external API calls and respect rate limits.
 * Each source has its own TTL based on data freshness requirements.
 * 
 * TTL Strategy:
 * - Remotive: 24h (data has 24h delay)
 * - RemoteOK: 6h (good freshness, scraped every 6h)
 * - WeWorkRemotely: 2h (RSS feed, frequent updates)
 * - Himalayas: 4h (rate limited, scraped every 4h)
 * - Jobicy: 1h (can poll frequently, scraped hourly)
 */

const CACHE_PREFIX = 'jobscrape:';

// TTL in seconds per source
const SOURCE_TTL = {
    remotive: 86400,      // 24 hours
    remoteok: 21600,      // 6 hours
    weworkremotely: 7200, // 2 hours
    himalayas: 14400,     // 4 hours
    jobicy: 3600          // 1 hour
};

/**
 * Generate cache key for a scraping request
 * @param {string} source - Source name
 * @param {Object} options - Scraping options
 * @returns {string} Cache key
 */
function generateCacheKey(source, options = {}) {
    // Sort options to ensure consistent keys
    const sortedOptions = Object.keys(options)
        .sort()
        .reduce((acc, key) => {
            acc[key] = options[key];
            return acc;
        }, {});
    
    const optionsHash = crypto
        .createHash('md5')
        .update(JSON.stringify(sortedOptions))
        .digest('hex')
        .substring(0, 8);
    
    return `${CACHE_PREFIX}${source}:${optionsHash}`;
}

/**
 * Get cached scraping result
 * @param {string} source - Source name
 * @param {Object} options - Scraping options
 * @returns {Promise<Object|null>} Cached result or null if not found/expired
 */
export async function getCachedJobs(source, options = {}) {
    try {
        const redisClient = getRedisClient();
        const key = generateCacheKey(source, options);
        const cached = await redisClient.get(key);
        
        if (!cached) {
            logger.debug('Cache miss for job scraping', { source, key });
            return null;
        }
        
        const result = JSON.parse(cached);
        logger.info('Cache hit for job scraping', { 
            source, 
            key,
            jobCount: result.jobs?.length || 0,
            age: result.cachedAt ? Math.round((Date.now() - result.cachedAt) / 1000) : 'unknown'
        });
        
        return result;
    } catch (error) {
        logger.error('Failed to get cached jobs', {
            source,
            error: error.message
        });
        return null; // Fail gracefully, proceed with fresh scrape
    }
}

/**
 * Cache scraping result
 * @param {string} source - Source name
 * @param {Object} options - Scraping options
 * @param {Object} result - Scraping result to cache
 * @returns {Promise<boolean>} Success status
 */
export async function setCachedJobs(source, options = {}, result) {
    try {
        const redisClient = getRedisClient();
        const key = generateCacheKey(source, options);
        const ttl = SOURCE_TTL[source] || 3600; // Default 1 hour
        
        const cacheData = {
            ...result,
            cachedAt: Date.now()
        };
        
        await redisClient.setex(key, ttl, JSON.stringify(cacheData));
        
        logger.info('Cached job scraping result', {
            source,
            key,
            ttl,
            jobCount: result.jobs?.length || 0
        });
        
        return true;
    } catch (error) {
        logger.error('Failed to cache jobs', {
            source,
            error: error.message
        });
        return false; // Fail gracefully, don't block scraping
    }
}

/**
 * Invalidate cache for a specific source
 * @param {string} source - Source name
 * @param {Object} options - Scraping options (optional, if not provided clears all for source)
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCache(source, options = null) {
    try {
        const redisClient = getRedisClient();
        
        if (options) {
            // Invalidate specific cache entry
            const key = generateCacheKey(source, options);
            const deleted = await redisClient.del(key);
            
            logger.info('Invalidated specific cache entry', { source, key, deleted });
            return deleted;
        } else {
            // Invalidate all cache entries for source
            const pattern = `${CACHE_PREFIX}${source}:*`;
            const keys = await redisClient.keys(pattern);
            
            if (keys.length === 0) {
                logger.info('No cache entries to invalidate', { source, pattern });
                return 0;
            }
            
            const deleted = await redisClient.del(...keys);
            logger.info('Invalidated all cache entries for source', { 
                source, 
                pattern, 
                deleted 
            });
            return deleted;
        }
    } catch (error) {
        logger.error('Failed to invalidate cache', {
            source,
            error: error.message
        });
        return 0;
    }
}

/**
 * Get cache statistics for monitoring
 * @returns {Promise<Object>} Cache stats per source
 */
export async function getCacheStats() {
    try {
        const redisClient = getRedisClient();
        const stats = {};
        
        for (const source of Object.keys(SOURCE_TTL)) {
            const pattern = `${CACHE_PREFIX}${source}:*`;
            const keys = await redisClient.keys(pattern);
            
            stats[source] = {
                cachedEntries: keys.length,
                ttl: SOURCE_TTL[source]
            };
        }
        
        return stats;
    } catch (error) {
        logger.error('Failed to get cache stats', {
            error: error.message
        });
        return {};
    }
}

/**
 * Clear all job scraping cache
 * Use with caution - typically only for debugging or forced refresh
 * @returns {Promise<number>} Number of keys deleted
 */
export async function clearAllCache() {
    try {
        const redisClient = getRedisClient();
        const pattern = `${CACHE_PREFIX}*`;
        const keys = await redisClient.keys(pattern);
        
        if (keys.length === 0) {
            logger.info('No cache entries to clear');
            return 0;
        }
        
        const deleted = await redisClient.del(...keys);
        logger.warn('Cleared all job scraping cache', { deleted });
        return deleted;
    } catch (error) {
        logger.error('Failed to clear cache', {
            error: error.message
        });
        return 0;
    }
}

export default {
    getCachedJobs,
    setCachedJobs,
    invalidateCache,
    getCacheStats,
    clearAllCache
};
