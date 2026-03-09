import { Router } from 'express';
import { commonAuthenticate } from '../../middleware/authenticate-routes.js';
import { checkAndReserveCredits } from '../../middleware/billing.middleware.js';
import {
    createRoadmapController,
    getRoadmapController,
    getAllRoadmapsController,
    selectPathController,
    createDetailedRoadmapController,
    deleteRoadmapController,
} from '../../controllers/career-roadmap.controller.js';

const router = Router();

// All routes require authentication
router.use(commonAuthenticate);

/**
 * @route POST /api/v1/career-roadmap
 * @desc  Start AI career roadmap generation
 * @access Private
 * @note  Costs 1 credit
 * @body  { resumeContentID, questionnaire: { targetRoles, industry, timeframe, priorities, constraints? } }
 */
router.post('/', checkAndReserveCredits('career_roadmap'), createRoadmapController);

/**
 * @route GET /api/v1/career-roadmap
 * @desc  Get all career roadmaps for authenticated user
 * @access Private
 * @query page, limit
 */
router.get('/', getAllRoadmapsController);

/**
 * @route GET /api/v1/career-roadmap/:id
 * @desc  Get a specific career roadmap
 * @access Private
 */
router.get('/:id', getRoadmapController);

/**
 * @route PATCH /api/v1/career-roadmap/:id/select
 * @desc  Save user's selected career path
 * @access Private
 * @body  { pathIndex: number }
 */
router.patch('/:id/select', selectPathController);

/**
 * @route POST /api/v1/career-roadmap/:id/detailed-path
 * @desc  Trigger detailed AI career roadmap generation for selected path
 * @access Private
 */
router.post('/:id/detailed-path', createDetailedRoadmapController);

/**
 * @route DELETE /api/v1/career-roadmap/:id
 * @desc  Delete a career roadmap
 * @access Private
 */
router.delete('/:id', deleteRoadmapController);

export default router;
