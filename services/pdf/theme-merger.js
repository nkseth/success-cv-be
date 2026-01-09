/**
 * Theme Configuration Merger
 * 
 * Handles merging of base theme configs with user customizations.
 * Provides default fallbacks and validation.
 * 
 * IMPORTANT: All margin values are in INCHES for Puppeteer compatibility.
 * Spacing values are in POINTS for CSS consistency.
 */

import logger from "../../middleware/logger.js";
import {
    MARGIN_CONSTRAINTS,
    DEFAULT_MARGINS,
    FONT_SIZE_CONSTRAINTS,
    DEFAULT_SPACING,
    DEFAULT_COLORS,
    PAGE_SIZES,
    STYLE_OPTIONS,
    DEFAULT_SECTIONS,
    PRINT_SETTINGS
} from "./constants.js";

/**
 * Default theme configuration
 * Applied when no theme is specified or for missing values.
 * 
 * This is the FALLBACK config - themes from database override these values.
 * Margins: in INCHES (for @page CSS and Puppeteer)
 * Spacing/Font sizes: in POINTS (for CSS)
 */
export const DEFAULT_THEME_CONFIG = {
    layout: {
        orientation: 'portrait',
        pageSize: 'A4',
        columns: 1,
        // Margins in INCHES - used by @page CSS rule
        margins: { ...DEFAULT_MARGINS.standard },
        // Spacing in POINTS - used for CSS
        spacing: { ...DEFAULT_SPACING }
    },
    colors: { ...DEFAULT_COLORS },
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
        order: [...DEFAULT_SECTIONS.order],
        visibility: { ...DEFAULT_SECTIONS.visibility }
    },
    style: {
        borderRadius: 4,
        dividerStyle: 'solid',      // solid, dashed, dotted, none
        dividerWidth: 1,
        bulletStyle: 'disc',        // disc, circle, square, dash, none
        headingStyle: 'underline',  // underline, background, simple, accent-left
        datePosition: 'right',      // right, below
        skillsLayout: 'pills',      // pills, list, inline, grouped
        experienceLayout: 'standard', // standard, compact, detailed
        photoEnabled: false,
        photoPosition: 'right',     // left, right, center
        photoSize: 80               // pixels
    }
};

/**
 * Deep merge two objects, with source values overriding target
 * @param {Object} target - Base object
 * @param {Object} source - Override object
 * @returns {Object} Merged object
 */
const deepMerge = (target, source) => {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else if (source[key] !== undefined) {
            result[key] = source[key];
        }
    }

    return result;
};

/**
 * Merge theme configuration with defaults and custom overrides
 * @param {Object} themeConfig - Theme config from database (can be null)
 * @param {Object} customOverrides - User's custom overrides (can be null)
 * @returns {Object} Complete merged theme configuration
 */
export const mergeThemeConfig = (themeConfig = null, customOverrides = null) => {
    try {
        // Start with defaults
        let merged = { ...DEFAULT_THEME_CONFIG };

        // Merge base theme config
        if (themeConfig) {
            merged = deepMerge(merged, themeConfig);
        }

        // Apply user's custom overrides
        if (customOverrides) {
            merged = deepMerge(merged, customOverrides);
        }

        // Validate and fix any invalid values
        merged = validateThemeConfig(merged);

        return merged;
    } catch (error) {
        logger.warn('[THEME_MERGER] Error merging theme config, using defaults', {
            error: error.message
        });
        return DEFAULT_THEME_CONFIG;
    }
};

/**
 * Validate and fix theme configuration values
 * @param {Object} config - Theme configuration
 * @returns {Object} Validated configuration
 */
const validateThemeConfig = (config) => {
    // Ensure required nested objects exist
    config.layout = config.layout || DEFAULT_THEME_CONFIG.layout;
    config.colors = config.colors || DEFAULT_THEME_CONFIG.colors;
    config.typography = config.typography || DEFAULT_THEME_CONFIG.typography;
    config.sections = config.sections || DEFAULT_THEME_CONFIG.sections;
    config.style = config.style || DEFAULT_THEME_CONFIG.style;

    // Normalize and validate margins (ensure they're in inches)
    if (config.layout.margins) {
        config.layout.margins = normalizeMargins(config.layout.margins);
    } else {
        config.layout.margins = { ...DEFAULT_MARGINS.standard };
    }

    // Validate spacing (ensure in points)
    if (config.layout.spacing) {
        config.layout.spacing = normalizeSpacing(config.layout.spacing);
    } else {
        config.layout.spacing = { ...DEFAULT_SPACING };
    }

    // Validate page size
    const validPageSizes = Object.keys(PAGE_SIZES);
    if (!validPageSizes.includes(config.layout.pageSize)) {
        config.layout.pageSize = 'A4';
    }

    // Validate font size
    if (config.typography.baseFontSize) {
        config.typography.baseFontSize = clamp(
            config.typography.baseFontSize, 
            FONT_SIZE_CONSTRAINTS.min, 
            FONT_SIZE_CONSTRAINTS.max
        );
    }

    // Validate style options
    if (config.style.bulletStyle && !STYLE_OPTIONS.bulletStyles.includes(config.style.bulletStyle)) {
        config.style.bulletStyle = 'disc';
    }
    if (config.style.headingStyle && !STYLE_OPTIONS.headingStyles.includes(config.style.headingStyle)) {
        config.style.headingStyle = 'underline';
    }
    if (config.style.skillsLayout && !STYLE_OPTIONS.skillsLayouts.includes(config.style.skillsLayout)) {
        config.style.skillsLayout = 'pills';
    }

    return config;
};

/**
 * Normalize margins to inches
 * Handles values that might be in pixels or points from older theme configs
 * @param {Object} margins - Margin values
 * @returns {Object} Normalized margins in inches
 */
const normalizeMargins = (margins) => {
    const normalize = (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return MARGIN_CONSTRAINTS.default;
        }
        // If value is greater than 3, assume it's in points and convert to inches
        // (margins shouldn't be more than 3 inches, but could be 30+ points)
        if (value > 3) {
            value = value / 72; // Convert points to inches
        }
        return clamp(value, MARGIN_CONSTRAINTS.min, MARGIN_CONSTRAINTS.max);
    };

    return {
        top: normalize(margins.top),
        right: normalize(margins.right),
        bottom: normalize(margins.bottom),
        left: normalize(margins.left)
    };
};

/**
 * Normalize spacing to points
 * @param {Object} spacing - Spacing values
 * @returns {Object} Normalized spacing in points
 */
const normalizeSpacing = (spacing) => {
    const normalize = (value, defaultValue) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return defaultValue;
        }
        return clamp(value, 0, 50);
    };

    return {
        section: normalize(spacing.section, DEFAULT_SPACING.section),
        item: normalize(spacing.item, DEFAULT_SPACING.item),
        line: normalize(spacing.line, DEFAULT_SPACING.line),
        paragraph: normalize(spacing.paragraph, DEFAULT_SPACING.paragraph)
    };
};

/**
 * Clamp a number between min and max values
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};

/**
 * Get CSS variables from theme config
 * @param {Object} themeConfig - Theme configuration
 * @returns {string} CSS custom properties
 */
export const getThemeCSSVariables = (themeConfig) => {
    const config = mergeThemeConfig(themeConfig);
    
    return `
        :root {
            /* Colors - from theme */
            --color-primary: ${config.colors.primary};
            --color-secondary: ${config.colors.secondary};
            --color-accent: ${config.colors.accent};
            --color-text: ${config.colors.text};
            --color-text-light: ${config.colors.textLight};
            --color-background: ${config.colors.background};
            --color-border: ${config.colors.border};
            --color-header-bg: ${config.colors.headerBg};

            /* Typography - from theme */
            --font-family: ${config.typography.fontFamily};
            --font-family-header: ${config.typography.headerFontFamily || config.typography.fontFamily};
            --font-size-base: ${config.typography.baseFontSize}pt;
            --font-size-name: ${config.typography.sizes?.name || 24}pt;
            --font-size-title: ${config.typography.sizes?.title || 14}pt;
            --font-size-section: ${config.typography.sizes?.sectionHeading || 12}pt;
            --font-size-subheading: ${config.typography.sizes?.subheading || 11}pt;
            --font-size-body: ${config.typography.sizes?.body || 10}pt;
            --font-size-small: ${config.typography.sizes?.small || 9}pt;
            --font-weight-light: ${config.typography.weights?.light || 300};
            --font-weight-regular: ${config.typography.weights?.regular || 400};
            --font-weight-medium: ${config.typography.weights?.medium || 500};
            --font-weight-semibold: ${config.typography.weights?.semibold || 600};
            --font-weight-bold: ${config.typography.weights?.bold || 700};
            --line-height: ${config.typography.lineHeight || PRINT_SETTINGS.lineHeight};

            /* Spacing - from theme (in points) */
            --spacing-section: ${config.layout.spacing.section}pt;
            --spacing-item: ${config.layout.spacing.item}pt;
            --spacing-line: ${config.layout.spacing.line}pt;
            --spacing-paragraph: ${config.layout.spacing.paragraph || 6}pt;

            /* Style - from theme */
            --border-radius: ${config.style.borderRadius}px;
            --divider-style: ${config.style.dividerStyle};
            --divider-width: ${config.style.dividerWidth}px;
            
            /* Page info - from theme */
            --page-size: ${config.layout.pageSize};
            --margin-top: ${config.layout.margins.top}in;
            --margin-right: ${config.layout.margins.right}in;
            --margin-bottom: ${config.layout.margins.bottom}in;
            --margin-left: ${config.layout.margins.left}in;
        }
    `;
};

/**
 * Export theme config for frontend consumption
 * Returns a clean config object that can be used by frontend to render previews
 * @param {Object} themeConfig - Theme configuration from database
 * @returns {Object} Normalized theme config
 */
export const exportThemeForFrontend = (themeConfig) => {
    const config = mergeThemeConfig(themeConfig);
    
    return {
        layout: {
            pageSize: config.layout.pageSize,
            columns: config.layout.columns,
            margins: config.layout.margins,
            spacing: config.layout.spacing
        },
        colors: { ...config.colors },
        typography: {
            fontFamily: config.typography.fontFamily,
            headerFontFamily: config.typography.headerFontFamily,
            baseFontSize: config.typography.baseFontSize,
            sizes: { ...config.typography.sizes },
            weights: { ...config.typography.weights },
            lineHeight: config.typography.lineHeight
        },
        sections: {
            order: [...config.sections.order],
            visibility: { ...config.sections.visibility }
        },
        style: { ...config.style },
        // Include CSS variables as a string for easy frontend injection
        cssVariables: getThemeCSSVariables(config)
    };
};

export default {
    DEFAULT_THEME_CONFIG,
    mergeThemeConfig,
    getThemeCSSVariables,
    exportThemeForFrontend
};
