/**
 * Theme Image Downloader / Generator
 * 
 * Generates preview images for resume themes using Puppeteer.
 * Creates styled HTML resume templates and captures them as PNG images.
 * Uses the actual theme configs from themes-with-images.seed.js
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
 * Theme definitions derived from the actual themeConfigs
 * These match exactly with the theme configs in themes-with-images.seed.js
 */
const themeDefinitions = [
    // ============================================
    // PROFESSIONAL THEMES (1-6)
    // ============================================
    {
        slug: 'classic-professional',
        name: 'Classic Professional',
        config: {
            colors: { primary: '#1a1a2e', secondary: '#16213e', accent: '#0f3460', text: '#333333', textLight: '#666666', background: '#ffffff', border: '#dddddd', headerBg: '#f5f5f5' },
            typography: { fontFamily: "Georgia, 'Times New Roman', serif", headerFontFamily: "Georgia, 'Times New Roman', serif", baseFontSize: 10, sizes: { name: 22, title: 13, sectionHeading: 12, subheading: 11, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 }, spacing: { section: 18, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'executive-leadership',
        name: 'Executive Leadership',
        config: {
            colors: { primary: '#1a1a2e', secondary: '#4a4e69', accent: '#9a8c98', text: '#22223b', textLight: '#4a4e69', background: '#ffffff', border: '#c9ada7', headerBg: '#f9f7f7' },
            typography: { fontFamily: "'Playfair Display', Georgia, serif", headerFontFamily: "'Playfair Display', Georgia, serif", baseFontSize: 11, sizes: { name: 24, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.6 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.65, right: 0.65, bottom: 0.65, left: 0.65 }, spacing: { section: 20, item: 12, line: 5, paragraph: 7 } }
        }
    },
    {
        slug: 'corporate-elegant',
        name: 'Corporate Elegant',
        config: {
            colors: { primary: '#2c3e50', secondary: '#34495e', accent: '#1abc9c', text: '#2c3e50', textLight: '#7f8c8d', background: '#ffffff', border: '#bdc3c7', headerBg: '#ecf0f1' },
            typography: { fontFamily: "'Libre Baskerville', Georgia, serif", headerFontFamily: "'Libre Baskerville', Georgia, serif", baseFontSize: 10, sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'circle', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 }, spacing: { section: 18, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'business-formal',
        name: 'Business Formal',
        config: {
            colors: { primary: '#1f2937', secondary: '#374151', accent: '#3b82f6', text: '#1f2937', textLight: '#6b7280', background: '#ffffff', border: '#d1d5db', headerBg: '#f9fafb' },
            typography: { fontFamily: "'Source Serif Pro', Georgia, serif", headerFontFamily: "'Source Serif Pro', Georgia, serif", baseFontSize: 10, sizes: { name: 21, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'comma-separated', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 16, item: 9, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'polished-pro',
        name: 'Polished Pro',
        config: {
            colors: { primary: '#0f172a', secondary: '#1e293b', accent: '#0ea5e9', text: '#0f172a', textLight: '#64748b', background: '#ffffff', border: '#cbd5e1', headerBg: '#f8fafc' },
            typography: { fontFamily: "'Merriweather', Georgia, serif", headerFontFamily: "'Merriweather', Georgia, serif", baseFontSize: 10, sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 2, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'capitalize', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 }, spacing: { section: 17, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'senior-manager',
        name: 'Senior Manager',
        config: {
            colors: { primary: '#18181b', secondary: '#27272a', accent: '#a1a1aa', text: '#18181b', textLight: '#52525b', background: '#ffffff', border: '#d4d4d8', headerBg: '#fafafa' },
            typography: { fontFamily: "'Crimson Pro', Georgia, serif", headerFontFamily: "'Crimson Pro', Georgia, serif", baseFontSize: 11, sizes: { name: 24, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.6 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'none', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.6, right: 0.65, bottom: 0.6, left: 0.65 }, spacing: { section: 19, item: 11, line: 5, paragraph: 7 } }
        }
    },

    // ============================================
    // MINIMAL THEMES (7-12)
    // ============================================
    {
        slug: 'modern-minimal',
        name: 'Modern Minimal',
        config: {
            colors: { primary: '#2d3436', secondary: '#636e72', accent: '#00b894', text: '#2d3436', textLight: '#636e72', background: '#ffffff', border: '#e0e0e0', headerBg: '#fafafa' },
            typography: { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", headerFontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", baseFontSize: 10, sizes: { name: 24, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.6 },
            style: { borderRadius: 4, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'left', sectionTitleCase: 'capitalize', showIcons: false },
            layout: { margins: { top: 0.6, right: 0.7, bottom: 0.6, left: 0.7 }, spacing: { section: 20, item: 12, line: 5, paragraph: 8 } }
        }
    },
    {
        slug: 'clean-slate',
        name: 'Clean Slate',
        config: {
            colors: { primary: '#111827', secondary: '#374151', accent: '#6366f1', text: '#111827', textLight: '#6b7280', background: '#ffffff', border: '#e5e7eb', headerBg: '#ffffff' },
            typography: { fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif", headerFontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 26, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.65 },
            style: { borderRadius: 0, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.7, right: 0.75, bottom: 0.7, left: 0.75 }, spacing: { section: 22, item: 14, line: 6, paragraph: 9 } }
        }
    },
    {
        slug: 'swiss-design',
        name: 'Swiss Design',
        config: {
            colors: { primary: '#000000', secondary: '#333333', accent: '#ff0000', text: '#000000', textLight: '#555555', background: '#ffffff', border: '#e0e0e0', headerBg: '#ffffff' },
            typography: { fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", headerFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", baseFontSize: 10, sizes: { name: 28, title: 14, sectionHeading: 10, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 0, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.6, right: 0.65, bottom: 0.6, left: 0.65 }, spacing: { section: 20, item: 12, line: 5, paragraph: 7 } }
        }
    },
    {
        slug: 'elegant-simple',
        name: 'Elegant Simple',
        config: {
            colors: { primary: '#1a1a1a', secondary: '#4a4a4a', accent: '#b8860b', text: '#1a1a1a', textLight: '#666666', background: '#ffffff', border: '#d0d0d0', headerBg: '#fafafa' },
            typography: { fontFamily: "'Lora', Georgia, serif", headerFontFamily: "'Lora', Georgia, serif", baseFontSize: 10, sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.6 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'capitalize', showIcons: false },
            layout: { margins: { top: 0.65, right: 0.7, bottom: 0.65, left: 0.7 }, spacing: { section: 21, item: 13, line: 5, paragraph: 8 } }
        }
    },
    {
        slug: 'nordic-light',
        name: 'Nordic Light',
        config: {
            colors: { primary: '#2e3440', secondary: '#3b4252', accent: '#5e81ac', text: '#2e3440', textLight: '#4c566a', background: '#ffffff', border: '#d8dee9', headerBg: '#eceff4' },
            typography: { fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", headerFontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.6 },
            style: { borderRadius: 4, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'circle', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'left', sectionTitleCase: 'capitalize', showIcons: false },
            layout: { margins: { top: 0.65, right: 0.7, bottom: 0.65, left: 0.7 }, spacing: { section: 20, item: 12, line: 5, paragraph: 8 } }
        }
    },
    {
        slug: 'zen-minimal',
        name: 'Zen Minimal',
        config: {
            colors: { primary: '#2d2d2d', secondary: '#4d4d4d', accent: '#8b9dc3', text: '#2d2d2d', textLight: '#6d6d6d', background: '#ffffff', border: '#e8e8e8', headerBg: '#ffffff' },
            typography: { fontFamily: "'Nunito Sans', 'Helvetica Neue', sans-serif", headerFontFamily: "'Nunito Sans', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 26, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.7 },
            style: { borderRadius: 0, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'none', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'center', sectionTitleCase: 'lowercase', showIcons: false },
            layout: { margins: { top: 0.7, right: 0.75, bottom: 0.7, left: 0.75 }, spacing: { section: 24, item: 14, line: 6, paragraph: 10 } }
        }
    },

    // ============================================
    // TECHNICAL THEMES (13-17)
    // ============================================
    {
        slug: 'tech-developer',
        name: 'Tech Developer',
        config: {
            colors: { primary: '#0d1117', secondary: '#21262d', accent: '#58a6ff', text: '#333333', textLight: '#586069', background: '#ffffff', border: '#e1e4e8', headerBg: '#f6f8fa' },
            typography: { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", headerFontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", baseFontSize: 10, sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 6, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'dash', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.45, right: 0.5, bottom: 0.45, left: 0.5 }, spacing: { section: 16, item: 10, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'software-engineer',
        name: 'Software Engineer',
        config: {
            colors: { primary: '#1e1e1e', secondary: '#2d2d2d', accent: '#007acc', text: '#1e1e1e', textLight: '#6a6a6a', background: '#ffffff', border: '#d4d4d4', headerBg: '#f3f3f3' },
            typography: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", headerFontFamily: "'Inter', 'Segoe UI', sans-serif", baseFontSize: 10, sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 4, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'square', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 15, item: 9, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'data-scientist',
        name: 'Data Scientist',
        config: {
            colors: { primary: '#1a365d', secondary: '#2a4365', accent: '#3182ce', text: '#1a202c', textLight: '#4a5568', background: '#ffffff', border: '#cbd5e0', headerBg: '#ebf8ff' },
            typography: { fontFamily: "'Source Sans Pro', 'Helvetica Neue', sans-serif", headerFontFamily: "'Source Sans Pro', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 4, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 16, item: 10, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'devops-engineer',
        name: 'DevOps Engineer',
        config: {
            colors: { primary: '#232f3e', secondary: '#37475a', accent: '#ff9900', text: '#232f3e', textLight: '#545b64', background: '#ffffff', border: '#d5dbdb', headerBg: '#fafafa' },
            typography: { fontFamily: "'Ubuntu', 'Segoe UI', sans-serif", headerFontFamily: "'Ubuntu', 'Segoe UI', sans-serif", baseFontSize: 10, sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 4, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'dash', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 15, item: 9, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'cybersecurity-pro',
        name: 'Cybersecurity Pro',
        config: {
            colors: { primary: '#0a0a0a', secondary: '#1a1a1a', accent: '#00ff88', text: '#1a1a1a', textLight: '#4a4a4a', background: '#ffffff', border: '#d0d0d0', headerBg: '#f5f5f5' },
            typography: { fontFamily: "'Roboto Mono', 'Courier New', monospace", headerFontFamily: "'Roboto', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 2, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'square', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 16, item: 10, line: 4, paragraph: 5 } }
        }
    },

    // ============================================
    // ATS-OPTIMIZED THEMES (18-21)
    // ============================================
    {
        slug: 'ats-optimized',
        name: 'ATS Optimized',
        config: {
            colors: { primary: '#000000', secondary: '#333333', accent: '#000000', text: '#000000', textLight: '#333333', background: '#ffffff', border: '#cccccc', headerBg: '#ffffff' },
            typography: { fontFamily: "Arial, sans-serif", headerFontFamily: "Arial, sans-serif", baseFontSize: 11, sizes: { name: 18, title: 12, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.4 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'comma-separated', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }, spacing: { section: 14, item: 8, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'ats-friendly',
        name: 'ATS Friendly',
        config: {
            colors: { primary: '#1a1a1a', secondary: '#333333', accent: '#1a1a1a', text: '#1a1a1a', textLight: '#444444', background: '#ffffff', border: '#cccccc', headerBg: '#ffffff' },
            typography: { fontFamily: "'Times New Roman', Times, serif", headerFontFamily: "'Times New Roman', Times, serif", baseFontSize: 11, sizes: { name: 18, title: 12, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.4 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'comma-separated', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }, spacing: { section: 14, item: 8, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'ats-standard',
        name: 'ATS Standard',
        config: {
            colors: { primary: '#000000', secondary: '#333333', accent: '#2b5797', text: '#000000', textLight: '#333333', background: '#ffffff', border: '#cccccc', headerBg: '#ffffff' },
            typography: { fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif", headerFontFamily: "Calibri, 'Segoe UI', Arial, sans-serif", baseFontSize: 11, sizes: { name: 18, title: 12, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.4 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'comma-separated', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }, spacing: { section: 14, item: 8, line: 4, paragraph: 5 } }
        }
    },
    {
        slug: 'ats-modern',
        name: 'ATS Modern',
        config: {
            colors: { primary: '#2d3748', secondary: '#4a5568', accent: '#2d3748', text: '#1a202c', textLight: '#4a5568', background: '#ffffff', border: '#e2e8f0', headerBg: '#ffffff' },
            typography: { fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", headerFontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", baseFontSize: 11, sizes: { name: 20, title: 12, sectionHeading: 11, subheading: 11, body: 11, small: 10 }, lineHeight: 1.45 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 15, item: 9, line: 4, paragraph: 5 } }
        }
    },

    // ============================================
    // CREATIVE THEMES (22-25)
    // ============================================
    {
        slug: 'creative-bold',
        name: 'Creative Bold',
        config: {
            colors: { primary: '#6c5ce7', secondary: '#2d3436', accent: '#fd79a8', text: '#2d3436', textLight: '#636e72', background: '#ffffff', border: '#dfe6e9', headerBg: '#f8f9fa' },
            typography: { fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif", headerFontFamily: "'Montserrat', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 26, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 8, dividerStyle: 'solid', dividerWidth: 2, bulletStyle: 'square', headingStyle: 'background', datePosition: 'right', skillsLayout: 'pills', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 20, item: 10, line: 5, paragraph: 6 } }
        }
    },
    {
        slug: 'designer-portfolio',
        name: 'Designer Portfolio',
        config: {
            colors: { primary: '#e84393', secondary: '#2d3436', accent: '#00cec9', text: '#2d3436', textLight: '#636e72', background: '#ffffff', border: '#dfe6e9', headerBg: '#ffeef5' },
            typography: { fontFamily: "'Poppins', 'Helvetica Neue', sans-serif", headerFontFamily: "'Poppins', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 28, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 12, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'circle', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'pills', headerAlignment: 'left', sectionTitleCase: 'capitalize', showIcons: true },
            layout: { margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 }, spacing: { section: 22, item: 12, line: 5, paragraph: 7 } }
        }
    },
    {
        slug: 'artistic-flair',
        name: 'Artistic Flair',
        config: {
            colors: { primary: '#5f27cd', secondary: '#341f97', accent: '#ff6b6b', text: '#2d3436', textLight: '#636e72', background: '#ffffff', border: '#dfe6e9', headerBg: '#f5f3ff' },
            typography: { fontFamily: "'Raleway', 'Helvetica Neue', sans-serif", headerFontFamily: "'Playfair Display', Georgia, serif", baseFontSize: 10, sizes: { name: 26, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 16, dividerStyle: 'dashed', dividerWidth: 1, bulletStyle: 'circle', headingStyle: 'background', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'center', sectionTitleCase: 'capitalize', showIcons: true },
            layout: { margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 }, spacing: { section: 20, item: 11, line: 5, paragraph: 6 } }
        }
    },
    {
        slug: 'modern-creative',
        name: 'Modern Creative',
        config: {
            colors: { primary: '#10b981', secondary: '#064e3b', accent: '#f59e0b', text: '#1f2937', textLight: '#4b5563', background: '#ffffff', border: '#d1fae5', headerBg: '#ecfdf5' },
            typography: { fontFamily: "'Work Sans', 'Helvetica Neue', sans-serif", headerFontFamily: "'Work Sans', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 26, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 }, lineHeight: 1.5 },
            style: { borderRadius: 8, dividerStyle: 'solid', dividerWidth: 2, bulletStyle: 'disc', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'left', sectionTitleCase: 'uppercase', showIcons: true },
            layout: { margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 }, spacing: { section: 18, item: 11, line: 5, paragraph: 6 } }
        }
    },

    // ============================================
    // ACADEMIC THEMES (26-28)
    // ============================================
    {
        slug: 'academic-scholar',
        name: 'Academic Scholar',
        config: {
            colors: { primary: '#1e3a5f', secondary: '#4a6fa5', accent: '#166088', text: '#333333', textLight: '#666666', background: '#ffffff', border: '#d0d0d0', headerBg: '#f5f7fa' },
            typography: { fontFamily: "'Times New Roman', Georgia, serif", headerFontFamily: "'Times New Roman', Georgia, serif", baseFontSize: 11, sizes: { name: 20, title: 13, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.5 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'list', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 }, spacing: { section: 16, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'research-scientist',
        name: 'Research Scientist',
        config: {
            colors: { primary: '#003366', secondary: '#336699', accent: '#0066cc', text: '#333333', textLight: '#666666', background: '#ffffff', border: '#cccccc', headerBg: '#f0f4f8' },
            typography: { fontFamily: "'Charter', Georgia, serif", headerFontFamily: "'Charter', Georgia, serif", baseFontSize: 11, sizes: { name: 20, title: 13, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.5 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'simple', datePosition: 'right', skillsLayout: 'list', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 }, spacing: { section: 16, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'university-professor',
        name: 'University Professor',
        config: {
            colors: { primary: '#2c2c54', secondary: '#474787', accent: '#706fd3', text: '#2c2c54', textLight: '#5a5a5a', background: '#ffffff', border: '#c8c8c8', headerBg: '#f8f8fc' },
            typography: { fontFamily: "'Garamond', 'Times New Roman', serif", headerFontFamily: "'Garamond', 'Times New Roman', serif", baseFontSize: 11, sizes: { name: 22, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 }, lineHeight: 1.55 },
            style: { borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc', headingStyle: 'underline', datePosition: 'right', skillsLayout: 'list', headerAlignment: 'center', sectionTitleCase: 'uppercase', showIcons: false },
            layout: { margins: { top: 0.65, right: 0.65, bottom: 0.65, left: 0.65 }, spacing: { section: 18, item: 11, line: 5, paragraph: 7 } }
        }
    },

    // ============================================
    // MODERN THEMES (29-30)
    // ============================================
    {
        slug: 'startup-modern',
        name: 'Startup Modern',
        config: {
            colors: { primary: '#7c3aed', secondary: '#4c1d95', accent: '#a78bfa', text: '#1f2937', textLight: '#6b7280', background: '#ffffff', border: '#e5e7eb', headerBg: '#f5f3ff' },
            typography: { fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif", headerFontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 8, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'disc', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'left', sectionTitleCase: 'capitalize', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 18, item: 10, line: 4, paragraph: 6 } }
        }
    },
    {
        slug: 'contemporary-edge',
        name: 'Contemporary Edge',
        config: {
            colors: { primary: '#0f766e', secondary: '#134e4a', accent: '#2dd4bf', text: '#1f2937', textLight: '#4b5563', background: '#ffffff', border: '#ccfbf1', headerBg: '#f0fdfa' },
            typography: { fontFamily: "'Outfit', 'Helvetica Neue', sans-serif", headerFontFamily: "'Outfit', 'Helvetica Neue', sans-serif", baseFontSize: 10, sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 }, lineHeight: 1.55 },
            style: { borderRadius: 6, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'circle', headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'tags', headerAlignment: 'left', sectionTitleCase: 'capitalize', showIcons: true },
            layout: { margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 }, spacing: { section: 18, item: 10, line: 4, paragraph: 6 } }
        }
    }
];

/**
 * Generate HTML template for a resume theme using the actual theme config
 */
function generateResumeHTML(theme, content) {
    const { personalInfo, summary, experience, education, skills } = content;
    const { colors, typography, style, layout } = theme.config;
    
    // Header style CSS based on headingStyle
    const headerStyleCSS = {
        'underline': `border-bottom: 2px solid ${colors.primary}; padding-bottom: 4px;`,
        'simple': ``,
        'accent-left': `border-left: 4px solid ${colors.accent}; padding-left: 10px;`,
        'background': `background-color: ${colors.primary}; color: white; padding: 8px 12px; border-radius: ${style.borderRadius}px;`
    };
    
    const sectionHeaderStyle = headerStyleCSS[style.headingStyle] || '';
    
    // Section title case transformation
    const transformSectionTitle = (title) => {
        switch(style.sectionTitleCase) {
            case 'uppercase': return title.toUpperCase();
            case 'lowercase': return title.toLowerCase();
            case 'capitalize': return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
            default: return title;
        }
    };
    
    // Bullet style CSS
    const getBulletStyle = () => {
        switch(style.bulletStyle) {
            case 'disc': return 'disc';
            case 'circle': return 'circle';
            case 'square': return 'square';
            case 'dash': return '"- "';
            case 'none': return 'none';
            default: return 'disc';
        }
    };
    
    // Skills layout rendering
    const renderSkills = () => {
        switch(style.skillsLayout) {
            case 'tags':
            case 'pills':
                return `<div class="skills-list">${skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>`;
            case 'comma-separated':
                return `<p class="skills-text">${skills.join(', ')}</p>`;
            case 'list':
                return `<ul class="skills-list-vertical">${skills.map(s => `<li>${s}</li>`).join('')}</ul>`;
            case 'grouped':
                return `<div class="skills-grouped">${skills.map(s => `<span class="skill-grouped">${s}</span>`).join('')}</div>`;
            case 'inline':
            default:
                return `<div class="skills-inline">${skills.map(s => `<span class="skill-inline">${s}</span>`).join(' • ')}</div>`;
        }
    };
    
    // Divider CSS
    const dividerCSS = style.dividerStyle !== 'none' && style.dividerWidth > 0 
        ? `border-bottom: ${style.dividerWidth}px ${style.dividerStyle} ${colors.border};` 
        : '';

    // Calculate padding from margins (in inches to pixels, roughly 96dpi)
    const paddingTop = layout.margins.top * 72;
    const paddingRight = layout.margins.right * 72;
    const paddingBottom = layout.margins.bottom * 72;
    const paddingLeft = layout.margins.left * 72;

    // Single column layout
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=Nunito+Sans:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Source+Sans+Pro:wght@300;400;500;600;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@300;400;700&family=Libre+Baskerville:wght@400;700&family=Source+Serif+Pro:wght@400;600;700&family=Crimson+Pro:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: ${typography.fontFamily};
            color: ${colors.text};
            background: ${colors.background};
            font-size: ${typography.baseFontSize}pt;
            line-height: ${typography.lineHeight};
        }
        .container {
            width: 595px;
            min-height: 842px;
            margin: 0 auto;
            padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;
        }
        .header {
            text-align: ${style.headerAlignment};
            margin-bottom: ${layout.spacing.section}px;
            ${dividerCSS}
            padding-bottom: ${layout.spacing.paragraph}px;
        }
        .name {
            font-family: ${typography.headerFontFamily};
            font-size: ${typography.sizes.name}pt;
            font-weight: 700;
            color: ${colors.primary};
            margin-bottom: 5px;
        }
        .title {
            font-size: ${typography.sizes.title}pt;
            color: ${colors.accent};
            margin-bottom: 10px;
        }
        .contact-info {
            font-size: ${typography.sizes.small}pt;
            color: ${colors.textLight};
        }
        .contact-info span {
            margin: 0 8px;
        }
        .section {
            margin-bottom: ${layout.spacing.section}px;
        }
        .section-title {
            font-family: ${typography.headerFontFamily};
            font-size: ${typography.sizes.sectionHeading}pt;
            color: ${colors.primary};
            ${sectionHeaderStyle}
            margin-bottom: ${layout.spacing.item}px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .summary-text {
            font-size: ${typography.sizes.body}pt;
            line-height: ${typography.lineHeight + 0.1};
        }
        .job {
            margin-bottom: ${layout.spacing.item + 5}px;
        }
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: ${layout.spacing.line}px;
        }
        .job-title {
            font-weight: 600;
            font-size: ${typography.sizes.subheading}pt;
            color: ${colors.primary};
        }
        .job-company {
            font-weight: 500;
        }
        .job-location {
            color: ${colors.textLight};
            font-size: ${typography.sizes.small}pt;
        }
        .job-date {
            color: ${colors.textLight};
            font-size: ${typography.sizes.small}pt;
        }
        .job-highlights {
            list-style-type: ${getBulletStyle()};
            margin-left: ${style.bulletStyle === 'none' ? '0' : '20px'};
            font-size: ${typography.sizes.body}pt;
        }
        .job-highlights li {
            margin-bottom: ${layout.spacing.line}px;
            ${style.bulletStyle === 'dash' ? 'list-style-type: none; text-indent: -1em; padding-left: 1em;' : ''}
        }
        .job-highlights li::before {
            ${style.bulletStyle === 'dash' ? 'content: "- ";' : ''}
        }
        .education-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: ${layout.spacing.item}px;
        }
        .education-degree {
            font-weight: 600;
        }
        .education-institution {
            font-style: italic;
            color: ${colors.textLight};
        }
        /* Skills layouts */
        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .skill-tag {
            background: ${colors.primary}15;
            color: ${colors.primary};
            padding: 4px 12px;
            border-radius: ${style.skillsLayout === 'pills' ? '15px' : `${style.borderRadius}px`};
            font-size: ${typography.sizes.small}pt;
            border: 1px solid ${colors.primary}30;
        }
        .skills-text {
            font-size: ${typography.sizes.body}pt;
            color: ${colors.text};
        }
        .skills-list-vertical {
            list-style-type: ${getBulletStyle()};
            margin-left: 20px;
            font-size: ${typography.sizes.body}pt;
        }
        .skills-list-vertical li {
            margin-bottom: 4px;
        }
        .skills-grouped {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .skill-grouped {
            background: ${colors.headerBg};
            color: ${colors.text};
            padding: 3px 10px;
            border-radius: ${style.borderRadius}px;
            font-size: ${typography.sizes.small}pt;
            border: 1px solid ${colors.border};
        }
        .skills-inline {
            font-size: ${typography.sizes.body}pt;
            color: ${colors.text};
        }
        .skill-inline {
            color: ${colors.text};
        }
        ${style.showIcons ? `
        .icon {
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 6px;
            vertical-align: middle;
        }
        ` : ''}
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
            <h2 class="section-title">${transformSectionTitle('Professional Summary')}</h2>
            <p class="summary-text">${summary}</p>
        </section>
        
        <section class="section">
            <h2 class="section-title">${transformSectionTitle('Experience')}</h2>
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
            <h2 class="section-title">${transformSectionTitle('Education')}</h2>
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
            <h2 class="section-title">${transformSectionTitle('Skills')}</h2>
            ${renderSkills()}
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
