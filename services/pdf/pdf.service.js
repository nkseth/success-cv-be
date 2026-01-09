import logger from "../../middleware/logger.js";
import { AppError } from "../../middleware/error.js";
import { generateResumeHTML } from "./templates/index.js";
import { mergeThemeConfig } from "./theme-merger.js";

/**
 * PDF Service
 * 
 * Handles PDF generation for resumes using Puppeteer for high-quality rendering.
 * Supports multiple themes and customizations with a scalable template system.
 * 
 * Architecture:
 * - Templates are modular HTML/CSS generators
 * - Theme configs control styling and layout
 * - Puppeteer renders HTML to PDF with print-quality output
 */

// Lazy-load puppeteer to improve startup time
let puppeteerBrowser = null;

/**
 * Get or create a puppeteer browser instance
 * Uses a singleton pattern for efficiency
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
const getBrowser = async () => {
    if (!puppeteerBrowser) {
        const puppeteer = await import('puppeteer');
        puppeteerBrowser = await puppeteer.default.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--font-render-hinting=none'
            ]
        });

        // Handle browser disconnection
        puppeteerBrowser.on('disconnected', () => {
            puppeteerBrowser = null;
        });

        logger.info('[PDF_SERVICE] Puppeteer browser launched');
    }
    return puppeteerBrowser;
};

/**
 * Close the browser instance (for cleanup)
 */
export const closeBrowser = async () => {
    if (puppeteerBrowser) {
        await puppeteerBrowser.close();
        puppeteerBrowser = null;
        logger.info('[PDF_SERVICE] Puppeteer browser closed');
    }
};

/**
 * Generate PDF from resume content and theme
 * @param {Object} resumeContent - Structured resume content
 * @param {Object} themeConfig - Theme configuration (from database, merged with defaults)
 * @param {Object} options - Generation options
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateResumePDF = async (resumeContent, themeConfig, options = {}) => {
    const startTime = Date.now();
    let page = null;

    try {
        logger.info('[PDF_SERVICE] Generating PDF', {
            hasContent: !!resumeContent,
            hasTheme: !!themeConfig,
            options
        });

        // Merge theme config with defaults - ensures all values exist
        const finalThemeConfig = mergeThemeConfig(themeConfig);

        // Generate HTML from template (uses theme config for all styling)
        const html = generateResumeHTML(resumeContent, finalThemeConfig, options);

        // Get browser and create new page
        const browser = await getBrowser();
        page = await browser.newPage();

        // Set page content with proper encoding
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        // Get layout settings from theme config
        const pageSize = finalThemeConfig.layout?.pageSize || 'A4';
        const margins = finalThemeConfig.layout?.margins;
        
        // Ensure consistent margins from theme (already normalized in theme-merger)
        const pdfMargins = {
            top: `${margins.top}in`,
            right: `${margins.right}in`,
            bottom: `${margins.bottom}in`,
            left: `${margins.left}in`
        };

        // Configure PDF options based on theme
        const pdfOptions = {
            format: pageSize,
            printBackground: true,
            preferCSSPageSize: false,
            margin: pdfMargins,
            displayHeaderFooter: options.showPageNumbers || false,
            headerTemplate: options.showPageNumbers 
                ? '<div style="font-size: 8px; width: 100%; text-align: center;"></div>'
                : '',
            footerTemplate: options.showPageNumbers
                ? `<div style="font-size: 8px; width: 100%; text-align: center; color: #999; margin-bottom: ${margins.bottom * 0.25}in;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`
                : ''
        };

        // Generate PDF - Puppeteer returns Uint8Array, convert to Buffer for proper handling
        const pdfUint8Array = await page.pdf(pdfOptions);
        const pdfBuffer = Buffer.from(pdfUint8Array);

        const duration = Date.now() - startTime;
        logger.info('[PDF_SERVICE] ✅ PDF generated successfully', {
            sizeKB: Math.round(pdfBuffer.length / 1024),
            durationMs: duration,
            pageSize,
            margins: pdfMargins
        });

        return pdfBuffer;
    } catch (error) {
        logger.error('[PDF_SERVICE] Failed to generate PDF', {
            error: error.message,
            stack: error.stack
        });
        throw new AppError(`Failed to generate PDF: ${error.message}`, 500);
    } finally {
        // Always close the page to free resources
        if (page) {
            await page.close().catch(err => {
                logger.warn('[PDF_SERVICE] Failed to close page', { error: err.message });
            });
        }
    }
};

/**
 * Generate PDF preview (first page only, lower quality for speed)
 * @param {Object} resumeContent - Structured resume content
 * @param {Object} themeConfig - Theme configuration
 * @returns {Promise<Buffer>} PDF buffer (first page only)
 */
export const generateResumePDFPreview = async (resumeContent, themeConfig) => {
    const startTime = Date.now();
    let page = null;

    try {
        logger.info('[PDF_SERVICE] Generating PDF preview');

        // Use same theme merging as full PDF
        const finalThemeConfig = mergeThemeConfig(themeConfig);
        const html = generateResumeHTML(resumeContent, finalThemeConfig, { isPreview: true });

        const browser = await getBrowser();
        page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Use theme margins (already normalized)
        const pageSize = finalThemeConfig.layout?.pageSize || 'A4';
        const margins = finalThemeConfig.layout?.margins;

        // Generate PDF - Puppeteer returns Uint8Array, convert to Buffer for proper handling
        const pdfUint8Array = await page.pdf({
            format: pageSize,
            printBackground: true,
            preferCSSPageSize: false,
            margin: {
                top: `${margins.top}in`,
                right: `${margins.right}in`,
                bottom: `${margins.bottom}in`,
                left: `${margins.left}in`
            },
            pageRanges: '1'  // Only first page
        });
        const pdfBuffer = Buffer.from(pdfUint8Array);

        const duration = Date.now() - startTime;
        logger.info('[PDF_SERVICE] ✅ PDF preview generated', {
            sizeKB: Math.round(pdfBuffer.length / 1024),
            durationMs: duration
        });

        return pdfBuffer;
    } catch (error) {
        logger.error('[PDF_SERVICE] Failed to generate PDF preview', {
            error: error.message
        });
        throw new AppError(`Failed to generate PDF preview: ${error.message}`, 500);
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }
};

/**
 * Generate HTML preview (for testing/debugging and frontend consumption)
 * @param {Object} resumeContent - Structured resume content
 * @param {Object} themeConfig - Theme configuration
 * @returns {string} HTML string
 */
export const generateResumeHTMLPreview = (resumeContent, themeConfig) => {
    const finalThemeConfig = mergeThemeConfig(themeConfig);
    return generateResumeHTML(resumeContent, finalThemeConfig, { isPreview: true });
};

export default {
    generateResumePDF,
    generateResumePDFPreview,
    generateResumeHTMLPreview,
    closeBrowser
};
