/**
 * Base CSS Styles for Resume PDF
 * 
 * Core styles that apply across all themes.
 * Theme-specific customizations are applied via CSS variables from theme config.
 * 
 * IMPORTANT: 
 * - Page margins are handled by @page rule (set in print-styles.js)
 * - Container has NO padding to avoid double margins
 * - All spacing uses CSS variables from theme config
 */

/**
 * Generate base CSS styles
 * @param {Object} config - Theme configuration
 * @returns {string} Base CSS styles
 */
export const getBaseStyles = (config) => {
    return `
        /* ========== RESET AND BASE ========== */
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            font-family: var(--font-family);
            font-size: var(--font-size-base);
            line-height: var(--line-height);
            color: var(--color-text);
            background-color: var(--color-background);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* ========== CONTAINER ========== */
        
        /* 
         * NO PADDING HERE - margins are handled by @page in print-styles.js
         * This ensures consistent margins on all pages
         */
        .resume-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        /* ========== TYPOGRAPHY ========== */
        h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-family-header);
            font-weight: var(--font-weight-bold);
            color: var(--color-secondary);
            margin: 0;
        }

        h1 {
            font-size: var(--font-size-name);
            letter-spacing: -0.5pt;
        }

        h2 {
            font-size: var(--font-size-section);
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            color: var(--color-primary);
        }

        h3 {
            font-size: var(--font-size-subheading);
            font-weight: var(--font-weight-semibold);
        }

        h4 {
            font-size: var(--font-size-body);
            font-weight: var(--font-weight-semibold);
        }

        p {
            margin: 0;
            font-size: var(--font-size-body);
        }

        a {
            color: var(--color-primary);
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        /* ========== SECTIONS ========== */
        
        .section {
            margin-bottom: var(--spacing-section);
        }

        /* Keep some margin on last section for bottom page edge */
        .section:last-child {
            margin-bottom: calc(var(--spacing-section) / 2);
        }

        .section-title {
            font-size: var(--font-size-section);
            font-weight: var(--font-weight-bold);
            color: var(--color-primary);
            text-transform: uppercase;
            letter-spacing: 1pt;
            margin-bottom: var(--spacing-item);
            padding-bottom: var(--spacing-line);
        }

        .section-content {
            font-size: var(--font-size-body);
        }

        /* ========== PERSONAL INFO / HEADER ========== */
        
        .header {
            text-align: center;
            margin-bottom: var(--spacing-section);
            padding-bottom: var(--spacing-item);
            border-bottom: 2px solid var(--color-primary);
        }

        .header-name {
            font-size: var(--font-size-name);
            font-weight: var(--font-weight-bold);
            color: var(--color-secondary);
            margin-bottom: var(--spacing-item);
        }

        .header-title {
            font-size: var(--font-size-title);
            font-weight: var(--font-weight-medium);
            color: var(--color-text-light);
            margin-bottom: var(--spacing-item);
        }

        .contact-info {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--spacing-item) var(--spacing-section);
            font-size: var(--font-size-small);
            color: var(--color-text);
            row-gap: var(--spacing-line);
        }

        .contact-item {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-line);
            white-space: nowrap;
        }

        .contact-item svg {
            width: 10pt;
            height: 10pt;
            fill: var(--color-primary);
        }

        .contact-divider {
            color: var(--color-border);
            margin: 0 2pt;
        }

        /* ========== SUMMARY ========== */
        
        .summary-text {
            font-size: var(--font-size-body);
            line-height: var(--line-height);
            text-align: left;
            color: var(--color-text);
        }

        /* ========== EXPERIENCE & EDUCATION ITEMS ========== */
        
        .entry-item {
            margin-bottom: var(--spacing-item);
        }

        .entry-item:last-child {
            margin-bottom: 0;
        }

        .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: var(--spacing-line);
            gap: var(--spacing-item);
        }

        .entry-title-group {
            flex: 1;
        }

        .entry-title {
            font-size: var(--font-size-subheading);
            font-weight: var(--font-weight-semibold);
            color: var(--color-secondary);
        }

        .entry-subtitle {
            font-size: var(--font-size-body);
            color: var(--color-text);
            font-weight: var(--font-weight-medium);
        }

        .entry-meta {
            font-size: var(--font-size-small);
            color: var(--color-text-light);
            text-align: right;
            white-space: nowrap;
        }

        .entry-date {
            font-weight: var(--font-weight-medium);
        }

        .entry-location {
            font-style: italic;
        }

        .entry-description {
            font-size: var(--font-size-body);
            color: var(--color-text);
            margin-top: var(--spacing-line);
            line-height: var(--line-height);
        }

        .entry-achievements {
            margin-top: var(--spacing-line);
            padding-left: 18pt;
            list-style-type: disc;
        }

        .entry-achievements li {
            font-size: var(--font-size-body);
            margin-bottom: var(--spacing-line);
            line-height: var(--line-height);
        }

        .entry-achievements li:last-child {
            margin-bottom: 0;
        }

        /* ========== SKILLS ========== */
        
        .skills-container {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-item);
        }

        .skill-category {
            margin-bottom: var(--spacing-item);
        }

        .skill-category:last-child {
            margin-bottom: 0;
        }

        .skill-category-title {
            font-size: var(--font-size-body);
            font-weight: var(--font-weight-semibold);
            color: var(--color-secondary);
            margin-bottom: var(--spacing-line);
        }

        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: var(--spacing-line) var(--spacing-item);
        }

        .skill-pill {
            display: inline-block;
            padding: 2pt 8pt;
            background-color: var(--color-header-bg);
            border: 1px solid var(--color-border);
            border-radius: var(--border-radius);
            font-size: var(--font-size-small);
            color: var(--color-text);
            line-height: var(--line-height);
        }

        .skills-inline {
            font-size: var(--font-size-body);
            line-height: var(--line-height);
        }

        /* ========== ADDITIONAL SECTIONS ========== */
        
        .additional-section {
            margin-bottom: var(--spacing-item);
        }

        .additional-item {
            margin-bottom: var(--spacing-line);
        }

        .additional-item:last-child {
            margin-bottom: 0;
        }

        .additional-item-title {
            font-weight: var(--font-weight-semibold);
            color: var(--color-secondary);
        }

        .additional-item-meta {
            font-size: var(--font-size-small);
            color: var(--color-text-light);
        }

        .additional-item-description {
            font-size: var(--font-size-body);
            color: var(--color-text);
            margin-top: var(--spacing-line);
        }

        /* ========== UTILITIES ========== */
        
        .text-primary {
            color: var(--color-primary);
        }

        .text-secondary {
            color: var(--color-secondary);
        }

        .text-muted {
            color: var(--color-text-light);
        }

        .text-small {
            font-size: var(--font-size-small);
        }

        .font-semibold {
            font-weight: var(--font-weight-semibold);
        }

        .font-bold {
            font-weight: var(--font-weight-bold);
        }

        .mb-4 {
            margin-bottom: 4pt;
        }

        .mb-8 {
            margin-bottom: 8pt;
        }

        .mt-4 {
            margin-top: 4pt;
        }

        .flex {
            display: flex;
        }

        .flex-wrap {
            flex-wrap: wrap;
        }

        .justify-between {
            justify-content: space-between;
        }

        .items-center {
            align-items: center;
        }

        .gap-4 {
            gap: 4pt;
        }

        .gap-8 {
            gap: 8pt;
        }
    `;
};

export default {
    getBaseStyles
};
