import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import resumeService from "../services/resume.service.js";

/**
 * Resume Controller
 * 
 * Unified controller handling all resume operations:
 * - Resume content CRUD
 * - Section editing
 * - Rewrite management
 * - Theme application and customization
 */

// ========== RESUME CONTENT ENDPOINTS ==========

/**
 * Get all resumes for authenticated user
 * GET /api/v1/resumes
 */
export const getAllResumesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { limit = 50 } = req.query;

    logger.info('[RESUME_CONTROLLER] Fetching all resumes', { userID });

    const resumes = await resumeService.getAllResumes(userID, {
        limit: parseInt(limit)
    });

    sendSuccess(res, resumes, 'Resumes fetched successfully', 200, {
        count: resumes.length
    });
});

/**
 * Get resume by ID with full details
 * GET /api/v1/resumes/:id
 */
export const getResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume', { userID, resumeID: validatedID });

    const resume = await resumeService.getResumeByID(validatedID, userID);

    sendSuccess(res, resume, 'Resume fetched successfully');
});

/**
 * Get resume by analysis ID
 * GET /api/v1/resumes/by-analysis/:analysisId
 */
export const getResumeByAnalysisController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { analysisId } = req.params;

    const validatedID = validateInteger(analysisId, 'Analysis ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume by analysis', { userID, analysisID: validatedID });

    const resume = await resumeService.getResumeByAnalysisID(validatedID, userID);

    if (!resume) {
        sendSuccess(res, null, 'No resume found for this analysis', 200);
        return;
    }

    sendSuccess(res, resume, 'Resume fetched successfully');
});

/**
 * Update a single section of resume
 * PATCH /api/v1/resumes/:id/sections/:sectionName
 */
export const updateSectionController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id, sectionName } = req.params;
    const { data } = req.body;

    const validatedID = validateInteger(id, 'Resume ID');
    const validatedSection = validateString(sectionName, 'Section Name', {
        minLength: 1,
        maxLength: 50
    });

    if (data === undefined) {
        throw new AppError('Section data is required', 400);
    }

    logger.info('[RESUME_CONTROLLER] Updating section', {
        userID,
        resumeID: validatedID,
        sectionName: validatedSection
    });

    const result = await resumeService.updateSection(
        validatedID,
        userID,
        validatedSection,
        data
    );

    sendSuccess(res, result, 'Section updated successfully');
});

/**
 * Update multiple sections at once
 * PATCH /api/v1/resumes/:id/sections
 */
export const updateSectionsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;
    const { sections } = req.body;

    const validatedID = validateInteger(id, 'Resume ID');

    if (!sections || typeof sections !== 'object' || Object.keys(sections).length === 0) {
        throw new AppError('Sections object is required', 400);
    }

    logger.info('[RESUME_CONTROLLER] Updating multiple sections', {
        userID,
        resumeID: validatedID,
        sectionCount: Object.keys(sections).length
    });

    const result = await resumeService.updateSections(validatedID, userID, sections);

    sendSuccess(res, result, 'Sections updated successfully');
});

/**
 * Get resume formatted for rendering with theme
 * GET /api/v1/resumes/:id/render
 */
export const getResumeForRenderController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume for render', {
        userID,
        resumeID: validatedID
    });

    const renderData = await resumeService.getResumeForRender(validatedID, userID);

    sendSuccess(res, renderData, 'Resume render data fetched successfully');
});

/**
 * Publish resume (finalize)
 * POST /api/v1/resumes/:id/publish
 */
export const publishResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Publishing resume', {
        userID,
        resumeID: validatedID
    });

    const result = await resumeService.publishResume(validatedID, userID);

    sendSuccess(res, result, 'Resume published successfully');
});

// ========== REWRITE ENDPOINTS ==========

/**
 * Create a new rewrite job
 * POST /api/v1/resumes/:id/rewrites
 */
export const createRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;
    const { 
        versionLabel,
        targetATSScore,
        focusAreas,
        optimizationLevel 
    } = req.body;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID);

    logger.info('[RESUME_CONTROLLER] Creating rewrite', {
        userID,
        resumeID: validatedID,
        analysisID: resume.content.analysisID
    });

    const result = await resumeService.createRewrite(
        userID,
        resume.content.analysisID,
        {
            versionLabel,
            targetATSScore: targetATSScore ? parseInt(targetATSScore) : undefined,
            focusAreas,
            optimizationLevel
        }
    );

    sendSuccess(res, result, 'Rewrite job created successfully', 201);
});

/**
 * Create rewrite by analysis ID (alternative endpoint)
 * POST /api/v1/resumes/analysis/:analysisId/rewrites
 */
export const createRewriteByAnalysisController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { analysisId } = req.params;
    const { 
        versionLabel,
        targetATSScore,
        focusAreas,
        optimizationLevel 
    } = req.body;

    const validatedID = validateInteger(analysisId, 'Analysis ID');

    logger.info('[RESUME_CONTROLLER] Creating rewrite by analysis', {
        userID,
        analysisID: validatedID
    });

    const result = await resumeService.createRewrite(
        userID,
        validatedID,
        {
            versionLabel,
            targetATSScore: targetATSScore ? parseInt(targetATSScore) : undefined,
            focusAreas,
            optimizationLevel
        }
    );

    sendSuccess(res, result, 'Rewrite job created successfully', 201);
});

/**
 * Get all rewrites for a resume
 * GET /api/v1/resumes/:id/rewrites
 */
export const getRewritesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID);

    logger.info('[RESUME_CONTROLLER] Fetching rewrites', {
        userID,
        resumeID: validatedID,
        analysisID: resume.content.analysisID
    });

    const rewrites = await resumeService.getRewritesByAnalysis(
        resume.content.analysisID,
        userID
    );

    sendSuccess(res, rewrites, 'Rewrites fetched successfully', 200, {
        count: rewrites.length
    });
});

/**
 * Get specific rewrite details
 * GET /api/v1/resumes/:id/rewrites/:rewriteId
 */
export const getRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { rewriteId } = req.params;

    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[RESUME_CONTROLLER] Fetching rewrite', {
        userID,
        rewriteID: validatedRewriteID
    });

    const rewrite = await resumeService.getRewrite(validatedRewriteID, userID);

    sendSuccess(res, rewrite, 'Rewrite fetched successfully');
});

/**
 * Apply a completed rewrite to resume content
 * POST /api/v1/resumes/:id/rewrites/:rewriteId/apply
 */
export const applyRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { rewriteId } = req.params;

    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[RESUME_CONTROLLER] Applying rewrite', {
        userID,
        rewriteID: validatedRewriteID
    });

    const result = await resumeService.applyRewrite(validatedRewriteID, userID);

    sendSuccess(res, result, 'Rewrite applied successfully');
});

// ========== THEME ENDPOINTS ==========

/**
 * Get available themes
 * GET /api/v1/themes
 */
export const getThemesController = asyncHandler(async (req, res, next) => {
    const { 
        category, 
        isATSOptimized, 
        search, 
        sortBy = 'usageCount',
        limit = 50,
        offset = 0 
    } = req.query;

    logger.info('[RESUME_CONTROLLER] Fetching themes', {
        category,
        isATSOptimized
    });

    const themes = await resumeService.getThemes({
        category: category || null,
        isATSOptimized: isATSOptimized === 'true' ? true : (isATSOptimized === 'false' ? false : null),
        search: search || null,
        sortBy,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });

    sendSuccess(res, themes, 'Themes fetched successfully', 200, {
        count: themes.length
    });
});

/**
 * Get theme details
 * GET /api/v1/themes/:themeId
 */
export const getThemeController = asyncHandler(async (req, res, next) => {
    const { themeId } = req.params;

    const validatedID = validateInteger(themeId, 'Theme ID');

    logger.info('[RESUME_CONTROLLER] Fetching theme details', {
        themeID: validatedID
    });

    const theme = await resumeService.getThemeDetails(validatedID);

    sendSuccess(res, theme, 'Theme fetched successfully');
});

/**
 * Get themes by category
 * GET /api/v1/themes/category/:category
 */
export const getThemesByCategoryController = asyncHandler(async (req, res, next) => {
    const { category } = req.params;
    const { limit = 20 } = req.query;

    const validatedCategory = validateString(category, 'Category', {
        minLength: 1,
        maxLength: 50
    });

    logger.info('[RESUME_CONTROLLER] Fetching themes by category', {
        category: validatedCategory
    });

    const themes = await resumeService.getThemes({
        category: validatedCategory,
        limit: parseInt(limit)
    });

    sendSuccess(res, themes, 'Themes fetched successfully', 200, {
        count: themes.length
    });
});

/**
 * Apply theme to resume
 * POST /api/v1/resumes/:id/theme
 */
export const applyThemeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;
    const { themeId, customOverrides } = req.body;

    const validatedResumeID = validateInteger(id, 'Resume ID');
    const validatedThemeID = validateInteger(themeId, 'Theme ID');

    logger.info('[RESUME_CONTROLLER] Applying theme', {
        userID,
        resumeID: validatedResumeID,
        themeID: validatedThemeID
    });

    const result = await resumeService.applyTheme(
        validatedResumeID,
        userID,
        validatedThemeID,
        customOverrides
    );

    sendSuccess(res, result, 'Theme applied successfully');
});

/**
 * Update theme customizations
 * PATCH /api/v1/resumes/:id/theme
 */
export const updateThemeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const { id } = req.params;
    const { customOverrides, sectionVisibility, sectionOrder } = req.body;

    const validatedResumeID = validateInteger(id, 'Resume ID');

    if (!customOverrides && !sectionVisibility && !sectionOrder) {
        throw new AppError('At least one update field is required', 400);
    }

    logger.info('[RESUME_CONTROLLER] Updating theme', {
        userID,
        resumeID: validatedResumeID
    });

    const updates = {};
    if (customOverrides) updates.customOverrides = customOverrides;
    if (sectionVisibility) updates.sectionVisibility = sectionVisibility;
    if (sectionOrder) updates.sectionOrder = sectionOrder;

    const result = await resumeService.updateThemeConfig(
        validatedResumeID,
        userID,
        updates
    );

    sendSuccess(res, result, 'Theme updated successfully');
});

export default {
    // Resume content
    getAllResumesController,
    getResumeController,
    getResumeByAnalysisController,
    updateSectionController,
    updateSectionsController,
    getResumeForRenderController,
    publishResumeController,
    // Rewrites
    createRewriteController,
    createRewriteByAnalysisController,
    getRewritesController,
    getRewriteController,
    applyRewriteController,
    // Themes
    getThemesController,
    getThemeController,
    getThemesByCategoryController,
    applyThemeController,
    updateThemeController
};
