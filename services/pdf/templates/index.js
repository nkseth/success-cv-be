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

    const sectionRenderers = {
        personalInfo: () => renderPersonalInfo(content.personalInfo, config),
        summary: () => renderSummary(content.summary, config),
        experience: () => renderExperience(content.experience, config),
        education: () => renderEducation(content.education, config),
        skills: () => renderSkills(content.skills, config),
        additionalSections: () => renderAdditionalSections(content.additionalSections, config)
    };

    return sectionOrder
        .filter(section => visibility[section] !== false)
        .map(section => {
            const renderer = sectionRenderers[section];
            if (!renderer) return '';
            return renderer();
        })
        .join('\n');
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
            .resume-container {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: var(--spacing-section);
            }
            
            .section-personal-info {
                grid-column: 1 / -1;
            }
            
            .section-summary {
                grid-column: 1 / -1;
            }
            
            .sidebar-section {
                grid-column: 1;
            }
            
            .main-section {
                grid-column: 2;
            }
            
            .section-skills,
            .section-additional {
                grid-column: 1;
            }
            
            .section-experience,
            .section-education {
                grid-column: 2;
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
