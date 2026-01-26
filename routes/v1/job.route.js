import express from 'express';
import * as jobController from '../../controllers/job.controller.js';
import { authenticateUser } from '../../middleware/authenticate-routes.js';

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

// GET /api/v1/jobs - Browse all jobs with filtering
router.get('/jobs', jobController.getJobs);

// GET /api/v1/jobs/:id - Get specific job details
router.get('/jobs/:id', jobController.getJobById);

/**
 * Job matching routes
 */

// GET /api/v1/job-matches - Get user's job matches
router.get('/job-matches', jobController.getUserJobMatches);

// GET /api/v1/job-matches/:id - Get specific job match
router.get('/job-matches/:id', jobController.getJobMatchById);

// POST /api/v1/job-matches/generate - Trigger job matching
router.post('/job-matches/generate', jobController.generateJobMatches);

// POST /api/v1/job-matches/regenerate - Re-trigger job matching
router.post('/job-matches/regenerate', jobController.regenerateJobMatches);

// PUT /api/v1/job-matches/:id - Update job match (save, apply, reject)
router.put('/job-matches/:id', jobController.updateJobMatch);

// DELETE /api/v1/job-matches/:id - Delete job match
router.delete('/job-matches/:id', jobController.deleteJobMatch);

// POST /api/v1/job-matches/:jobMatchId/rewrite - Job-aware resume rewrite
router.post('/job-matches/:jobMatchId/rewrite', jobController.rewriteResumeForJob);

/**
 * Job preferences routes
 */

// GET /api/v1/job-preferences - Get user's job preferences
router.get('/job-preferences', jobController.getUserJobPreferences);

// PUT /api/v1/job-preferences - Update user's job preferences
router.put('/job-preferences', jobController.updateUserJobPreferences);

export default router;
