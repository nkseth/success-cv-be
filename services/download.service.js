import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import downloadModel from "../models/download.model.js";
import pdfService from "./pdf/pdf.service.js";
import { mergeThemeConfig } from "./pdf/theme-merger.js";
import cacheService from "./cache.service.js";

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
 * @param {number} userID - User ID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadResumePDF = async (resumeContentID, userID, options = {}) => {
    const startTime = Date.now();
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Starting PDF download', {
            resumeContentID,
            userID,
            options
        });

        // Check cache first (if caching enabled)
        if (options.useCache !== false) {
            const cacheKey = buildCacheKey('pdf', resumeContentID, options);
            const cachedPDF = await getCachedPDF(cacheKey);
            if (cachedPDF) {
                logger.info('[DOWNLOAD_SERVICE] ✅ Returning cached PDF', {
                    resumeContentID,
                    durationMs: Date.now() - startTime
                });
                return cachedPDF;
            }
        }

        // Get resume data for rendering
        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID);

        // Build theme configuration
        const themeConfig = buildThemeConfig(resumeData.theme, options.themeOverrides);

        // Apply section visibility/order from user preferences or options
        if (options.sectionVisibility) {
            themeConfig.sections = themeConfig.sections || {};
            themeConfig.sections.visibility = {
                ...themeConfig.sections.visibility,
                ...options.sectionVisibility
            };
        }

        if (options.sectionOrder) {
            themeConfig.sections = themeConfig.sections || {};
            themeConfig.sections.order = options.sectionOrder;
        }

        // Generate PDF
        const pdfBuffer = await pdfService.generateResumePDF(
            resumeData.content,
            themeConfig,
            {
                showPageNumbers: options.showPageNumbers || false
            }
        );

        // Build filename
        const filename = buildFilename(resumeData, options);

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

        // Cache the result
        if (options.useCache !== false) {
            const cacheKey = buildCacheKey('pdf', resumeContentID, options);
            await cachePDF(cacheKey, result);
        }

        const duration = Date.now() - startTime;
        logger.info('[DOWNLOAD_SERVICE] ✅ PDF generated successfully', {
            resumeContentID,
            filename,
            sizeKB: Math.round(pdfBuffer.length / 1024),
            durationMs: duration
        });

        return result;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate PDF', {
            error: error.message,
            resumeContentID,
            durationMs: Date.now() - startTime
        });
        throw error;
    }
};

/**
 * Download a specific rewrite version as PDF
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadRewritePDF = async (rewriteID, userID, options = {}) => {
    const startTime = Date.now();
    
    try {
        logger.info('[DOWNLOAD_SERVICE] Starting rewrite PDF download', {
            rewriteID,
            userID
        });

        // Get rewrite data for rendering
        const resumeData = await downloadModel.getRewriteForDownload(rewriteID, userID);

        // Build theme configuration
        const themeConfig = buildThemeConfig(resumeData.theme, options.themeOverrides);

        // Generate PDF
        const pdfBuffer = await pdfService.generateResumePDF(
            resumeData.content,
            themeConfig,
            {
                showPageNumbers: options.showPageNumbers || false
            }
        );

        // Build filename with rewrite version
        const filename = buildFilename(resumeData, {
            ...options,
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
            durationMs: duration
        });

        return result;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate rewrite PDF', {
            error: error.message,
            rewriteID
        });
        throw error;
    }
};

/**
 * Generate PDF preview (first page, lower quality)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} options - Preview options
 * @returns {Promise<Object>} PDF buffer
 */
export const getPreviewPDF = async (resumeContentID, userID, options = {}) => {
    try {
        logger.info('[DOWNLOAD_SERVICE] Generating PDF preview', {
            resumeContentID,
            userID
        });

        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID);
        const themeConfig = buildThemeConfig(resumeData.theme, options.themeOverrides);

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
            resumeContentID
        });
        throw error;
    }
};

/**
 * Generate HTML preview (for testing/debugging)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} options - Preview options
 * @returns {Promise<string>} HTML string
 */
export const getHTMLPreview = async (resumeContentID, userID, options = {}) => {
    try {
        const resumeData = await downloadModel.getResumeForDownload(resumeContentID, userID);
        const themeConfig = buildThemeConfig(resumeData.theme, options.themeOverrides);

        const html = pdfService.generateResumeHTMLPreview(
            resumeData.content,
            themeConfig
        );

        return html;
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to generate HTML preview', {
            error: error.message,
            resumeContentID
        });
        throw error;
    }
};

/**
 * Download resume by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} PDF buffer and metadata
 */
export const downloadResumePDFByAnalysis = async (analysisID, userID, options = {}) => {
    try {
        logger.info('[DOWNLOAD_SERVICE] Downloading resume by analysis', {
            analysisID,
            userID
        });

        const resumeData = await downloadModel.getResumeForDownloadByAnalysisID(analysisID, userID);
        
        // Use the regular download flow with the content ID
        return await downloadResumePDF(resumeData.metadata.id, userID, options);
    } catch (error) {
        logger.error('[DOWNLOAD_SERVICE] Failed to download by analysis', {
            error: error.message,
            analysisID
        });
        throw error;
    }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Build theme configuration from user theme and overrides
 * @param {Object} userTheme - User's applied theme
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Complete theme config
 */
const buildThemeConfig = (userTheme, overrides = null) => {
    let baseConfig = null;

    if (userTheme) {
        baseConfig = {
            ...userTheme.config,
            ...(userTheme.customOverrides || {})
        };

        // Apply section visibility/order from user theme
        if (userTheme.sectionVisibility) {
            baseConfig.sections = baseConfig.sections || {};
            baseConfig.sections.visibility = userTheme.sectionVisibility;
        }

        if (userTheme.sectionOrder) {
            baseConfig.sections = baseConfig.sections || {};
            baseConfig.sections.order = userTheme.sectionOrder;
        }
    }

    // Apply any additional overrides
    if (overrides) {
        baseConfig = baseConfig ? { ...baseConfig, ...overrides } : overrides;
    }

    return mergeThemeConfig(baseConfig);
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
        sectionVisibility: options.sectionVisibility,
        sectionOrder: options.sectionOrder
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
