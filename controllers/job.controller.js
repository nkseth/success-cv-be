import logger from '../middleware/logger.js';
import * as jobModel from '../models/job.model.js';
import { addMatchJobsForUserJob, addRematchJobsForUserJob } from '../queues/job-matching.queue.js';
import { addResumeRewriteJob } from '../queues/resume-rewrite.queue.js';
import { AppError } from '../middleware/error.js';

/**
 * Job Controller
 * 
 * Handles HTTP requests for job-related operations:
 * - Browse/search jobs
 * - View job details
 * - Get user's job matches
 * - Trigger job matching
 * - Update match status (saved, applied, rejected)
 */

/**
 * Get all jobs with filtering and pagination
 * GET /api/v1/jobs
 */
export async function getJobs(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            location,
            remoteType,
            employmentType,
            experienceLevel,
            minSalary,
            maxSalary,
            skills,
            educationLevel,
            postedAfter,
            sortBy = 'postedDate',
            sortOrder = 'desc'
        } = req.query;

        logger.info('Fetching jobs', {
            userId: req.user?.id,
            filters: { location, remoteType, employmentType, experienceLevel, search }
        });

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            search,
            location,
            remoteType,
            employmentType,
            experienceLevel,
            minSalary: minSalary ? parseFloat(minSalary) : undefined,
            maxSalary: maxSalary ? parseFloat(maxSalary) : undefined,
            skills: skills ? (Array.isArray(skills) ? skills : skills.split(',')) : undefined,
            educationLevel,
            postedAfter: postedAfter ? new Date(postedAfter) : undefined
        };

        const result = await jobModel.getJobs(options);

        res.status(200).json({
            success: true,
            message: 'Jobs fetched successfully',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching jobs', {
            userId: req.user?.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Get job by ID
 * GET /api/v1/jobs/:id
 */
export async function getJobById(req, res, next) {
    try {
        const { id } = req.params;

        logger.info('Fetching job by ID', {
            userId: req.user?.id,
            jobId: id
        });

        const job = await jobModel.getJobByID(parseInt(id));

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Job fetched successfully',
            data: job
        });
    } catch (error) {
        logger.error('Error fetching job', {
            userId: req.user?.id,
            jobId: req.params.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Get user's job matches
 * GET /api/v1/job-matches
 */
export async function getUserJobMatches(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            minScore,
            status,
            saved,
            applied,
            analysisId,
            sortBy = 'matchScore',
            sortOrder = 'desc'
        } = req.query;

        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Fetching job matches for user', {
            userId,
            userType,
            analysisId,
            filters: { minScore, status, saved, applied }
        });

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            minScore: minScore ? parseInt(minScore) : undefined,
            status,
            saved: saved === 'true' ? true : saved === 'false' ? false : undefined,
            applied: applied === 'true' ? true : applied === 'false' ? false : undefined,
            analysisId: analysisId ? parseInt(analysisId) : undefined
        };

        const result = await jobModel.getJobMatchesForUser(userId, userType, options);

        res.status(200).json({
            success: true,
            message: 'Job matches fetched successfully',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error('Error fetching job matches', {
            userId: req.user?.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Trigger job matching for user's resume
 * POST /api/v1/job-matches/generate
 * Body: { analysisId, minScore?, maxResults?, replaceExisting? }
 */
export async function generateJobMatches(req, res, next) {
    try {
        const { analysisId, minScore, maxResults, replaceExisting } = req.body;

        if (!analysisId) {
            throw new AppError('Analysis ID is required', 400);
        }

        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Triggering job matching', {
            userId,
            userType,
            analysisId,
            options: { minScore, maxResults, replaceExisting }
        });

        // Add job to matching queue
        const job = await addMatchJobsForUserJob(
            userId,
            parseInt(analysisId),
            userType,
            {
                minScore: minScore ? parseInt(minScore) : 50,
                maxResults: maxResults ? parseInt(maxResults) : 50,
                replaceExisting: replaceExisting !== false
            }
        );

        res.status(202).json({
            success: true,
            message: 'Job matching started. Results will be available shortly.',
            data: {
                jobId: job.id,
                userId,
                analysisId: parseInt(analysisId),
                status: 'processing'
            }
        });
    } catch (error) {
        logger.error('Error triggering job matching', {
            userId: req.user?.id,
            analysisId: req.body.analysisId,
            error: error.message
        });
        next(error);
    }
}

/**
 * Re-trigger job matching (e.g., after preference change)
 * POST /api/v1/job-matches/regenerate
 * Body: { analysisId, minScore?, maxResults? }
 */
export async function regenerateJobMatches(req, res, next) {
    try {
        const { analysisId, minScore, maxResults } = req.body;

        if (!analysisId) {
            throw new AppError('Analysis ID is required', 400);
        }

        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Re-triggering job matching', {
            userId,
            userType,
            analysisId
        });

        // Add rematch job to queue
        const job = await addRematchJobsForUserJob(
            userId,
            parseInt(analysisId),
            userType,
            {
                minScore: minScore ? parseInt(minScore) : 50,
                maxResults: maxResults ? parseInt(maxResults) : 50
            }
        );

        res.status(202).json({
            success: true,
            message: 'Job re-matching started. Updated results will be available shortly.',
            data: {
                jobId: job.id,
                userId,
                analysisId: parseInt(analysisId),
                status: 'processing'
            }
        });
    } catch (error) {
        logger.error('Error re-triggering job matching', {
            userId: req.user?.id,
            analysisId: req.body.analysisId,
            error: error.message
        });
        next(error);
    }
}

/**
 * Update job match status
 * PUT /api/v1/job-matches/:id
 * Body: { status?, saved?, applied?, rejectedAt? }
 */
export async function updateJobMatch(req, res, next) {
    try {
        const { id } = req.params;
        const { status, saved, applied, rejectedAt } = req.body;

        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Updating job match', {
            userId,
            userType,
            matchId: id,
            updates: { status, saved, applied }
        });

        // Validate at least one field to update
        if (status === undefined && saved === undefined && applied === undefined && rejectedAt === undefined) {
            throw new AppError('At least one field to update is required', 400);
        }

        const updates = {};
        if (status !== undefined) updates.status = status;
        if (saved !== undefined) updates.saved = saved;
        if (applied !== undefined) {
            updates.applied = applied;
            if (applied) {
                updates.appliedAt = new Date();
            }
        }
        if (rejectedAt !== undefined) updates.rejectedAt = rejectedAt ? new Date(rejectedAt) : null;

        const updatedMatch = await jobModel.updateJobMatch(parseInt(id), userId, userType, updates);

        if (!updatedMatch) {
            throw new AppError('Job match not found or unauthorized', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Job match updated successfully',
            data: updatedMatch
        });
    } catch (error) {
        logger.error('Error updating job match', {
            userId: req.user?.id,
            matchId: req.params.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Get job match by ID
 * GET /api/v1/job-matches/:id
 */
export async function getJobMatchById(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Fetching job match by ID', {
            userId,
            userType,
            matchId: id
        });

        const match = await jobModel.getJobMatchByID(parseInt(id), userId, userType);

        if (!match) {
            throw new AppError('Job match not found or unauthorized', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Job match fetched successfully',
            data: match
        });
    } catch (error) {
        logger.error('Error fetching job match', {
            userId: req.user?.id,
            matchId: req.params.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Delete job match
 * DELETE /api/v1/job-matches/:id
 */
export async function deleteJobMatch(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Deleting job match', {
            userId,
            userType,
            matchId: id
        });

        const deleted = await jobModel.deleteJobMatch(parseInt(id), userId, userType);

        if (!deleted) {
            throw new AppError('Job match not found or unauthorized', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Job match deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting job match', {
            userId: req.user?.id,
            matchId: req.params.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Trigger job-aware resume rewrite
 * POST /api/v1/job-matches/:jobMatchId/rewrite
 * Body: { resumeId, analysisId? }
 */
export async function rewriteResumeForJob(req, res, next) {
    try {
        const { jobMatchId } = req.params;
        const { resumeId, analysisId } = req.body;

        if (!resumeId) {
            throw new AppError('Resume ID is required', 400);
        }

        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Triggering job-aware resume rewrite', {
            userId,
            userType,
            jobMatchId,
            resumeId,
            analysisId
        });

        // 1. Get job match (validates user ownership)
        const jobMatch = await jobModel.getJobMatchByID(parseInt(jobMatchId), userId, userType);

        if (!jobMatch) {
            throw new AppError('Job match not found or unauthorized', 404);
        }

        // 2. Get job details
        const job = await jobModel.getJobByID(jobMatch.jobID);

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // 3. Prepare job context for rewrite
        const jobContext = {
            targetJobID: job.id,
            sourceResumeID: parseInt(resumeId),
            jobMetadata: {
                title: job.title,
                company: job.company,
                description: job.description || '',
                skillsRequired: job.skillsRequired || {},
                experienceLevel: job.experienceLevel || '',
                educationLevel: job.educationLevel || ''
            }
        };

        // 4. Add rewrite job to queue with job-aware context
        const rewriteJob = await addResumeRewriteJob({
            userID: userType === 'user' ? userId : null,
            candidateID: userType === 'candidate' ? userId : null,
            userType,
            resumeId: parseInt(resumeId),
            analysisID: analysisId ? parseInt(analysisId) : jobMatch.analysisID || jobMatch.candidateAnalysisID,
            ...jobContext
        });

        res.status(202).json({
            success: true,
            message: 'Job-aware resume rewrite started. Check back soon for results.',
            data: {
                rewriteJobId: rewriteJob.id,
                jobMatchId: parseInt(jobMatchId),
                jobTitle: job.title,
                jobCompany: job.company,
                resumeId: parseInt(resumeId),
                status: 'processing'
            }
        });
    } catch (error) {
        logger.error('Error triggering job-aware resume rewrite', {
            userId: req.user?.id,
            jobMatchId: req.params.jobMatchId,
            resumeId: req.body.resumeId,
            error: error.message
        });
        next(error);
    }
}

/**
 * Get user's job preferences
 * GET /api/v1/job-preferences
 */
export async function getUserJobPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const userType = req.user.userType || 'user';

        logger.info('Fetching job preferences', {
            userId,
            userType
        });

        const preferences = await jobModel.getUserJobPreferences(userId, userType);

        res.status(200).json({
            success: true,
            message: 'Job preferences fetched successfully',
            data: preferences
        });
    } catch (error) {
        logger.error('Error fetching job preferences', {
            userId: req.user?.id,
            error: error.message
        });
        next(error);
    }
}

/**
 * Update user's job preferences
 * PUT /api/v1/job-preferences
 * Body: { preferredTitles?, preferredLocations?, remotePreference?, minSalary?, notificationEnabled? }
 */
export async function updateUserJobPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const userType = req.user.userType || 'user';
        const {
            preferredTitles,
            preferredLocations,
            remotePreference,
            minSalary,
            notificationEnabled
        } = req.body;

        logger.info('Updating job preferences', {
            userId,
            userType,
            updates: Object.keys(req.body)
        });

        // Validate at least one field provided
        if (
            !preferredTitles &&
            !preferredLocations &&
            !remotePreference &&
            minSalary === undefined &&
            notificationEnabled === undefined
        ) {
            throw new AppError('At least one preference field is required', 400);
        }

        const preferences = {};
        if (preferredTitles !== undefined) preferences.preferredTitles = preferredTitles;
        if (preferredLocations !== undefined) preferences.preferredLocations = preferredLocations;
        if (remotePreference !== undefined) preferences.remotePreference = remotePreference;
        if (minSalary !== undefined) preferences.minSalary = minSalary;
        if (notificationEnabled !== undefined) preferences.notificationEnabled = notificationEnabled;

        const updated = await jobModel.upsertUserJobPreferences(userId, userType, preferences);

        res.status(200).json({
            success: true,
            message: 'Job preferences updated successfully',
            data: updated
        });
    } catch (error) {
        logger.error('Error updating job preferences', {
            userId: req.user?.id,
            error: error.message
        });
        next(error);
    }
}

export default {
    getJobs,
    getJobById,
    getUserJobMatches,
    generateJobMatches,
    regenerateJobMatches,
    updateJobMatch,
    getJobMatchById,
    deleteJobMatch,
    rewriteResumeForJob,
    getUserJobPreferences,
    updateUserJobPreferences
};
