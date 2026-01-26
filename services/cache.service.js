import { getCacheRedis } from '../config/redis.config.js';
import logger from '../middleware/logger.js';

/**
 * Cache Service for managing Redis cache operations
 */
class CacheService {
    constructor() {
        this.redis = getCacheRedis();
        this.defaultTTL = 3600; // 1 hour default TTL
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Parsed value or null if not found
     */
    async get(key) {
        try {
            const value = await this.redis.get(key);
            if (!value) {
                logger.debug('Cache miss', { key });
                return null;
            }
            
            logger.debug('Cache hit', { key });
            return JSON.parse(value);
        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            return null;
        }
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache (will be JSON stringified)
     * @param {number} ttl - Time to live in seconds (optional, defaults to 1 hour)
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const stringValue = JSON.stringify(value);
            
            if (ttl > 0) {
                await this.redis.setex(key, ttl, stringValue);
            } else {
                await this.redis.set(key, stringValue);
            }
            
            logger.debug('Cache set', { key, ttl });
            return true;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Delete value from cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        try {
            const result = await this.redis.del(key);
            logger.debug('Cache delete', { key, deleted: result > 0 });
            return result > 0;
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Delete multiple keys matching a pattern
     * @param {string} pattern - Redis key pattern (e.g., "user:*")
     * @returns {Promise<number>} Number of keys deleted
     */
    async deletePattern(pattern) {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }

            const result = await this.redis.del(...keys);
            logger.info('Cache pattern delete', { pattern, deleted: result });
            return result;
        } catch (error) {
            logger.error('Cache pattern delete error', { pattern, error: error.message });
            return 0;
        }
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Cache exists error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Get remaining TTL for a key
     * @param {string} key - Cache key
     * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
     */
    async getTTL(key) {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            logger.error('Cache getTTL error', { key, error: error.message });
            return -2;
        }
    }

    /**
     * Extend TTL for existing key
     * @param {string} key - Cache key
     * @param {number} ttl - New TTL in seconds
     * @returns {Promise<boolean>}
     */
    async extend(key, ttl) {
        try {
            const result = await this.redis.expire(key, ttl);
            logger.debug('Cache TTL extended', { key, ttl });
            return result === 1;
        } catch (error) {
            logger.error('Cache extend error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Get multiple values at once
     * @param {string[]} keys - Array of cache keys
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async getMany(keys) {
        try {
            const values = await this.redis.mget(...keys);
            const result = {};
            
            keys.forEach((key, index) => {
                if (values[index]) {
                    try {
                        result[key] = JSON.parse(values[index]);
                    } catch {
                        result[key] = null;
                    }
                } else {
                    result[key] = null;
                }
            });

            return result;
        } catch (error) {
            logger.error('Cache getMany error', { keys, error: error.message });
            return {};
        }
    }

    /**
     * Set multiple values at once
     * @param {Object} keyValuePairs - Object with key-value pairs
     * @param {number} ttl - TTL for all keys (optional)
     * @returns {Promise<boolean>}
     */
    async setMany(keyValuePairs, ttl = this.defaultTTL) {
        try {
            const pipeline = this.redis.pipeline();

            Object.entries(keyValuePairs).forEach(([key, value]) => {
                const stringValue = JSON.stringify(value);
                if (ttl > 0) {
                    pipeline.setex(key, ttl, stringValue);
                } else {
                    pipeline.set(key, stringValue);
                }
            });

            await pipeline.exec();
            logger.debug('Cache setMany', { count: Object.keys(keyValuePairs).length, ttl });
            return true;
        } catch (error) {
            logger.error('Cache setMany error', { error: error.message });
            return false;
        }
    }

    /**
     * Increment a numeric value
     * @param {string} key - Cache key
     * @param {number} increment - Amount to increment by (default 1)
     * @returns {Promise<number|null>} New value after increment
     */
    async increment(key, increment = 1) {
        try {
            const result = await this.redis.incrby(key, increment);
            logger.debug('Cache increment', { key, increment, newValue: result });
            return result;
        } catch (error) {
            logger.error('Cache increment error', { key, error: error.message });
            return null;
        }
    }

    /**
     * Decrement a numeric value
     * @param {string} key - Cache key
     * @param {number} decrement - Amount to decrement by (default 1)
     * @returns {Promise<number|null>} New value after decrement
     */
    async decrement(key, decrement = 1) {
        try {
            const result = await this.redis.decrby(key, decrement);
            logger.debug('Cache decrement', { key, decrement, newValue: result });
            return result;
        } catch (error) {
            logger.error('Cache decrement error', { key, error: error.message });
            return null;
        }
    }

    /**
     * Clear all cache (use with caution!)
     * @returns {Promise<boolean>}
     */
    async flush() {
        try {
            await this.redis.flushdb();
            logger.warn('Cache flushed - all keys deleted');
            return true;
        } catch (error) {
            logger.error('Cache flush error', { error: error.message });
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        try {
            const info = await this.redis.info('stats');
            const keyspace = await this.redis.info('keyspace');
            
            return {
                info,
                keyspace,
                dbSize: await this.redis.dbsize()
            };
        } catch (error) {
            logger.error('Cache getStats error', { error: error.message });
            return null;
        }
    }
}

// Export singleton instance
export default new CacheService();
