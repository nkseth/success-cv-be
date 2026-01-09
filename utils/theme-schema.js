/**
 * Theme Schema Definition
 * 
 * This file defines the complete theme configuration schema that is shared
 * between backend PDF generation and frontend resume preview.
 * 
 * USAGE:
 * - Backend: Import and use for validation and defaults
 * - Frontend: Fetch via API or copy this schema for TypeScript types
 * 
 * All margin values are in INCHES (for PDF/print compatibility)
 * All spacing/font values are in POINTS (for CSS consistency)
 */

// ========== SCHEMA DEFINITIONS ==========

/**
 * Layout configuration schema
 */
export const LAYOUT_SCHEMA = {
    orientation: {
        type: 'string',
        enum: ['portrait', 'landscape'],
        default: 'portrait',
        description: 'Page orientation'
    },
    pageSize: {
        type: 'string',
        enum: ['A4', 'Letter', 'Legal'],
        default: 'A4',
        description: 'Page size format'
    },
    columns: {
        type: 'number',
        enum: [1, 2],
        default: 1,
        description: 'Number of columns (1 = single column, 2 = sidebar layout)'
    },
    margins: {
        type: 'object',
        description: 'Page margins in INCHES',
        properties: {
            top: { type: 'number', min: 0.25, max: 1.5, default: 0.5, unit: 'inches' },
            right: { type: 'number', min: 0.25, max: 1.5, default: 0.5, unit: 'inches' },
            bottom: { type: 'number', min: 0.25, max: 1.5, default: 0.5, unit: 'inches' },
            left: { type: 'number', min: 0.25, max: 1.5, default: 0.5, unit: 'inches' }
        }
    },
    spacing: {
        type: 'object',
        description: 'Content spacing in POINTS',
        properties: {
            section: { type: 'number', min: 8, max: 32, default: 16, unit: 'pt' },
            item: { type: 'number', min: 4, max: 20, default: 10, unit: 'pt' },
            line: { type: 'number', min: 2, max: 12, default: 4, unit: 'pt' },
            paragraph: { type: 'number', min: 2, max: 12, default: 6, unit: 'pt' }
        }
    }
};

/**
 * Colors configuration schema
 */
export const COLORS_SCHEMA = {
    primary: {
        type: 'string',
        format: 'color',
        default: '#2563eb',
        description: 'Primary accent color (headers, links, accents)'
    },
    secondary: {
        type: 'string',
        format: 'color',
        default: '#1e293b',
        description: 'Secondary color (subheadings, titles)'
    },
    accent: {
        type: 'string',
        format: 'color',
        default: '#0ea5e9',
        description: 'Accent color for highlights'
    },
    text: {
        type: 'string',
        format: 'color',
        default: '#1f2937',
        description: 'Main body text color'
    },
    textLight: {
        type: 'string',
        format: 'color',
        default: '#6b7280',
        description: 'Muted/secondary text color'
    },
    background: {
        type: 'string',
        format: 'color',
        default: '#ffffff',
        description: 'Page background color'
    },
    border: {
        type: 'string',
        format: 'color',
        default: '#e5e7eb',
        description: 'Border and divider color'
    },
    headerBg: {
        type: 'string',
        format: 'color',
        default: '#f8fafc',
        description: 'Header/section background color'
    }
};

/**
 * Typography configuration schema
 */
export const TYPOGRAPHY_SCHEMA = {
    fontFamily: {
        type: 'string',
        default: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
        description: 'Primary font family for body text',
        options: [
            "'Inter', sans-serif",
            "'Roboto', sans-serif",
            "'Open Sans', sans-serif",
            "'Lato', sans-serif",
            "'Montserrat', sans-serif",
            "'Poppins', sans-serif",
            "'Source Sans Pro', sans-serif",
            "'Nunito', sans-serif",
            "'Raleway', sans-serif",
            "Georgia, serif",
            "'Playfair Display', serif",
            "'Times New Roman', serif",
            "Arial, sans-serif"
        ]
    },
    headerFontFamily: {
        type: 'string',
        default: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
        description: 'Font family for headings (can match fontFamily)'
    },
    baseFontSize: {
        type: 'number',
        min: 8,
        max: 14,
        default: 10,
        unit: 'pt',
        description: 'Base font size in points'
    },
    sizes: {
        type: 'object',
        description: 'Font sizes in POINTS',
        properties: {
            name: { type: 'number', min: 16, max: 32, default: 24, unit: 'pt' },
            title: { type: 'number', min: 10, max: 20, default: 14, unit: 'pt' },
            sectionHeading: { type: 'number', min: 10, max: 18, default: 12, unit: 'pt' },
            subheading: { type: 'number', min: 9, max: 14, default: 11, unit: 'pt' },
            body: { type: 'number', min: 8, max: 12, default: 10, unit: 'pt' },
            small: { type: 'number', min: 7, max: 10, default: 9, unit: 'pt' }
        }
    },
    weights: {
        type: 'object',
        description: 'Font weights',
        properties: {
            light: { type: 'number', enum: [100, 200, 300], default: 300 },
            regular: { type: 'number', enum: [400], default: 400 },
            medium: { type: 'number', enum: [500], default: 500 },
            semibold: { type: 'number', enum: [600], default: 600 },
            bold: { type: 'number', enum: [700, 800, 900], default: 700 }
        }
    },
    lineHeight: {
        type: 'number',
        min: 1.2,
        max: 2.0,
        default: 1.5,
        description: 'Line height multiplier'
    }
};

/**
 * Sections configuration schema
 */
export const SECTIONS_SCHEMA = {
    order: {
        type: 'array',
        items: {
            type: 'string',
            enum: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections']
        },
        default: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
        description: 'Order in which sections appear on the resume'
    },
    visibility: {
        type: 'object',
        description: 'Which sections are visible',
        properties: {
            personalInfo: { type: 'boolean', default: true },
            summary: { type: 'boolean', default: true },
            experience: { type: 'boolean', default: true },
            education: { type: 'boolean', default: true },
            skills: { type: 'boolean', default: true },
            additionalSections: { type: 'boolean', default: true }
        }
    }
};

/**
 * Style configuration schema
 */
export const STYLE_SCHEMA = {
    borderRadius: {
        type: 'number',
        min: 0,
        max: 16,
        default: 4,
        unit: 'px',
        description: 'Border radius for pills and cards'
    },
    dividerStyle: {
        type: 'string',
        enum: ['solid', 'dashed', 'dotted', 'none'],
        default: 'solid',
        description: 'Style of section dividers'
    },
    dividerWidth: {
        type: 'number',
        min: 0,
        max: 4,
        default: 1,
        unit: 'px',
        description: 'Width of divider lines'
    },
    bulletStyle: {
        type: 'string',
        enum: ['disc', 'circle', 'square', 'dash', 'none'],
        default: 'disc',
        description: 'Bullet point style for lists'
    },
    headingStyle: {
        type: 'string',
        enum: ['underline', 'background', 'accent-left', 'simple'],
        default: 'underline',
        description: 'Style of section headings'
    },
    datePosition: {
        type: 'string',
        enum: ['right', 'below', 'inline'],
        default: 'right',
        description: 'Position of dates in experience/education'
    },
    skillsLayout: {
        type: 'string',
        enum: ['pills', 'tags', 'list', 'inline', 'grouped', 'comma-separated'],
        default: 'pills',
        description: 'How skills are displayed'
    },
    experienceLayout: {
        type: 'string',
        enum: ['standard', 'compact', 'detailed'],
        default: 'standard',
        description: 'Experience section layout style'
    },
    photoEnabled: {
        type: 'boolean',
        default: false,
        description: 'Whether to show profile photo'
    },
    photoPosition: {
        type: 'string',
        enum: ['left', 'right', 'center'],
        default: 'right',
        description: 'Position of profile photo'
    },
    photoSize: {
        type: 'number',
        min: 40,
        max: 120,
        default: 80,
        unit: 'px',
        description: 'Size of profile photo'
    }
};

// ========== COMPLETE SCHEMA ==========

/**
 * Complete theme configuration schema
 */
export const THEME_CONFIG_SCHEMA = {
    layout: LAYOUT_SCHEMA,
    colors: COLORS_SCHEMA,
    typography: TYPOGRAPHY_SCHEMA,
    sections: SECTIONS_SCHEMA,
    style: STYLE_SCHEMA
};

// ========== DEFAULT VALUES ==========

/**
 * Extract default values from schema
 * @param {Object} schema - Schema object
 * @returns {Object} Default values
 */
const extractDefaults = (schema) => {
    const defaults = {};
    
    for (const [key, config] of Object.entries(schema)) {
        if (config.properties) {
            defaults[key] = extractDefaults(config.properties);
        } else if (config.default !== undefined) {
            defaults[key] = config.default;
        }
    }
    
    return defaults;
};

/**
 * Default theme configuration (derived from schema)
 */
export const DEFAULT_THEME = {
    layout: {
        orientation: 'portrait',
        pageSize: 'A4',
        columns: 1,
        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
        spacing: { section: 16, item: 10, line: 4, paragraph: 6 }
    },
    colors: {
        primary: '#2563eb',
        secondary: '#1e293b',
        accent: '#0ea5e9',
        text: '#1f2937',
        textLight: '#6b7280',
        background: '#ffffff',
        border: '#e5e7eb',
        headerBg: '#f8fafc'
    },
    typography: {
        fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
        headerFontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
        baseFontSize: 10,
        sizes: {
            name: 24,
            title: 14,
            sectionHeading: 12,
            subheading: 11,
            body: 10,
            small: 9
        },
        weights: {
            light: 300,
            regular: 400,
            medium: 500,
            semibold: 600,
            bold: 700
        },
        lineHeight: 1.5
    },
    sections: {
        order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
        visibility: {
            personalInfo: true,
            summary: true,
            experience: true,
            education: true,
            skills: true,
            additionalSections: true
        }
    },
    style: {
        borderRadius: 4,
        dividerStyle: 'solid',
        dividerWidth: 1,
        bulletStyle: 'disc',
        headingStyle: 'underline',
        datePosition: 'right',
        skillsLayout: 'pills',
        experienceLayout: 'standard',
        photoEnabled: false,
        photoPosition: 'right',
        photoSize: 80
    }
};

// ========== VALIDATION HELPERS ==========

/**
 * Validate a color string
 * @param {string} color - Color value
 * @returns {boolean} Is valid color
 */
export const isValidColor = (color) => {
    if (!color || typeof color !== 'string') return false;
    // Hex color
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) return true;
    // RGB/RGBA
    if (/^rgba?\(.+\)$/.test(color)) return true;
    // HSL/HSLA
    if (/^hsla?\(.+\)$/.test(color)) return true;
    return false;
};

/**
 * Validate theme configuration against schema
 * @param {Object} config - Theme configuration
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateThemeConfig = (config) => {
    const errors = [];
    
    // Validate layout
    if (config.layout) {
        if (config.layout.pageSize && !['A4', 'Letter', 'Legal'].includes(config.layout.pageSize)) {
            errors.push(`Invalid pageSize: ${config.layout.pageSize}`);
        }
        if (config.layout.columns && ![1, 2].includes(config.layout.columns)) {
            errors.push(`Invalid columns: ${config.layout.columns}`);
        }
        if (config.layout.margins) {
            for (const [side, value] of Object.entries(config.layout.margins)) {
                if (typeof value !== 'number' || value < 0.25 || value > 1.5) {
                    errors.push(`Invalid margin.${side}: ${value} (must be 0.25-1.5 inches)`);
                }
            }
        }
    }
    
    // Validate colors
    if (config.colors) {
        for (const [key, value] of Object.entries(config.colors)) {
            if (value && !isValidColor(value)) {
                errors.push(`Invalid color.${key}: ${value}`);
            }
        }
    }
    
    // Validate typography
    if (config.typography) {
        if (config.typography.baseFontSize) {
            const size = config.typography.baseFontSize;
            if (typeof size !== 'number' || size < 8 || size > 14) {
                errors.push(`Invalid baseFontSize: ${size} (must be 8-14)`);
            }
        }
        if (config.typography.lineHeight) {
            const lh = config.typography.lineHeight;
            if (typeof lh !== 'number' || lh < 1.2 || lh > 2.0) {
                errors.push(`Invalid lineHeight: ${lh} (must be 1.2-2.0)`);
            }
        }
    }
    
    // Validate style options
    if (config.style) {
        const validBullets = ['disc', 'circle', 'square', 'dash', 'none'];
        if (config.style.bulletStyle && !validBullets.includes(config.style.bulletStyle)) {
            errors.push(`Invalid bulletStyle: ${config.style.bulletStyle}`);
        }
        
        const validHeadings = ['underline', 'background', 'accent-left', 'simple'];
        if (config.style.headingStyle && !validHeadings.includes(config.style.headingStyle)) {
            errors.push(`Invalid headingStyle: ${config.style.headingStyle}`);
        }
        
        const validSkillsLayouts = ['pills', 'tags', 'list', 'inline', 'grouped', 'comma-separated'];
        if (config.style.skillsLayout && !validSkillsLayouts.includes(config.style.skillsLayout)) {
            errors.push(`Invalid skillsLayout: ${config.style.skillsLayout}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

// ========== CSS GENERATION FOR FRONTEND ==========

/**
 * Generate CSS variables from theme config for frontend use
 * This allows frontend to render previews matching backend PDF output
 * @param {Object} config - Theme configuration
 * @returns {string} CSS custom properties
 */
export const generateCSSVariables = (config) => {
    const theme = { ...DEFAULT_THEME, ...config };
    
    return `
:root {
    /* Colors */
    --color-primary: ${theme.colors.primary};
    --color-secondary: ${theme.colors.secondary};
    --color-accent: ${theme.colors.accent};
    --color-text: ${theme.colors.text};
    --color-text-light: ${theme.colors.textLight};
    --color-background: ${theme.colors.background};
    --color-border: ${theme.colors.border};
    --color-header-bg: ${theme.colors.headerBg};

    /* Typography */
    --font-family: ${theme.typography.fontFamily};
    --font-family-header: ${theme.typography.headerFontFamily || theme.typography.fontFamily};
    --font-size-base: ${theme.typography.baseFontSize}pt;
    --font-size-name: ${theme.typography.sizes.name}pt;
    --font-size-title: ${theme.typography.sizes.title}pt;
    --font-size-section: ${theme.typography.sizes.sectionHeading}pt;
    --font-size-subheading: ${theme.typography.sizes.subheading}pt;
    --font-size-body: ${theme.typography.sizes.body}pt;
    --font-size-small: ${theme.typography.sizes.small}pt;
    --font-weight-light: ${theme.typography.weights.light};
    --font-weight-regular: ${theme.typography.weights.regular};
    --font-weight-medium: ${theme.typography.weights.medium};
    --font-weight-semibold: ${theme.typography.weights.semibold};
    --font-weight-bold: ${theme.typography.weights.bold};
    --line-height: ${theme.typography.lineHeight};

    /* Spacing */
    --spacing-section: ${theme.layout.spacing.section}pt;
    --spacing-item: ${theme.layout.spacing.item}pt;
    --spacing-line: ${theme.layout.spacing.line}pt;
    --spacing-paragraph: ${theme.layout.spacing.paragraph || 6}pt;

    /* Page Layout */
    --page-size: ${theme.layout.pageSize};
    --margin-top: ${theme.layout.margins.top}in;
    --margin-right: ${theme.layout.margins.right}in;
    --margin-bottom: ${theme.layout.margins.bottom}in;
    --margin-left: ${theme.layout.margins.left}in;

    /* Style */
    --border-radius: ${theme.style.borderRadius}px;
    --divider-style: ${theme.style.dividerStyle};
    --divider-width: ${theme.style.dividerWidth}px;
}
    `.trim();
};

export default {
    THEME_CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    COLORS_SCHEMA,
    TYPOGRAPHY_SCHEMA,
    SECTIONS_SCHEMA,
    STYLE_SCHEMA,
    DEFAULT_THEME,
    isValidColor,
    validateThemeConfig,
    generateCSSVariables
};
