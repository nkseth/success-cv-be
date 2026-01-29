import { asyncHandler, AppError } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import downloadService from "../services/download.service.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Download Controller
 * 
 * Handles resume PDF download endpoints with proper streaming
 * and content disposition headers for file downloads.
 * Supports both regular users and candidates via userType.
 */

/**
 * Download resume as PDF
 * GET /api/v1/resumes/:id/download
 * 
 * Query params:
 * - format: 'pdf' (default)
 * - showPageNumbers: boolean
 * - includeTimestamp: boolean
 */
export const downloadResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { 
        format = 'pdf',
        showPageNumbers,
        includeTimestamp 
    } = req.query;

    const resumeContentID = validateInteger(id, 'Resume ID');

    logger.info('[DOWNLOAD_CONTROLLER] Resume download requested', {
        userID,
        userType,
        resumeContentID,
        format
    });

    if (format !== 'pdf') {
        throw new AppError('Only PDF format is currently supported', 400);
    }

    const result = await downloadService.downloadResumePDF(
        resumeContentID,
        userID,
        {
            showPageNumbers: showPageNumbers === 'true',
            includeTimestamp: includeTimestamp === 'true',
            userType
        }
    );

    // Set response headers for file download
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Add metadata headers
    res.setHeader('X-Resume-Version', result.metadata.version);
    res.setHeader('X-Generated-At', result.metadata.generatedAt);
    res.setHeader('X-Theme-Name', result.metadata.themeName);

    // Send the PDF buffer
    res.send(result.buffer);
});

/**
 * Download resume by analysis ID
 * GET /api/v1/resumes/analysis/:analysisId/download
 */
export const downloadResumeByAnalysisController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { analysisId } = req.params;
    const { showPageNumbers, includeTimestamp } = req.query;

    const validatedAnalysisID = validateInteger(analysisId, 'Analysis ID');

    logger.info('[DOWNLOAD_CONTROLLER] Resume download by analysis requested', {
        userID,
        userType,
        analysisId: validatedAnalysisID
    });

    const result = await downloadService.downloadResumePDFByAnalysis(
        validatedAnalysisID,
        userID,
        {
            showPageNumbers: showPageNumbers === 'true',
            includeTimestamp: includeTimestamp === 'true',
            userType
        }
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(result.buffer);
});

/**
 * Download a specific rewrite version as PDF
 * GET /api/v1/resumes/:id/rewrites/:rewriteId/download
 */
export const downloadRewriteController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id, rewriteId } = req.params;
    const { showPageNumbers, includeTimestamp } = req.query;

    // Validate both IDs
    validateInteger(id, 'Resume ID');
    const validatedRewriteID = validateInteger(rewriteId, 'Rewrite ID');

    logger.info('[DOWNLOAD_CONTROLLER] Rewrite download requested', {
        userID,
        userType,
        rewriteId: validatedRewriteID
    });

    const result = await downloadService.downloadRewritePDF(
        validatedRewriteID,
        userID,
        {
            showPageNumbers: showPageNumbers === 'true',
            includeTimestamp: includeTimestamp === 'true',
            userType
        }
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.setHeader('X-Rewrite-Version', result.metadata.versionNumber);
    if (result.metadata.versionLabel) {
        res.setHeader('X-Version-Label', result.metadata.versionLabel);
    }

    res.send(result.buffer);
});

/**
 * Get PDF preview (inline viewing, not download)
 * GET /api/v1/resumes/:id/preview
 */
export const previewResumeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { format = 'pdf' } = req.query;

    const resumeContentID = validateInteger(id, 'Resume ID');

    logger.info('[DOWNLOAD_CONTROLLER] Resume preview requested', {
        userID,
        userType,
        resumeContentID,
        format
    });

    if (format === 'html') {
        // Return HTML preview for debugging/testing
        const html = await downloadService.getHTMLPreview(resumeContentID, userID, userType);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        return;
    }

    // PDF preview
    const result = await downloadService.getPreviewPDF(resumeContentID, userID, userType);

    // Inline disposition for viewing in browser
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(result.buffer);
});

/**
 * Download with custom theme (preview with different theme)
 * POST /api/v1/resumes/:id/download/custom
 * Body: { themeId?, themeOverrides?, sectionVisibility?, sectionOrder? }
 */
export const downloadWithCustomThemeController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;
    const { 
        themeId,
        themeOverrides,
        sectionVisibility,
        sectionOrder,
        showPageNumbers,
        includeTimestamp
    } = req.body;

    const resumeContentID = validateInteger(id, 'Resume ID');

    logger.info('[DOWNLOAD_CONTROLLER] Custom theme download requested', {
        userID,
        userType,
        resumeContentID,
        hasThemeId: !!themeId,
        hasOverrides: !!themeOverrides
    });

    // Build options with custom theme settings
    const options = {
        themeOverrides,
        sectionVisibility,
        sectionOrder,
        showPageNumbers: showPageNumbers === true,
        includeTimestamp: includeTimestamp === true,
        useCache: false,  // Don't cache custom downloads
        userType
    };

    // If a specific theme ID is provided, we could fetch and apply it
    // For now, we use the provided overrides
    if (themeId) {
        // This would fetch the theme config and merge with overrides
        // Implementation would go in the service layer
        logger.info('[DOWNLOAD_CONTROLLER] Using theme ID', { themeId });
    }

    const result = await downloadService.downloadResumePDF(
        resumeContentID,
        userID,
        options
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);

    res.send(result.buffer);
});

/**
 * Get download options/info for a resume
 * GET /api/v1/resumes/:id/download/info
 * Returns available download options and resume metadata
 */
export const getDownloadInfoController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { id } = req.params;

    const resumeContentID = validateInteger(id, 'Resume ID');

    logger.info('[DOWNLOAD_CONTROLLER] Download info requested', {
        userID,
        userType,
        resumeContentID
    });

    // Get resume data for metadata
    const downloadModel = await import('../models/download.model.js');
    const resumeData = await downloadModel.default.getResumeForDownload(resumeContentID, userID, userType);

    const info = {
        resumeContentID: resumeData.metadata.id,
        version: resumeData.metadata.version,
        lastEditType: resumeData.metadata.lastEditType,
        documentTitle: resumeData.metadata.documentTitle,
        updatedAt: resumeData.metadata.updatedAt,
        theme: resumeData.theme ? {
            id: resumeData.theme.themeID,
            name: resumeData.theme.name,
            category: resumeData.theme.category,
            isATSOptimized: resumeData.theme.isATSOptimized
        } : null,
        availableFormats: ['pdf'],
        downloadOptions: {
            showPageNumbers: {
                type: 'boolean',
                default: false,
                description: 'Include page numbers in footer'
            },
            includeTimestamp: {
                type: 'boolean',
                default: false,
                description: 'Add date to filename'
            }
        },
        endpoints: {
            download: `/api/v1/resumes/${resumeContentID}/download`,
            preview: `/api/v1/resumes/${resumeContentID}/preview`,
            customDownload: `/api/v1/resumes/${resumeContentID}/download/custom`
        }
    };

    sendSuccess(res, info, 'Download info retrieved successfully');
});

export default {
    downloadResumeController,
    downloadResumeByAnalysisController,
    downloadRewriteController,
    previewResumeController,
    downloadWithCustomThemeController,
    getDownloadInfoController
};
