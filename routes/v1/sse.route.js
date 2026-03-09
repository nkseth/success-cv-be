import { Router } from 'express';
import {
    connectToJob,
    connectToRewriteJob,
    connectToManualAnalysisJob,
    connectToCareerRoadmapJob,
    getStats,
    connectToDetailedRoadmapJob
} from '../../controllers/sse.controller.js';

/**
 * SSE (Server-Sent Events) Routes
 * 
 * Real-time job monitoring for:
 * - Resume Analysis: /sse/job/:jobId?queueName=resume-analysis
 * - Resume Rewrite: /sse/rewrite/:jobId
 * - Manual Analysis: /sse/manual-analysis/:jobId
 * 
 * Frontend Usage:
 * ```javascript
 * // For analysis jobs (file upload)
 * const eventSource = new EventSource('/api/v1/sse/job/resume-123?queueName=resume-analysis');
 * 
 * // For rewrite jobs
 * const eventSource = new EventSource('/api/v1/sse/rewrite/rewrite-456');
 * 
 * // For manual analysis jobs (blank resume analysis)
 * const eventSource = new EventSource('/api/v1/sse/manual-analysis/manual-analysis-789');
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

// Specialized SSE route for manual analysis jobs - auto-subscribes to manual-resume-analysis queue
router.get('/manual-analysis/:jobId', connectToManualAnalysisJob);

// Specialized SSE route for career roadmap jobs - auto-subscribes to career-roadmap queue
/**
 * @route GET /api/v1/sse/career-roadmap/:jobId
 * @desc  Connect to SSE stream for career roadmap job updates
 */
router.get('/career-roadmap/:jobId', connectToCareerRoadmapJob);

/**
 * @route GET /api/v1/sse/detailed-roadmap/:jobId
 * @desc  Connect to SSE stream for detailed roadmap job updates
 */
router.get('/detailed-roadmap/:jobId', connectToDetailedRoadmapJob);

// Statistics endpoint (optional, for monitoring)
router.get('/stats', getStats);

export default router;
