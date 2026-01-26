import express from 'express';
import {
    getJobsController,
    getJobByIdController,
    getUserJobMatchesController,
    getJobMatchByIdController,
    generateJobMatchesController,
    regenerateJobMatchesController,
    updateJobMatchController,
    deleteJobMatchController,
    rewriteResumeForJobController,
    getUserJobPreferencesController,
    updateUserJobPreferencesController
} from '../../controllers/job.controller.js';
import { authenticateUser } from '../../middleware/authenticate-routes.js';
import { JOB_MATCHING_ENABLED } from '../../config/featureFlags.js';

const router = express.Router();

/**
 * Job Routes
 * 
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * Job browsing routes
 */

// GET /api/v1/jobs - Browse all jobs with filtering (uses saved preferences if no filters)
router.get('/jobs', getJobsController);

// GET /api/v1/jobs/:id - Get specific job details
router.get('/jobs/:id', getJobByIdController);

/**
 * Job matching routes
 */
if (JOB_MATCHING_ENABLED) {
    // GET /api/v1/job-matches - Get user's job matches
    router.get('/job-matches', getUserJobMatchesController);

    // GET /api/v1/job-matches/:id - Get specific job match
    router.get('/job-matches/:id', getJobMatchByIdController);

    // POST /api/v1/job-matches/generate - Trigger job matching
    router.post('/job-matches/generate', generateJobMatchesController);

    // POST /api/v1/job-matches/regenerate - Re-trigger job matching
    router.post('/job-matches/regenerate', regenerateJobMatchesController);

    // PUT /api/v1/job-matches/:id - Update job match (save, apply, reject)
    router.put('/job-matches/:id', updateJobMatchController);

    // DELETE /api/v1/job-matches/:id - Delete job match
    router.delete('/job-matches/:id', deleteJobMatchController);

    // POST /api/v1/job-matches/:jobMatchId/rewrite - Job-aware resume rewrite
    router.post('/job-matches/:jobMatchId/rewrite', rewriteResumeForJobController);
} else {
    const jobMatchingDisabled = (req, res) => res.status(404).json({
        success: false,
        message: 'Job matching is currently disabled'
    });

    router.all('/job-matches', jobMatchingDisabled);
    router.all('/job-matches/*path', jobMatchingDisabled);
    router.all('/job-preferences', jobMatchingDisabled);
    router.all('/job-preferences/*path', jobMatchingDisabled);
}

/**
 * Job preferences routes
 */
if (JOB_MATCHING_ENABLED) {
    // GET /api/v1/job-preferences - Get user's job preferences
    router.get('/job-preferences', getUserJobPreferencesController);

    // PUT /api/v1/job-preferences - Update user's job preferences
    router.put('/job-preferences', updateUserJobPreferencesController);
}

export default router;
