/**
 * Template Configuration Structure and Utilities
 * Defines the structure and validation for resume templates
 */

import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";

// ========== TEMPLATE CONFIGURATION SCHEMA ==========

/**
 * Default template configuration structure
 */
export const DEFAULT_TEMPLATE_CONFIG = {
    layout: {
        orientation: "portrait",
        pageSize: "A4",
        margins: {
            top: 0.75,
            right: 0.75,
            bottom: 0.75,
            left: 0.75
        },
        columns: 1,
        spacing: {
            section: 12,
            line: 6,
            paragraph: 8
        }
    },
    colors: {
        primary: "#0047AB",
        secondary: "#333333",
        accent: "#0066CC",
        text: "#000000",
        background: "#FFFFFF"
    },
    typography: {
        fontFamily: "Arial, sans-serif",
        sizes: {
            heading: 16,
            subheading: 13,
            body: 11,
            small: 10
        },
        weights: {
            regular: 400,
            bold: 700,
            semibold: 600
        }
    },
    sections: [
        {
            name: "personal_info",
            enabled: true,
            order: 1,
            style: {
                showPhoto: false,
                showLocation: true,
                showLinks: true
            }
        },
        {
            name: "summary",
            enabled: true,
            order: 2,
            style: {
                maxLines: 3
            }
        },
        {
            name: "experience",
            enabled: true,
            order: 3,
            style: {
                showAchievements: true,
                bulletPoints: true,
                maxEntries: null
            }
        },
        {
            name: "education",
            enabled: true,
            order: 4,
            style: {
                showGPA: true,
                maxEntries: null
            }
        },
        {
            name: "skills",
            enabled: true,
            order: 5,
            style: {
                displayAs: "list",
                maxSkills: null,
                groupByCategory: false
            }
        },
        {
            name: "certifications",
            enabled: true,
            order: 6,
            style: {
                maxEntries: null
            }
        },
        {
            name: "projects",
            enabled: true,
            order: 7,
            style: {
                showTechnologies: true,
                maxEntries: null
            }
        },
        {
            name: "languages",
            enabled: true,
            order: 8,
            style: {
                showProficiency: true
            }
        }
    ]
};

// ========== VALIDATION FUNCTIONS ==========

/**
 * Validate template configuration
 * @param {Object} config - Template configuration
 * @returns {boolean} Is valid
 */
export function validateTemplateConfig(config) {
    try {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Validate required properties
        if (!config.layout || !config.colors || !config.typography || !config.sections) {
            return false;
        }

        // Validate layout
        const layout = config.layout;
        if (!['portrait', 'landscape'].includes(layout.orientation)) {
            return false;
        }
        if (!['A4', 'Letter'].includes(layout.pageSize)) {
            return false;
        }
        if (layout.columns < 1 || layout.columns > 3) {
            return false;
        }

        // Validate colors (basic hex validation)
        const colorHexRegex = /^#([A-F0-9]{6}|[A-F0-9]{3})$/i;
        for (const [key, color] of Object.entries(config.colors)) {
            if (!colorHexRegex.test(color)) {
                return false;
            }
        }

        // Validate typography
        if (!config.typography.fontFamily || typeof config.typography.fontFamily !== 'string') {
            return false;
        }
        if (!config.typography.sizes || !config.typography.weights) {
            return false;
        }

        // Validate sections
        if (!Array.isArray(config.sections) || config.sections.length === 0) {
            return false;
        }

        for (const section of config.sections) {
            if (!section.name || !section.hasOwnProperty('enabled') || section.order === undefined) {
                return false;
            }
        }

        return true;
    } catch (error) {
        logger.warn('[TEMPLATE_UTILS] Configuration validation failed', {
            error: error.message
        });
        return false;
    }
}

/**
 * Validate section content based on section type
 * @param {string} sectionName - Section name
 * @param {Object} content - Section content
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateSectionContent(sectionName, content) {
    const errors = [];

    try {
        switch (sectionName) {
            case 'personal_info':
                if (typeof content !== 'object' || content === null) {
                    errors.push('Personal info must be an object');
                }
                break;

            case 'summary':
                if (typeof content !== 'string' && !Array.isArray(content)) {
                    errors.push('Summary must be a string or array');
                }
                break;

            case 'experience':
                if (!Array.isArray(content)) {
                    errors.push('Experience must be an array');
                } else {
                    content.forEach((exp, idx) => {
                        if (typeof exp !== 'object') {
                            errors.push(`Experience[${idx}] must be an object`);
                        }
                    });
                }
                break;

            case 'education':
                if (!Array.isArray(content)) {
                    errors.push('Education must be an array');
                } else {
                    content.forEach((edu, idx) => {
                        if (typeof edu !== 'object') {
                            errors.push(`Education[${idx}] must be an object`);
                        }
                    });
                }
                break;

            case 'skills':
                if (!Array.isArray(content)) {
                    errors.push('Skills must be an array');
                } else {
                    content.forEach((skill, idx) => {
                        if (typeof skill !== 'string' && typeof skill !== 'object') {
                            errors.push(`Skill[${idx}] must be a string or object`);
                        }
                    });
                }
                break;

            case 'certifications':
                if (!Array.isArray(content)) {
                    errors.push('Certifications must be an array');
                }
                break;

            case 'projects':
                if (!Array.isArray(content)) {
                    errors.push('Projects must be an array');
                }
                break;

            case 'languages':
                if (!Array.isArray(content)) {
                    errors.push('Languages must be an array');
                }
                break;

            default:
                errors.push(`Unknown section: ${sectionName}`);
        }
    } catch (error) {
        errors.push(`Validation error: ${error.message}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get default section content based on section name
 * @param {string} sectionName - Section name
 * @returns {Object} Default content
 */
export function getDefaultSectionContent(sectionName) {
    const defaults = {
        personal_info: {
            name: null,
            email: null,
            phone: null,
            location: null,
            linkedin: null,
            portfolio: null
        },
        summary: "",
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
        languages: []
    };

    return defaults[sectionName] || null;
}

/**
 * Merge custom config with base template config
 * @param {Object} baseConfig - Base template configuration
 * @param {Object} customConfig - Custom configuration overrides
 * @returns {Object} Merged configuration
 */
export function mergeConfigs(baseConfig, customConfig) {
    if (!baseConfig) return customConfig;
    if (!customConfig) return baseConfig;

    try {
        // Deep merge for colors and typography
        return {
            layout: {
                ...baseConfig.layout,
                ...customConfig.layout
            },
            colors: {
                ...baseConfig.colors,
                ...customConfig.colors
            },
            typography: {
                ...baseConfig.typography,
                ...customConfig.typography,
                sizes: {
                    ...baseConfig.typography?.sizes,
                    ...customConfig.typography?.sizes
                },
                weights: {
                    ...baseConfig.typography?.weights,
                    ...customConfig.typography?.weights
                }
            },
            sections: customConfig.sections || baseConfig.sections
        };
    } catch (error) {
        logger.warn('[TEMPLATE_UTILS] Config merge failed, returning base config', {
            error: error.message
        });
        return baseConfig;
    }
}

/**
 * Generate resume template preview
 * @param {Object} resumeData - Resume data
 * @param {Object} config - Template config
 * @returns {Object} Preview data
 */
export function generatePreview(resumeData, config) {
    try {
        const preview = {
            personal_info: resumeData.personal_info || {},
            summary: resumeData.summary || "",
            sections: []
        };

        // Get enabled sections from config
        const enabledSections = (config.sections || [])
            .filter(s => s.enabled)
            .sort((a, b) => a.order - b.order);

        // Build preview sections
        for (const section of enabledSections) {
            const content = resumeData[section.name];
            if (content) {
                preview.sections.push({
                    name: section.name,
                    title: section.name.replace(/_/g, ' ').toUpperCase(),
                    content: Array.isArray(content) ? content.slice(0, 3) : content
                });
            }
        }

        return preview;
    } catch (error) {
        logger.error('[TEMPLATE_UTILS] Preview generation failed', {
            error: error.message
        });
        throw new AppError('Failed to generate preview', 500);
    }
}

/**
 * Get ATS compatibility score
 * Analyzes resume for ATS-friendliness
 * @param {Object} resumeData - Resume data
 * @param {Object} config - Template config
 * @returns {number} Score 0-100
 */
export function calculateATSScore(resumeData, config) {
    let score = 0;
    const checks = [];

    try {
        // Check for simple fonts (ATS-friendly)
        const simpleFont = ['Arial', 'Calibri', 'Helvetica', 'Times New Roman', 'Georgia'];
        if (simpleFont.some(f => config.typography?.fontFamily?.includes(f))) {
            score += 10;
            checks.push('✓ ATS-friendly font');
        } else {
            checks.push('✗ Consider using standard fonts');
        }

        // Check for standard structure
        const requiredSections = ['personal_info', 'experience', 'education'];
        const hasSections = requiredSections.every(s => resumeData[s]);
        if (hasSections) {
            score += 20;
            checks.push('✓ Has all required sections');
        }

        // Check for simple colors (ATS prefers dark text on light background)
        const darkText = parseInt(config.colors?.text?.slice(1), 16) < 0x808080;
        const lightBg = parseInt(config.colors?.background?.slice(1), 16) > 0x808080;
        if (darkText && lightBg) {
            score += 15;
            checks.push('✓ Good color contrast');
        }

        // Check for standard layout (single column better for ATS)
        if (config.layout?.columns === 1) {
            score += 15;
            checks.push('✓ Single column layout');
        }

        // Check for experience data
        if (resumeData.experience && resumeData.experience.length > 0) {
            score += 15;
            checks.push('✓ Has work experience');
        }

        // Check for education data
        if (resumeData.education && resumeData.education.length > 0) {
            score += 10;
            checks.push('✓ Has education details');
        }

        // Check for skills
        if (resumeData.skills && resumeData.skills.length > 0) {
            score += 10;
            checks.push('✓ Has skills section');
        }

        return {
            score: Math.min(score, 100),
            checks
        };
    } catch (error) {
        logger.warn('[TEMPLATE_UTILS] ATS score calculation failed', {
            error: error.message
        });
        return {
            score: 50,
            checks: []
        };
    }
}

/**
 * Validate template for system use
 * @param {Object} templateData - Template data
 * @returns {Object} Validation result
 */
export function validateTemplateForSystem(templateData) {
    const errors = [];

    try {
        const { name, slug, category, config } = templateData;

        // Validate basic fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            errors.push('Template name is required');
        }

        if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
            errors.push('Template slug is required');
        } else if (!/^[a-z0-9-]+$/.test(slug)) {
            errors.push('Template slug must contain only lowercase letters, numbers, and hyphens');
        }

        if (!category || typeof category !== 'string' || category.trim().length === 0) {
            errors.push('Template category is required');
        }

        // Validate config
        if (!validateTemplateConfig(config)) {
            errors.push('Template configuration is invalid');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    } catch (error) {
        errors.push(`Validation error: ${error.message}`);
        return {
            valid: false,
            errors
        };
    }
}

/**
 * Get available template categories
 * @returns {Array} List of categories
 */
export function getTemplateCategories() {
    return [
        {
            name: "professional",
            label: "Professional",
            description: "Clean, modern designs suitable for corporate roles"
        },
        {
            name: "creative",
            label: "Creative",
            description: "Design-forward templates for creative professionals"
        },
        {
            name: "minimal",
            label: "Minimal",
            description: "Simplistic designs that focus on content"
        },
        {
            name: "ats-optimized",
            label: "ATS Optimized",
            description: "Designed to pass Applicant Tracking Systems"
        },
        {
            name: "academic",
            label: "Academic",
            description: "Suitable for academic and research positions"
        },
        {
            name: "technical",
            label: "Technical",
            description: "Ideal for software engineering and tech roles"
        }
    ];
}

export default {
    DEFAULT_TEMPLATE_CONFIG,
    validateTemplateConfig,
    validateSectionContent,
    getDefaultSectionContent,
    mergeConfigs,
    generatePreview,
    calculateATSScore,
    validateTemplateForSystem,
    getTemplateCategories
};
