/**
 * Base CSS Styles for Resume PDF
 * 
 * Core styles that apply across all themes.
 * Theme-specific customizations are applied via CSS variables from theme config.
 * 
 * IMPORTANT: 
 * - All CSS variables use --rp- prefix to match frontend (temp/resume-preview/)
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
            font-family: var(--rp-font-family);
            font-size: var(--rp-font-size-base);
            line-height: var(--rp-line-height);
            color: var(--rp-color-text);
            background-color: var(--rp-color-background);
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
            font-family: var(--rp-font-family-header);
            font-weight: var(--rp-font-weight-bold);
            color: var(--rp-color-secondary);
            margin: 0;
        }

        h1 {
            font-size: var(--rp-font-size-name);
            letter-spacing: -0.5pt;
        }

        h2 {
            font-size: var(--rp-font-size-section);
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            color: var(--rp-color-primary);
        }

        h3 {
            font-size: var(--rp-font-size-subheading);
            font-weight: var(--rp-font-weight-semibold);
        }

        h4 {
            font-size: var(--rp-font-size-body);
            font-weight: var(--rp-font-weight-semibold);
        }

        p {
            margin: 0;
            font-size: var(--rp-font-size-body);
        }

        a {
            color: var(--rp-color-primary);
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        /* ========== SECTIONS ========== */
        
        .section {
            margin-bottom: var(--rp-spacing-section);
        }

        /* Keep some margin on last section for bottom page edge */
        .section:last-child {
            margin-bottom: calc(var(--rp-spacing-section) / 2);
        }

        .section-title {
            font-size: var(--rp-font-size-section);
            font-weight: var(--rp-font-weight-bold);
            color: var(--rp-color-primary);
            text-transform: uppercase;
            letter-spacing: 1pt;
            margin-bottom: var(--rp-spacing-item);
            padding-bottom: var(--rp-spacing-line);
        }

        .section-content {
            font-size: var(--rp-font-size-body);
        }

        /* ========== PERSONAL INFO / HEADER ========== */
        
        .header {
            margin-bottom: var(--rp-spacing-section);
            padding-bottom: var(--rp-spacing-item);
            border-bottom: 2px solid var(--rp-color-primary);
        }

        /* Header alignment variants */
        .header-align-center {
            text-align: center;
        }
        .header-align-center .contact-info {
            justify-content: center;
        }

        .header-align-left {
            text-align: left;
        }
        .header-align-left .contact-info {
            justify-content: flex-start;
        }

        .header-align-right {
            text-align: right;
        }
        .header-align-right .contact-info {
            justify-content: flex-end;
        }

        .header-name {
            font-size: var(--rp-font-size-name);
            font-weight: var(--rp-font-weight-bold);
            color: var(--rp-color-secondary);
            margin-bottom: 0;
            letter-spacing: -0.5pt;
        }

        .header-title {
            font-size: var(--rp-font-size-title);
            font-weight: var(--rp-font-weight-medium);
            color: var(--rp-color-primary);
            margin-top: 4pt;
            margin-bottom: 0;
        }

        .contact-info {
            display: flex;
            flex-wrap: wrap;
            gap: 4pt 16pt;
            font-size: var(--rp-font-size-small);
            color: var(--rp-color-text-light);
        }

        .contact-item {
            display: inline-flex;
            align-items: center;
            gap: 4pt;
            white-space: nowrap;
        }

        .contact-item svg {
            width: 10pt;
            height: 10pt;
            color: currentColor;
        }

        .contact-divider {
            display: none;
        }

        /* ========== SUMMARY ========== */
        
        .summary-text {
            font-size: var(--rp-font-size-body);
            line-height: var(--rp-line-height);
            text-align: left;
            color: var(--rp-color-text);
        }

        /* ========== EXPERIENCE & EDUCATION ITEMS ========== */
        
        .entry-item {
            margin-bottom: var(--rp-spacing-item);
        }

        .entry-item:last-child {
            margin-bottom: 0;
        }

        .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            margin-bottom: var(--rp-spacing-line);
            gap: var(--rp-spacing-item);
        }

        .entry-title-group {
            flex: 1;
        }

        .entry-title {
            font-size: var(--rp-font-size-subheading);
            font-weight: var(--rp-font-weight-semibold);
            color: var(--rp-color-primary);
        }

        .entry-subtitle {
            font-size: var(--rp-font-size-body);
            color: var(--rp-color-secondary);
            font-weight: var(--rp-font-weight-medium);
        }

        .entry-meta {
            font-size: var(--rp-font-size-small);
            color: var(--rp-color-text-light);
            text-align: right;
            white-space: nowrap;
        }

        .entry-date {
            font-weight: var(--rp-font-weight-medium);
        }

        .entry-location {
            font-style: italic;
        }

        .entry-description {
            font-size: var(--rp-font-size-body);
            color: var(--rp-color-text);
            margin-top: var(--rp-spacing-line);
            line-height: var(--rp-line-height);
        }

        /* HTML content within description (from rich text editors) */
        .entry-description p {
            margin-bottom: var(--rp-spacing-line);
        }

        .entry-description p:last-child {
            margin-bottom: 0;
        }

        .entry-description ul,
        .entry-description ol {
            margin-top: var(--rp-spacing-line);
            margin-bottom: var(--rp-spacing-line);
            padding-left: 18pt;
        }

        .entry-description li {
            font-size: var(--rp-font-size-body);
            margin-bottom: var(--rp-spacing-line);
            line-height: var(--rp-line-height);
        }

        .entry-description li:last-child {
            margin-bottom: 0;
        }

        .entry-description strong,
        .entry-description b {
            font-weight: var(--rp-font-weight-semibold);
        }

        .entry-description em,
        .entry-description i {
            font-style: italic;
        }

        .entry-achievements {
            margin-top: var(--rp-spacing-line);
            padding-left: 18pt;
            list-style-type: disc;
        }

        .entry-achievements li {
            font-size: var(--rp-font-size-body);
            margin-bottom: var(--rp-spacing-line);
            line-height: var(--rp-line-height);
        }

        .entry-achievements li:last-child {
            margin-bottom: 0;
        }

        /* ========== SKILLS ========== */
        
        .skills-container {
            display: flex;
            flex-direction: column;
            gap: var(--rp-spacing-item);
        }

        .skill-category {
            margin-bottom: var(--rp-spacing-item);
        }

        .skill-category:last-child {
            margin-bottom: 0;
        }

        .skill-category-title {
            font-size: var(--rp-font-size-body);
            font-weight: var(--rp-font-weight-semibold);
            color: var(--rp-color-secondary);
            margin-bottom: var(--rp-spacing-line);
        }

        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: var(--rp-spacing-line) var(--rp-spacing-item);
        }

        /* Skills Layout: Flattened pills/tags */
        .skills-list-flat {
            display: flex;
            flex-wrap: wrap;
            gap: 6pt;
        }

        /* Filled pills (primary bg, white text) - matches frontend pills */
        .skill-pill-filled {
            display: inline-block;
            padding: 4pt 10pt;
            background-color: var(--rp-color-primary);
            color: #ffffff;
            border-radius: 9999px;
            font-size: var(--rp-font-size-small);
            font-weight: var(--rp-font-weight-medium);
        }

        /* Tags (bordered, light bg) - matches frontend tags */
        .skill-tag {
            display: inline-block;
            padding: 4pt 10pt;
            background-color: color-mix(in srgb, var(--rp-color-primary) 15%, white);
            color: var(--rp-color-primary);
            border: 1px solid color-mix(in srgb, var(--rp-color-primary) 30%, transparent);
            border-radius: var(--rp-border-radius);
            font-size: var(--rp-font-size-small);
            font-weight: var(--rp-font-weight-medium);
        }

        /* Light pills for grouped layout */
        .skill-pill-light {
            display: inline-block;
            padding: 2pt 8pt;
            background-color: color-mix(in srgb, var(--rp-color-accent) 8%, white);
            border: 1px solid color-mix(in srgb, var(--rp-color-accent) 30%, transparent);
            color: var(--rp-color-text);
            border-radius: 9999px;
            font-size: var(--rp-font-size-small);
        }

        /* Default pill style (backwards compat) */
        .skill-pill {
            display: inline-block;
            padding: 2pt 8pt;
            background-color: var(--rp-color-header-bg);
            border: 1px solid var(--rp-color-border);
            border-radius: var(--rp-border-radius);
            font-size: var(--rp-font-size-small);
            color: var(--rp-color-text);
            line-height: var(--rp-line-height);
        }

        /* Grouped skills with category labels */
        .skill-category-grouped {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 4pt 6pt;
            margin-bottom: 8pt;
        }

        .skill-category-grouped:last-child {
            margin-bottom: 0;
        }

        .skill-category-label {
            font-size: var(--rp-font-size-small);
            font-weight: var(--rp-font-weight-semibold);
            color: var(--rp-color-secondary);
            margin-right: 4pt;
        }

        .skills-list-inline {
            display: inline-flex;
            flex-wrap: wrap;
            gap: 4pt;
        }

        /* Inline/comma-separated skills */
        .skill-category-inline {
            font-size: var(--rp-font-size-body);
            margin-bottom: 4pt;
        }

        .skill-category-inline:last-child {
            margin-bottom: 0;
        }

        /* 2-column grid for list layout */
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2pt 16pt;
        }

        .skill-list-item {
            display: flex;
            align-items: center;
            gap: 6pt;
            font-size: var(--rp-font-size-body);
        }

        .skill-bullet {
            color: var(--rp-color-text-light);
        }

        .skills-inline {
            font-size: var(--rp-font-size-body);
            line-height: var(--rp-line-height);
        }

        /* ========== TWO-COLUMN LAYOUT ========== */

        .resume-two-column {
            display: grid;
            grid-template-columns: var(--rp-sidebar-width) 1fr;
            gap: var(--rp-spacing-section);
            align-items: start;
        }

        .resume-two-column-right {
            grid-template-columns: 1fr var(--rp-sidebar-width);
        }

        .resume-sidebar {
            padding: var(--rp-sidebar-padding);
            background-color: var(--rp-color-sidebar-bg);
            border-radius: var(--rp-border-radius);
            display: flex;
            flex-direction: column;
            gap: var(--rp-spacing-item);
        }

        .resume-main {
            display: flex;
            flex-direction: column;
            gap: var(--rp-spacing-section);
        }

        /* Remove default section margins in two-column - gap handles it */
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

        /* Sidebar-specific styling for compact display */
        .resume-sidebar .skill-category {
            margin-bottom: var(--rp-spacing-line);
        }

        .resume-sidebar .entry-item {
            margin-bottom: var(--rp-spacing-line);
        }

        /* ========== ADDITIONAL SECTIONS ========== */
        
        .additional-section {
            margin-bottom: var(--rp-spacing-item);
        }

        .additional-item {
            margin-bottom: var(--rp-spacing-line);
        }

        .additional-item:last-child {
            margin-bottom: 0;
        }

        .additional-item-title {
            font-weight: var(--rp-font-weight-semibold);
            color: var(--rp-color-secondary);
        }

        .additional-item-meta {
            font-size: var(--rp-font-size-small);
            color: var(--rp-color-text-light);
        }

        .additional-item-description {
            font-size: var(--rp-font-size-body);
            color: var(--rp-color-text);
            margin-top: var(--rp-spacing-line);
        }

        /* ========== UTILITIES ========== */
        
        .text-primary {
            color: var(--rp-color-primary);
        }

        .text-secondary {
            color: var(--rp-color-secondary);
        }

        .text-muted {
            color: var(--rp-color-text-light);
        }

        .text-small {
            font-size: var(--rp-font-size-small);
        }

        .font-semibold {
            font-weight: var(--rp-font-weight-semibold);
        }

        .font-bold {
            font-weight: var(--rp-font-weight-bold);
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
