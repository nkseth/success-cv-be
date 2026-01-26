import Redis from 'ioredis';
import logger from '../middleware/logger.js';

/**
 * PubSub Service
 * Manages Redis Pub/Sub for real-time communication
 * Used to send worker updates to frontend via SSE
 */

class PubSubService {
    constructor() {
        this.publisher = null;
        this.subscriber = null;
        this.channels = new Map(); // Store channel subscriptions
        this.isConnected = false;
    }

    /**
     * Initialize Redis Pub/Sub connections
     * @param {Object} redisConfig - Redis connection configuration
     */
    async initialize(redisConfig, options = {}) {
        try {
            const mode = options.mode || 'both';
            const connectionNamePrefix = options.connectionNamePrefix || 'pubsub';

            const baseOptions = {
                host: redisConfig.host,
                port: redisConfig.port,
                username: redisConfig.username,
                password: redisConfig.password,
                db: redisConfig.db || 0,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                ...(redisConfig.tls && {
                    tls: {
                        rejectUnauthorized: false
                    }
                })
            };

            // Create connections based on mode
            if (mode === 'both' || mode === 'publisher') {
                this.publisher = new Redis({
                    ...baseOptions,
                    connectionName: `${connectionNamePrefix}:publisher`
                });
            }

            if (mode === 'both' || mode === 'subscriber') {
                this.subscriber = new Redis({
                    ...baseOptions,
                    connectionName: `${connectionNamePrefix}:subscriber`
                });
            }

            // Set up event listeners
            this.setupEventListeners();

            const readinessChecks = [];

            if (this.publisher) {
                readinessChecks.push(new Promise((resolve, reject) => {
                    if (this.publisher.status === 'ready') {
                        resolve();
                    } else {
                        this.publisher.once('ready', resolve);
                        this.publisher.once('error', reject);
                    }
                }));
            }

            if (this.subscriber) {
                readinessChecks.push(new Promise((resolve, reject) => {
                    if (this.subscriber.status === 'ready') {
                        resolve();
                    } else {
                        this.subscriber.once('ready', resolve);
                        this.subscriber.once('error', reject);
                    }
                }));
            }

            // Wait for required connections to be ready
            await Promise.all(readinessChecks);

            this.isConnected = true;
            logger.info('PubSub Service: Initialized successfully');
        } catch (error) {
            logger.error('PubSub Service: Initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup event listeners for Redis connections
     */
    setupEventListeners() {
        if (this.publisher) {
            this.publisher.on('connect', () => {
                logger.info('PubSub Publisher: Connected');
            });

            this.publisher.on('ready', () => {
                logger.info('PubSub Publisher: Ready');
            });

            this.publisher.on('error', (error) => {
                logger.error('PubSub Publisher: Error', { error: error.message });
            });

            this.publisher.on('close', () => {
                logger.warn('PubSub Publisher: Connection closed');
                this.isConnected = false;
            });
        }

        if (this.subscriber) {
            this.subscriber.on('connect', () => {
                logger.info('PubSub Subscriber: Connected');
            });

            this.subscriber.on('ready', () => {
                logger.info('PubSub Subscriber: Ready');
            });

            this.subscriber.on('error', (error) => {
                logger.error('PubSub Subscriber: Error', { error: error.message });
            });

            this.subscriber.on('close', () => {
                logger.warn('PubSub Subscriber: Connection closed');
                this.isConnected = false;
            });

            // Message handler
            this.subscriber.on('message', (channel, message) => {
                this.handleMessage(channel, message);
            });
        }
    }

    /**
     * Publish a message to a channel
     * @param {string} channel - Channel name
     * @param {Object} data - Data to publish
     * @returns {Promise<number>} Number of subscribers that received the message
     */
    async publish(channel, data) {
        try {
            if (!this.isConnected) {
                throw new Error('PubSub service not connected');
            }

            if (!this.publisher) {
                throw new Error('PubSub publisher not initialized');
            }

            const message = JSON.stringify(data);
            const subscribers = await this.publisher.publish(channel, message);

            logger.debug('PubSub: Message published', { 
                channel, 
                subscribers,
                messageType: data.type 
            });

            return subscribers;
        } catch (error) {
            logger.error('PubSub: Failed to publish message', { 
                channel, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Subscribe to a channel
     * @param {string} channel - Channel name
     * @param {Function} callback - Callback function to handle messages
     */
    async subscribe(channel, callback) {
        try {
            if (!this.isConnected) {
                throw new Error('PubSub service not connected');
            }

            if (!this.subscriber) {
                throw new Error('PubSub subscriber not initialized');
            }

            await this.subscriber.subscribe(channel);

            // Store callbacks for this channel
            if (!this.channels.has(channel)) {
                this.channels.set(channel, new Set());
            }
            this.channels.get(channel).add(callback);

            logger.info('PubSub: Subscribed to channel', { channel });
        } catch (error) {
            logger.error('PubSub: Failed to subscribe to channel', { 
                channel, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Unsubscribe from a channel
     * @param {string} channel - Channel name
     * @param {Function} callback - Callback to remove (optional, removes all if not provided)
     */
    async unsubscribe(channel, callback = null) {
        try {
            if (!this.subscriber) {
                return;
            }

            if (!this.channels.has(channel)) {
                return;
            }

            if (callback) {
                // Remove specific callback
                this.channels.get(channel).delete(callback);
                
                // If no more callbacks, unsubscribe from Redis
                if (this.channels.get(channel).size === 0) {
                    await this.subscriber.unsubscribe(channel);
                    this.channels.delete(channel);
                    logger.info('PubSub: Unsubscribed from channel', { channel });
                }
            } else {
                // Remove all callbacks and unsubscribe
                await this.subscriber.unsubscribe(channel);
                this.channels.delete(channel);
                logger.info('PubSub: Unsubscribed from channel', { channel });
            }
        } catch (error) {
            logger.error('PubSub: Failed to unsubscribe from channel', { 
                channel, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Handle incoming messages
     * @param {string} channel - Channel name
     * @param {string} message - Message string
     */
    handleMessage(channel, message) {
        try {
            const data = JSON.parse(message);
            const callbacks = this.channels.get(channel);

            if (callbacks) {
                callbacks.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        logger.error('PubSub: Callback error', { 
                            channel, 
                            error: error.message 
                        });
                    }
                });
            }
        } catch (error) {
            logger.error('PubSub: Failed to handle message', { 
                channel, 
                error: error.message 
            });
        }
    }

    /**
     * Publish job update
     * @param {string} jobId - Job ID
     * @param {Object} update - Update data
     */
    async publishJobUpdate(jobId, update) {
        const channel = `job:${jobId}`;
        await this.publish(channel, {
            type: 'job_update',
            jobId,
            timestamp: Date.now(),
            ...update
        });
    }

    /**
     * Publish queue update
     * @param {string} queueName - Queue name
     * @param {Object} update - Update data
     */
    async publishQueueUpdate(queueName, update) {
        const channel = `queue:${queueName}`;
        await this.publish(channel, {
            type: 'queue_update',
            queueName,
            timestamp: Date.now(),
            ...update
        });
    }

    /**
     * Publish worker status
     * @param {string} workerId - Worker ID
     * @param {Object} status - Worker status
     */
    async publishWorkerStatus(workerId, status) {
        const channel = 'worker:status';
        await this.publish(channel, {
            type: 'worker_status',
            workerId,
            timestamp: Date.now(),
            ...status
        });
    }

    /**
     * Subscribe to job updates
     * @param {string} jobId - Job ID
     * @param {Function} callback - Callback function
     */
    async subscribeToJob(jobId, callback) {
        const channel = `job:${jobId}`;
        await this.subscribe(channel, callback);
    }

    /**
     * Subscribe to queue updates
     * @param {string} queueName - Queue name
     * @param {Function} callback - Callback function
     */
    async subscribeToQueue(queueName, callback) {
        const channel = `queue:${queueName}`;
        await this.subscribe(channel, callback);
    }

    /**
     * Subscribe to all worker status updates
     * @param {Function} callback - Callback function
     */
    async subscribeToWorkerStatus(callback) {
        const channel = 'worker:status';
        await this.subscribe(channel, callback);
    }

    /**
     * Get all active subscriptions
     * @returns {Array<string>} List of active channels
     */
    getActiveSubscriptions() {
        return Array.from(this.channels.keys());
    }

    /**
     * Get subscription count for a channel
     * @param {string} channel - Channel name
     * @returns {number} Number of callbacks subscribed to the channel
     */
    getSubscriptionCount(channel) {
        return this.channels.has(channel) ? this.channels.get(channel).size : 0;
    }

    /**
     * Disconnect all connections
     */
    async disconnect() {
        try {
            logger.info('PubSub Service: Disconnecting...');

            // Unsubscribe from all channels
            const channels = Array.from(this.channels.keys());
            for (const channel of channels) {
                if (this.subscriber) {
                    await this.subscriber.unsubscribe(channel);
                }
            }
            this.channels.clear();

            // Disconnect connections
            await Promise.all([
                this.publisher?.quit(),
                this.subscriber?.quit()
            ]);

            this.isConnected = false;
            logger.info('PubSub Service: Disconnected successfully');
        } catch (error) {
            logger.error('PubSub Service: Disconnect error', { error: error.message });
            throw error;
        }
    }

    /**
     * Check if service is connected
     * @returns {boolean}
     */
    isServiceConnected() {
        return this.isConnected;
    }
}

// Export singleton instance
const pubSubService = new PubSubService();

export default pubSubService;
