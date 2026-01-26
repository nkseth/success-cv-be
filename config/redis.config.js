import Redis from 'ioredis';
import logger from '../middleware/logger.js';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Redis Configuration
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_DB_CACHE = parseInt(process.env.REDIS_DB_CACHE || '0');
const REDIS_DB_QUEUE = parseInt(process.env.REDIS_DB_QUEUE || '1');
const REDIS_CLUSTER_MODE = process.env.REDIS_CLUSTER_MODE === 'true';
const REDIS_TLS = process.env.REDIS_TLS === 'true';
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '3');
const NODE_ENV = process.env.NODE_ENV || 'development';

function parseRedisUrl(redisUrl) {
    if (!redisUrl) return null;

    try {
        const url = new URL(redisUrl);
        const tls = url.protocol === 'rediss:';
        const username = url.username || REDIS_USERNAME;
        const password = url.password || REDIS_PASSWORD || undefined;
        const port = url.port ? parseInt(url.port) : REDIS_PORT;

        return {
            host: url.hostname,
            port,
            username,
            password,
            tls
        };
    } catch (error) {
        logger.error('Invalid REDIS_URL provided', { error: error.message });
        return null;
    }
}

const redisUrlConfig = parseRedisUrl(REDIS_URL);
const RESOLVED_REDIS_HOST = redisUrlConfig?.host || REDIS_HOST;
const RESOLVED_REDIS_PORT = redisUrlConfig?.port || REDIS_PORT;
const RESOLVED_REDIS_USERNAME = redisUrlConfig?.username || REDIS_USERNAME;
const RESOLVED_REDIS_PASSWORD = redisUrlConfig?.password || (REDIS_PASSWORD || undefined);
const RESOLVED_REDIS_TLS = redisUrlConfig?.tls ?? REDIS_TLS;

// Base Redis configuration (for standalone mode)
const baseConfig = {
    host: RESOLVED_REDIS_HOST,
    port: RESOLVED_REDIS_PORT,
    username: RESOLVED_REDIS_USERNAME,
    password: RESOLVED_REDIS_PASSWORD,
    lazyConnect: true,
    showFriendlyErrorStack: NODE_ENV === 'development',
    enableOfflineQueue: true,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    ...(RESOLVED_REDIS_TLS && {
        tls: {
            rejectUnauthorized: false
        }
    }),
    retryStrategy: (times) => {
        if (times > REDIS_MAX_RETRIES) {
            logger.error('Redis max retries exceeded', { times, maxRetries: REDIS_MAX_RETRIES });
            return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
    },
    reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT'];
        if (targetErrors.some(targetError => err.message.includes(targetError))) {
            logger.warn('Redis reconnecting due to error', { error: err.message });
            return true;
        }
        return false;
    }
};

// Cluster configuration (if cluster mode is enabled)
const clusterNodes = REDIS_CLUSTER_MODE ? [
    {
        host: RESOLVED_REDIS_HOST,
        port: RESOLVED_REDIS_PORT
    }
] : [];

const clusterConfig = {
    redisOptions: {
        username: RESOLVED_REDIS_USERNAME,
        password: RESOLVED_REDIS_PASSWORD,
        ...(RESOLVED_REDIS_TLS && {
            tls: {
                rejectUnauthorized: false
            }
        })
    },
    lazyConnect: true,
    showFriendlyErrorStack: NODE_ENV === 'development',
    enableOfflineQueue: true,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    retryStrategy: (times) => {
        if (times > REDIS_MAX_RETRIES) {
            logger.error('Redis Cluster max retries exceeded', { times, maxRetries: REDIS_MAX_RETRIES });
            return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis connections based on mode (lazy initialization)
let cacheRedis;
let queueRedis;

function createCacheRedis() {
    if (REDIS_CLUSTER_MODE) {
        logger.info('Initializing Redis cache in CLUSTER mode', { 
            host: RESOLVED_REDIS_HOST, 
            port: RESOLVED_REDIS_PORT 
        });
        
        return new Redis.Cluster(clusterNodes, {
            ...clusterConfig,
            redisOptions: {
                ...clusterConfig.redisOptions,
                connectionName: 'app:cache'
            },
            keyPrefix: 'cache:'
        });
    }

    logger.info('Initializing Redis cache in STANDALONE mode', { 
        host: RESOLVED_REDIS_HOST, 
        port: RESOLVED_REDIS_PORT,
        cacheDB: REDIS_DB_CACHE
    });
    
    return new Redis({
        ...baseConfig,
        db: REDIS_DB_CACHE,
        keyPrefix: 'cache:',
        enableReadyCheck: true,
        keepAlive: 30000,
        connectionName: 'app:cache'
    });
}

function createQueueRedis() {
    if (REDIS_CLUSTER_MODE) {
        logger.info('Initializing Redis queue in CLUSTER mode', { 
            host: RESOLVED_REDIS_HOST, 
            port: RESOLVED_REDIS_PORT 
        });
        
        return new Redis.Cluster(clusterNodes, {
            ...clusterConfig,
            redisOptions: {
                ...clusterConfig.redisOptions,
                connectionName: 'app:queue'
            },
            maxRetriesPerRequest: null // Important for BullMQ
        });
    }

    logger.info('Initializing Redis queue in STANDALONE mode', { 
        host: RESOLVED_REDIS_HOST, 
        port: RESOLVED_REDIS_PORT,
        queueDB: REDIS_DB_QUEUE
    });
    
    return new Redis({
        ...baseConfig,
        db: REDIS_DB_QUEUE,
        maxRetriesPerRequest: null, // Important for BullMQ
        enableReadyCheck: true,
        keepAlive: 30000,
        connectionName: 'app:queue'
    });
}

function setupCacheRedisListeners(client) {
    client.on('connect', () => {
        logger.info('Cache Redis: Connecting...', { 
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
            host: RESOLVED_REDIS_HOST, 
            port: RESOLVED_REDIS_PORT,
            db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_CACHE
        });
    });

    client.on('ready', () => {
        logger.info('Cache Redis: Connected and ready', { 
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
            db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_CACHE
        });
    });

    client.on('error', (err) => {
        logger.error('Cache Redis: Connection error', { 
            error: err.message,
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });

    client.on('close', () => {
        logger.warn('Cache Redis: Connection closed', {
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });

    client.on('reconnecting', (delay) => {
        logger.info('Cache Redis: Reconnecting...', { 
            delay,
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });
}

function setupQueueRedisListeners(client) {
    client.on('connect', () => {
        logger.info('Queue Redis: Connecting...', { 
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
            host: RESOLVED_REDIS_HOST, 
            port: RESOLVED_REDIS_PORT,
            db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_QUEUE
        });
    });

    client.on('ready', () => {
        logger.info('Queue Redis: Connected and ready', { 
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
            db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_QUEUE
        });
    });

    client.on('error', (err) => {
        logger.error('Queue Redis: Connection error', { 
            error: err.message,
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });

    client.on('close', () => {
        logger.warn('Queue Redis: Connection closed', {
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });

    client.on('reconnecting', (delay) => {
        logger.info('Queue Redis: Reconnecting...', { 
            delay,
            mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
        });
    });
}

export function getCacheRedis() {
    if (!cacheRedis) {
        cacheRedis = createCacheRedis();
        setupCacheRedisListeners(cacheRedis);
    }
    return cacheRedis;
}

export function getQueueRedis() {
    if (!queueRedis) {
        queueRedis = createQueueRedis();
        setupQueueRedisListeners(queueRedis);
    }
    return queueRedis;
}

// Initialize connections
export async function connectRedis() {
    try {
        logger.info('Initializing Redis connections...');

        const cache = getCacheRedis();
        const queue = getQueueRedis();

        if (cache.status === 'wait') {
            await cache.connect();
        }
        await cache.ping();
        logger.info('Cache Redis connection established');

        if (queue.status === 'wait') {
            await queue.connect();
        }
        await queue.ping();
        logger.info('Queue Redis connection established');

        return { cache, queue };
    } catch (error) {
        logger.error('Failed to connect to Redis', { error: error.message });
        throw error;
    }
}

// Disconnect all Redis connections gracefully
export async function disconnectRedis() {
    try {
        logger.info('Disconnecting Redis connections...');

        const disconnects = [];
        if (cacheRedis) disconnects.push(cacheRedis.quit());
        if (queueRedis) disconnects.push(queueRedis.quit());

        await Promise.all(disconnects);

        logger.info('All Redis connections closed gracefully');
    } catch (error) {
        logger.error('Error disconnecting Redis', { error: error.message });
        
        // Force close if graceful shutdown fails
        const forceDisconnects = [];
        if (cacheRedis) forceDisconnects.push(cacheRedis.disconnect());
        if (queueRedis) forceDisconnects.push(queueRedis.disconnect());
        await Promise.all(forceDisconnects);
    }
}

// Health check for Redis connections
export async function checkRedisHealth() {
    const health = {
        cache: {
            connected: false,
            latency: null,
            error: null
        },
        queue: {
            connected: false,
            latency: null,
            error: null
        }
    };

    const cache = getCacheRedis();
    const queue = getQueueRedis();

    // Check cache Redis
    try {
        const startCache = Date.now();
        await cache.ping();
        health.cache.connected = true;
        health.cache.latency = Date.now() - startCache;
    } catch (error) {
        health.cache.error = error.message;
    }

    // Check queue Redis
    try {
        const startQueue = Date.now();
        await queue.ping();
        health.queue.connected = true;
        health.queue.latency = Date.now() - startQueue;
    } catch (error) {
        health.queue.error = error.message;
    }

    return health;
}

// Export Redis configuration for BullMQ
export const bullMQConnection = REDIS_CLUSTER_MODE ? {
    // Cluster mode configuration
    cluster: {
        nodes: clusterNodes,
        options: {
            redisOptions: {
                username: RESOLVED_REDIS_USERNAME,
                password: RESOLVED_REDIS_PASSWORD,
                ...(RESOLVED_REDIS_TLS && {
                    tls: {
                        rejectUnauthorized: false
                    }
                }),
                connectionName: 'bullmq:cluster'
            },
            maxRetriesPerRequest: null,
            enableOfflineQueue: true
        }
    },
    prefix: 'bull' // Prefix for queue keys to separate from cache
} : {
    // Standalone mode configuration
    host: RESOLVED_REDIS_HOST,
    port: RESOLVED_REDIS_PORT,
    username: RESOLVED_REDIS_USERNAME,
    password: RESOLVED_REDIS_PASSWORD,
    db: REDIS_DB_QUEUE,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    prefix: 'bull', // Prefix for queue keys to separate from cache
    connectionName: 'bullmq:queue',
    ...(RESOLVED_REDIS_TLS && {
        tls: {
            rejectUnauthorized: false
        }
    })
};

export function getRedisConnectionConfig({ db, connectionName } = {}) {
    return {
        host: RESOLVED_REDIS_HOST,
        port: RESOLVED_REDIS_PORT,
        username: RESOLVED_REDIS_USERNAME,
        password: RESOLVED_REDIS_PASSWORD,
        db: typeof db === 'number' ? db : REDIS_DB_CACHE,
        tls: RESOLVED_REDIS_TLS,
        connectionName
    };
}

export default {
    getCacheRedis,
    getQueueRedis,
    connectRedis,
    disconnectRedis,
    checkRedisHealth,
    bullMQConnection,
    getRedisConnectionConfig
};
