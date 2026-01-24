/**
 * Resume Section Renderers
 * 
 * Modular HTML generators for each resume section.
 * Each renderer takes section data and theme config, returns HTML string.
 */

import { escapeHtml, sanitizeHtml, formatDate, formatDateRange } from "./helpers.js";

/**
 * Render Personal Info / Header Section
 * @param {Object} personalInfo - Personal info data
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderPersonalInfo = (personalInfo, config) => {
    if (!personalInfo) return '';

    const {
        fullName = '',
        title = '',
        email = '',
        phone = '',
        location = '',
        linkedin = '',
        website = '',
        github = '',
        portfolio = ''
    } = personalInfo;

    const contacts = [];
    
    if (email) {
        contacts.push(`<span class="contact-item">${getIcon('email')}${escapeHtml(email)}</span>`);
    }
    if (phone) {
        contacts.push(`<span class="contact-item">${getIcon('phone')}${escapeHtml(phone)}</span>`);
    }
    if (location) {
        contacts.push(`<span class="contact-item">${getIcon('location')}${escapeHtml(location)}</span>`);
    }
    if (linkedin) {
        const linkedinDisplay = linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
        contacts.push(`<span class="contact-item">${getIcon('linkedin')}<a href="${escapeHtml(linkedin)}">${escapeHtml(linkedinDisplay)}</a></span>`);
    }
    if (website) {
        const websiteDisplay = website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
        contacts.push(`<span class="contact-item">${getIcon('website')}<a href="${escapeHtml(website)}">${escapeHtml(websiteDisplay)}</a></span>`);
    }
    if (github) {
        const githubDisplay = github.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/$/, '');
        contacts.push(`<span class="contact-item">${getIcon('github')}<a href="${escapeHtml(github)}">${escapeHtml(githubDisplay)}</a></span>`);
    }
    if (portfolio) {
        contacts.push(`<span class="contact-item">${getIcon('portfolio')}<a href="${escapeHtml(portfolio)}">Portfolio</a></span>`);
    }

    return `
        <header class="header section section-personal-info">
            <h1 class="header-name">${escapeHtml(fullName)}</h1>
            ${title ? `<p class="header-title">${escapeHtml(title)}</p>` : ''}
            ${contacts.length > 0 ? `
                <div class="contact-info">
                    ${contacts.join('<span class="contact-divider">|</span>')}
                </div>
            ` : ''}
        </header>
    `;
};

/**
 * Render Summary Section
 * @param {Object} summary - Summary data
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderSummary = (summary, config) => {
    if (!summary) return '';

    const text = typeof summary === 'string' ? summary : summary.text || summary.summary || '';
    if (!text) return '';

    return `
        <section class="section section-summary">
            <h2 class="section-title">Professional Summary</h2>
            <div class="section-content">
                <p class="summary-text">${escapeHtml(text)}</p>
            </div>
        </section>
    `;
};

/**
 * Render Experience Section
 * @param {Array} experience - Experience entries
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderExperience = (experience, config) => {
    if (!experience || !Array.isArray(experience) || experience.length === 0) return '';

    const experienceItems = experience.map(exp => {
        const {
            company = '',
            position = '',
            location = '',
            startDate = '',
            endDate = '',
            current = false,
            description = '',
            achievements = [],
            website = '',
            keywords = []
        } = exp;

        const dateStr = formatDateRange(startDate, current ? 'Present' : endDate);
        
        // Render achievements only if present and non-empty
        let achievementsHTML = '';
        if (achievements && Array.isArray(achievements) && achievements.length > 0) {
            achievementsHTML = `
                <ul class="entry-achievements item-list">
                    ${achievements.map(ach => `<li>${escapeHtml(ach)}</li>`).join('')}
                </ul>
            `;
        }

        // Description can contain HTML content from rich text editor
        // Use sanitizeHtml to allow safe HTML while preventing XSS
        const descriptionHTML = description 
            ? `<div class="entry-description">${sanitizeHtml(description)}</div>` 
            : '';

        // Keywords as subtle tags (optional, for ATS visibility)
        const keywordsHTML = keywords && keywords.length > 0
            ? `<div class="entry-keywords text-small text-muted">${keywords.map(k => escapeHtml(k)).join(' • ')}</div>`
            : '';

        // Company with optional website link
        const companyHTML = website 
            ? `<a href="${escapeHtml(website)}" class="entry-subtitle">${escapeHtml(company)}</a>`
            : `<p class="entry-subtitle">${escapeHtml(company)}</p>`;

        return `
            <div class="entry-item experience-item">
                <div class="entry-header">
                    <div class="entry-title-group">
                        <h3 class="entry-title">${escapeHtml(position)}</h3>
                        ${companyHTML}
                    </div>
                    <div class="entry-meta">
                        <p class="entry-date">${escapeHtml(dateStr)}</p>
                        ${location ? `<p class="entry-location">${escapeHtml(location)}</p>` : ''}
                    </div>
                </div>
                ${descriptionHTML}
                ${achievementsHTML}
            </div>
        `;
    }).join('');

    return `
        <section class="section section-experience main-section">
            <h2 class="section-title">Professional Experience</h2>
            <div class="section-content">
                ${experienceItems}
            </div>
        </section>
    `;
};

/**
 * Render Education Section
 * @param {Array} education - Education entries
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderEducation = (education, config) => {
    if (!education || !Array.isArray(education) || education.length === 0) return '';

    const educationItems = education.map(edu => {
        const {
            institution = '',
            degree = '',
            field = '',
            location = '',
            startDate = '',
            endDate = '',
            gpa = '',
            honors = [],
            achievements = []
        } = edu;

        const degreeField = [degree, field].filter(Boolean).join(' in ');
        const dateStr = endDate ? formatDate(endDate) : (startDate ? `${formatDate(startDate)} - Present` : '');
        
        const extras = [];
        if (gpa) extras.push(`GPA: ${gpa}`);
        if (honors && honors.length > 0) extras.push(honors.join(', '));
        if (achievements && achievements.length > 0) extras.push(achievements.join(', '));

        return `
            <div class="entry-item education-item">
                <div class="entry-header">
                    <div class="entry-title-group">
                        <h3 class="entry-title">${escapeHtml(degreeField || institution)}</h3>
                        ${degreeField ? `<p class="entry-subtitle">${escapeHtml(institution)}</p>` : ''}
                    </div>
                    <div class="entry-meta">
                        ${dateStr ? `<p class="entry-date">${escapeHtml(dateStr)}</p>` : ''}
                        ${location ? `<p class="entry-location">${escapeHtml(location)}</p>` : ''}
                    </div>
                </div>
                ${extras.length > 0 ? `<p class="entry-description text-small">${escapeHtml(extras.join(' • '))}</p>` : ''}
            </div>
        `;
    }).join('');

    return `
        <section class="section section-education main-section">
            <h2 class="section-title">Education</h2>
            <div class="section-content">
                ${educationItems}
            </div>
        </section>
    `;
};

/**
 * Render Skills Section
 * @param {Object} skills - Skills data
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderSkills = (skills, config) => {
    if (!skills) return '';

    const skillsLayout = config.style?.skillsLayout || 'pills';
    const categories = [];

    // Technical Skills
    if (skills.technical && skills.technical.length > 0) {
        categories.push({
            title: 'Technical Skills',
            items: skills.technical
        });
    }

    // Soft Skills
    if (skills.soft && skills.soft.length > 0) {
        categories.push({
            title: 'Soft Skills',
            items: skills.soft
        });
    }

    // Tools
    if (skills.tools && skills.tools.length > 0) {
        categories.push({
            title: 'Tools & Technologies',
            items: skills.tools
        });
    }

    // Languages
    if (skills.languages && skills.languages.length > 0) {
        categories.push({
            title: 'Languages',
            items: skills.languages
        });
    }

    // Certifications
    if (skills.certifications && skills.certifications.length > 0) {
        const certNames = skills.certifications.map(c => 
            typeof c === 'string' ? c : c.name
        ).filter(Boolean);
        if (certNames.length > 0) {
            categories.push({
                title: 'Certifications',
                items: certNames
            });
        }
    }

    if (categories.length === 0) return '';

    const renderCategory = (category) => {
        if (skillsLayout === 'pills') {
            return `
                <div class="skill-category">
                    <h4 class="skill-category-title">${escapeHtml(category.title)}</h4>
                    <div class="skills-list">
                        ${category.items.map(skill => `<span class="skill-pill">${escapeHtml(skill)}</span>`).join('')}
                    </div>
                </div>
            `;
        } else if (skillsLayout === 'inline') {
            return `
                <div class="skill-category">
                    <span class="skill-category-title">${escapeHtml(category.title)}:</span>
                    <span class="skills-inline">${category.items.map(s => escapeHtml(s)).join(', ')}</span>
                </div>
            `;
        } else { // list
            return `
                <div class="skill-category">
                    <h4 class="skill-category-title">${escapeHtml(category.title)}</h4>
                    <ul class="item-list">
                        ${category.items.map(skill => `<li>${escapeHtml(skill)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    };

    return `
        <section class="section section-skills sidebar-section">
            <h2 class="section-title">Skills</h2>
            <div class="section-content skills-container">
                ${categories.map(renderCategory).join('')}
            </div>
        </section>
    `;
};

/**
 * Render Additional Sections (Projects, Awards, etc.)
 * @param {Array} additionalSections - Array of additional sections
 * @param {Object} config - Theme configuration
 * @returns {string} HTML string
 */
export const renderAdditionalSections = (additionalSections, config) => {
    if (!additionalSections || !Array.isArray(additionalSections) || additionalSections.length === 0) {
        return '';
    }

    const sectionsHTML = additionalSections.map(section => {
        const { title, type, content } = section;
        if (!content || (Array.isArray(content) && content.length === 0)) return '';

        let contentHTML = '';

        switch (type) {
            case 'projects':
                contentHTML = renderProjects(content);
                break;
            case 'awards':
            case 'achievements':
                contentHTML = renderAwards(content);
                break;
            case 'publications':
                contentHTML = renderPublications(content);
                break;
            case 'volunteers':
                contentHTML = renderVolunteers(content);
                break;
            case 'interests':
            case 'hobbies':
                contentHTML = renderInterests(content);
                break;
            default:
                contentHTML = renderGenericList(content);
        }

        return `
            <div class="additional-section">
                <h2 class="section-title">${escapeHtml(title)}</h2>
                <div class="section-content">
                    ${contentHTML}
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    if (!sectionsHTML) return '';

    return `
        <section class="section section-additional sidebar-section">
            ${sectionsHTML}
        </section>
    `;
};

// Helper renderers for additional sections
const renderProjects = (projects) => {
    return projects.map(proj => {
        const dateStr = formatDateRange(proj.startDate || proj.start_date, proj.endDate || proj.end_date);
        
        // Description can contain HTML content, sanitize it
        const descriptionHTML = proj.description 
            ? sanitizeHtml(proj.description)
            : '';
        
        // Highlights as bullet points if available
        const highlightsHTML = proj.highlights && proj.highlights.length > 0
            ? `<ul class="item-list project-highlights">${proj.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
            : '';
        
        return `
        <div class="additional-item project-item">
            <div class="entry-header">
                <span class="additional-item-title">${escapeHtml(proj.name || proj.title || '')}</span>
                <div class="project-links">
                    ${proj.link ? `<a href="${escapeHtml(proj.link)}" class="text-small text-primary">View</a>` : ''}
                    ${dateStr ? `<span class="additional-item-meta">${escapeHtml(dateStr)}</span>` : ''}
                </div>
            </div>
            ${descriptionHTML ? `<div class="additional-item-description">${descriptionHTML}</div>` : ''}
            ${highlightsHTML}
            ${proj.technologies && proj.technologies.length > 0 ? `
                <p class="text-small text-muted mt-4"><strong>Technologies:</strong> ${proj.technologies.map(t => escapeHtml(t)).join(', ')}</p>
            ` : ''}
        </div>
    `}).join('');
};

const renderAwards = (awards) => {
    return awards.map(award => `
        <div class="additional-item">
            <div class="entry-header">
                <span class="additional-item-title">${escapeHtml(award.title || '')}</span>
                ${award.date ? `<span class="additional-item-meta">${escapeHtml(formatDate(award.date))}</span>` : ''}
            </div>
            ${award.issuer ? `<p class="text-small text-muted">${escapeHtml(award.issuer)}</p>` : ''}
            ${award.description ? `<p class="additional-item-description">${escapeHtml(award.description)}</p>` : ''}
        </div>
    `).join('');
};

const renderPublications = (publications) => {
    return publications.map(pub => `
        <div class="additional-item">
            <div class="entry-header">
                <span class="additional-item-title">${escapeHtml(pub.title || '')}</span>
                ${pub.date ? `<span class="additional-item-meta">${escapeHtml(formatDate(pub.date))}</span>` : ''}
            </div>
            ${pub.publisher ? `<p class="text-small text-muted">${escapeHtml(pub.publisher)}</p>` : ''}
            ${pub.description ? `<p class="additional-item-description">${escapeHtml(pub.description)}</p>` : ''}
            ${pub.link ? `<a href="${escapeHtml(pub.link)}" class="text-small text-primary">Read More</a>` : ''}
        </div>
    `).join('');
};

const renderVolunteers = (volunteers) => {
    return volunteers.map(vol => {
        const dateStr = formatDateRange(vol.startDate, vol.endDate);
        return `
            <div class="additional-item">
                <div class="entry-header">
                    <div>
                        <span class="additional-item-title">${escapeHtml(vol.role || '')}</span>
                        ${vol.organization ? `<span class="text-muted"> at ${escapeHtml(vol.organization)}</span>` : ''}
                    </div>
                    ${dateStr ? `<span class="additional-item-meta">${escapeHtml(dateStr)}</span>` : ''}
                </div>
                ${vol.description ? `<p class="additional-item-description">${escapeHtml(vol.description)}</p>` : ''}
            </div>
        `;
    }).join('');
};

const renderInterests = (interests) => {
    const items = interests.map(int => 
        typeof int === 'string' ? int : int.name || ''
    ).filter(Boolean);

    if (items.length === 0) return '';

    return `<p class="skills-inline">${items.map(i => escapeHtml(i)).join(', ')}</p>`;
};

const renderGenericList = (content) => {
    if (Array.isArray(content)) {
        return `
            <ul class="item-list">
                ${content.map(item => {
                    const text = typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item);
                    return `<li>${escapeHtml(text)}</li>`;
                }).join('')}
            </ul>
        `;
    }
    return `<p>${escapeHtml(String(content))}</p>`;
};

/**
 * Get SVG icon by name
 * @param {string} name - Icon name
 * @returns {string} SVG HTML
 */
const getIcon = (name) => {
    const icons = {
        email: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
        phone: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,
        location: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
        linkedin: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>`,
        website: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
        github: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>`,
        portfolio: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>`
    };
    return icons[name] || '';
};

export default {
    renderPersonalInfo,
    renderSummary,
    renderExperience,
    renderEducation,
    renderSkills,
    renderAdditionalSections
};
