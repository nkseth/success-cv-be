import logger from '../middleware/logger.js';
import { AppError } from '../middleware/error.js';
import { db } from '../config/db.js';
import { careerRoadmapsTable } from '../drizzle/schema/career-roadmap.schema.js';
import { resumeContentTable } from '../drizzle/schema/resume.schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { addCareerRoadmapJob } from '../queues/career-roadmap.queue.js';
import { addDetailedRoadmapJob } from '../queues/detailed-roadmap.queue.js';

/**
 * Career Roadmap Service
 *
 * Handles all career roadmap business logic:
 *  - createRoadmap()     — validate resume, deduct credits, create DB record, enqueue job
 *  - getRoadmap()        — fetch a specific roadmap (auth check)
 *  - getAllRoadmaps()    — list with pagination
 *  - selectPath()        — save the user's chosen path index
 *  - deleteRoadmap()     — soft-delete (set status = 'deleted')
 */

// ========== CREATE ==========

/**
 * Create a new career roadmap generation job
 * @param {number} userID
 * @param {number} resumeContentID - Must belong to userID
 * @param {Object} questionnaire   - User's answers
 * @param {Object} creditTransaction - From billing middleware (req.creditTransaction)
 * @returns {Promise<Object>} Created roadmap record
 */
async function createRoadmap(userID, resumeContentID, questionnaire, creditTransaction) {
    logger.info('[ROADMAP_SERVICE] Creating career roadmap', { userID, resumeContentID });

    // Verify the resume content belongs to this user
    const [resumeContent] = await db
        .select({ id: resumeContentTable.id, userID: resumeContentTable.userID })
        .from(resumeContentTable)
        .where(
            and(
                eq(resumeContentTable.id, resumeContentID),
                eq(resumeContentTable.userID, userID)
            )
        )
        .limit(1);

    if (!resumeContent) {
        throw new AppError('Resume not found or you do not have permission to access it', 404);
    }

    // Validate questionnaire
    if (!questionnaire || !questionnaire.targetRoles || questionnaire.targetRoles.length === 0) {
        throw new AppError('Please specify at least one target role in your questionnaire', 400);
    }

    // Create DB record (status: pending) — this gets updated by the worker
    const [roadmap] = await db
        .insert(careerRoadmapsTable)
        .values({
            userID,
            resumeContentID,
            questionnaire,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .returning();

    logger.info('[ROADMAP_SERVICE] Roadmap record created', { roadmapID: roadmap.id });

    // Enqueue BullMQ job
    const job = await addCareerRoadmapJob({
        roadmapID: roadmap.id,
        userID,
        resumeContentID,
        questionnaire,
        creditTransactionID: creditTransaction?.id || null,
    });

    // Save the BullMQ job ID back to the record for tracking
    await db
        .update(careerRoadmapsTable)
        .set({ jobID: job.id, updatedAt: new Date() })
        .where(eq(careerRoadmapsTable.id, roadmap.id));

    logger.info('[ROADMAP_SERVICE] Job enqueued', { roadmapID: roadmap.id, jobID: job.id });

    return {
        ...roadmap,
        jobID: job.id,
    };
}

// ========== READ ==========

/**
 * Get a single roadmap by ID (verifies ownership)
 * @param {number} roadmapID
 * @param {number} userID
 * @returns {Promise<Object>}
 */
async function getRoadmap(roadmapID, userID) {
    const [roadmap] = await db
        .select()
        .from(careerRoadmapsTable)
        .where(
            and(
                eq(careerRoadmapsTable.id, roadmapID),
                eq(careerRoadmapsTable.userID, userID)
            )
        )
        .limit(1);

    if (!roadmap) {
        throw new AppError('Career roadmap not found or you do not have permission to view it', 404);
    }

    return roadmap;
}

/**
 * Get all roadmaps for a user (paginated)
 * @param {number} userID
 * @param {Object} options - { page, limit }
 * @returns {Promise<Object>} { roadmaps, total, page, limit }
 */
async function getAllRoadmaps(userID, options = {}) {
    const page = Math.max(1, parseInt(options.page || 1));
    const limit = Math.min(50, Math.max(1, parseInt(options.limit || 10)));
    const offset = (page - 1) * limit;

    const roadmaps = await db
        .select({
            id: careerRoadmapsTable.id,
            resumeContentID: careerRoadmapsTable.resumeContentID,
            questionnaire: careerRoadmapsTable.questionnaire,
            status: careerRoadmapsTable.status,
            selectedPathIndex: careerRoadmapsTable.selectedPathIndex,
            jobID: careerRoadmapsTable.jobID,
            paths: careerRoadmapsTable.paths,
            pathCount: sql`jsonb_array_length(COALESCE(${careerRoadmapsTable.paths}::jsonb, '[]'::jsonb))`,
            createdAt: careerRoadmapsTable.createdAt,
            updatedAt: careerRoadmapsTable.updatedAt,
            completedAt: careerRoadmapsTable.completedAt,
        })
        .from(careerRoadmapsTable)
        .where(eq(careerRoadmapsTable.userID, userID))
        .orderBy(desc(careerRoadmapsTable.createdAt))
        .limit(limit)
        .offset(offset);

    return { roadmaps, page, limit };
}

// ========== UPDATE ==========

/**
 * Trigger generation of a deeply detailed roadmap for the selected path
 * @param {number} roadmapID
 * @param {number} userID
 * @returns {Promise<Object>} Updated roadmap with detailedJobID
 */
async function createDetailedRoadmap(roadmapID, userID) {
    const roadmap = await getRoadmap(roadmapID, userID);

    if (roadmap.status !== 'completed') {
        throw new AppError('Career roadmap must be completed before generating a detailed path', 400);
    }

    if (roadmap.selectedPathIndex === null || roadmap.selectedPathIndex === undefined) {
        throw new AppError('Please select a path first before generating a detailed plan', 400);
    }

    if (roadmap.detailedStatus === 'processing' || roadmap.detailedStatus === 'pending') {
        throw new AppError('A detailed roadmap is already being generated', 400);
    }

    logger.info('[ROADMAP_SERVICE] Enqueuing detailed roadmap job', { roadmapID, userID, pathIndex: roadmap.selectedPathIndex });

    // Update DB status to pending
    const [updated] = await db
        .update(careerRoadmapsTable)
        .set({ detailedStatus: 'pending', updatedAt: new Date() })
        .where(eq(careerRoadmapsTable.id, roadmapID))
        .returning();

    // Enqueue BullMQ detailed job
    const job = await addDetailedRoadmapJob({
        roadmapID,
        userID,
        pathIndex: roadmap.selectedPathIndex,
    });

    // Save job ID
    await db
        .update(careerRoadmapsTable)
        .set({ detailedJobID: job.id, updatedAt: new Date() })
        .where(eq(careerRoadmapsTable.id, roadmapID));

    logger.info('[ROADMAP_SERVICE] Detailed job enqueued', { roadmapID, jobID: job.id });

    return {
        ...updated,
        detailedJobID: job.id,
    };
}

/**
 * Save the user's selected path index
 * @param {number} roadmapID
 * @param {number} userID
 * @param {number} pathIndex - 0-indexed
 * @returns {Promise<Object>} Updated roadmap
 */
async function selectPath(roadmapID, userID, pathIndex) {
    // Verify ownership + completed status
    const roadmap = await getRoadmap(roadmapID, userID);

    if (roadmap.status !== 'completed') {
        throw new AppError('Career roadmap is not yet ready — please wait for generation to complete', 400);
    }

    const paths = roadmap.paths || [];
    if (pathIndex < 0 || pathIndex >= paths.length) {
        throw new AppError(`Invalid path index. Choose between 0 and ${paths.length - 1}`, 400);
    }

    const [updated] = await db
        .update(careerRoadmapsTable)
        .set({ selectedPathIndex: pathIndex, updatedAt: new Date() })
        .where(eq(careerRoadmapsTable.id, roadmapID))
        .returning();

    logger.info('[ROADMAP_SERVICE] Path selected', { roadmapID, pathIndex, userID });
    return updated;
}

// ========== DELETE ==========

/**
 * Delete a roadmap (mark status as deleted)
 * @param {number} roadmapID
 * @param {number} userID
 */
async function deleteRoadmap(roadmapID, userID) {
    const roadmap = await getRoadmap(roadmapID, userID);

    await db
        .update(careerRoadmapsTable)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(eq(careerRoadmapsTable.id, roadmap.id));

    logger.info('[ROADMAP_SERVICE] Roadmap deleted', { roadmapID, userID });
    return { success: true };
}

export default {
    createRoadmap,
    getRoadmap,
    getAllRoadmaps,
    selectPath,
    createDetailedRoadmap,
    deleteRoadmap,
};
