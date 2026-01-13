import { Router } from 'express';
import {
    connectToJob,
    getStats
} from '../../controllers/sse.controller.js';

/**
 * SSE (Server-Sent Events) Routes
 */

const router = Router();

// Primary SSE route - connect and auto-subscribe to job
router.get('/job/:jobId', connectToJob);

// Statistics endpoint (optional, for monitoring)
router.get('/stats', getStats);

export default router;
