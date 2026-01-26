import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import downloadModel from "../models/download.model.js";
import pdfService from "./pdf/pdf.service.js";
import { mergeThemeConfig } from "./pdf/theme-merger.js";
import cacheService from "./cache.service.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Download Service
 * 
 * Handles resume PDF generation with caching for performance.
 * Supports multiple output formats and theme configurations.
 */

// Cache TTL for generated PDFs (15 minutes)
const PDF_CACHE_TTL = 900;

/**
 * Generate and return resume PDF
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID or Candidate ID
 * @param {Object} options - Generation options including userType
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadResumePDF = async (resumeContentID, userID, options = {}) => {
    const startTime = Date.now();
    const { userType = userTypeConstants.USER, ...otherOptions } = options;
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Starting PDF download', {
            resumeContentID,
            userID,
            options,
            userType
        });

        // Get resume data for rendering (needed for cache key and PDF generation)
        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID, userType);

        // Build theme configuration - this includes all custom overrides
        const themeConfig = buildThemeConfig(resumeData.theme, otherOptions.themeOverrides);

        // Apply section visibility/order from user preferences or options
        if (otherOptions.sectionVisibility) {
            themeConfig.sections = themeConfig.sections || {};
            themeConfig.sections.visibility = {
                ...themeConfig.sections.visibility,
                ...otherOptions.sectionVisibility
            };
        }

        if (otherOptions.sectionOrder) {
            themeConfig.sections = themeConfig.sections || {};
            themeConfig.sections.order = otherOptions.sectionOrder;
        }

        // Check cache with theme-aware cache key
        if (otherOptions.useCache !== false) {
            const cacheKey = buildCacheKey('pdf', resumeContentID, {
                ...otherOptions,
                // Include theme updatedAt to invalidate cache when theme changes
                themeUpdatedAt: resumeData.theme?.updatedAt,
                themeCustomOverrides: resumeData.theme?.customOverrides,
                userType
            });
            const cachedPDF = await getCachedPDF(cacheKey);
            if (cachedPDF) {
                logger.info('[DOWNLOAD_SERVICE] ✅ Returning cached PDF', {
                    resumeContentID,
                    durationMs: Date.now() - startTime
                });
                return cachedPDF;
            }
        }

        // Generate PDF
        const pdfBuffer = await pdfService.generateResumePDF(
            resumeData.content,
            themeConfig,
            {
                showPageNumbers: otherOptions.showPageNumbers || false
            }
        );

        // Build filename
        const filename = buildFilename(resumeData, otherOptions);

        const result = {
            buffer: pdfBuffer,
            filename,
            contentType: 'application/pdf',
            metadata: {
                resumeContentID,
                version: resumeData.metadata.version,
                generatedAt: new Date().toISOString(),
                themeName: resumeData.theme?.name || 'Default',
                sizeBytes: pdfBuffer.length
            }
        };

        // Cache the result with theme-aware cache key
        if (otherOptions.useCache !== false) {
            const cacheKey = buildCacheKey('pdf', resumeContentID, {
                ...otherOptions,
                themeUpdatedAt: resumeData.theme?.updatedAt,
                themeCustomOverrides: resumeData.theme?.customOverrides,
                userType
            });
            await cachePDF(cacheKey, result);
        }

        const duration = Date.now() - startTime;
        logger.info('[DOWNLOAD_SERVICE] ✅ PDF generated successfully', {
            resumeContentID,
            filename,
            sizeKB: Math.round(pdfBuffer.length / 1024),
            durationMs: duration,
            userType
        });

        return result;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate PDF', {
            error: error.message,
            resumeContentID,
            durationMs: Date.now() - startTime,
            userType
        });
        throw error;
    }
};

/**
 * Download a specific rewrite version as PDF
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID or Candidate ID
 * @param {Object} options - Generation options including userType
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadRewritePDF = async (rewriteID, userID, options = {}) => {
    const startTime = Date.now();
    const { userType = userTypeConstants.USER, ...otherOptions } = options;
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Starting rewrite PDF download', {
            rewriteID,
            userID,
            userType
        });

        // Get rewrite data for rendering
        const resumeData = await downloadModel.getRewriteForDownload(rewriteID, userID, userType);

        // Build theme configuration
        const themeConfig = buildThemeConfig(resumeData.theme, otherOptions.themeOverrides);

        // Generate PDF
        const pdfBuffer = await pdfService.generateResumePDF(
            resumeData.content,
            themeConfig,
            {
                showPageNumbers: otherOptions.showPageNumbers || false
            }
        );

        // Build filename with rewrite version
        const filename = buildFilename(resumeData, {
            ...otherOptions,
            suffix: `_v${resumeData.metadata.versionNumber}`
        });

        const result = {
            buffer: pdfBuffer,
            filename,
            contentType: 'application/pdf',
            metadata: {
                rewriteID,
                versionNumber: resumeData.metadata.versionNumber,
                versionLabel: resumeData.metadata.versionLabel,
                generatedAt: new Date().toISOString(),
                themeName: resumeData.theme?.name || 'Default',
                sizeBytes: pdfBuffer.length
            }
        };

        const duration = Date.now() - startTime;
        logger.info('[DOWNLOAD_SERVICE] ✅ Rewrite PDF generated', {
            rewriteID,
            filename,
            sizeKB: Math.round(pdfBuffer.length / 1024),
            durationMs: duration,
            userType
        });

        return result;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate rewrite PDF', {
            error: error.message,
            rewriteID,
            userType
        });
        throw error;
    }
};

/**
 * Generate PDF preview (first page, lower quality)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID or Candidate ID
 * @param {Object} options - Preview options including userType
 * @returns {Promise<Object>} PDF buffer
 */
export const getPreviewPDF = async (resumeContentID, userID, options = {}) => {
    const { userType = userTypeConstants.USER, ...otherOptions } = options;
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Generating PDF preview', {
            resumeContentID,
            userID,
            userType
        });

        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID, userType);
        const themeConfig = buildThemeConfig(resumeData.theme, otherOptions.themeOverrides);

        const pdfBuffer = await pdfService.generateResumePDFPreview(
            resumeData.content,
            themeConfig
        );

        return {
            buffer: pdfBuffer,
            contentType: 'application/pdf'
        };
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate PDF preview', {
            error: error.message,
            resumeContentID,
            userType
        });
        throw error;
    }
};

/**
 * Generate HTML preview (for testing/debugging)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID or Candidate ID
 * @param {Object} options - Preview options including userType
 * @returns {Promise<string>} HTML string
 */
export const getHTMLPreview = async (resumeContentID, userID, options = {}) => {
    const { userType = userTypeConstants.USER, ...otherOptions } = options;
    
    try {
        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID, userType);
        const themeConfig = buildThemeConfig(resumeData.theme, otherOptions.themeOverrides);

        const html = pdfService.generateResumeHTMLPreview(
            resumeData.content,
            themeConfig
        );

        return html;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate HTML preview', {
            error: error.message,
            resumeContentID,
            userType
        });
        throw error;
    }
};

/**
 * Download resume by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID or Candidate ID
 * @param {Object} options - Generation options including userType
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadResumePDFByAnalysis = async (analysisID, userID, options = {}) => {
    const { userType = userTypeConstants.USER, ...otherOptions } = options;
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Downloading resume by analysis', {
            analysisID,
            userID,
            userType
        });

        const resumeData = await downloadModel.getResumeForDownloadByAnalysisID(analysisID, userID, userType);
        
        // Use the regular download flow with the content ID
        return await downloadResumePDF(resumeData.metadata.id, userID, { ...otherOptions, userType });
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to download by analysis', {
            error: error.message,
            analysisID,
            userType
        });
        throw error;
    }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Build theme configuration from user theme and overrides
 * Uses mergeThemeConfig to properly deep-merge theme config with custom overrides
 * @param {Object} userTheme - User's applied theme
 * @param {Object} overrides - Additional overrides from download options
 * @returns {Object} Complete theme config
 */
const buildThemeConfig = (userTheme, overrides = null) => {
    // Start with base theme config from the database
    const baseThemeConfig = userTheme?.config || null;
    
    // User's custom overrides (stored when they customize the theme)
    const userCustomOverrides = userTheme?.customOverrides || null;
    
    // First merge: base theme with user's saved customizations
    let mergedConfig = mergeThemeConfig(baseThemeConfig, userCustomOverrides);

    // Apply section visibility from user theme settings
    if (userTheme?.sectionVisibility) {
        mergedConfig.sections = mergedConfig.sections || {};
        mergedConfig.sections.visibility = {
            ...mergedConfig.sections.visibility,
            ...userTheme.sectionVisibility
        };
    }

    // Apply section order from user theme settings
    if (userTheme?.sectionOrder) {
        mergedConfig.sections = mergedConfig.sections || {};
        mergedConfig.sections.order = userTheme.sectionOrder;
    }

    // Apply any additional overrides passed in options (e.g., from download request)
    if (overrides) {
        mergedConfig = mergeThemeConfig(mergedConfig, overrides);
    }

    return mergedConfig;
};

/**
 * Build filename for download
 * @param {Object} resumeData - Resume data
 * @param {Object} options - Filename options
 * @returns {string} Filename
 */
const buildFilename = (resumeData, options = {}) => {
    const name = resumeData.content?.personalInfo?.fullName || 'Resume';
    const cleanName = name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    
    const suffix = options.suffix || '';
    const timestamp = options.includeTimestamp 
        ? `_${new Date().toISOString().split('T')[0]}`
        : '';
    
    return `${cleanName}${suffix}${timestamp}.pdf`;
};

/**
 * Build cache key for PDF
 * @param {string} type - Cache type
 * @param {number} id - Resource ID
 * @param {Object} options - Options that affect output
 * @returns {string} Cache key
 */
const buildCacheKey = (type, id, options = {}) => {
    const optionsHash = JSON.stringify({
        showPageNumbers: options.showPageNumbers,
        themeOverrides: options.themeOverrides,
        themeUpdatedAt: options.themeUpdatedAt,
        themeCustomOverrides: options.themeCustomOverrides,
        sectionVisibility: options.sectionVisibility,
        sectionOrder: options.sectionOrder,
        userType: options.userType
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < optionsHash.length; i++) {
        hash = ((hash << 5) - hash) + optionsHash.charCodeAt(i);
        hash = hash & hash;
    }
    
    return `resume:${type}:${id}:${hash}`;
};

/**
 * Get cached PDF
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} Cached result or null
 */
const getCachedPDF = async (cacheKey) => {
    try {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            // Convert base64 back to buffer
            return {
                ...cached,
                buffer: Buffer.from(cached.buffer, 'base64')
            };
        }
        return null;
    } catch (error) {
        logger.warn('[DOWNLOAD_SERVICE] Cache get failed', { error: error.message });
        return null;
    }
};

/**
 * Cache PDF result
 * @param {string} cacheKey - Cache key
 * @param {Object} result - PDF result to cache
 */
const cachePDF = async (cacheKey, result) => {
    try {
        // Convert buffer to base64 for caching
        const cacheData = {
            ...result,
            buffer: result.buffer.toString('base64')
        };
        await cacheService.set(cacheKey, cacheData, PDF_CACHE_TTL);
    } catch (error) {
        logger.warn('[DOWNLOAD_SERVICE] Cache set failed', { error: error.message });
    }
};

/**
 * Invalidate cached PDFs for a resume
 * @param {number} resumeContentID - Resume content ID
 */
export const invalidateResumeCache = async (resumeContentID) => {
    try {
        // This would require pattern-based deletion
        // For now, we rely on TTL expiration
        logger.info('[DOWNLOAD_SERVICE] Cache invalidation requested', { resumeContentID });
    } catch (error) {
        logger.warn('[DOWNLOAD_SERVICE] Cache invalidation failed', { error: error.message });
    }
};

export default {
    downloadResumePDF,
    downloadRewritePDF,
    downloadResumePDFByAnalysis,
    getPreviewPDF,
    getHTMLPreview,
    invalidateResumeCache
};
