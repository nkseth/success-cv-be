import { db } from "../config/db.js";
import { AppError } from "../middleware/error.js";
import { eq, and, desc, asc, inArray, gte, lte, or, ilike, count, sql, isNull } from "drizzle-orm";
import logger from "../middleware/logger.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import { 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy 
} from "../utils/pagination-filter.js";
import {
    jobsTable,
    jobMatchesTable,
    jobScrapingLogsTable,
    userJobPreferencesTable,
    usersTable,
    candidatesTable,
    analysisTable,
    candidateAnalysisTable
} from "../drizzle/schema.js";

// ========== JOB CRUD OPERATIONS ==========

/**
 * Get job by ID
 * @param {number} jobId - Job ID
 * @returns {Promise<Object|null>} Job object or null
 */
export const getJobByID = async (jobId) => {
    try {
        const validJobID = validateInteger(jobId, "Job ID", { min: 1 });
        
        const [job] = await db.select()
            .from(jobsTable)
            .where(eq(jobsTable.id, validJobID))
            .limit(1);
        
        return job || null;
    } catch (error) {
        logger.error('Failed to get job by ID', { jobId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get job: ${error.message}`, 500);
    }
};

/**
 * Get jobs with filters, search, and pagination
 * 
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.q - Search query (searches title, company, description)
 * @param {string} options.location - Filter by location
 * @param {string} options.remoteType - Filter by remote type (comma-separated: remote,hybrid,onsite)
 * @param {string} options.employmentType - Filter by employment type (comma-separated: full-time,part-time,contract)
 * @param {string} options.experienceLevel - Filter by experience level (comma-separated: entry,mid,senior)
 * @param {string} options.source - Filter by source (comma-separated: remoteok,indeed)
 * @param {number} options.salaryMin - Minimum salary
 * @param {number} options.salaryMax - Maximum salary
 * @param {string} options.skills - Required skills (comma-separated)
 * @param {string} options.postedAfter - Filter jobs posted after date (ISO string)
 * @param {string} options.sortBy - Sort field (default: postedDate)
 * @param {string} options.sortOrder - Sort order (asc/desc, default: desc)
 * @returns {Promise<Object>} { data: Job[], pagination: Object, filters: Object }
 */
export const getJobs = async (options = {}) => {
    try {
        const {
            page = 1,
            limit = 20,
            q = '',
            location = '',
            remoteType = '',
            employmentType = '',
            experienceLevel = '',
            source = '',
            salaryMin,
            salaryMax,
            skills = '',
            postedAfter,
            sortBy = 'postedDate',
            sortOrder = 'desc'
        } = options;

        // Build WHERE conditions
        const conditions = [eq(jobsTable.isActive, true)];

        // Full-text search on title, company, description
        if (q) {
            conditions.push(
                or(
                    ilike(jobsTable.title, `%${q}%`),
                    ilike(jobsTable.company, `%${q}%`),
                    ilike(jobsTable.description, `%${q}%`)
                )
            );
        }

        // Location filter (fuzzy match)
        if (location) {
            conditions.push(ilike(jobsTable.location, `%${location}%`));
        }

        // Remote type filter (multi-value)
        if (remoteType) {
            const remoteTypes = remoteType.split(',').map(t => t.trim());
            conditions.push(inArray(jobsTable.remoteType, remoteTypes));
        }

        // Employment type filter (multi-value)
        if (employmentType) {
            const employmentTypes = employmentType.split(',').map(t => t.trim());
            conditions.push(inArray(jobsTable.employmentType, employmentTypes));
        }

        // Experience level filter (multi-value)
        if (experienceLevel) {
            const experienceLevels = experienceLevel.split(',').map(l => l.trim());
            conditions.push(inArray(jobsTable.experienceLevel, experienceLevels));
        }

        // Source filter (multi-value)
        if (source) {
            const sources = source.split(',').map(s => s.trim());
            conditions.push(inArray(jobsTable.source, sources));
        }

        // Salary range filter
        if (salaryMin) {
            conditions.push(
                or(
                    gte(jobsTable.salaryMax, parseInt(salaryMin)),
                    isNull(jobsTable.salaryMax)
                )
            );
        }
        if (salaryMax) {
            conditions.push(
                or(
                    lte(jobsTable.salaryMin, parseInt(salaryMax)),
                    isNull(jobsTable.salaryMin)
                )
            );
        }

        // Skills filter (JSONB array contains check)
        if (skills) {
            const skillsArray = skills.split(',').map(s => s.trim().toLowerCase());
            // Use JSONB contains operator for PostgreSQL
            skillsArray.forEach(skill => {
                conditions.push(
                    sql`${jobsTable.skillsRequired}::jsonb @> ${JSON.stringify({ required: [skill] })}::jsonb
                    OR ${jobsTable.skillsRequired}::jsonb @> ${JSON.stringify({ technical: [skill] })}::jsonb`
                );
            });
        }

        // Posted date filter
        if (postedAfter) {
            conditions.push(gte(jobsTable.postedDate, new Date(postedAfter)));
        }

        // Build ORDER BY
        const orderByField = jobsTable[sortBy] || jobsTable.postedDate;
        const orderByDirection = sortOrder === 'asc' ? asc : desc;

        // Count total matching jobs
        const [{ total }] = await db
            .select({ total: count() })
            .from(jobsTable)
            .where(and(...conditions));

        // Fetch paginated jobs
        const offset = (page - 1) * limit;
        const jobs = await db.select()
            .from(jobsTable)
            .where(and(...conditions))
            .orderBy(orderByDirection(orderByField))
            .limit(limit)
            .offset(offset);

        // Build pagination metadata
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            currentPage: page,
            pageSize: limit,
            totalCount: total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            previousPage: page > 1 ? page - 1 : null
        };

        // Build filters metadata
        const filters = {
            q,
            location,
            remoteType,
            employmentType,
            experienceLevel,
            source,
            salaryMin,
            salaryMax,
            skills,
            postedAfter,
            sortBy,
            sortOrder
        };

        return {
            data: jobs,
            pagination,
            filters
        };

    } catch (error) {
        logger.error('Failed to get jobs', { options, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get jobs: ${error.message}`, 500);
    }
};

/**
 * Create a new job
 * @param {Object} jobData - Job data
 * @returns {Promise<Object>} Created job
 */
export const createJob = async (jobData) => {
    try {
        const [job] = await db.insert(jobsTable)
            .values({
                ...jobData,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastScrapedAt: new Date()
            })
            .returning();

        logger.info('Job created', { jobId: job.id, title: job.title, company: job.company });
        return job;
    } catch (error) {
        logger.error('Failed to create job', { jobData, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create job: ${error.message}`, 500);
    }
};

/**
 * Update a job
 * @param {number} jobId - Job ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated job
 */
export const updateJob = async (jobId, updates) => {
    try {
        const validJobID = validateInteger(jobId, "Job ID", { min: 1 });

        const [job] = await db.update(jobsTable)
            .set({
                ...updates,
                updatedAt: new Date()
            })
            .where(eq(jobsTable.id, validJobID))
            .returning();

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        logger.info('Job updated', { jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to update job', { jobId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update job: ${error.message}`, 500);
    }
};

/**
 * Delete a job (soft delete by marking inactive)
 * @param {number} jobId - Job ID
 * @returns {Promise<Object>} Updated job
 */
export const deleteJob = async (jobId) => {
    try {
        const validJobID = validateInteger(jobId, "Job ID", { min: 1 });

        const [job] = await db.update(jobsTable)
            .set({
                isActive: false,
                updatedAt: new Date()
            })
            .where(eq(jobsTable.id, validJobID))
            .returning();

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        logger.info('Job deleted (marked inactive)', { jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to delete job', { jobId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to delete job: ${error.message}`, 500);
    }
};

// ========== JOB MATCH OPERATIONS ==========

/**
 * Get job match by ID (with optional user ownership validation)
 * @param {number} matchId - Match ID
 * @param {number} userId - Optional user ID for ownership check
 * @param {string} userType - 'user' or 'candidate'
 * @returns {Promise<Object|null>} Job match or null
 */
export const getJobMatchByID = async (matchId, userId = null, userType = 'user') => {
    try {
        const validMatchID = validateInteger(matchId, "Match ID", { min: 1 });

        let query = db.select()
            .from(jobMatchesTable)
            .where(eq(jobMatchesTable.id, validMatchID));

        // Add user ownership filter if userId provided
        if (userId) {
            const validUserID = validateInteger(userId, "User ID", { min: 1 });
            const isCandidate = userType === 'candidate';
            const userConditions = [
                eq(jobMatchesTable.userType, userType),
                isCandidate
                    ? eq(jobMatchesTable.candidateID, validUserID)
                    : eq(jobMatchesTable.userID, validUserID)
            ];
            query = query.where(and(...userConditions));
        }

        const [match] = await query.limit(1);

        return match || null;
    } catch (error) {
        logger.error('Failed to get job match by ID', { matchId, userId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get job match: ${error.message}`, 500);
    }
};

/**
 * Get job matches for a user with filters and pagination
 * 
 * @param {number} userId - User ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {number} options.minScore - Minimum match score filter
 * @param {string} options.status - Filter by status (comma-separated)
 * @param {boolean} options.saved - Filter saved jobs only
 * @param {boolean} options.applied - Filter applied jobs only
 * @param {string} options.sortBy - Sort field (default: matchScore)
 * @param {string} options.sortOrder - Sort order (default: desc)
 * @returns {Promise<Object>} { data: Match[], pagination: Object, filters: Object }
 */
export const getJobMatchesForUser = async (userId, userType, options = {}) => {
    try {
        const {
            page = 1,
            limit = 20,
            minScore,
            status = '',
            saved,
            applied,
            sortBy = 'matchScore',
            sortOrder = 'desc'
        } = options;

        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        // Build WHERE conditions
        const conditions = [
            eq(jobMatchesTable.userType, userType),
            isCandidate 
                ? eq(jobMatchesTable.candidateID, validUserID)
                : eq(jobMatchesTable.userID, validUserID)
        ];

        // Minimum score filter
        if (minScore) {
            conditions.push(gte(jobMatchesTable.matchScore, parseInt(minScore)));
        }

        // Status filter (multi-value)
        if (status) {
            const statuses = status.split(',').map(s => s.trim());
            conditions.push(inArray(jobMatchesTable.status, statuses));
        }

        // Saved filter
        if (saved !== undefined) {
            conditions.push(eq(jobMatchesTable.isSaved, Boolean(saved)));
        }

        // Applied filter
        if (applied !== undefined) {
            conditions.push(eq(jobMatchesTable.isApplied, Boolean(applied)));
        }

        // Build ORDER BY
        const orderByField = jobMatchesTable[sortBy] || jobMatchesTable.matchScore;
        const orderByDirection = sortOrder === 'asc' ? asc : desc;

        // Count total matches
        const [{ total }] = await db
            .select({ total: count() })
            .from(jobMatchesTable)
            .where(and(...conditions));

        // Fetch paginated matches with job details
        const offset = (page - 1) * limit;
        const matches = await db.select({
            match: jobMatchesTable,
            job: jobsTable
        })
            .from(jobMatchesTable)
            .leftJoin(jobsTable, eq(jobMatchesTable.jobID, jobsTable.id))
            .where(and(...conditions))
            .orderBy(orderByDirection(orderByField))
            .limit(limit)
            .offset(offset);

        // Transform results
        const data = matches.map(({ match, job }) => ({
            ...match,
            job
        }));

        // Build pagination metadata
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            currentPage: page,
            pageSize: limit,
            totalCount: total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            previousPage: page > 1 ? page - 1 : null
        };

        const filters = { minScore, status, saved, applied, sortBy, sortOrder };

        return { data, pagination, filters };

    } catch (error) {
        logger.error('Failed to get job matches for user', { userId, userType, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get job matches: ${error.message}`, 500);
    }
};

/**
 * Create a job match
 * @param {Object} matchData - Match data
 * @returns {Promise<Object>} Created match
 */
export const createJobMatch = async (matchData) => {
    try {
        const [match] = await db.insert(jobMatchesTable)
            .values({
                ...matchData,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        logger.info('Job match created', { matchId: match.id, userId: matchData.userID || matchData.candidateID });
        return match;
    } catch (error) {
        logger.error('Failed to create job match', { matchData, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to create job match: ${error.message}`, 500);
    }
};

/**
 * Bulk create job matches
 * @param {Array<Object>} matches - Array of match data
 * @returns {Promise<Array>} Created matches
 */
export const bulkCreateJobMatches = async (matches) => {
    try {
        const matchesWithTimestamps = matches.map(match => ({
            ...match,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        const createdMatches = await db.insert(jobMatchesTable)
            .values(matchesWithTimestamps)
            .returning();

        logger.info('Job matches bulk created', { count: createdMatches.length });
        return createdMatches;
    } catch (error) {
        logger.error('Failed to bulk create job matches', { count: matches.length, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to bulk create job matches: ${error.message}`, 500);
    }
};

/**
 * Update a job match (with user ownership validation)
 * @param {number} matchId - Match ID
 * @param {number} userId - User ID (for ownership check)
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated match or null if not found/unauthorized
 */
export const updateJobMatch = async (matchId, userId, userType, updates) => {
    try {
        const validMatchID = validateInteger(matchId, "Match ID", { min: 1 });
        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        const conditions = [
            eq(jobMatchesTable.id, validMatchID),
            eq(jobMatchesTable.userType, userType),
            isCandidate
                ? eq(jobMatchesTable.candidateID, validUserID)
                : eq(jobMatchesTable.userID, validUserID)
        ];

        const [match] = await db.update(jobMatchesTable)
            .set({
                ...updates,
                updatedAt: new Date()
            })
            .where(and(...conditions))
            .returning();

        if (!match) {
            return null; // Not found or unauthorized
        }

        logger.info('Job match updated', { matchId, userId, updates: Object.keys(updates) });
        return match;
    } catch (error) {
        logger.error('Failed to update job match', { matchId, userId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to update job match: ${error.message}`, 500);
    }
};


/**
 * Delete job matches for a user/analysis
 * @param {number} userId - User ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {number} analysisId - Analysis ID (optional)
 * @returns {Promise<number>} Number of deleted matches
 */
/**
 * Delete a specific job match by ID (with user ownership validation)
 * 
 * @param {number} matchId - Match ID
 * @param {number} userId - User ID (for ownership check)
 * @param {string} userType - 'user' or 'candidate'
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteJobMatch = async (matchId, userId, userType) => {
    try {
        const validMatchID = validateInteger(matchId, "Match ID", { min: 1 });
        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        const conditions = [
            eq(jobMatchesTable.id, validMatchID),
            eq(jobMatchesTable.userType, userType),
            isCandidate
                ? eq(jobMatchesTable.candidateID, validUserID)
                : eq(jobMatchesTable.userID, validUserID)
        ];

        const result = await db.delete(jobMatchesTable)
            .where(and(...conditions))
            .returning({ id: jobMatchesTable.id });

        if (result.length === 0) {
            return false; // Not found or unauthorized
        }

        logger.info('Job match deleted', { matchId, userId, userType });
        return true;
    } catch (error) {
        logger.error('Failed to delete job match', { matchId, userId, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to delete job match: ${error.message}`, 500);
    }
};

/**
 * Delete all job matches for a user (optionally for specific analysis)
 * 
 * @param {number} userId - User ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {number} analysisId - Optional analysis ID to delete matches for
 * @returns {Promise<number>} Number of matches deleted
 */
export const deleteJobMatchesForUser = async (userId, userType, analysisId = null) => {
    try {
        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        const conditions = [
            eq(jobMatchesTable.userType, userType),
            isCandidate
                ? eq(jobMatchesTable.candidateID, validUserID)
                : eq(jobMatchesTable.userID, validUserID)
        ];

        if (analysisId) {
            const validAnalysisID = validateInteger(analysisId, "Analysis ID", { min: 1 });
            conditions.push(
                isCandidate
                    ? eq(jobMatchesTable.candidateAnalysisID, validAnalysisID)
                    : eq(jobMatchesTable.analysisID, validAnalysisID)
            );
        }

        const result = await db.delete(jobMatchesTable)
            .where(and(...conditions))
            .returning({ id: jobMatchesTable.id });

        logger.info('Job matches deleted', { userId, userType, count: result.length });
        return result.length;
    } catch (error) {
        logger.error('Failed to delete job matches', { userId, userType, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to delete job matches: ${error.message}`, 500);
    }
};

// ========== JOB PREFERENCES OPERATIONS ==========

/**
 * Get job preferences for a user
 * @param {number} userId - User ID
 * @param {string} userType - 'user' or 'candidate'
 * @returns {Promise<Object|null>} Preferences or null
 */
export const getUserJobPreferences = async (userId, userType) => {
    try {
        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        const [prefs] = await db.select()
            .from(userJobPreferencesTable)
            .where(
                and(
                    eq(userJobPreferencesTable.userType, userType),
                    isCandidate
                        ? eq(userJobPreferencesTable.candidateID, validUserID)
                        : eq(userJobPreferencesTable.userID, validUserID)
                )
            )
            .limit(1);

        return prefs || null;
    } catch (error) {
        logger.error('Failed to get user job preferences', { userId, userType, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get job preferences: ${error.message}`, 500);
    }
};

/**
 * Create or update job preferences for a user
 * @param {number} userId - User ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} preferencesData - Preferences data
 * @returns {Promise<Object>} Created/updated preferences
 */
export const upsertUserJobPreferences = async (userId, userType, preferencesData) => {
    try {
        const validUserID = validateInteger(userId, "User ID", { min: 1 });
        const isCandidate = userType === 'candidate';

        // Check if preferences exist
        const existing = await getUserJobPreferences(userId, userType);

        if (existing) {
            // Update existing preferences
            const [prefs] = await db.update(userJobPreferencesTable)
                .set({
                    ...preferencesData,
                    updatedAt: new Date()
                })
                .where(eq(userJobPreferencesTable.id, existing.id))
                .returning();

            logger.info('Job preferences updated', { userId, userType });
            return prefs;
        } else {
            // Create new preferences
            const [prefs] = await db.insert(userJobPreferencesTable)
                .values({
                    [isCandidate ? 'candidateID' : 'userID']: validUserID,
                    userType,
                    ...preferencesData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .returning();

            logger.info('Job preferences created', { userId, userType });
            return prefs;
        }
    } catch (error) {
        logger.error('Failed to upsert job preferences', { userId, userType, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to save job preferences: ${error.message}`, 500);
    }
};

// ========== JOB SCRAPING LOGS OPERATIONS ==========

/**
 * Get recent scraping logs
 * @param {Object} options - Query options
 * @param {number} options.limit - Max logs to return (default: 50)
 * @param {string} options.source - Filter by source
 * @param {string} options.status - Filter by status
 * @returns {Promise<Array>} Scraping logs
 */
export const getScrapingLogs = async (options = {}) => {
    try {
        const { limit = 50, source, status } = options;

        const conditions = [];
        if (source) conditions.push(eq(jobScrapingLogsTable.source, source));
        if (status) conditions.push(eq(jobScrapingLogsTable.status, status));

        const logs = await db.select()
            .from(jobScrapingLogsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(jobScrapingLogsTable.createdAt))
            .limit(limit);

        return logs;
    } catch (error) {
        logger.error('Failed to get scraping logs', { options, error: error.message });
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to get scraping logs: ${error.message}`, 500);
    }
};

export default {
    // Job operations
    getJobByID,
    getJobs,
    createJob,
    updateJob,
    deleteJob,
    
    // Job match operations
    getJobMatchByID,
    getJobMatchesForUser,
    createJobMatch,
    bulkCreateJobMatches,
    updateJobMatch,
    deleteJobMatchesForUser,
    
    // Job preferences operations
    getUserJobPreferences,
    upsertUserJobPreferences,
    
    // Scraping logs
    getScrapingLogs
};
