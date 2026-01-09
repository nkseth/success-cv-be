/**
 * PDF/Print Constants
 * 
 * Shared constants for PDF generation and print styling.
 * These values ensure consistency between theme configs and PDF output.
 */

// ========== PAGE DIMENSIONS ==========

/**
 * Standard page sizes in points (1 inch = 72 points)
 * These match Puppeteer's expected format names
 */
export const PAGE_SIZES = {
    A4: {
        name: 'A4',
        width: 595,     // 8.27 inches
        height: 842,    // 11.69 inches
        widthIn: 8.27,
        heightIn: 11.69
    },
    Letter: {
        name: 'Letter',
        width: 612,     // 8.5 inches
        height: 792,    // 11 inches
        widthIn: 8.5,
        heightIn: 11
    },
    Legal: {
        name: 'Legal',
        width: 612,     // 8.5 inches
        height: 1008,   // 14 inches
        widthIn: 8.5,
        heightIn: 14
    }
};

// ========== MARGIN CONSTRAINTS ==========

/**
 * Margin constraints (in inches)
 * Min ensures content doesn't bleed, max keeps content readable
 */
export const MARGIN_CONSTRAINTS = {
    min: 0.25,
    max: 1.5,
    default: 0.3
};

/**
 * Default margins for different contexts
 */
export const DEFAULT_MARGINS = {
    // Standard balanced margins (in inches)
    standard: {
        top: 0.3,
        right: 0.3,
        bottom: 0.3,
        left: 0.3
    },
    // Compact for more content
    compact: {
        top: 0.25,
        right: 0.25,
        bottom: 0.25,
        left: 0.25
    },
    // Generous for executive/premium look
    generous: {
        top: 0.5,
        right: 0.5,
        bottom: 0.5,
        left: 0.5
    }
};

// ========== UNIT CONVERSIONS ==========

/**
 * Points per inch (for PDF/print)
 */
export const POINTS_PER_INCH = 72;

/**
 * Convert inches to points
 * @param {number} inches 
 * @returns {number} points
 */
export const inchesToPoints = (inches) => inches * POINTS_PER_INCH;

/**
 * Convert points to inches
 * @param {number} points 
 * @returns {number} inches
 */
export const pointsToInches = (points) => points / POINTS_PER_INCH;

/**
 * Convert pixels to points (assuming 96 DPI screen)
 * @param {number} pixels 
 * @returns {number} points
 */
export const pixelsToPoints = (pixels) => pixels * 0.75;

/**
 * Convert points to pixels (assuming 96 DPI screen)
 * @param {number} points 
 * @returns {number} pixels
 */
export const pointsToPixels = (points) => points / 0.75;

// ========== TYPOGRAPHY SCALES ==========

/**
 * Font size constraints (in points)
 */
export const FONT_SIZE_CONSTRAINTS = {
    min: 8,
    max: 32,
    defaultBody: 10
};

/**
 * Standard typography scale for resumes
 * All values in points for print consistency
 */
export const TYPOGRAPHY_SCALE = {
    xs: 8,
    sm: 9,
    base: 10,
    md: 11,
    lg: 12,
    xl: 14,
    '2xl': 16,
    '3xl': 18,
    '4xl': 20,
    '5xl': 24,
    '6xl': 28
};

// ========== SPACING SYSTEM ==========

/**
 * Spacing scale in points
 * Consistent spacing for sections, items, and elements
 */
export const SPACING_SCALE = {
    none: 0,
    xs: 2,
    sm: 4,
    md: 6,
    base: 8,
    lg: 10,
    xl: 12,
    '2xl': 16,
    '3xl': 20,
    '4xl': 24,
    '5xl': 32
};

/**
 * Default spacing values
 */
export const DEFAULT_SPACING = {
    section: 16,    // Between major sections
    item: 10,       // Between items in a list
    line: 4,        // Between lines of text
    paragraph: 6    // Between paragraphs
};

// ========== COLOR DEFAULTS ==========

/**
 * Default color palette
 * These are fallbacks - actual colors come from theme config
 */
export const DEFAULT_COLORS = {
    primary: '#2563eb',
    secondary: '#1e293b',
    accent: '#0ea5e9',
    text: '#1f2937',
    textLight: '#6b7280',
    background: '#ffffff',
    border: '#e5e7eb',
    headerBg: '#f8fafc'
};

// ========== PRINT SETTINGS ==========

/**
 * Print-specific settings
 */
export const PRINT_SETTINGS = {
    // Minimum lines to keep together when breaking pages
    orphans: 2,
    widows: 2,
    
    // Default line height for print
    lineHeight: 1.4,
    
    // Whether to print backgrounds by default
    printBackground: true
};

// ========== STYLE OPTIONS ==========

/**
 * Valid style option values
 */
export const STYLE_OPTIONS = {
    bulletStyles: ['disc', 'circle', 'square', 'dash', 'none'],
    headingStyles: ['underline', 'background', 'accent-left', 'simple'],
    skillsLayouts: ['pills', 'tags', 'list', 'inline', 'grouped', 'comma-separated'],
    datePositions: ['right', 'below', 'inline'],
    dividerStyles: ['solid', 'dashed', 'dotted', 'none']
};

// ========== SECTION DEFAULTS ==========

/**
 * Default section configuration
 */
export const DEFAULT_SECTIONS = {
    order: [
        'personalInfo',
        'summary',
        'experience',
        'education',
        'skills',
        'additionalSections'
    ],
    visibility: {
        personalInfo: true,
        summary: true,
        experience: true,
        education: true,
        skills: true,
        additionalSections: true
    }
};

export default {
    PAGE_SIZES,
    MARGIN_CONSTRAINTS,
    DEFAULT_MARGINS,
    POINTS_PER_INCH,
    inchesToPoints,
    pointsToInches,
    pixelsToPoints,
    pointsToPixels,
    FONT_SIZE_CONSTRAINTS,
    TYPOGRAPHY_SCALE,
    SPACING_SCALE,
    DEFAULT_SPACING,
    DEFAULT_COLORS,
    PRINT_SETTINGS,
    STYLE_OPTIONS,
    DEFAULT_SECTIONS
};
