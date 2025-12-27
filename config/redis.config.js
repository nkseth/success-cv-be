import Redis from 'ioredis';
import logger from '../middleware/logger.js';

// Redis Configuration
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

// Base Redis configuration (for standalone mode)
const baseConfig = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD || undefined,
    lazyConnect: true,
    showFriendlyErrorStack: NODE_ENV === 'development',
    enableOfflineQueue: true,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    ...(REDIS_TLS && {
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
        host: REDIS_HOST,
        port: REDIS_PORT
    }
] : [];

const clusterConfig = {
    redisOptions: {
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD || undefined,
        ...(REDIS_TLS && {
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

// Create Redis connections based on mode
let cacheRedis;
let queueRedis;

if (REDIS_CLUSTER_MODE) {
    // Cluster Mode
    logger.info('Initializing Redis in CLUSTER mode', { 
        host: REDIS_HOST, 
        port: REDIS_PORT 
    });
    
    cacheRedis = new Redis.Cluster(clusterNodes, {
        ...clusterConfig,
        keyPrefix: 'cache:'
    });
    
    queueRedis = new Redis.Cluster(clusterNodes, {
        ...clusterConfig,
        maxRetriesPerRequest: null // Important for BullMQ
    });
} else {
    // Standalone Mode
    logger.info('Initializing Redis in STANDALONE mode', { 
        host: REDIS_HOST, 
        port: REDIS_PORT,
        cacheDB: REDIS_DB_CACHE,
        queueDB: REDIS_DB_QUEUE
    });
    
    cacheRedis = new Redis({
        ...baseConfig,
        db: REDIS_DB_CACHE,
        keyPrefix: 'cache:',
        enableReadyCheck: true,
        keepAlive: 30000
    });
    
    queueRedis = new Redis({
        ...baseConfig,
        db: REDIS_DB_QUEUE,
        maxRetriesPerRequest: null, // Important for BullMQ
        enableReadyCheck: true,
        keepAlive: 30000
    });
}

export { cacheRedis, queueRedis };

// Event handlers for Cache Redis
cacheRedis.on('connect', () => {
    logger.info('Cache Redis: Connecting...', { 
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
        host: REDIS_HOST, 
        port: REDIS_PORT,
        db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_CACHE
    });
});

cacheRedis.on('ready', () => {
    logger.info('Cache Redis: Connected and ready', { 
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
        db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_CACHE
    });
});

cacheRedis.on('error', (err) => {
    logger.error('Cache Redis: Connection error', { 
        error: err.message,
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

cacheRedis.on('close', () => {
    logger.warn('Cache Redis: Connection closed', {
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

cacheRedis.on('reconnecting', (delay) => {
    logger.info('Cache Redis: Reconnecting...', { 
        delay,
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

// Event handlers for Queue Redis
queueRedis.on('connect', () => {
    logger.info('Queue Redis: Connecting...', { 
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
        host: REDIS_HOST, 
        port: REDIS_PORT,
        db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_QUEUE
    });
});

queueRedis.on('ready', () => {
    logger.info('Queue Redis: Connected and ready', { 
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone',
        db: REDIS_CLUSTER_MODE ? 'N/A' : REDIS_DB_QUEUE
    });
});

queueRedis.on('error', (err) => {
    logger.error('Queue Redis: Connection error', { 
        error: err.message,
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

queueRedis.on('close', () => {
    logger.warn('Queue Redis: Connection closed', {
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

queueRedis.on('reconnecting', (delay) => {
    logger.info('Queue Redis: Reconnecting...', { 
        delay,
        mode: REDIS_CLUSTER_MODE ? 'cluster' : 'standalone'
    });
});

// Initialize connections
export async function connectRedis() {
    try {
        logger.info('Initializing Redis connections...');
        
        // Connect cache Redis
        await cacheRedis.connect();
        await cacheRedis.ping();
        logger.info('Cache Redis connection established');

        // Connect queue Redis
        await queueRedis.connect();
        await queueRedis.ping();
        logger.info('Queue Redis connection established');

        return { cache: cacheRedis, queue: queueRedis };
    } catch (error) {
        logger.error('Failed to connect to Redis', { error: error.message });
        throw error;
    }
}

// Disconnect all Redis connections gracefully
export async function disconnectRedis() {
    try {
        logger.info('Disconnecting Redis connections...');
        
        await Promise.all([
            cacheRedis.quit(),
            queueRedis.quit()
        ]);

        logger.info('All Redis connections closed gracefully');
    } catch (error) {
        logger.error('Error disconnecting Redis', { error: error.message });
        
        // Force close if graceful shutdown fails
        await Promise.all([
            cacheRedis.disconnect(),
            queueRedis.disconnect()
        ]);
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

    // Check cache Redis
    try {
        const startCache = Date.now();
        await cacheRedis.ping();
        health.cache.connected = true;
        health.cache.latency = Date.now() - startCache;
    } catch (error) {
        health.cache.error = error.message;
    }

    // Check queue Redis
    try {
        const startQueue = Date.now();
        await queueRedis.ping();
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
                username: REDIS_USERNAME,
                password: REDIS_PASSWORD || undefined,
                ...(REDIS_TLS && {
                    tls: {
                        rejectUnauthorized: false
                    }
                })
            },
            maxRetriesPerRequest: null,
            enableOfflineQueue: true
        }
    },
    prefix: 'bull' // Prefix for queue keys to separate from cache
} : {
    // Standalone mode configuration
    host: REDIS_HOST,
    port: REDIS_PORT,
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD || undefined,
    db: REDIS_DB_QUEUE,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    prefix: 'bull', // Prefix for queue keys to separate from cache
    ...(REDIS_TLS && {
        tls: {
            rejectUnauthorized: false
        }
    })
};

export default {
    cacheRedis,
    queueRedis,
    connectRedis,
    disconnectRedis,
    checkRedisHealth,
    bullMQConnection
};
