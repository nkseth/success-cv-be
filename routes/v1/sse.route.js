import { Router } from 'express';
import {
    connectToJob,
    connectToRewriteJob,
    getStats
} from '../../controllers/sse.controller.js';

/**
 * SSE (Server-Sent Events) Routes
 * 
 * Real-time job monitoring for:
 * - Resume Analysis: /sse/job/:jobId?queueName=resume-analysis
 * - Resume Rewrite: /sse/rewrite/:jobId
 * 
 * Frontend Usage:
 * ```javascript
 * // For analysis jobs
 * const eventSource = new EventSource('/api/v1/sse/job/resume-123?queueName=resume-analysis');
 * 
 * // For rewrite jobs
 * const eventSource = new EventSource('/api/v1/sse/rewrite/rewrite-456');
 * 
 * eventSource.addEventListener('job_update', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(`Progress: ${data.progress}% - ${data.message}`);
 *   if (data.status === 'completed') {
 *     eventSource.close();
 *   }
 * });
 * ```
 */

const router = Router();

// Primary SSE route - connect and auto-subscribe to any job
router.get('/job/:jobId', connectToJob);

// Specialized SSE route for rewrite jobs - auto-subscribes to resume-rewrite queue
router.get('/rewrite/:jobId', connectToRewriteJob);

// Statistics endpoint (optional, for monitoring)
router.get('/stats', getStats);

export default router;
