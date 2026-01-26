import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import * as jobModel from "../models/job.model.js";
import { addMatchJobsForUserJob, addRematchJobsForUserJob } from "../queues/job-matching.queue.js";
import { addResumeRewriteJob } from "../queues/resume-rewrite.queue.js";
import { userTypeConstants } from "../utils/constants.js";
import { db } from "../config/db.js";
import { analysisTable, candidateAnalysisTable } from "../drizzle/schema.js";
import { and, desc, eq } from "drizzle-orm";
import {
    parseQueryParams,
    getPaginationMeta,
    formatPaginatedResponse
} from "../utils/pagination-filter.js";

/**
 * Job Controller
 * 
 * Handles HTTP requests for job-related operations:
 * - Browse/search jobs (with preferences fallback)
 * - View job details
 * - Get user's job matches
 * - Trigger job matching
 * - Update match status (saved, applied, rejected)
 * - Manage job preferences
 */

const getLatestCompletedAnalysisId = async (userID, userType) => {
    const isCandidate = userType === userTypeConstants.CANDIDATE;
    const table = isCandidate ? candidateAnalysisTable : analysisTable;
    const userField = isCandidate ? candidateAnalysisTable.candidateID : analysisTable.userID;

    const [analysis] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(userField, userID), eq(table.status, 'completed')))
        .orderBy(desc(table.completedAt), desc(table.createdAt))
        .limit(1);

    return analysis?.id || null;
};

// ========== JOB BROWSING ENDPOINTS ==========

/**
 * Get all jobs with filtering and pagination
 * Falls back to user's saved preferences when no filters provided
 * GET /api/v1/jobs
 * 
 * Query params:
 * - page, limit: Pagination
 * - q: Search query (title, company, description)
 * - location: Location filter
 * - remoteType: remote,hybrid,onsite (comma-separated)
 * - employmentType: full-time,part-time,contract (comma-separated)
 * - experienceLevel: entry,mid,senior (comma-separated)
 * - minSalary, maxSalary: Salary range
 * - skills: Required skills (comma-separated)
 * - postedAfter: ISO date string
 * - sortBy, sortOrder: Sorting
 */
export const getJobsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    const {
        page = 1,
        limit = 20,
        q,
        location,
        remoteType,
        employmentType,
        experienceLevel,
        minSalary,
        maxSalary,
        skills,
        postedAfter,
        sortBy = 'postedDate',
        sortOrder = 'desc'
    } = req.query;

    logger.info('[JOB_CONTROLLER] Fetching jobs', {
        userID,
        userType,
        hasFilters: !!(q || location || remoteType || employmentType || experienceLevel || skills)
    });

    // Check if any filters are provided
    const hasFilters = !!(q || location || remoteType || employmentType || experienceLevel || minSalary || maxSalary || skills);

    let options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        q,
        location,
        remoteType,
        employmentType,
        experienceLevel,
        salaryMin: minSalary ? parseFloat(minSalary) : undefined,
        salaryMax: maxSalary ? parseFloat(maxSalary) : undefined,
        skills,
        postedAfter: postedAfter ? new Date(postedAfter) : undefined
    };

    // If no filters provided and user is authenticated, use their saved preferences
    if (!hasFilters && userID) {
        const preferences = await jobModel.getUserJobPreferences(userID, userType);

        if (preferences) {
            logger.info('[JOB_CONTROLLER] Applying saved preferences', { userID, userType });

            // Apply preferences as filters
            if (preferences.preferredLocations?.length > 0) {
                options.location = preferences.preferredLocations[0]; // Use first preferred location
            }
            if (preferences.remotePreference && preferences.remotePreference !== 'no_preference') {
                options.remoteType = preferences.remotePreference === 'remote_only' ? 'remote' : preferences.remotePreference;
            }
            if (preferences.employmentTypes?.length > 0) {
                options.employmentType = preferences.employmentTypes.join(',');
            }
            if (preferences.experienceLevels?.length > 0) {
                options.experienceLevel = preferences.experienceLevels.join(',');
            }
            if (preferences.minSalary) {
                options.salaryMin = preferences.minSalary;
            }
            if (preferences.maxSalary) {
                options.salaryMax = preferences.maxSalary;
            }
            if (preferences.mustHaveSkills?.length > 0) {
                options.skills = preferences.mustHaveSkills.join(',');
            }
        }
    }

    const result = await jobModel.getJobs(options);

    sendSuccess(res, {
        jobs: result.data,
        pagination: result.pagination,
        appliedPreferences: !hasFilters && userID ? true : false
    }, 'Jobs fetched successfully', 200);
});

/**
 * Get job by ID
 * GET /api/v1/jobs/:id
 */
export const getJobByIdController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const jobId = validateInteger(id, 'Job ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Fetching job by ID', { userID, userType, jobId });

    const job = await jobModel.getJobByID(jobId);

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    sendSuccess(res, job, 'Job fetched successfully', 200);
});

// ========== JOB MATCHES ENDPOINTS ==========

/**
 * Get user's job matches
 * GET /api/v1/job-matches
 * 
 * Query params:
 * - page, limit: Pagination
 * - minScore: Minimum match score filter
 * - status: Match status filter
 * - saved: Filter by saved (true/false)
 * - applied: Filter by applied (true/false)
 * - analysisId: Filter by specific analysis
 * - sortBy, sortOrder: Sorting
 */
export const getUserJobMatchesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

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

    logger.info('[JOB_CONTROLLER] Fetching job matches', {
        userID,
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

    const result = await jobModel.getJobMatchesForUser(userID, userType, options);

    sendSuccess(res, {
        matches: result.data,
        pagination: result.pagination
    }, 'Job matches fetched successfully', 200);
});

/**
 * Get job match by ID
 * GET /api/v1/job-matches/:id
 */
export const getJobMatchByIdController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const matchId = validateInteger(id, 'Match ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Fetching job match by ID', { userID, userType, matchId });

    const match = await jobModel.getJobMatchByID(matchId, userID, userType);

    if (!match) {
        throw new AppError('Job match not found or unauthorized', 404);
    }

    sendSuccess(res, match, 'Job match fetched successfully', 200);
});

/**
 * Trigger job matching for user's resume
 * POST /api/v1/job-matches/generate
 * Body: { analysisId, minScore?, maxResults?, replaceExisting? }
 */
export const generateJobMatchesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { analysisId, minScore, maxResults, replaceExisting } = req.body;

    let validAnalysisId = analysisId ? validateInteger(analysisId, 'Analysis ID', { min: 1 }) : null;

    if (!validAnalysisId) {
        validAnalysisId = await getLatestCompletedAnalysisId(userID, userType);
    }

    if (!validAnalysisId) {
        throw new AppError('No completed resume analysis found. Please run resume analysis first.', 400);
    }

    logger.info('[JOB_CONTROLLER] Triggering job matching', {
        userID,
        userType,
        analysisId: validAnalysisId,
        options: { minScore, maxResults, replaceExisting }
    });

    // Add job to matching queue
    const job = await addMatchJobsForUserJob(
        userID,
        validAnalysisId,
        userType,
        {
            minScore: minScore ? parseInt(minScore) : 50,
            maxResults: maxResults ? parseInt(maxResults) : 50,
            replaceExisting: replaceExisting === true
        }
    );

    sendSuccess(res, {
        jobId: job.id,
        userId: userID,
        analysisId: validAnalysisId,
        status: 'processing'
    }, 'Job matching started. Results will be available shortly.', 202);
});

/**
 * Re-trigger job matching (e.g., after preference change)
 * POST /api/v1/job-matches/regenerate
 * Body: { analysisId, minScore?, maxResults? }
 */
export const regenerateJobMatchesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { analysisId, minScore, maxResults } = req.body;

    if (!analysisId) {
        throw new AppError('Analysis ID is required', 400);
    }

    const validAnalysisId = validateInteger(analysisId, 'Analysis ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Re-triggering job matching', {
        userID,
        userType,
        analysisId: validAnalysisId
    });

    // Add rematch job to queue
    const job = await addRematchJobsForUserJob(
        userID,
        validAnalysisId,
        userType,
        {
            minScore: minScore ? parseInt(minScore) : 50,
            maxResults: maxResults ? parseInt(maxResults) : 50
        }
    );

    sendSuccess(res, {
        jobId: job.id,
        userId: userID,
        analysisId: validAnalysisId,
        status: 'processing'
    }, 'Job re-matching started. Updated results will be available shortly.', 202);
});

/**
 * Update job match status
 * PUT /api/v1/job-matches/:id
 * Body: { status?, saved?, applied?, rejectedAt? }
 */
export const updateJobMatchController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { status, saved, applied, rejectedAt } = req.body;

    const matchId = validateInteger(id, 'Match ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Updating job match', {
        userID,
        userType,
        matchId,
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

    const updatedMatch = await jobModel.updateJobMatch(matchId, userID, userType, updates);

    if (!updatedMatch) {
        throw new AppError('Job match not found or unauthorized', 404);
    }

    sendSuccess(res, updatedMatch, 'Job match updated successfully', 200);
});

/**
 * Delete job match
 * DELETE /api/v1/job-matches/:id
 */
export const deleteJobMatchController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const matchId = validateInteger(id, 'Match ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Deleting job match', { userID, userType, matchId });

    const deleted = await jobModel.deleteJobMatch(matchId, userID, userType);

    if (!deleted) {
        throw new AppError('Job match not found or unauthorized', 404);
    }

    sendSuccess(res, null, 'Job match deleted successfully', 200);
});

// ========== JOB-AWARE REWRITE ENDPOINT ==========

/**
 * Trigger job-aware resume rewrite
 * POST /api/v1/job-matches/:jobMatchId/rewrite
 * Body: { resumeId, analysisId? }
 */
export const rewriteResumeForJobController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { jobMatchId } = req.params;
    const { resumeId, analysisId } = req.body;

    if (!resumeId) {
        throw new AppError('Resume ID is required', 400);
    }

    const validJobMatchId = validateInteger(jobMatchId, 'Job Match ID', { min: 1 });
    const validResumeId = validateInteger(resumeId, 'Resume ID', { min: 1 });

    logger.info('[JOB_CONTROLLER] Triggering job-aware resume rewrite', {
        userID,
        userType,
        jobMatchId: validJobMatchId,
        resumeId: validResumeId,
        analysisId
    });

    // 1. Get job match (validates user ownership)
    const jobMatch = await jobModel.getJobMatchByID(validJobMatchId, userID, userType);

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
        sourceResumeID: validResumeId,
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
        userID: userType === userTypeConstants.USER ? userID : null,
        candidateID: userType === userTypeConstants.CANDIDATE ? userID : null,
        userType,
        resumeId: validResumeId,
        analysisID: analysisId ? parseInt(analysisId) : jobMatch.analysisID || jobMatch.candidateAnalysisID,
        ...jobContext
    });

    sendSuccess(res, {
        rewriteJobId: rewriteJob.id,
        jobMatchId: validJobMatchId,
        jobTitle: job.title,
        jobCompany: job.company,
        resumeId: validResumeId,
        status: 'processing'
    }, 'Job-aware resume rewrite started. Check back soon for results.', 202);
});

// ========== JOB PREFERENCES ENDPOINTS ==========

/**
 * Get user's job preferences
 * GET /api/v1/job-preferences
 */
export const getUserJobPreferencesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[JOB_CONTROLLER] Fetching job preferences', { userID, userType });

    const preferences = await jobModel.getUserJobPreferences(userID, userType);

    sendSuccess(res, preferences, 'Job preferences fetched successfully', 200);
});

/**
 * Update user's job preferences
 * PUT /api/v1/job-preferences
 * Body: {
 *   preferredTitles?: string[],
 *   preferredLocations?: string[],
 *   remotePreference?: 'remote_only' | 'hybrid' | 'onsite' | 'no_preference',
 *   employmentTypes?: string[],
 *   experienceLevels?: string[],
 *   minSalary?: number,
 *   maxSalary?: number,
 *   mustHaveSkills?: string[],
 *   excludedCompanies?: string[],
 *   notificationEnabled?: boolean,
 *   notificationFrequency?: 'realtime' | 'daily' | 'weekly' | 'never',
 *   minMatchScoreForNotification?: number
 * }
 */
export const updateUserJobPreferencesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const {
        preferredTitles,
        preferredLocations,
        remotePreference,
        employmentTypes,
        experienceLevels,
        minSalary,
        maxSalary,
        mustHaveSkills,
        excludedCompanies,
        notificationEnabled,
        notificationFrequency,
        minMatchScoreForNotification
    } = req.body;

    logger.info('[JOB_CONTROLLER] Updating job preferences', {
        userID,
        userType,
        updates: Object.keys(req.body)
    });

    // Validate at least one field provided
    const hasUpdates = [
        preferredTitles,
        preferredLocations,
        remotePreference,
        employmentTypes,
        experienceLevels,
        minSalary,
        maxSalary,
        mustHaveSkills,
        excludedCompanies,
        notificationEnabled,
        notificationFrequency,
        minMatchScoreForNotification
    ].some(v => v !== undefined);

    if (!hasUpdates) {
        throw new AppError('At least one preference field is required', 400);
    }

    // Build preferences object with only provided fields
    const preferences = {};
    if (preferredTitles !== undefined) preferences.preferredTitles = preferredTitles;
    if (preferredLocations !== undefined) preferences.preferredLocations = preferredLocations;
    if (remotePreference !== undefined) preferences.remotePreference = remotePreference;
    if (employmentTypes !== undefined) preferences.employmentTypes = employmentTypes;
    if (experienceLevels !== undefined) preferences.experienceLevels = experienceLevels;
    if (minSalary !== undefined) preferences.minSalary = minSalary;
    if (maxSalary !== undefined) preferences.maxSalary = maxSalary;
    if (mustHaveSkills !== undefined) preferences.mustHaveSkills = mustHaveSkills;
    if (excludedCompanies !== undefined) preferences.excludedCompanies = excludedCompanies;
    if (notificationEnabled !== undefined) preferences.notificationEnabled = notificationEnabled;
    if (notificationFrequency !== undefined) preferences.notificationFrequency = notificationFrequency;
    if (minMatchScoreForNotification !== undefined) preferences.minMatchScoreForNotification = minMatchScoreForNotification;

    const updated = await jobModel.upsertUserJobPreferences(userID, userType, preferences);

    sendSuccess(res, updated, 'Job preferences updated successfully', 200);
});
