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
    renderCertifications,
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
        const twoColumn = config.twoColumn || {};

        const fontFamily = typography.fontFamily || "'Inter', 'Segoe UI', 'Roboto', sans-serif";
        const headerFontFamily = typography.headerFontFamily || fontFamily;
        const sidebarBg = twoColumn.sidebarBg || colors.headerBg || '#f8fafc';

        return `
:root {
    --rp-color-primary: ${colors.primary || '#2563eb'};
    --rp-color-secondary: ${colors.secondary || '#1e293b'};
    --rp-color-accent: ${colors.accent || '#0ea5e9'};
    --rp-color-text: ${colors.text || '#1f2937'};
    --rp-color-text-light: ${colors.textLight || '#6b7280'};
    --rp-color-background: ${colors.background || '#ffffff'};
    --rp-color-border: ${colors.border || '#e5e7eb'};
    --rp-color-header-bg: ${colors.headerBg || '#f8fafc'};
    --rp-color-sidebar-bg: ${sidebarBg};

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

    --rp-margin-top: ${toPxFromInches(margins.top || 0.4)}px;
    --rp-margin-right: ${toPxFromInches(margins.right || 0.4)}px;
    --rp-margin-bottom: ${toPxFromInches(margins.bottom || 0.4)}px;
    --rp-margin-left: ${toPxFromInches(margins.left || 0.4)}px;

    --rp-border-radius: ${(config.style?.borderRadius ?? 4)}px;
    --rp-divider-width: ${(config.style?.dividerWidth ?? 1)}px;

    --rp-sidebar-width: ${twoColumn.sidebarWidth || 35}%;
    --rp-sidebar-padding: ${toPxFromPoints(twoColumn.sidebarPadding || 16)}px;
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
        const margins = config.layout?.margins || { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 };

        return `
${buildFrontendVariableBlock(config)}

@page {
    size: ${page.name || pageSizeKey};
    margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
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
    width: 100%;
    max-width: ${pageWidthPx}px;
    min-height: ${pageHeightPx}px;
    background-color: var(--rp-color-background);
    padding: 0;
    border-radius: 0;
    position: relative;
    overflow: visible;
    color: var(--rp-color-text);
}

@media screen {
    .resume-container {
        margin: 0 auto;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
        padding: var(--rp-margin-top) var(--rp-margin-right) var(--rp-margin-bottom) var(--rp-margin-left);
        border-radius: var(--rp-border-radius);
    }
}

@media print {
    .resume-container {
        box-shadow: none;
        padding: 0;
        overflow: visible;
        min-height: auto;
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
    margin: 0 0 var(--rp-spacing-item);
}

.header {
    padding-bottom: var(--rp-spacing-item);
    margin-bottom: var(--rp-spacing-section);
    border-bottom: 2px solid var(--rp-color-primary);
}

.header-name {
    font-size: var(--rp-font-size-name);
    font-family: var(--rp-font-family-header);
    font-weight: var(--rp-font-weight-bold);
    color: var(--rp-color-secondary);
    margin: 0;
    letter-spacing: -0.5px;
}

.header-title {
    font-size: var(--rp-font-size-title);
    font-weight: var(--rp-font-weight-medium);
    color: var(--rp-color-primary);
    margin: 4px 0 0;
}

.contact-info {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: var(--rp-font-size-small);
    color: var(--rp-color-text-light);
    margin-top: 12px;
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
    color: currentColor;
    flex-shrink: 0;
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
        'personalInfo', 'summary', 'experience', 'education', 'skills', 'certifications', 'additionalSections'
    ];
    const visibility = config.sections?.visibility || {};
    const columns = Number(config.layout?.columns || 1);

    const ensureArray = (value, fallback) =>
        Array.isArray(value) && value.length > 0 ? value : fallback;

    const fullWidthSections = ensureArray(config.layout?.fullWidthSections, ['personalInfo', 'summary']);
    const sidebarSections = ensureArray(config.layout?.sidebarSections, ['skills', 'certifications', 'additionalSections']);
    const mainSections = ensureArray(config.layout?.mainSections, ['experience', 'education']);

    const sectionRenderers = {
        personalInfo: () => renderPersonalInfo(content.personalInfo, config),
        summary: () => renderSummary(content.summary, config),
        experience: () => renderExperience(content.experience, config),
        education: () => renderEducation(content.education, config),
        skills: () => renderSkills(content.skills, config),
        certifications: () => renderCertifications(content.skills?.certifications, config),
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
    const sidebarWidth = config.twoColumn?.sidebarWidth || 35;
    const sidebarPosition = config.twoColumn?.sidebarPosition || 'left';
    const sidebarPadding = config.twoColumn?.sidebarPadding || 16;
    
    if (columns === 2) {
        // Match frontend: grid-cols-[35%_1fr] with proper sidebar styling
        const gridCols = sidebarPosition === 'left' 
            ? `${sidebarWidth}% 1fr`
            : `1fr ${sidebarWidth}%`;
        const positionClass = sidebarPosition === 'right' ? 'resume-two-column-right' : '';
        
        return `
            .resume-two-column {
                display: grid;
                grid-template-columns: ${gridCols};
                gap: var(--rp-spacing-section);
                align-items: start;
            }

            .resume-sidebar {
                padding: ${sidebarPadding}pt;
                background-color: var(--rp-color-sidebar-bg, var(--rp-color-header-bg));
                border-radius: var(--rp-border-radius);
                display: flex;
                flex-direction: column;
                gap: var(--rp-spacing-item);
                min-width: 0;
            }

            .resume-main {
                display: flex;
                flex-direction: column;
                gap: var(--rp-spacing-section);
                min-width: 0;
            }

            /* Avoid double spacing inside grid columns */
            .resume-two-column .section {
                margin-bottom: 0;
            }

            .resume-two-column .section:last-child {
                margin-bottom: 0;
            }

            /* Sidebar section title adjustments */
            .resume-sidebar .section-title {
                font-size: calc(var(--rp-font-size-section) * 0.9);
                margin-bottom: var(--rp-spacing-line);
                padding-bottom: var(--rp-spacing-line);
            }

            /* Sidebar-specific compact styling */
            .resume-sidebar .skill-category {
                margin-bottom: var(--rp-spacing-line);
            }

            .resume-sidebar .entry-item {
                margin-bottom: var(--rp-spacing-line);
            }

            /* Full width sections span above the columns */
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
            // Underline (Default): border-bottom styling
            headingCSS = `
                .section-title {
                    border-bottom: 2px solid var(--rp-color-primary);
                    padding-bottom: 4px;
                    margin-bottom: 8px;
                }
            `;
            break;
        case 'background':
            // Background: headerBg background with padding
            headingCSS = `
                .section-title {
                    background-color: var(--rp-color-header-bg);
                    padding: 4px 8px;
                    margin-bottom: 8px;
                }
            `;
            break;
        case 'accent-left':
            // Accent Left: left border styling
            headingCSS = `
                .section-title {
                    border-left: 3px solid var(--rp-color-primary);
                    padding-left: 8px;
                    margin-bottom: 8px;
                }
            `;
            break;
        default: // simple
            // Simple: clean, no decoration
            headingCSS = `
                .section-title {
                    margin-bottom: 8px;
                }
            `;
    }
    
    return `
        ${headingCSS}
        
        .item-list,
        .entry-achievements {
            list-style-type: ${bulletStyle === 'dash' ? '"— "' : bulletStyle};
            padding-left: ${bulletStyle === 'none' ? '0' : 'var(--rp-spacing-section)'};
        }
        
        .item-list li,
        .entry-achievements li {
            margin-bottom: var(--rp-spacing-line);
        }
        
        .item-list li:last-child,
        .entry-achievements li:last-child {
            margin-bottom: 0;
        }
        
        .section-divider {
            border: none;
            border-top: var(--rp-divider-width) ${dividerStyle} var(--rp-color-border);
            margin: var(--rp-spacing-section) 0;
        }
    `;
};

export default {
    generateResumeHTML
};
