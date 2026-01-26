import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger, validateString } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import resumeService from "../services/resume.service.js";
import { 
    parseQueryParams, 
    getPaginationMeta, 
    formatPaginatedResponse 
} from "../utils/pagination-filter.js";
import { userTypeConstants } from "../utils/constants.js";
import { getExamplePrompts } from "../utils/prompt-validator.js";

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
 * Create blank resume from scratch
 * POST /api/v1/resumes/blank
 * Body: { name?: string }
 */
export const createBlankResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { name } = req.body;

    logger.info('[RESUME_CONTROLLER] Creating blank resume', { userID, userType, name });

    // Validate name if provided
    const resumeName = name ? validateString(name, 'Resume name', { maxLength: 255 }) : 'Untitled Resume';

    const resume = await resumeService.createBlankResume(userID, resumeName, userType);

    sendSuccess(res, resume, 'Blank resume created successfully', 201);
});

/**
 * Get all resumes for authenticated user
 * GET /api/v1/resumes
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - q: Search in document title
 * - status: Filter by status (completed, pending, failed) - supports multiple: ?status=completed,pending
 * - createdAt: Date range filter ?createdAt=2025-01-01,2025-12-31
 * - updatedAt: Date range filter
 * - completedAt: Date range filter
 * - isDraft: Filter by draft status - supports multiple: ?isDraft=true,false
 * - sortBy: Sort field (createdAt, updatedAt, completedAt, version, atsScore)
 * - sortOrder: Sort order (asc, desc)
 */
export const getAllResumesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info('[RESUME_CONTROLLER] Fetching all resumes', { userID, userType, query: req.query });

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        filterableFields: {
            status: 'array',
            createdAt: 'dateRange',
            updatedAt: 'dateRange',
            completedAt: 'dateRange',
            isDraft: 'boolean',
        },
        sortableFields: ['createdAt', 'updatedAt', 'completedAt', 'version', 'atsScore'],
        defaultSort: { field: 'updatedAt', order: 'desc' }
    });

    const { resumes, totalCount } = await resumeService.getAllResumes(userID, {
        pagination,
        filters,
        search,
        sort,
        userType
    });

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(resumes, paginationMeta, filters);

    sendSuccess(res, response, 'Resumes fetched successfully', 200);
});

/**
 * Get resume by ID with full details
 * GET /api/v1/resumes/:id
 */
export const getResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume', { userID, userType, resumeID: validatedID });

    const resume = await resumeService.getResumeByID(validatedID, userID, userType);

    sendSuccess(res, resume, 'Resume fetched successfully');
});

/**
 * Get resume by analysis ID
 * GET /api/v1/resumes/by-analysis/:analysisId
 */
export const getResumeByAnalysisController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { analysisId } = req.params;

    const validatedID = validateInteger(analysisId, 'Analysis ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume by analysis', { userID, userType, analysisID: validatedID });

    const resume = await resumeService.getResumeByAnalysisID(validatedID, userID, userType);

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
    const userType = req.type || userTypeConstants.USER;
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
        userType,
        resumeID: validatedID,
        sectionName: validatedSection
    });

    const result = await resumeService.updateSection(
        validatedID,
        userID,
        validatedSection,
        data,
        userType
    );

    sendSuccess(res, result, 'Section updated successfully');
});

/**
 * Update multiple sections at once
 * PATCH /api/v1/resumes/:id/sections
 */
export const updateSectionsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { sections } = req.body;

    const validatedID = validateInteger(id, 'Resume ID');

    if (!sections || typeof sections !== 'object' || Object.keys(sections).length === 0) {
        throw new AppError('Sections object is required', 400);
    }

    logger.info('[RESUME_CONTROLLER] Updating multiple sections', {
        userID,
        userType,
        resumeID: validatedID,
        sectionCount: Object.keys(sections).length
    });

    const result = await resumeService.updateSections(validatedID, userID, sections, userType);

    sendSuccess(res, result, 'Sections updated successfully');
});

/**
 * Get resume formatted for rendering with theme
 * GET /api/v1/resumes/:id/render
 */
export const getResumeForRenderController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Fetching resume for render', {
        userID,
        userType,
        resumeID: validatedID
    });

    const renderData = await resumeService.getResumeForRender(validatedID, userID, userType);

    sendSuccess(res, renderData, 'Resume render data fetched successfully');
});

/**
 * Publish resume (finalize)
 * POST /api/v1/resumes/:id/publish
 */
export const publishResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    logger.info('[RESUME_CONTROLLER] Publishing resume', {
        userID,
        userType,
        resumeID: validatedID
    });

    const result = await resumeService.publishResume(validatedID, userID, userType);

    sendSuccess(res, result, 'Resume published successfully');
});

// ========== REWRITE ENDPOINTS ==========

/**
 * Create a new rewrite job based on user's optimization prompt
 * POST /api/v1/resumes/:id/rewrites
 * 
 * @body {string} prompt - REQUIRED: User's optimization goal (e.g., "Optimize for a Senior Developer role at a tech startup")
 * @body {string} versionLabel - Optional label for this rewrite version
 * @body {number} targetATSScore - Target ATS score (default: 90)
 */
export const createRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { 
        prompt,         // NEW: User's optimization goal
        versionLabel,
        targetATSScore
    } = req.body;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID, userType);

    logger.info('[RESUME_CONTROLLER] Creating user-driven rewrite', {
        userID,
        userType,
        resumeID: validatedID,
        analysisID: resume.content.analysisID,
        hasPrompt: !!prompt,
        promptPreview: prompt?.substring(0, 50)
    });

    const result = await resumeService.createRewrite(
        userID,
        resume.content.analysisID,
        {
            userPrompt: prompt,  // Pass user's optimization goal
            versionLabel,
            targetATSScore: targetATSScore ? parseInt(targetATSScore) : 90,
            userType
        }
    );

    sendSuccess(res, result, 'Rewrite job created successfully', 201);
});

/**
 * Create rewrite by analysis ID (alternative endpoint)
 * POST /api/v1/resumes/analysis/:analysisId/rewrites
 * 
 * @body {string} prompt - REQUIRED: User's optimization goal (e.g., "Optimize for a Senior Developer role at a tech startup")
 * @body {string} versionLabel - Optional label for this rewrite version
 * @body {number} targetATSScore - Target ATS score (default: 90)
 */
export const createRewriteByAnalysisController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { analysisId } = req.params;
    const { 
        prompt,         // NEW: User's optimization goal
        versionLabel,
        targetATSScore
    } = req.body;

    const validatedID = validateInteger(analysisId, 'Analysis ID');

    logger.info('[RESUME_CONTROLLER] Creating user-driven rewrite by analysis', {
        userID,
        userType,
        analysisID: validatedID,
        hasPrompt: !!prompt,
        promptPreview: prompt?.substring(0, 50)
    });

    const result = await resumeService.createRewrite(
        userID,
        validatedID,
        {
            userPrompt: prompt,  // Pass user's optimization goal
            versionLabel,
            targetATSScore: targetATSScore ? parseInt(targetATSScore) : 90,
            userType
        }
    );

    sendSuccess(res, result, 'Rewrite job created successfully', 201);
});

/**
 * Get all rewrites for a resume
 * GET /api/v1/resumes/:id/rewrites
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - status: Filter by status (pending, processing, completed, failed) - supports multiple
 * - isActive: Filter by active status
 * - createdAt: Date range filter
 * - completedAt: Date range filter
 * - sortBy: Sort field (createdAt, updatedAt, completedAt, versionNumber)
 * - sortOrder: Sort order (asc, desc)
 */
export const getRewritesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID, userType);

    logger.info('[RESUME_CONTROLLER] Fetching rewrites', {
        userID,
        userType,
        resumeID: validatedID,
        analysisID: resume.content.analysisID,
        query: req.query
    });

    // Parse query parameters
    const { pagination, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        filterableFields: {
            status: 'array',
            isActive: 'boolean',
            createdAt: 'dateRange',
            completedAt: 'dateRange',
        },
        sortableFields: ['createdAt', 'updatedAt', 'completedAt', 'versionNumber'],
        defaultSort: { field: 'createdAt', order: 'desc' }
    });

    const { rewrites, totalCount } = await resumeService.getRewritesByAnalysis(
        resume.content.analysisID,
        userID,
        { pagination, filters, sort, userType }
    );

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(rewrites, paginationMeta, filters);

    sendSuccess(res, response, 'Rewrites fetched successfully', 200);
});

/**
 * Get specific rewrite details
 * GET /api/v1/resumes/:id/rewrites/:rewriteId
 */
export const getRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { rewriteId } = req.params;

    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[RESUME_CONTROLLER] Fetching rewrite', {
        userID,
        userType,
        rewriteID: validatedRewriteID
    });

    const rewrite = await resumeService.getRewrite(validatedRewriteID, userID, userType);

    sendSuccess(res, rewrite, 'Rewrite fetched successfully');
});

/**
 * Apply a completed rewrite to resume content
 * POST /api/v1/resumes/:id/rewrites/:rewriteId/apply
 */
export const applyRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { rewriteId } = req.params;

    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[RESUME_CONTROLLER] Applying rewrite', {
        userID,
        userType,
        rewriteID: validatedRewriteID
    });

    const result = await resumeService.applyRewrite(validatedRewriteID, userID, userType);

    sendSuccess(res, result, 'Rewrite applied successfully');
});

/**
 * Switch to a different rewrite version
 * Updates resume content with the selected version's content
 * POST /api/v1/resumes/:id/rewrites/:rewriteId/switch
 */
export const switchRewriteVersionController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { rewriteId } = req.params;

    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[RESUME_CONTROLLER] Switching rewrite version', {
        userID,
        userType,
        rewriteID: validatedRewriteID
    });

    const result = await resumeService.switchRewriteVersion(validatedRewriteID, userID, userType);

    sendSuccess(res, result, result.message || 'Switched to rewrite version successfully');
});

/**
 * Get the currently active rewrite for a resume
 * GET /api/v1/resumes/:id/rewrites/active
 */
export const getActiveRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID, userType);

    logger.info('[RESUME_CONTROLLER] Fetching active rewrite', {
        userID,
        userType,
        resumeID: validatedID,
        analysisID: resume.content.analysisID
    });

    const activeRewrite = await resumeService.getActiveRewrite(resume.content.analysisID, userID, userType);

    if (!activeRewrite) {
        sendSuccess(res, null, 'No active rewrite version');
        return;
    }

    sendSuccess(res, activeRewrite, 'Active rewrite fetched successfully');
});

/**
 * Clear active rewrite (revert to manual editing mode)
 * DELETE /api/v1/resumes/:id/rewrites/active
 */
export const clearActiveRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const validatedID = validateInteger(id, 'Resume ID');

    // Get the analysis ID from resume content
    const resume = await resumeService.getResumeByID(validatedID, userID, userType);

    logger.info('[RESUME_CONTROLLER] Clearing active rewrite', {
        userID,
        userType,
        resumeID: validatedID,
        analysisID: resume.content.analysisID
    });

    const result = await resumeService.clearActiveRewrite(resume.content.analysisID, userID, userType);

    sendSuccess(res, result, 'Reverted to manual editing mode');
});

/**
 * Compare two rewrite versions
 * GET /api/v1/resumes/:id/rewrites/compare
 * Query params: version1, version2 (rewrite IDs)
 */
export const compareRewriteVersionsController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { version1, version2 } = req.query;

    const validatedVersion1 = validateInteger(version1, 'Version 1 ID');
    const validatedVersion2 = validateInteger(version2, 'Version 2 ID');

    logger.info('[RESUME_CONTROLLER] Comparing rewrite versions', {
        userID,
        userType,
        version1: validatedVersion1,
        version2: validatedVersion2
    });

    const comparison = await resumeService.compareRewriteVersions(
        validatedVersion1,
        validatedVersion2,
        userID,
        userType
    );

    sendSuccess(res, comparison, 'Rewrite versions compared successfully');
});

// ========== THEME ENDPOINTS ==========

/**
 * Get available themes
 * GET /api/v1/themes
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - q: Search in theme name or description
 * - category: Filter by category (professional, creative, minimal, ats-optimized, academic)
 * - isATSOptimized: Filter by ATS optimization
 * - isPublic: Filter by public visibility
 * - sortBy: Sort field (usageCount, createdAt, name)
 * - sortOrder: Sort order (asc, desc)
 */
export const getThemesController = asyncHandler(async (req, res, next) => {
    logger.info('[RESUME_CONTROLLER] Fetching themes', { query: req.query });

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 20,
        maxPageSize: 100,
        filterableFields: {
            category: 'string',
            isATSOptimized: 'boolean',
            isPublic: 'boolean',
        },
        sortableFields: ['usageCount', 'createdAt', 'name'],
        defaultSort: { field: 'usageCount', order: 'desc' }
    });

    const { themes, totalCount } = await resumeService.getThemes({
        pagination,
        search,
        filters,
        sort
    });

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(themes, paginationMeta, filters);

    sendSuccess(res, response, 'Themes fetched successfully', 200);
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
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { themeId, customOverrides } = req.body;

    const validatedResumeID = validateInteger(id, 'Resume ID');
    const validatedThemeID = validateInteger(themeId, 'Theme ID');

    logger.info('[RESUME_CONTROLLER] Applying theme', {
        userID,
        userType,
        resumeID: validatedResumeID,
        themeID: validatedThemeID
    });

    const result = await resumeService.applyTheme(
        validatedResumeID,
        userID,
        validatedThemeID,
        customOverrides,
        userType
    );

    sendSuccess(res, result, 'Theme applied successfully');
});

/**
 * Update theme customizations
 * PATCH /api/v1/resumes/:id/theme
 */
export const updateThemeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { customOverrides, sectionVisibility, sectionOrder } = req.body;

    const validatedResumeID = validateInteger(id, 'Resume ID');

    if (!customOverrides && !sectionVisibility && !sectionOrder) {
        throw new AppError('At least one update field is required', 400);
    }

    logger.info('[RESUME_CONTROLLER] Updating theme', {
        userID,
        userType,
        resumeID: validatedResumeID
    });

    const updates = {};
    if (customOverrides) updates.customOverrides = customOverrides;
    if (sectionVisibility) updates.sectionVisibility = sectionVisibility;
    if (sectionOrder) updates.sectionOrder = sectionOrder;

    const result = await resumeService.updateThemeConfig(
        validatedResumeID,
        userID,
        updates,
        userType
    );

    sendSuccess(res, result, 'Theme updated successfully');
});

/**
 * Get example optimization prompts
 * GET /api/v1/resumes/optimization-examples
 * 
 * Returns a list of example prompts users can use or modify
 */
export const getOptimizationExamplesController = asyncHandler(async (req, res, next) => {
    logger.info('[RESUME_CONTROLLER] Getting optimization examples');
    
    const examples = getExamplePrompts();
    
    sendSuccess(res, {
        examples,
        instructions: 'Provide a prompt describing your optimization goal. Be specific about the role, industry, or focus area you want to target.',
        tips: [
            'Be specific about the target role (e.g., "Senior Software Engineer")',
            'Mention the industry if relevant (e.g., "fintech startup")',
            'Specify any focus areas (e.g., "highlight leadership experience")',
            'Include company type if applicable (e.g., "FAANG", "enterprise", "startup")'
        ]
    }, 'Optimization examples retrieved successfully');
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
    switchRewriteVersionController,
    getActiveRewriteController,
    clearActiveRewriteController,
    compareRewriteVersionsController,
    getOptimizationExamplesController,
    // Themes
    getThemesController,
    getThemeController,
    getThemesByCategoryController,
    applyThemeController,
    updateThemeController
};
