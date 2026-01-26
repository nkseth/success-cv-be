/**
 * Resume HTML Template Generator
 * 
 * Generates professional resume HTML from structured content and theme configuration.
 * Supports multiple layout styles and is optimized for PDF rendering.
 * 
 * ARCHITECTURE:
 * - Theme config drives all styling via CSS variables
 * - Print styles handle page breaks and multi-page rendering
 * - Base styles provide the layout structure
 * - Section styles customize headings, bullets, etc.
 */

import { PAGE_SIZES, pointsToPixels } from "../constants.js";
import { getThemeCSSVariables, mergeThemeConfig } from "../theme-merger.js";
import {
    renderPersonalInfo,
    renderSummary,
    renderExperience,
    renderEducation,
    renderSkills,
    renderAdditionalSections
} from "./sections/index.js";
import { getBaseStyles } from "./styles/base-styles.js";
import { getPrintStyles, getPageSafeStyles } from "./styles/print-styles.js";

// PDF/page sizing helpers (96 DPI target)
const PX_PER_INCH = 96;
const toPxFromInches = (inches) => Number((inches * PX_PER_INCH).toFixed(3));
const toPxFromPoints = (points) => Number(pointsToPixels(points || 0).toFixed(3));
const DEFAULT_PAGE_WIDTH_PX = Math.round((PAGE_SIZES.A4?.widthIn || 8.27) * PX_PER_INCH);
const DEFAULT_PAGE_HEIGHT_PX = Math.round((PAGE_SIZES.A4?.heightIn || 11.69) * PX_PER_INCH);

/**
 * Generate complete resume HTML
 * @param {Object} resumeContent - Structured resume content
 * @param {Object} themeConfig - Theme configuration (from database)
 * @param {Object} options - Rendering options
 * @returns {string} Complete HTML document
 */
export const generateResumeHTML = (resumeContent, themeConfig, options = {}) => {
    // Merge with defaults - this ensures all values exist
    const config = mergeThemeConfig(themeConfig);
    
    // Get CSS from theme config
    const cssVariables = getThemeCSSVariables(config);
    const baseStyles = getBaseStyles(config);
    const printStyles = getPrintStyles(config);
    const pageSafeStyles = getPageSafeStyles(config);
    const layoutStyles = getLayoutStyles(config);
    const sectionStyles = getSectionStyles(config);
    
    // Render sections in configured order (from theme)
    const sectionsHTML = renderSections(resumeContent, config, options);
    
    // Get font family from theme config
    const fontFamily = config.typography?.fontFamily || 'Inter';
    const fontUrl = getFontUrl(fontFamily);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(resumeContent.personalInfo?.fullName || 'Resume')}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    ${fontUrl ? `<link href="${fontUrl}" rel="stylesheet">` : ''}
    <style>
        /* Theme CSS Variables */
        ${cssVariables}
        
        /* Print & Page Styles */
        ${printStyles}
        ${pageSafeStyles}
        
        /* Base Styles */
        ${baseStyles}
        
        /* Layout Styles */
        ${layoutStyles}
        
        /* Section Styles */
        ${sectionStyles}

        /* Frontend preview parity */
        ${buildFrontendPreviewStyles(config)}
    </style>
</head>
<body>
    <div class="resume-container">
        ${sectionsHTML}
    </div>
</body>
</html>
    `.trim();
};

/**
 * Get Google Fonts URL for a font family
 * @param {string} fontFamily - Font family name
 * @returns {string|null} Google Fonts URL or null
 */
const getFontUrl = (fontFamily) => {
    // Extract the primary font name
    const primaryFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    
    // Map of supported Google Fonts
    const googleFonts = {
        'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
        'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap',
        'Lato': 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
        'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
        'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
        'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
        'Source Sans Pro': 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap',
        'Nunito': 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap',
        'Raleway': 'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap'
    };
    
    return googleFonts[primaryFont] || googleFonts['Inter'];
};

/**
 * Map backend theme config to the CSS custom properties used by the
 * frontend resume preview so PDF output matches the on-screen design.
 * Values are converted to pixels to mirror browser rendering.
 */
const buildFrontendVariableBlock = (config) => {
        const typography = config.typography || {};
        const sizes = typography.sizes || {};
        const weights = typography.weights || {};
        const spacing = config.layout?.spacing || {};
        const margins = config.layout?.margins || {};
        const colors = config.colors || {};

        const fontFamily = typography.fontFamily || "'Montserrat', sans-serif";
        const headerFontFamily = typography.headerFontFamily || fontFamily;

        return `
:root {
    --rp-color-primary: ${colors.primary || '#6c5ce7'};
    --rp-color-secondary: ${colors.secondary || '#6c5ce7'};
    --rp-color-accent: ${colors.accent || '#fd79a8'};
    --rp-color-text: ${colors.text || '#2d3436'};
    --rp-color-text-light: ${colors.textLight || '#666666'};
    --rp-color-background: ${colors.background || '#ffffff'};
    --rp-color-border: ${colors.border || '#dddddd'};
    --rp-color-header-bg: ${colors.headerBg || '#f5f5f5'};

    --rp-font-family: ${fontFamily};
    --rp-font-family-header: ${headerFontFamily};
    --rp-font-size-name: ${toPxFromPoints(sizes.name || 24)}px;
    --rp-font-size-title: ${toPxFromPoints(sizes.title || 14)}px;
    --rp-font-size-section: ${toPxFromPoints(sizes.sectionHeading || 12)}px;
    --rp-font-size-subheading: ${toPxFromPoints(sizes.subheading || 11)}px;
    --rp-font-size-body: ${toPxFromPoints(sizes.body || 10)}px;
    --rp-font-size-small: ${toPxFromPoints(sizes.small || 9)}px;
    --rp-font-weight-light: ${weights.light || 300};
    --rp-font-weight-regular: ${weights.regular || 400};
    --rp-font-weight-medium: ${weights.medium || 500};
    --rp-font-weight-semibold: ${weights.semibold || 600};
    --rp-font-weight-bold: ${weights.bold || 700};
    --rp-line-height: ${typography.lineHeight || 1.5};

    --rp-spacing-section: ${toPxFromPoints(spacing.section || 16)}px;
    --rp-spacing-item: ${toPxFromPoints(spacing.item || 10)}px;
    --rp-spacing-line: ${toPxFromPoints(spacing.line || 4)}px;
    --rp-spacing-paragraph: ${toPxFromPoints(spacing.paragraph || 6)}px;

    --rp-margin-top: ${toPxFromInches(margins.top || 0.5)}px;
    --rp-margin-right: ${toPxFromInches(margins.right || 0.5)}px;
    --rp-margin-bottom: ${toPxFromInches(margins.bottom || 0.5)}px;
    --rp-margin-left: ${toPxFromInches(margins.left || 0.5)}px;

    --rp-border-radius: ${(config.style?.borderRadius ?? 8)}px;
    --rp-divider-width: ${(config.style?.dividerWidth ?? 1)}px;
}
`;
};

/**
 * Frontend-style CSS overrides so Puppeteer/Playwright output matches the
 * on-screen preview (colors, spacing, typography, layout).
 */
const buildFrontendPreviewStyles = (config) => {
        const pageSizeKey = config.layout?.pageSize || 'A4';
        const page = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4;
        const pageWidthPx = Math.round((page.widthIn || page.width / 72) * PX_PER_INCH) || DEFAULT_PAGE_WIDTH_PX;
        const pageHeightPx = Math.round((page.heightIn || page.height / 72) * PX_PER_INCH) || DEFAULT_PAGE_HEIGHT_PX;

        return `
${buildFrontendVariableBlock(config)}

@page {
    size: ${page.name || pageSizeKey};
    margin: 0;
}

body {
    margin: 0;
    color: var(--rp-color-text);
    font-family: var(--rp-font-family);
    font-size: var(--rp-font-size-body);
    line-height: var(--rp-line-height);
    background: var(--rp-color-background);
}

.resume-container {
    width: ${pageWidthPx}px;
    min-height: ${pageHeightPx}px;
    background-color: var(--rp-color-background);
    padding: var(--rp-margin-top) var(--rp-margin-right) var(--rp-margin-bottom) var(--rp-margin-left);
    border-radius: var(--rp-border-radius);
    position: relative;
    overflow: hidden;
    color: var(--rp-color-text);
}

@media screen {
    .resume-container {
        margin: 0 auto;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
    }
}

@media print {
    .resume-container {
        box-shadow: none;
    }
}

a {
    color: var(--rp-color-primary);
    text-decoration: none;
}

a:hover { text-decoration: underline; }

.section {
    margin-bottom: var(--rp-spacing-section);
}

.section:last-child {
    margin-bottom: calc(var(--rp-spacing-section) / 2);
}

.section-title {
    font-size: var(--rp-font-size-section);
    font-weight: var(--rp-font-weight-semibold);
    color: var(--rp-color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: var(--rp-color-header-bg);
    padding: 6px 8px;
    margin: 0 0 var(--rp-spacing-item);
    border-radius: 4px;
    border-left: 3px solid var(--rp-color-primary);
}

.header {
    padding-bottom: var(--rp-spacing-item);
    margin-bottom: var(--rp-spacing-item);
    border-bottom: 2px solid var(--rp-color-primary);
}

.header-name {
    font-size: var(--rp-font-size-name);
    font-family: var(--rp-font-family-header);
    font-weight: var(--rp-font-weight-bold);
    color: var(--rp-color-secondary);
    margin: 0 0 6px;
}

.header-title {
    font-size: var(--rp-font-size-title);
    font-weight: var(--rp-font-weight-medium);
    color: var(--rp-color-primary);
    margin: 0 0 8px;
}

.contact-info {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: var(--rp-font-size-small);
    color: var(--rp-color-text-light);
}

.contact-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.contact-item svg {
    width: 12px;
    height: 12px;
    color: var(--rp-color-text-light);
}

.summary-text,
.section-content,
.entry-description {
    font-size: var(--rp-font-size-body);
    line-height: var(--rp-line-height);
    color: var(--rp-color-text);
}

.entry-title {
    font-size: var(--rp-font-size-subheading);
    font-weight: var(--rp-font-weight-semibold);
    color: var(--rp-color-primary);
    margin: 0;
}

.entry-subtitle {
    font-size: var(--rp-font-size-body);
    font-weight: var(--rp-font-weight-medium);
    color: var(--rp-color-secondary);
    margin: 2px 0 0;
}

.entry-meta {
    font-size: var(--rp-font-size-small);
    color: var(--rp-color-text-light);
    text-align: right;
}

.entry-description ul,
.entry-description ol {
    padding-left: 18px;
    margin: 4px 0;
}

.entry-description li {
    margin: 2px 0;
}

.entry-description strong,
.entry-description b {
    font-weight: var(--rp-font-weight-semibold);
}

.skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
}

.skill-pill {
    display: inline-block;
    padding: 6px 10px;
    font-size: var(--rp-font-size-small);
    font-weight: var(--rp-font-weight-medium);
    background-color: var(--rp-color-header-bg);
    border: 1px solid var(--rp-color-border);
    border-radius: var(--rp-border-radius);
    color: var(--rp-color-primary);
}

.section-divider {
    border: none;
    border-top: var(--rp-divider-width) solid var(--rp-color-border);
    margin: var(--rp-spacing-section) 0;
}
`;
};

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Render all sections in configured order
 * @param {Object} content - Resume content
 * @param {Object} config - Theme configuration
 * @param {Object} options - Rendering options
 * @returns {string} Combined sections HTML
 */
const renderSections = (content, config, options) => {
    const sectionOrder = config.sections?.order || [
        'personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'
    ];
    const visibility = config.sections?.visibility || {};
    const columns = Number(config.layout?.columns || 1);

    const ensureArray = (value, fallback) =>
        Array.isArray(value) && value.length > 0 ? value : fallback;

    const fullWidthSections = ensureArray(config.layout?.fullWidthSections, ['personalInfo', 'summary']);
    const sidebarSections = ensureArray(config.layout?.sidebarSections, ['skills', 'additionalSections']);
    const mainSections = ensureArray(config.layout?.mainSections, ['experience', 'education']);

    const sectionRenderers = {
        personalInfo: () => renderPersonalInfo(content.personalInfo, config),
        summary: () => renderSummary(content.summary, config),
        experience: () => renderExperience(content.experience, config),
        education: () => renderEducation(content.education, config),
        skills: () => renderSkills(content.skills, config),
        additionalSections: () => renderAdditionalSections(content.additionalSections, config)
    };

    const renderedSections = sectionOrder
        .filter(section => visibility[section] !== false)
        .map(section => {
            const renderer = sectionRenderers[section];
            if (!renderer) return null;
            const html = renderer();
            if (!html) return null;
            return { name: section, html };
        })
        .filter(Boolean);

    if (columns === 2) {
        const fullWidthHTML = [];
        const sidebarHTML = [];
        const mainHTML = [];

        for (const section of renderedSections) {
            if (fullWidthSections.includes(section.name)) {
                fullWidthHTML.push(section.html);
                continue;
            }

            if (sidebarSections.includes(section.name)) {
                sidebarHTML.push(section.html);
                continue;
            }

            // Default to main column when not explicitly mapped
            mainHTML.push(section.html);
        }

        const sidebarBlock = sidebarHTML.length
            ? `<div class="resume-sidebar">${sidebarHTML.join('\n')}</div>`
            : '';
        const mainBlock = mainHTML.length
            ? `<div class="resume-main">${mainHTML.join('\n')}</div>`
            : '';

        const twoColumnBlock = (sidebarBlock || mainBlock)
            ? `
        <div class="resume-two-column">
            ${sidebarBlock}
            ${mainBlock}
        </div>
        `.trim()
            : '';

        return [
            ...fullWidthHTML,
            twoColumnBlock
        ].filter(Boolean).join('\n');
    }

    return renderedSections.map(section => section.html).join('\n');
};

/**
 * Get layout-specific CSS
 * @param {Object} config - Theme configuration
 * @returns {string} Layout CSS
 */
const getLayoutStyles = (config) => {
    const columns = config.layout?.columns || 1;
    
    if (columns === 2) {
        return `
            .resume-two-column {
                display: grid;
                grid-template-columns: minmax(220px, 1fr) minmax(340px, 2fr);
                gap: var(--spacing-section);
                align-items: start;
            }

            .resume-sidebar,
            .resume-main {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-section);
                min-width: 0;
            }

            /* Avoid double spacing inside grid columns */
            .resume-two-column .section {
                margin-bottom: 0;
            }

            .resume-two-column .section:last-child {
                margin-bottom: 0;
            }

            .section-personal-info,
            .section-summary {
                width: 100%;
            }
        `;
    }
    
    return `
        .resume-container {
            display: flex;
            flex-direction: column;
        }
    `;
};

/**
 * Get section-specific CSS based on theme style options
 * @param {Object} config - Theme configuration
 * @returns {string} Section CSS
 */
const getSectionStyles = (config) => {
    const headingStyle = config.style?.headingStyle || 'underline';
    const bulletStyle = config.style?.bulletStyle || 'disc';
    const dividerStyle = config.style?.dividerStyle || 'solid';
    
    let headingCSS = '';
    
    switch (headingStyle) {
        case 'underline':
            headingCSS = `
                .section-title {
                    border-bottom: 2px solid var(--color-primary);
                    padding-bottom: var(--spacing-line);
                    margin-bottom: var(--spacing-item);
                }
            `;
            break;
        case 'background':
            headingCSS = `
                .section-title {
                    background-color: var(--color-header-bg);
                    padding: var(--spacing-line) var(--spacing-item);
                    margin-bottom: var(--spacing-item);
                    border-left: 3px solid var(--color-primary);
                }
            `;
            break;
        case 'accent-left':
            headingCSS = `
                .section-title {
                    padding-left: var(--spacing-item);
                    border-left: 4px solid var(--color-primary);
                    margin-bottom: var(--spacing-item);
                }
            `;
            break;
        default: // simple
            headingCSS = `
                .section-title {
                    margin-bottom: var(--spacing-item);
                }
            `;
    }
    
    return `
        ${headingCSS}
        
        .item-list,
        .entry-achievements {
            list-style-type: ${bulletStyle === 'dash' ? '"— "' : bulletStyle};
            padding-left: ${bulletStyle === 'none' ? '0' : 'var(--spacing-section)'};
        }
        
        .item-list li,
        .entry-achievements li {
            margin-bottom: var(--spacing-line);
        }
        
        .item-list li:last-child,
        .entry-achievements li:last-child {
            margin-bottom: 0;
        }
        
        .section-divider {
            border: none;
            border-top: var(--divider-width) ${dividerStyle} var(--color-border);
            margin: var(--spacing-section) 0;
        }
    `;
};

export default {
    generateResumeHTML
};
