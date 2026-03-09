import pubSubService from './pubsub.service.js';
import logger from '../middleware/logger.js';

/**
 * SSE Service
 * Manages Server-Sent Events connections for real-time updates
 */

class SSEService {
    constructor() {
        this.clients = new Map(); // Store SSE clients by connection ID
        this.jobSubscriptions = new Map(); // Track job subscriptions
        this.queueSubscriptions = new Map(); // Track queue subscriptions
    }

    /**
     * Create a new SSE connection
     * @param {string} connectionId - Unique connection ID
     * @param {Response} res - Express response object
     * @param {Request} req - Express request object
     */
    createConnection(connectionId, res, req) {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Enable CORS for SSE - use the origin from the request
        const origin = req.headers.origin;
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        // Store client connection
        this.clients.set(connectionId, {
            res,
            req,
            connectedAt: Date.now(),
            lastHeartbeat: Date.now()
        });

        // Send initial connection message
        this.sendEvent(connectionId, 'connected', {
            connectionId,
            timestamp: Date.now(),
            message: 'Connection established successfully'
        });

        // Set up heartbeat interval (every 30 seconds)
        const heartbeatInterval = setInterval(() => {
            if (!this.clients.has(connectionId)) {
                clearInterval(heartbeatInterval);
                return;
            }

            this.sendHeartbeat(connectionId);
        }, 30000);

        // Handle connection close
        req.on('close', () => {
            clearInterval(heartbeatInterval);
            this.closeConnection(connectionId);
        });

        logger.info('SSE: Connection established', { connectionId });

        return connectionId;
    }

    /**
     * Send an event to a specific client
     * @param {string} connectionId - Connection ID
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    sendEvent(connectionId, eventType, data) {
        const client = this.clients.get(connectionId);

        if (!client) {
            logger.warn('SSE: Client not found', { connectionId });
            return false;
        }

        try {
            const eventData = {
                event: eventType,
                data,
                timestamp: Date.now()
            };

            // Format SSE message
            const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

            client.res.write(message);
            client.lastHeartbeat = Date.now();

            logger.debug('SSE: Event sent', {
                connectionId,
                eventType
            });

            return true;
        } catch (error) {
            logger.error('SSE: Failed to send event', {
                connectionId,
                eventType,
                error: error.message
            });
            this.closeConnection(connectionId);
            return false;
        }
    }

    /**
     * Send heartbeat to keep connection alive
     * @param {string} connectionId - Connection ID
     */
    sendHeartbeat(connectionId) {
        this.sendEvent(connectionId, 'heartbeat', {
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast an event to all connected clients
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    broadcast(eventType, data) {
        let successCount = 0;
        let failCount = 0;

        for (const [connectionId] of this.clients) {
            if (this.sendEvent(connectionId, eventType, data)) {
                successCount++;
            } else {
                failCount++;
            }
        }

        logger.debug('SSE: Broadcast completed', {
            eventType,
            successCount,
            failCount
        });
    }

    /**
     * Subscribe a client to job updates
     * @param {string} connectionId - Connection ID
     * @param {string} jobId - Job ID to subscribe to
     */
    async subscribeToJob(connectionId, jobId) {
        try {
            if (!this.clients.has(connectionId)) {
                throw new Error('Connection not found');
            }

            // Create callback for this subscription
            const callback = (data) => {
                this.sendEvent(connectionId, 'job_update', data);
            };

            // Subscribe to Redis channel
            await pubSubService.subscribeToJob(jobId, callback);

            // Track subscription
            if (!this.jobSubscriptions.has(connectionId)) {
                this.jobSubscriptions.set(connectionId, new Map());
            }
            this.jobSubscriptions.get(connectionId).set(jobId, callback);

            logger.info('SSE: Subscribed to job', { connectionId, jobId });

            // Send confirmation
            this.sendEvent(connectionId, 'subscribed', {
                type: 'job',
                jobId,
                timestamp: Date.now(),
                message: 'Ready to receive updates'
            });
        } catch (error) {
            logger.error('SSE: Failed to subscribe to job', {
                connectionId,
                jobId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Subscribe a client to queue updates
     * @param {string} connectionId - Connection ID
     * @param {string} queueName - Queue name to subscribe to
     */
    async subscribeToQueue(connectionId, queueName) {
        try {
            if (!this.clients.has(connectionId)) {
                throw new Error('Connection not found');
            }

            // Create callback for this subscription
            const callback = (data) => {
                this.sendEvent(connectionId, 'queue_update', data);
            };

            // Subscribe to Redis channel
            await pubSubService.subscribeToQueue(queueName, callback);

            // Track subscription
            if (!this.queueSubscriptions.has(connectionId)) {
                this.queueSubscriptions.set(connectionId, new Map());
            }
            this.queueSubscriptions.get(connectionId).set(queueName, callback);

            logger.info('SSE: Subscribed to queue', { connectionId, queueName });

            // Send confirmation
            this.sendEvent(connectionId, 'subscribed', {
                type: 'queue',
                queueName,
                timestamp: Date.now(),
                message: 'Ready to receive updates'
            });
        } catch (error) {
            logger.error('SSE: Failed to subscribe to queue', {
                connectionId,
                queueName,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Unsubscribe a client from job updates
     * @param {string} connectionId - Connection ID
     * @param {string} jobId - Job ID to unsubscribe from
     */
    async unsubscribeFromJob(connectionId, jobId) {
        try {
            const subscriptions = this.jobSubscriptions.get(connectionId);
            if (!subscriptions || !subscriptions.has(jobId)) {
                return;
            }

            const callback = subscriptions.get(jobId);
            await pubSubService.unsubscribe(`job:${jobId}`, callback);

            subscriptions.delete(jobId);
            if (subscriptions.size === 0) {
                this.jobSubscriptions.delete(connectionId);
            }

            logger.info('SSE: Unsubscribed from job', { connectionId, jobId });
        } catch (error) {
            logger.error('SSE: Failed to unsubscribe from job', {
                connectionId,
                jobId,
                error: error.message
            });
        }
    }

    /**
     * Unsubscribe a client from queue updates
     * @param {string} connectionId - Connection ID
     * @param {string} queueName - Queue name to unsubscribe from
     */
    async unsubscribeFromQueue(connectionId, queueName) {
        try {
            const subscriptions = this.queueSubscriptions.get(connectionId);
            if (!subscriptions || !subscriptions.has(queueName)) {
                return;
            }

            const callback = subscriptions.get(queueName);
            await pubSubService.unsubscribe(`queue:${queueName}`, callback);

            subscriptions.delete(queueName);
            if (subscriptions.size === 0) {
                this.queueSubscriptions.delete(connectionId);
            }

            logger.info('SSE: Unsubscribed from queue', { connectionId, queueName });
        } catch (error) {
            logger.error('SSE: Failed to unsubscribe from queue', {
                connectionId,
                queueName,
                error: error.message
            });
        }
    }

    /**
     * Close a client connection and clean up subscriptions
     * @param {string} connectionId - Connection ID
     */
    async closeConnection(connectionId) {
        try {
            const client = this.clients.get(connectionId);
            if (!client) {
                return;
            }

            // Unsubscribe from all job subscriptions
            const jobSubs = this.jobSubscriptions.get(connectionId);
            if (jobSubs) {
                for (const [jobId, callback] of jobSubs) {
                    await pubSubService.unsubscribe(`job:${jobId}`, callback);
                }
                this.jobSubscriptions.delete(connectionId);
            }

            // Unsubscribe from all queue subscriptions
            const queueSubs = this.queueSubscriptions.get(connectionId);
            if (queueSubs) {
                for (const [queueName, callback] of queueSubs) {
                    await pubSubService.unsubscribe(`queue:${queueName}`, callback);
                }
                this.queueSubscriptions.delete(connectionId);
            }

            // End response
            client.res.end();

            // Remove client
            this.clients.delete(connectionId);

            logger.info('SSE: Connection closed', { connectionId });
        } catch (error) {
            logger.error('SSE: Error closing connection', {
                connectionId,
                error: error.message
            });
        }
    }

    /**
     * Close all connections
     */
    async closeAllConnections() {
        logger.info('SSE: Closing all connections', {
            count: this.clients.size
        });

        const connectionIds = Array.from(this.clients.keys());
        for (const connectionId of connectionIds) {
            await this.closeConnection(connectionId);
        }
    }

    /**
     * Get connection statistics
     * @returns {Object} Connection stats
     */
    getStats() {
        const now = Date.now();
        const connections = Array.from(this.clients.entries()).map(([id, client]) => ({
            connectionId: id,
            connectedAt: client.connectedAt,
            lastHeartbeat: client.lastHeartbeat,
            duration: now - client.connectedAt,
            jobSubscriptions: this.jobSubscriptions.get(id)?.size || 0,
            queueSubscriptions: this.queueSubscriptions.get(id)?.size || 0
        }));

        return {
            totalConnections: this.clients.size,
            totalJobSubscriptions: Array.from(this.jobSubscriptions.values()).reduce(
                (sum, subs) => sum + subs.size, 0
            ),
            totalQueueSubscriptions: Array.from(this.queueSubscriptions.values()).reduce(
                (sum, subs) => sum + subs.size, 0
            ),
            connections
        };
    }

    /**
     * Get all connection IDs
     * @returns {Array<string>}
     */
    getConnectionIds() {
        return Array.from(this.clients.keys());
    }

    /**
     * Check if a connection exists
     * @param {string} connectionId - Connection ID
     * @returns {boolean}
     */
    hasConnection(connectionId) {
        return this.clients.has(connectionId);
    }
}

// Export singleton instance
const sseService = new SSEService();

export default sseService;
