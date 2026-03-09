import { sendSuccess, sendError } from '../utils/apiHelpers.js';
import logger from '../middleware/logger.js';
import careerRoadmapService from '../services/career-roadmap.service.js';

/**
 * Career Roadmap Controller
 * Thin controller — all business logic lives in the service.
 */

/**
 * POST /api/v1/career-roadmap
 * Create a new career roadmap generation job
 *
 * Body: {
 *   resumeContentID: number,   (required)
 *   questionnaire: {           (required)
 *     targetRoles: string[],
 *     industry: string,
 *     timeframe: string,
 *     priorities: string[],
 *     constraints?: string,
 *   }
 * }
 */
export async function createRoadmapController(req, res, next) {
    try {
        const { userID } = req;
        const { resumeContentID, questionnaire } = req.body;
        const creditTransaction = req.creditTransaction;

        if (!resumeContentID) {
            return sendError(res, 'resumeContentID is required', 400);
        }
        if (!questionnaire) {
            return sendError(res, 'questionnaire is required', 400);
        }

        const roadmap = await careerRoadmapService.createRoadmap(
            userID,
            parseInt(resumeContentID),
            questionnaire,
            creditTransaction
        );

        logger.info('[ROADMAP_CTRL] Career roadmap job created', {
            roadmapID: roadmap.id,
            userID,
            jobID: roadmap.jobID,
        });

        return sendSuccess(res, {
            roadmapID: roadmap.id,
            jobID: roadmap.jobID,
            status: roadmap.status,
            message: 'Career roadmap generation started. You will be notified when it\'s ready.',
        }, 'Career roadmap generation started', 202);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/v1/career-roadmap/:id
 * Get a specific career roadmap by ID
 */
export async function getRoadmapController(req, res, next) {
    try {
        const { userID } = req;
        const roadmapID = parseInt(req.params.id);

        if (isNaN(roadmapID)) {
            return sendError(res, 'Invalid roadmap ID', 400);
        }

        const roadmap = await careerRoadmapService.getRoadmap(roadmapID, userID);
        return sendSuccess(res, { roadmap }, 'Career roadmap retrieved successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/v1/career-roadmap
 * Get all roadmaps for the authenticated user
 *
 * Query: page, limit
 */
export async function getAllRoadmapsController(req, res, next) {
    try {
        const { userID } = req;
        const { page, limit } = req.query;

        const result = await careerRoadmapService.getAllRoadmaps(userID, { page, limit });
        return sendSuccess(res, result, 'Career roadmaps retrieved successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /api/v1/career-roadmap/:id/select
 * Save the user's selected path index
 *
 * Body: { pathIndex: number }
 */
export async function selectPathController(req, res, next) {
    try {
        const { userID } = req;
        const roadmapID = parseInt(req.params.id);
        const { pathIndex } = req.body;

        if (isNaN(roadmapID)) {
            return sendError(res, 'Invalid roadmap ID', 400);
        }
        if (pathIndex === undefined || pathIndex === null) {
            return sendError(res, 'pathIndex is required', 400);
        }

        const roadmap = await careerRoadmapService.selectPath(
            roadmapID,
            userID,
            parseInt(pathIndex)
        );

        return sendSuccess(res, { roadmap }, 'Career path selected successfully');
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/v1/career-roadmap/:id/detailed-path
 * Trigger generation of a detailed roadmap for the selected path
 */
export async function createDetailedRoadmapController(req, res, next) {
    try {
        const { userID } = req;
        const roadmapID = parseInt(req.params.id);

        if (isNaN(roadmapID)) {
            return sendError(res, 'Invalid roadmap ID', 400);
        }

        const updatedRoadmap = await careerRoadmapService.createDetailedRoadmap(
            roadmapID,
            userID
        );

        return sendSuccess(res, {
            roadmapID: updatedRoadmap.id,
            detailedJobID: updatedRoadmap.detailedJobID,
            detailedStatus: updatedRoadmap.detailedStatus,
            message: 'Detailed career roadmap generation started. You will be notified when it\'s ready.',
        }, 'Detailed career roadmap generation started', 202);
    } catch (error) {
        next(error);
    }
}

/**
 * DELETE /api/v1/career-roadmap/:id
 * Delete a career roadmap
 */
export async function deleteRoadmapController(req, res, next) {
    try {
        const { userID } = req;
        const roadmapID = parseInt(req.params.id);

        if (isNaN(roadmapID)) {
            return sendError(res, 'Invalid roadmap ID', 400);
        }

        await careerRoadmapService.deleteRoadmap(roadmapID, userID);
        return sendSuccess(res, null, 'Career roadmap deleted successfully');
    } catch (error) {
        next(error);
    }
}
