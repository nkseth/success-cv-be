/**
 * Theme Image Downloader / Generator
 * 
 * Generates preview images for resume themes using Puppeteer.
 * Creates styled HTML resume templates and captures them as PNG images.
 * 
 * Usage: node drizzle/seeds/theme-image-downloader.js
 * 
 * Output: uploads/themes/{theme-slug}-preview.png
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../../uploads/themes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Sample resume content for preview generation
 */
const sampleResumeContent = {
    personalInfo: {
        name: 'Alexandra Johnson',
        title: 'Senior Software Engineer',
        email: 'alexandra.johnson@email.com',
        phone: '+1 (555) 123-4567',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/alexandraj',
        github: 'github.com/alexjohnson'
    },
    summary: 'Results-driven software engineer with 8+ years of experience building scalable web applications. Expert in React, Node.js, and cloud technologies. Passionate about clean code, mentoring teams, and delivering exceptional user experiences.',
    experience: [
        {
            company: 'TechCorp Inc.',
            title: 'Senior Software Engineer',
            location: 'San Francisco, CA',
            startDate: 'Jan 2021',
            endDate: 'Present',
            highlights: [
                'Led development of microservices architecture serving 2M+ daily users',
                'Reduced API response time by 40% through optimization and caching',
                'Mentored team of 5 junior developers on best practices'
            ]
        },
        {
            company: 'StartupXYZ',
            title: 'Full Stack Developer',
            location: 'Palo Alto, CA',
            startDate: 'Mar 2018',
            endDate: 'Dec 2020',
            highlights: [
                'Built real-time collaboration features using WebSocket',
                'Implemented CI/CD pipeline reducing deployment time by 60%',
                'Developed responsive mobile-first user interfaces'
            ]
        }
    ],
    education: [
        {
            institution: 'Stanford University',
            degree: 'M.S. Computer Science',
            year: '2018'
        },
        {
            institution: 'UC Berkeley',
            degree: 'B.S. Computer Science',
            year: '2016'
        }
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'PostgreSQL', 'MongoDB', 'GraphQL', 'REST APIs', 'Git']
};

/**
 * Theme definitions for generating preview images
 * Each theme has styling properties that affect the resume appearance
 */
const themeDefinitions = [
    {
        slug: 'classic-professional',
        name: 'Classic Professional',
        primaryColor: '#1a1a2e',
        accentColor: '#0f3460',
        textColor: '#333333',
        bgColor: '#ffffff',
        fontFamily: 'Georgia, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'modern-minimal',
        name: 'Modern Minimal',
        primaryColor: '#2d3436',
        accentColor: '#00b894',
        textColor: '#2d3436',
        bgColor: '#ffffff',
        fontFamily: 'Inter, Helvetica, sans-serif',
        headerStyle: 'simple'
    },
    {
        slug: 'two-column-pro',
        name: 'Two Column Pro',
        primaryColor: '#2c3e50',
        accentColor: '#3498db',
        textColor: '#333333',
        bgColor: '#ffffff',
        fontFamily: 'Roboto, Arial, sans-serif',
        headerStyle: 'accent-left',
        twoColumn: true
    },
    {
        slug: 'ats-optimized',
        name: 'ATS Optimized',
        primaryColor: '#000000',
        accentColor: '#000000',
        textColor: '#000000',
        bgColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        headerStyle: 'underline'
    },
    {
        slug: 'creative-bold',
        name: 'Creative Bold',
        primaryColor: '#6c5ce7',
        accentColor: '#fd79a8',
        textColor: '#2d3436',
        bgColor: '#ffffff',
        fontFamily: 'Montserrat, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'academic-scholar',
        name: 'Academic Scholar',
        primaryColor: '#1e3a5f',
        accentColor: '#166088',
        textColor: '#333333',
        bgColor: '#ffffff',
        fontFamily: 'Times New Roman, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'tech-developer',
        name: 'Tech Developer',
        primaryColor: '#0d1117',
        accentColor: '#58a6ff',
        textColor: '#333333',
        bgColor: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        headerStyle: 'accent-left'
    },
    {
        slug: 'executive-leadership',
        name: 'Executive Leadership',
        primaryColor: '#1a1a2e',
        accentColor: '#9a8c98',
        textColor: '#22223b',
        bgColor: '#ffffff',
        fontFamily: 'Playfair Display, Georgia, serif',
        headerStyle: 'simple'
    },
    // Additional 22 themes to reach 30 total
    {
        slug: 'startup-fresh',
        name: 'Startup Fresh',
        primaryColor: '#ff6b6b',
        accentColor: '#4ecdc4',
        textColor: '#2f3542',
        bgColor: '#ffffff',
        fontFamily: 'Poppins, sans-serif',
        headerStyle: 'accent-left'
    },
    {
        slug: 'corporate-elegant',
        name: 'Corporate Elegant',
        primaryColor: '#2c3e50',
        accentColor: '#c0a080',
        textColor: '#333333',
        bgColor: '#ffffff',
        fontFamily: 'Garamond, serif',
        headerStyle: 'simple'
    },
    {
        slug: 'design-portfolio',
        name: 'Design Portfolio',
        primaryColor: '#e84545',
        accentColor: '#903749',
        textColor: '#2b2d42',
        bgColor: '#ffffff',
        fontFamily: 'Raleway, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'finance-professional',
        name: 'Finance Professional',
        primaryColor: '#1b4332',
        accentColor: '#40916c',
        textColor: '#2d3436',
        bgColor: '#ffffff',
        fontFamily: 'Cambria, Georgia, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'healthcare-clean',
        name: 'Healthcare Clean',
        primaryColor: '#0077b6',
        accentColor: '#00b4d8',
        textColor: '#023e8a',
        bgColor: '#ffffff',
        fontFamily: 'Open Sans, sans-serif',
        headerStyle: 'simple'
    },
    {
        slug: 'legal-formal',
        name: 'Legal Formal',
        primaryColor: '#1d3557',
        accentColor: '#457b9d',
        textColor: '#1d3557',
        bgColor: '#ffffff',
        fontFamily: 'Book Antiqua, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'marketing-vibrant',
        name: 'Marketing Vibrant',
        primaryColor: '#ff006e',
        accentColor: '#8338ec',
        textColor: '#3a0ca3',
        bgColor: '#ffffff',
        fontFamily: 'Nunito, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'consultant-sleek',
        name: 'Consultant Sleek',
        primaryColor: '#264653',
        accentColor: '#2a9d8f',
        textColor: '#264653',
        bgColor: '#ffffff',
        fontFamily: 'Source Sans Pro, sans-serif',
        headerStyle: 'accent-left'
    },
    {
        slug: 'engineer-modern',
        name: 'Engineer Modern',
        primaryColor: '#3d405b',
        accentColor: '#e07a5f',
        textColor: '#3d405b',
        bgColor: '#ffffff',
        fontFamily: 'Fira Sans, sans-serif',
        headerStyle: 'simple'
    },
    {
        slug: 'data-science',
        name: 'Data Science',
        primaryColor: '#5f0a87',
        accentColor: '#a4508b',
        textColor: '#2b2d42',
        bgColor: '#ffffff',
        fontFamily: 'IBM Plex Sans, sans-serif',
        headerStyle: 'accent-left'
    },
    {
        slug: 'product-manager',
        name: 'Product Manager',
        primaryColor: '#0a9396',
        accentColor: '#94d2bd',
        textColor: '#001219',
        bgColor: '#ffffff',
        fontFamily: 'Lato, sans-serif',
        headerStyle: 'simple'
    },
    {
        slug: 'ux-designer',
        name: 'UX Designer',
        primaryColor: '#7209b7',
        accentColor: '#f72585',
        textColor: '#3a0ca3',
        bgColor: '#ffffff',
        fontFamily: 'DM Sans, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'sales-dynamic',
        name: 'Sales Dynamic',
        primaryColor: '#d62828',
        accentColor: '#f77f00',
        textColor: '#003049',
        bgColor: '#ffffff',
        fontFamily: 'Rubik, sans-serif',
        headerStyle: 'accent-left'
    },
    {
        slug: 'hr-professional',
        name: 'HR Professional',
        primaryColor: '#48cae4',
        accentColor: '#90e0ef',
        textColor: '#023047',
        bgColor: '#ffffff',
        fontFamily: 'Work Sans, sans-serif',
        headerStyle: 'simple'
    },
    {
        slug: 'project-manager',
        name: 'Project Manager',
        primaryColor: '#3a5a40',
        accentColor: '#a3b18a',
        textColor: '#344e41',
        bgColor: '#ffffff',
        fontFamily: 'Karla, sans-serif',
        headerStyle: 'underline'
    },
    {
        slug: 'architect-elegant',
        name: 'Architect Elegant',
        primaryColor: '#212529',
        accentColor: '#6c757d',
        textColor: '#212529',
        bgColor: '#ffffff',
        fontFamily: 'Cormorant, serif',
        headerStyle: 'simple'
    },
    {
        slug: 'teacher-friendly',
        name: 'Teacher Friendly',
        primaryColor: '#5e60ce',
        accentColor: '#7400b8',
        textColor: '#3c096c',
        bgColor: '#ffffff',
        fontFamily: 'Quicksand, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'researcher-classic',
        name: 'Researcher Classic',
        primaryColor: '#4a4e69',
        accentColor: '#9a8c98',
        textColor: '#22223b',
        bgColor: '#ffffff',
        fontFamily: 'Palatino, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'journalist-bold',
        name: 'Journalist Bold',
        primaryColor: '#000000',
        accentColor: '#495057',
        textColor: '#212529',
        bgColor: '#ffffff',
        fontFamily: 'Merriweather, serif',
        headerStyle: 'simple'
    },
    {
        slug: 'creative-artist',
        name: 'Creative Artist',
        primaryColor: '#ff9f1c',
        accentColor: '#ffbf69',
        textColor: '#2c2c54',
        bgColor: '#ffffff',
        fontFamily: 'Josefin Sans, sans-serif',
        headerStyle: 'background'
    },
    {
        slug: 'government-formal',
        name: 'Government Formal',
        primaryColor: '#14213d',
        accentColor: '#fca311',
        textColor: '#000000',
        bgColor: '#ffffff',
        fontFamily: 'Libre Baskerville, serif',
        headerStyle: 'underline'
    },
    {
        slug: 'nonprofit-warm',
        name: 'Nonprofit Warm',
        primaryColor: '#2d6a4f',
        accentColor: '#52b788',
        textColor: '#1b4332',
        bgColor: '#ffffff',
        fontFamily: 'Cabin, sans-serif',
        headerStyle: 'simple'
    }
];

/**
 * Generate HTML template for a resume theme
 */
function generateResumeHTML(theme, content) {
    const { personalInfo, summary, experience, education, skills } = content;
    
    const headerStyleCSS = {
        'underline': `border-bottom: 2px solid ${theme.primaryColor}; padding-bottom: 4px;`,
        'simple': ``,
        'accent-left': `border-left: 4px solid ${theme.accentColor}; padding-left: 10px;`,
        'background': `background-color: ${theme.primaryColor}; color: white; padding: 8px 12px; border-radius: 4px;`
    };

    const sectionHeaderStyle = headerStyleCSS[theme.headerStyle] || '';

    if (theme.twoColumn) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: ${theme.fontFamily};
            color: ${theme.textColor};
            background: ${theme.bgColor};
            font-size: 10pt;
            line-height: 1.4;
        }
        .container {
            display: flex;
            width: 595px;
            min-height: 842px;
            margin: 0 auto;
        }
        .sidebar {
            width: 200px;
            background: ${theme.primaryColor};
            color: white;
            padding: 30px 20px;
        }
        .main {
            flex: 1;
            padding: 30px 25px;
        }
        .name {
            font-size: 18pt;
            font-weight: 700;
            margin-bottom: 5px;
        }
        .title {
            font-size: 11pt;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        .sidebar-section {
            margin-bottom: 20px;
        }
        .sidebar-section h3 {
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            opacity: 0.8;
        }
        .sidebar-section p, .sidebar-section li {
            font-size: 9pt;
            margin-bottom: 5px;
        }
        .skills-list {
            list-style: none;
        }
        .skills-list li {
            background: rgba(255,255,255,0.1);
            padding: 4px 8px;
            border-radius: 3px;
            margin-bottom: 5px;
            display: inline-block;
            margin-right: 5px;
        }
        .main-section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 12pt;
            color: ${theme.primaryColor};
            ${sectionHeaderStyle}
            margin-bottom: 12px;
            font-weight: 600;
        }
        .summary-text {
            font-size: 10pt;
            line-height: 1.5;
        }
        .job {
            margin-bottom: 15px;
        }
        .job-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .job-title {
            font-weight: 600;
            color: ${theme.primaryColor};
        }
        .job-company {
            font-weight: 500;
        }
        .job-date {
            color: #666;
            font-size: 9pt;
        }
        .job-highlights {
            list-style-type: disc;
            margin-left: 18px;
            font-size: 9pt;
        }
        .job-highlights li {
            margin-bottom: 3px;
        }
        .education-item {
            margin-bottom: 8px;
        }
        .education-degree {
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <div class="name">${personalInfo.name}</div>
            <div class="title">${personalInfo.title}</div>
            
            <div class="sidebar-section">
                <h3>Contact</h3>
                <p>${personalInfo.email}</p>
                <p>${personalInfo.phone}</p>
                <p>${personalInfo.location}</p>
            </div>
            
            <div class="sidebar-section">
                <h3>Skills</h3>
                <ul class="skills-list">
                    ${skills.slice(0, 8).map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
            
            <div class="sidebar-section">
                <h3>Education</h3>
                ${education.map(e => `
                    <div style="margin-bottom: 8px;">
                        <p style="font-weight: 600;">${e.degree}</p>
                        <p>${e.institution}</p>
                        <p style="opacity: 0.8;">${e.year}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="main">
            <div class="main-section">
                <h2 class="section-title">Professional Summary</h2>
                <p class="summary-text">${summary}</p>
            </div>
            
            <div class="main-section">
                <h2 class="section-title">Experience</h2>
                ${experience.map(exp => `
                    <div class="job">
                        <div class="job-header">
                            <div>
                                <span class="job-title">${exp.title}</span>
                                <span class="job-company"> | ${exp.company}</span>
                            </div>
                            <span class="job-date">${exp.startDate} - ${exp.endDate}</span>
                        </div>
                        <ul class="job-highlights">
                            ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    // Single column layout
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: ${theme.fontFamily};
            color: ${theme.textColor};
            background: ${theme.bgColor};
            font-size: 10pt;
            line-height: 1.5;
        }
        .container {
            width: 595px;
            min-height: 842px;
            margin: 0 auto;
            padding: 40px 50px;
        }
        .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 2px solid ${theme.primaryColor};
            padding-bottom: 20px;
        }
        .name {
            font-size: 24pt;
            font-weight: 700;
            color: ${theme.primaryColor};
            margin-bottom: 5px;
        }
        .title {
            font-size: 12pt;
            color: ${theme.accentColor};
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: 9pt;
            color: #666;
        }
        .contact-info span {
            margin: 0 8px;
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 12pt;
            color: ${theme.primaryColor};
            ${sectionHeaderStyle}
            margin-bottom: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .summary-text {
            font-size: 10pt;
            line-height: 1.6;
        }
        .job {
            margin-bottom: 15px;
        }
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 5px;
        }
        .job-title {
            font-weight: 600;
            font-size: 11pt;
            color: ${theme.primaryColor};
        }
        .job-company {
            font-weight: 500;
        }
        .job-location {
            color: #888;
            font-size: 9pt;
        }
        .job-date {
            color: #666;
            font-size: 9pt;
        }
        .job-highlights {
            list-style-type: disc;
            margin-left: 20px;
            font-size: 9.5pt;
        }
        .job-highlights li {
            margin-bottom: 4px;
        }
        .education-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .education-degree {
            font-weight: 600;
        }
        .education-institution {
            font-style: italic;
        }
        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .skill-tag {
            background: ${theme.primaryColor}15;
            color: ${theme.primaryColor};
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 9pt;
            border: 1px solid ${theme.primaryColor}30;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="name">${personalInfo.name}</h1>
            <div class="title">${personalInfo.title}</div>
            <div class="contact-info">
                <span>${personalInfo.email}</span> |
                <span>${personalInfo.phone}</span> |
                <span>${personalInfo.location}</span>
            </div>
        </header>
        
        <section class="section">
            <h2 class="section-title">Professional Summary</h2>
            <p class="summary-text">${summary}</p>
        </section>
        
        <section class="section">
            <h2 class="section-title">Experience</h2>
            ${experience.map(exp => `
                <div class="job">
                    <div class="job-header">
                        <div>
                            <span class="job-title">${exp.title}</span>
                            <span class="job-company"> at ${exp.company}</span>
                            <span class="job-location"> - ${exp.location}</span>
                        </div>
                        <span class="job-date">${exp.startDate} - ${exp.endDate}</span>
                    </div>
                    <ul class="job-highlights">
                        ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </section>
        
        <section class="section">
            <h2 class="section-title">Education</h2>
            ${education.map(e => `
                <div class="education-item">
                    <div>
                        <span class="education-degree">${e.degree}</span>
                        <span class="education-institution"> - ${e.institution}</span>
                    </div>
                    <span>${e.year}</span>
                </div>
            `).join('')}
        </section>
        
        <section class="section">
            <h2 class="section-title">Skills</h2>
            <div class="skills-list">
                ${skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
        </section>
    </div>
</body>
</html>`;
}

/**
 * Generate preview images for all themes
 */
async function downloadThemeImages() {
    console.log('🎨 Starting theme preview image generation...');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📋 Total themes to process: ${themeDefinitions.length}\n`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        for (const theme of themeDefinitions) {
            console.log(`   ⏳ Generating: ${theme.name} (${theme.slug})...`);
            
            const page = await browser.newPage();
            
            // Generate HTML content first
            const html = generateResumeHTML(theme, sampleResumeContent);
            
            // Set content (no network wait since we use system fonts)
            await page.setContent(html, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });

            // Small delay to ensure rendering is complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get the actual content dimensions
            const dimensions = await page.evaluate(() => {
                const container = document.querySelector('.container');
                if (container) {
                    return {
                        width: container.scrollWidth,
                        height: container.scrollHeight
                    };
                }
                return {
                    width: document.body.scrollWidth,
                    height: document.body.scrollHeight
                };
            });

            // Set viewport to match content (A4 proportions, full height)
            const width = 595;
            const height = Math.max(842, dimensions.height);
            
            await page.setViewport({
                width: width,
                height: height,
                deviceScaleFactor: 2 // Higher quality
            });

            // Re-set content after viewport change to ensure proper rendering
            await page.setContent(html, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            await new Promise(resolve => setTimeout(resolve, 100));

            // Save full page screenshot
            const outputPath = path.join(OUTPUT_DIR, `${theme.slug}-preview.png`);
            await page.screenshot({
                path: outputPath,
                type: 'png',
                fullPage: true
            });

            await page.close();
            console.log(`   ✅ Generated: ${theme.slug}-preview.png`);
        }

        console.log(`\n🎉 Successfully generated ${themeDefinitions.length} preview images`);
        console.log(`📁 Images saved to: ${OUTPUT_DIR}`);

    } catch (error) {
        console.error('❌ Error generating theme images:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Export for use in seeder
export { themeDefinitions, sampleResumeContent, downloadThemeImages };

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    downloadThemeImages()
        .then(() => {
            console.log('✅ Theme image generation complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Failed:', error);
            process.exit(1);
        });
}
