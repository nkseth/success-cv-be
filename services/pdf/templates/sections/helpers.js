/**
 * Template Helper Utilities
 * 
 * Common functions for template rendering.
 */

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Format a date string to a readable format
 * @param {string} dateStr - Date string (ISO, YYYY-MM, etc.)
 * @returns {string} Formatted date
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    
    // Handle "Present" or similar keywords
    const lowerDate = String(dateStr).toLowerCase();
    if (lowerDate === 'present' || lowerDate === 'current' || lowerDate === 'now') {
        return 'Present';
    }

    try {
        // Try to parse the date
        let date;
        
        // Check for year-month format (YYYY-MM)
        if (/^\d{4}-\d{2}$/.test(dateStr)) {
            const [year, month] = dateStr.split('-');
            date = new Date(parseInt(year), parseInt(month) - 1);
        }
        // Check for year-only format (YYYY)
        else if (/^\d{4}$/.test(dateStr)) {
            return dateStr; // Just return the year
        }
        // Try ISO date parsing
        else {
            date = new Date(dateStr);
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return dateStr; // Return original if can't parse
        }

        // Format to "MMM YYYY"
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
        return dateStr; // Return original on error
    }
};

/**
 * Format a date range
 * @param {string} startDate - Start date
 * @param {string} endDate - End date (or 'Present')
 * @returns {string} Formatted date range
 */
export const formatDateRange = (startDate, endDate) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);

    if (!start && !end) return '';
    if (!start) return end;
    if (!end) return `${start} - Present`;

    return `${start} - ${end}`;
};

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength, suffix = '...') => {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Convert newlines to HTML line breaks
 * @param {string} text - Text with newlines
 * @returns {string} Text with <br> tags
 */
export const nl2br = (text) => {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
};

/**
 * Sanitize HTML content - allows safe HTML tags while preventing XSS
 * Use this for content that may contain HTML (like experience descriptions)
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHtml = (html) => {
    if (html === null || html === undefined) return '';
    if (typeof html !== 'string') return String(html);
    
    // If content doesn't look like HTML, escape it
    if (!/<[a-z][\s\S]*>/i.test(html)) {
        return escapeHtml(html);
    }
    
    // Allow safe HTML tags commonly used in rich text editors
    const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'span', 'div', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const allowedAttributes = ['href', 'target', 'class', 'style'];
    
    // Remove script tags and event handlers completely
    let sanitized = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript:/gi, '');
    
    // Remove disallowed tags but keep their content
    sanitized = sanitized.replace(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi, (match, close, tag, attrs) => {
        const lowerTag = tag.toLowerCase();
        if (!allowedTags.includes(lowerTag)) {
            return ''; // Remove disallowed tags
        }
        
        // Filter attributes for allowed tags
        if (!close && attrs) {
            const filteredAttrs = attrs.replace(/([a-z-]+)\s*=\s*["']([^"']*)["']/gi, (attrMatch, attrName, attrValue) => {
                if (allowedAttributes.includes(attrName.toLowerCase())) {
                    // Additional check for href to prevent javascript:
                    if (attrName.toLowerCase() === 'href' && attrValue.toLowerCase().includes('javascript:')) {
                        return '';
                    }
                    return attrMatch;
                }
                return '';
            });
            return `<${close}${tag}${filteredAttrs}>`;
        }
        
        return match;
    });
    
    return sanitized;
};

/**
 * Generate a unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export const generateId = (prefix = 'id') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

/**
 * Convert object to inline CSS style string
 * @param {Object} styles - Style object
 * @returns {string} CSS style string
 */
export const toStyleString = (styles) => {
    if (!styles || typeof styles !== 'object') return '';
    
    return Object.entries(styles)
        .map(([key, value]) => {
            // Convert camelCase to kebab-case
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
};

export default {
    escapeHtml,
    sanitizeHtml,
    formatDate,
    formatDateRange,
    truncateText,
    nl2br,
    generateId,
    isEmpty,
    toStyleString
};
