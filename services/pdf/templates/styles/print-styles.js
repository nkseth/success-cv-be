/**
 * Print-Specific CSS Styles
 * 
 * Handles page breaks, orphans/widows, and multi-page rendering.
 * These styles ensure proper content flow across pages without
 * repetition or cut-off issues.
 * 
 * IMPORTANT: Uses --rp- prefix for CSS variables to match frontend
 */

import { PRINT_SETTINGS } from '../../constants.js';

/**
 * Generate print-specific CSS
 * @param {Object} config - Theme configuration
 * @returns {string} Print CSS
 */
export const getPrintStyles = (config) => {
    const pageSize = config.layout?.pageSize || 'A4';
    const margins = config.layout?.margins || { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 };
    
    return `
        /* ========== PAGE SETUP ========== */
        
        @page {
            size: ${pageSize};
            margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
        }

        @media print {
            html, body {
                width: 100%;
                height: auto;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            /* Resume container should fill the page content area */
            .resume-container {
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                overflow: visible !important;
                min-height: auto !important;
            }

            /* Two-column layout print handling */
            .resume-two-column {
                break-inside: auto;
            }

            .resume-sidebar {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* ========== PAGE BREAK CONTROL ========== */
            
            /* Sections can break between pages, but prefer to stay together */
            .section {
                break-inside: auto;
                page-break-inside: auto;
            }

            /* Header should never break */
            .header,
            .section-personal-info {
                break-inside: avoid;
                page-break-inside: avoid;
                break-after: avoid;
                page-break-after: avoid;
            }

            /* Section titles should stay with content */
            .section-title {
                break-after: avoid;
                page-break-after: avoid;
                orphans: 2;
                widows: 2;
            }

            /* Individual entries should stay together when possible */
            .entry-item,
            .experience-item,
            .education-item {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* Allow breaking inside entry items if they're too long */
            .entry-item.allow-break {
                break-inside: auto;
                page-break-inside: auto;
            }

            /* Entry headers should never separate from content */
            .entry-header {
                break-after: avoid;
                page-break-after: avoid;
            }

            /* Achievement lists can break, but keep items together */
            .entry-achievements,
            .item-list {
                break-inside: auto;
                page-break-inside: auto;
            }

            .entry-achievements li,
            .item-list li {
                break-inside: avoid;
                page-break-inside: avoid;
                orphans: ${PRINT_SETTINGS.orphans};
                widows: ${PRINT_SETTINGS.widows};
            }

            /* Skills section - pills should wrap properly */
            .skills-list,
            .skills-list-flat {
                break-inside: auto;
                page-break-inside: auto;
            }

            .skill-pill,
            .skill-pill-filled,
            .skill-tag,
            .skill-pill-light {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .skill-category,
            .skill-category-grouped {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* Skills container should allow breaking but keep groups together */
            .skills-container,
            .skills-list,
            .skills-list-flat {
                break-inside: auto;
                page-break-inside: auto;
            }

            /* Individual skill rows in grouped/inline layouts should stay together */
            .skill-category-inline {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* 2-column grid items should avoid breaking */
            .skills-grid {
                break-inside: auto;
                page-break-inside: auto;
            }

            .skill-list-item {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            /* ========== ORPHAN/WIDOW CONTROL ========== */
            
            p, li, .entry-description, .summary-text {
                orphans: ${PRINT_SETTINGS.orphans};
                widows: ${PRINT_SETTINGS.widows};
            }

            /* ========== PREVENT EMPTY PAGES ========== */
            
            /* Avoid page break before first section */
            .section:first-child {
                break-before: avoid;
                page-break-before: avoid;
            }

            /* Ensure last section has proper spacing (handled by container) */
            .section:last-child {
                break-after: auto;
                page-break-after: auto;
            }

            /* ========== LINKS AND INTERACTIVE ELEMENTS ========== */
            
            a {
                text-decoration: none;
                color: inherit;
            }

            a[href]:after {
                content: none; /* Don't show URLs after links in print */
            }

            /* ========== HIDE NON-PRINTABLE ELEMENTS ========== */
            
            .no-print,
            .print-hide {
                display: none !important;
            }

            /* ========== FORCED PAGE BREAKS ========== */
            
            .page-break-before {
                break-before: page;
                page-break-before: always;
            }

            .page-break-after {
                break-after: page;
                page-break-after: always;
            }

            .avoid-break {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }

        /* ========== SCREEN PREVIEW STYLES ========== */
        
        @media screen {
            /* Simulate page appearance on screen */
            .resume-container {
                max-width: 8.5in;
                margin: 0 auto;
                background: var(--color-background, #ffffff);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
        }
    `;
};

/**
 * Get page-safe wrapper styles
 * These ensure content respects margins without double-padding
 * Uses --rp- prefix to match frontend
 * @param {Object} config - Theme configuration
 * @returns {string} Wrapper CSS
 */
export const getPageSafeStyles = (config) => {
    const spacing = config.layout?.spacing || { section: 16, item: 10, line: 4 };
    
    return `
        /* Page-safe content wrapper */
        .resume-container {
            /* No padding here - margins handled by @page */
            padding: 0;
            margin: 0;
            width: 100%;
            box-sizing: border-box;
        }

        /* Ensure consistent section spacing */
        .section {
            margin-bottom: var(--rp-spacing-section, ${spacing.section}pt);
        }

        /* Last section should still have space from bottom edge */
        .section:last-child {
            margin-bottom: calc(var(--rp-spacing-section, ${spacing.section}pt) / 2);
        }

        /* Content wrapper for two-column layouts */
        .resume-content {
            display: contents;
        }

        /* Safe area visualization (for debugging) */
        .debug-safe-area {
            outline: 1px dashed red;
        }
    `;
};

export default {
    getPrintStyles,
    getPageSafeStyles
};
