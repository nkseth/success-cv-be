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
    formatDate,
    formatDateRange,
    truncateText,
    nl2br,
    generateId,
    isEmpty,
    toStyleString
};
