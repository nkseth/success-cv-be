import sseService from '../services/sse.service.js';
import { sendError } from '../utils/apiHelpers.js';
import logger from '../middleware/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * SSE Controller - Optimized for Resume Analysis Job Monitoring
 * Handles Server-Sent Events endpoints for real-time job updates
 */

/**
 * Connect and subscribe to a specific job (One-step connection)
 * GET /api/v1/sse/job/:jobId?queueName=resume-analysis
 * 
 * This is the primary endpoint for monitoring resume analysis jobs.
 * - Server generates connection ID automatically
 * - Auto-subscribes to the specified job
 * - Optionally subscribes to queue updates via query param
 * 
 * Usage: 
 * new EventSource('/api/v1/sse/job/resume-123-1699267200000?queueName=resume-analysis')
 */
export const connectToJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { queueName } = req.query;
        const connectionId = uuidv4();
        
        // Get subdomain context for logging (users vs candidates)
        const subdomainInfo = req.subdomainContext ? {
            userType: req.subdomainContext.userType,
            subdomain: req.subdomain,
            organisationSlug: req.organisationSlug
        } : { userType: 'unknown' };
        
        logger.info('SSE: Job connection established', { 
            connectionId,
            jobId,
            queueName: queueName || 'none',
            ip: req.ip,
            ...subdomainInfo
        });

        // Create SSE connection
        sseService.createConnection(connectionId, res, req);
        
        // Automatically subscribe to the job
        await sseService.subscribeToJob(connectionId, jobId);

        // If queue name provided, also subscribe to queue updates
        if (queueName) {
            await sseService.subscribeToQueue(connectionId, queueName);
        }

        logger.info('SSE: Subscriptions active', {
            connectionId,
            subscriptions: {
                job: jobId,
                queue: queueName || null
            }
        });

    } catch (error) {
        logger.error('SSE: Job connection failed', { 
            error: error.message,
            jobId: req.params.jobId 
        });
        return sendError(res, `Failed to establish job connection: ${error.message}`, 500);
    }
};

/**
 * Get SSE connection statistics
 * GET /api/v1/sse/stats
 * 
 * Returns information about active connections and subscriptions
 * Useful for monitoring and debugging
 */
export const getStats = async (req, res) => {
    try {
        const stats = sseService.getStats();

        res.json({
            success: true,
            message: 'SSE statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        logger.error('SSE: Get stats error', { error: error.message });
        return sendError(res, `Failed to get SSE stats: ${error.message}`, 500);
    }
};
