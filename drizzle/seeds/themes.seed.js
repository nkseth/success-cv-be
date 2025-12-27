/**
 * Resume Themes Seed Data
 * 
 * Run this to populate the resume_themes table with initial themes
 * Usage: node drizzle/seeds/themes.seed.js
 */

import 'dotenv/config';
import { db } from '../../config/db.js';
import { resumeThemesTable } from '../schema/resume.schema.js';

const themes = [
    {
        name: 'Classic Professional',
        slug: 'classic-professional',
        description: 'A clean, traditional resume layout perfect for corporate and business roles. Features a single-column design with clear section headers.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 40, right: 40, bottom: 40, left: 40 }
            },
            colors: {
                primary: '#1a1a2e',
                secondary: '#16213e',
                accent: '#0f3460',
                text: '#333333',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Georgia, serif',
                headingSize: 18,
                subheadingSize: 14,
                bodySize: 11,
                lineHeight: 1.5
            },
            spacing: {
                sectionGap: 20,
                itemGap: 10
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'education', 'skills'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'disc' },
                education: { showDates: true },
                skills: { layout: 'inline' }
            }
        },
        thumbnailURL: '/themes/classic-professional-thumb.png',
        previewURL: '/themes/classic-professional-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    },
    {
        name: 'Modern Minimal',
        slug: 'modern-minimal',
        description: 'A minimalist design with plenty of white space. Perfect for creative professionals who want a clean, contemporary look.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 50, right: 50, bottom: 50, left: 50 }
            },
            colors: {
                primary: '#2d3436',
                secondary: '#636e72',
                accent: '#00b894',
                text: '#2d3436',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Helvetica Neue, Arial, sans-serif',
                headingSize: 20,
                subheadingSize: 14,
                bodySize: 10,
                lineHeight: 1.6
            },
            spacing: {
                sectionGap: 25,
                itemGap: 12
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'skills', 'education'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'none', datePosition: 'right' },
                education: { showDates: true },
                skills: { layout: 'tags' }
            }
        },
        thumbnailURL: '/themes/modern-minimal-thumb.png',
        previewURL: '/themes/modern-minimal-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    },
    {
        name: 'Two Column Pro',
        slug: 'two-column-pro',
        description: 'A professional two-column layout that maximizes space usage. Sidebar for skills and contact, main column for experience.',
        category: 'professional',
        config: {
            layout: {
                columns: 2,
                columnRatio: '1:2',
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 30, right: 30, bottom: 30, left: 30 }
            },
            colors: {
                primary: '#2c3e50',
                secondary: '#34495e',
                accent: '#3498db',
                text: '#333333',
                background: '#ffffff',
                sidebarBackground: '#f8f9fa'
            },
            typography: {
                fontFamily: 'Roboto, Arial, sans-serif',
                headingSize: 16,
                subheadingSize: 12,
                bodySize: 10,
                lineHeight: 1.5
            },
            spacing: {
                sectionGap: 15,
                itemGap: 8
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'education', 'skills'],
            sectionStyles: {
                personalInfo: { position: 'sidebar' },
                skills: { position: 'sidebar', layout: 'list' },
                experience: { position: 'main', showDates: true, bulletStyle: 'circle' },
                education: { position: 'sidebar' }
            }
        },
        thumbnailURL: '/themes/two-column-pro-thumb.png',
        previewURL: '/themes/two-column-pro-preview.png',
        isSystemTheme: true,
        isATSOptimized: false,
        isPublic: true
    },
    {
        name: 'ATS Optimized',
        slug: 'ats-optimized',
        description: 'Specifically designed to pass Applicant Tracking Systems. Simple formatting, standard fonts, no graphics or complex layouts.',
        category: 'ats-optimized',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 36, right: 36, bottom: 36, left: 36 }
            },
            colors: {
                primary: '#000000',
                secondary: '#333333',
                accent: '#000000',
                text: '#000000',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Arial, sans-serif',
                headingSize: 14,
                subheadingSize: 12,
                bodySize: 11,
                lineHeight: 1.4
            },
            spacing: {
                sectionGap: 16,
                itemGap: 8
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'education', 'skills'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'disc', dateFormat: 'MM/YYYY' },
                education: { showDates: true },
                skills: { layout: 'comma-separated' }
            }
        },
        thumbnailURL: '/themes/ats-optimized-thumb.png',
        previewURL: '/themes/ats-optimized-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    },
    {
        name: 'Creative Bold',
        slug: 'creative-bold',
        description: 'A bold, eye-catching design for creative professionals. Features strong colors and unique section dividers.',
        category: 'creative',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 40, right: 40, bottom: 40, left: 40 }
            },
            colors: {
                primary: '#6c5ce7',
                secondary: '#a29bfe',
                accent: '#fd79a8',
                text: '#2d3436',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Montserrat, sans-serif',
                headingSize: 22,
                subheadingSize: 14,
                bodySize: 10,
                lineHeight: 1.6
            },
            spacing: {
                sectionGap: 24,
                itemGap: 12
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'skills', 'education'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'square' },
                skills: { layout: 'pills' }
            }
        },
        thumbnailURL: '/themes/creative-bold-thumb.png',
        previewURL: '/themes/creative-bold-preview.png',
        isSystemTheme: true,
        isATSOptimized: false,
        isPublic: true
    },
    {
        name: 'Academic Scholar',
        slug: 'academic-scholar',
        description: 'Designed for academic positions, research roles, and educational institutions. Emphasizes publications and education.',
        category: 'academic',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 45, right: 45, bottom: 45, left: 45 }
            },
            colors: {
                primary: '#1e3a5f',
                secondary: '#4a6fa5',
                accent: '#166088',
                text: '#333333',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Times New Roman, serif',
                headingSize: 16,
                subheadingSize: 13,
                bodySize: 11,
                lineHeight: 1.5
            },
            spacing: {
                sectionGap: 18,
                itemGap: 10
            },
            sectionOrder: ['personalInfo', 'summary', 'education', 'experience', 'publications', 'skills'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'disc' },
                education: { showDates: true, showGPA: true },
                publications: { citationStyle: 'APA' }
            }
        },
        thumbnailURL: '/themes/academic-scholar-thumb.png',
        previewURL: '/themes/academic-scholar-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    },
    {
        name: 'Tech Developer',
        slug: 'tech-developer',
        description: 'Perfect for software developers and IT professionals. Highlights technical skills and projects prominently.',
        category: 'technical',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 35, right: 35, bottom: 35, left: 35 }
            },
            colors: {
                primary: '#0d1117',
                secondary: '#21262d',
                accent: '#58a6ff',
                text: '#333333',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Inter, -apple-system, sans-serif',
                headingSize: 18,
                subheadingSize: 13,
                bodySize: 10,
                lineHeight: 1.5
            },
            spacing: {
                sectionGap: 20,
                itemGap: 10
            },
            sectionOrder: ['personalInfo', 'summary', 'skills', 'experience', 'projects', 'education'],
            sectionStyles: {
                skills: { layout: 'grouped-tags', showLevels: true },
                experience: { showDates: true, bulletStyle: 'dash' },
                projects: { showTechStack: true, showLinks: true }
            }
        },
        thumbnailURL: '/themes/tech-developer-thumb.png',
        previewURL: '/themes/tech-developer-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    },
    {
        name: 'Executive Leadership',
        slug: 'executive-leadership',
        description: 'Sophisticated design for senior executives and leadership roles. Emphasizes achievements and strategic impact.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 50, right: 50, bottom: 50, left: 50 }
            },
            colors: {
                primary: '#1a1a2e',
                secondary: '#4a4e69',
                accent: '#c9ada7',
                text: '#22223b',
                background: '#ffffff'
            },
            typography: {
                fontFamily: 'Playfair Display, Georgia, serif',
                headingSize: 20,
                subheadingSize: 14,
                bodySize: 11,
                lineHeight: 1.6
            },
            spacing: {
                sectionGap: 24,
                itemGap: 12
            },
            sectionOrder: ['personalInfo', 'summary', 'experience', 'achievements', 'education', 'skills'],
            sectionStyles: {
                experience: { showDates: true, bulletStyle: 'none', emphasisOnAchievements: true },
                achievements: { showMetrics: true }
            }
        },
        thumbnailURL: '/themes/executive-leadership-thumb.png',
        previewURL: '/themes/executive-leadership-preview.png',
        isSystemTheme: true,
        isATSOptimized: true,
        isPublic: true
    }
];

async function seedThemes() {
    console.log('🌱 Starting theme seeding...');
    
    try {
        // Check if themes already exist
        const existingThemes = await db.select({ id: resumeThemesTable.id }).from(resumeThemesTable).limit(1);
        
        if (existingThemes.length > 0) {
            console.log('⚠️  Themes already exist. Skipping seed to avoid duplicates.');
            console.log('   To reseed, clear the resume_themes table first.');
            return;
        }

        // Insert themes
        const insertedThemes = await db
            .insert(resumeThemesTable)
            .values(themes.map(theme => ({
                ...theme,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            })))
            .returning();

        console.log(`✅ Successfully seeded ${insertedThemes.length} themes:`);
        insertedThemes.forEach(theme => {
            console.log(`   - ${theme.name} (${theme.slug})`);
        });

    } catch (error) {
        console.error('❌ Failed to seed themes:', error.message);
        throw error;
    }
}

// Run if executed directly
seedThemes()
    .then(() => {
        console.log('🎉 Theme seeding complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Seeding failed:', error);
        process.exit(1);
    });

export { themes, seedThemes };
