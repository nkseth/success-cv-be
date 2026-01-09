import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import {
    // Resume content endpoints
    getAllResumesController,
    getResumeController,
    getResumeByAnalysisController,
    updateSectionController,
    updateSectionsController,
    getResumeForRenderController,
    publishResumeController,
    // Rewrite endpoints
    createRewriteController,
    createRewriteByAnalysisController,
    getRewritesController,
    getRewriteController,
    applyRewriteController,
    switchRewriteVersionController,
    getActiveRewriteController,
    clearActiveRewriteController,
    compareRewriteVersionsController,
    // Theme endpoints
    getThemesController,
    getThemeController,
    getThemesByCategoryController,
    applyThemeController,
    updateThemeController
} from "../../controllers/resume.controller.js";
import {
    // Download endpoints
    downloadResumeController,
    downloadResumeByAnalysisController,
    downloadRewriteController,
    previewResumeController,
    downloadWithCustomThemeController,
    getDownloadInfoController
} from "../../controllers/download.controller.js";

const router = Router();

// ========== HEALTH CHECK ==========

router.get('/health', (req, res) => {
    logger.info("API v1 Resume health route accessed");
    sendSuccess(res, null, "Success-CV API v1 Resume System is healthy");
});

// ========== PUBLIC THEME ROUTES (No Auth Required) ==========

/**
 * @route GET /api/v1/resumes/themes
 * @desc Get all available themes
 * @access Public
 * @query category, isATSOptimized, search, sortBy, limit, offset
 */
router.get('/themes', getThemesController);

/**
 * @route GET /api/v1/resumes/themes/category/:category
 * @desc Get themes by category
 * @access Public
 * @query limit
 */
router.get('/themes/category/:category', getThemesByCategoryController);

/**
 * @route GET /api/v1/resumes/themes/:themeId
 * @desc Get theme details
 * @access Public
 */
router.get('/themes/:themeId', getThemeController);

// ========== PROTECTED ROUTES (Auth Required) ==========

router.use(commonAuthenticate);

// ========== RESUME CONTENT ROUTES ==========

/**
 * @route GET /api/v1/resumes
 * @desc Get all resumes for authenticated user
 * @access Private
 * @query limit
 */
router.get('/', getAllResumesController);

/**
 * @route GET /api/v1/resumes/by-analysis/:analysisId
 * @desc Get resume by analysis ID
 * @access Private
 */
router.get('/by-analysis/:analysisId', getResumeByAnalysisController);

/**
 * @route GET /api/v1/resumes/analysis/:analysisId/download
 * @desc Download resume by analysis ID
 * @access Private
 */
router.get('/analysis/:analysisId/download', downloadResumeByAnalysisController);

/**
 * @route GET /api/v1/resumes/:id
 * @desc Get resume by ID with full details
 * @access Private
 */
router.get('/:id', getResumeController);

/**
 * @route GET /api/v1/resumes/:id/render
 * @desc Get resume formatted for rendering with applied theme
 * @access Private
 */
router.get('/:id/render', getResumeForRenderController);

/**
 * @route PATCH /api/v1/resumes/:id/sections/:sectionName
 * @desc Update a single section of resume
 * @access Private
 * @body { data: <section data> }
 */
router.patch('/:id/sections/:sectionName', updateSectionController);

/**
 * @route PATCH /api/v1/resumes/:id/sections
 * @desc Update multiple sections at once
 * @access Private
 * @body { sections: { sectionName: data, ... } }
 */
router.patch('/:id/sections', updateSectionsController);

/**
 * @route POST /api/v1/resumes/:id/publish
 * @desc Publish/finalize resume
 * @access Private
 */
router.post('/:id/publish', publishResumeController);

// ========== REWRITE ROUTES ==========

/**
 * @route POST /api/v1/resumes/:id/rewrites
 * @desc Create a new rewrite job for resume
 * @access Private
 * @body { versionLabel?, targetATSScore?, focusAreas?, optimizationLevel? }
 */
router.post('/:id/rewrites', createRewriteController);

/**
 * @route POST /api/v1/resumes/analysis/:analysisId/rewrites
 * @desc Create a new rewrite job by analysis ID
 * @access Private
 * @body { versionLabel?, targetATSScore?, focusAreas?, optimizationLevel? }
 */
router.post('/analysis/:analysisId/rewrites', createRewriteByAnalysisController);

/**
 * @route GET /api/v1/resumes/:id/rewrites
 * @desc Get all rewrites for a resume
 * @access Private
 */
router.get('/:id/rewrites', getRewritesController);

/**
 * @route GET /api/v1/resumes/:id/rewrites/active
 * @desc Get the currently active rewrite for a resume
 * @access Private
 * @note This must come before /:rewriteId to avoid route conflicts
 */
router.get('/:id/rewrites/active', getActiveRewriteController);

/**
 * @route DELETE /api/v1/resumes/:id/rewrites/active
 * @desc Clear active rewrite (revert to manual editing mode)
 * @access Private
 */
router.delete('/:id/rewrites/active', clearActiveRewriteController);

/**
 * @route GET /api/v1/resumes/:id/rewrites/compare
 * @desc Compare two rewrite versions
 * @access Private
 * @query version1, version2 (rewrite IDs)
 * @note This must come before /:rewriteId to avoid route conflicts
 */
router.get('/:id/rewrites/compare', compareRewriteVersionsController);

/**
 * @route GET /api/v1/resumes/:id/rewrites/:rewriteId
 * @desc Get specific rewrite details
 * @access Private
 */
router.get('/:id/rewrites/:rewriteId', getRewriteController);

/**
 * @route POST /api/v1/resumes/:id/rewrites/:rewriteId/apply
 * @desc Apply a completed rewrite to resume content
 * @access Private
 */
router.post('/:id/rewrites/:rewriteId/apply', applyRewriteController);

/**
 * @route POST /api/v1/resumes/:id/rewrites/:rewriteId/switch
 * @desc Switch to a different rewrite version (updates resume content)
 * @access Private
 */
router.post('/:id/rewrites/:rewriteId/switch', switchRewriteVersionController);

// ========== THEME APPLICATION ROUTES ==========

/**
 * @route POST /api/v1/resumes/:id/theme
 * @desc Apply a theme to resume
 * @access Private
 * @body { themeId, customOverrides? }
 */
router.post('/:id/theme', applyThemeController);

/**
 * @route PATCH /api/v1/resumes/:id/theme
 * @desc Update theme customizations
 * @access Private
 * @body { customOverrides?, sectionVisibility?, sectionOrder? }
 */
router.patch('/:id/theme', updateThemeController);

// ========== DOWNLOAD ROUTES ==========

/**
 * @route GET /api/v1/resumes/:id/download
 * @desc Download resume as PDF
 * @access Private
 * @query format (pdf), showPageNumbers, includeTimestamp
 */
router.get('/:id/download', downloadResumeController);

/**
 * @route GET /api/v1/resumes/:id/download/info
 * @desc Get download options and resume metadata
 * @access Private
 */
router.get('/:id/download/info', getDownloadInfoController);

/**
 * @route POST /api/v1/resumes/:id/download/custom
 * @desc Download with custom theme settings
 * @access Private
 * @body { themeId?, themeOverrides?, sectionVisibility?, sectionOrder?, showPageNumbers?, includeTimestamp? }
 */
router.post('/:id/download/custom', downloadWithCustomThemeController);

/**
 * @route GET /api/v1/resumes/:id/preview
 * @desc Get PDF preview (inline viewing)
 * @access Private
 * @query format (pdf|html)
 */
router.get('/:id/preview', previewResumeController);

/**
 * @route GET /api/v1/resumes/:id/rewrites/:rewriteId/download
 * @desc Download a specific rewrite version as PDF
 * @access Private
 * @query showPageNumbers, includeTimestamp
 */
router.get('/:id/rewrites/:rewriteId/download', downloadRewriteController);

export const resumeRoutes = router;
