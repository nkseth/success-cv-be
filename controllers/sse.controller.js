import sseService from '../services/sse.service.js';
import { sendError } from '../utils/apiHelpers.js';
import logger from '../middleware/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * SSE Controller - Handles Server-Sent Events for real-time job updates
 * Supports both Resume Analysis and Resume Rewrite job monitoring
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
 * Connect and subscribe to a rewrite job (One-step connection)
 * GET /api/v1/sse/rewrite/:jobId
 * 
 * Specialized endpoint for monitoring resume rewrite jobs.
 * Auto-subscribes to the resume-rewrite queue for progress updates.
 * 
 * Usage: 
 * new EventSource('/api/v1/sse/rewrite/rewrite-123-1699267200000')
 * 
 * Events emitted:
 * - connected: Connection established
 * - subscribed: Subscription confirmed
 * - job_update: Progress updates (status, progress%, message)
 * - heartbeat: Keep-alive (every 30s)
 */
export const connectToRewriteJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const connectionId = uuidv4();
        
        // Get subdomain context for logging
        const subdomainInfo = req.subdomainContext ? {
            userType: req.subdomainContext.userType,
            subdomain: req.subdomain,
            organisationSlug: req.organisationSlug
        } : { userType: 'unknown' };
        
        logger.info('SSE: Rewrite job connection established', { 
            connectionId,
            jobId,
            queueName: 'resume-rewrite',
            ip: req.ip,
            ...subdomainInfo
        });

        // Create SSE connection
        sseService.createConnection(connectionId, res, req);
        
        // Automatically subscribe to the job
        await sseService.subscribeToJob(connectionId, jobId);

        // Subscribe to resume-rewrite queue updates
        await sseService.subscribeToQueue(connectionId, 'resume-rewrite');

        logger.info('SSE: Rewrite subscriptions active', {
            connectionId,
            subscriptions: {
                job: jobId,
                queue: 'resume-rewrite'
            }
        });

    } catch (error) {
        logger.error('SSE: Rewrite job connection failed', { 
            error: error.message,
            jobId: req.params.jobId 
        });
        return sendError(res, `Failed to establish rewrite job connection: ${error.message}`, 500);
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
