/**
 * Resume Themes Seed Data
 * 
 * Run this to populate the resume_themes table with initial themes.
 * Usage: node drizzle/seeds/themes.seed.js
 * 
 * IMPORTANT: Theme config structure must match the schema in utils/theme-schema.js
 * 
 * Units:
 * - margins: INCHES (0.25 - 1.5)
 * - spacing: POINTS (section: 8-32, item: 4-20, line: 2-12)
 * - font sizes: POINTS
 * - borderRadius: PIXELS
 */

import 'dotenv/config';
import { db } from '../../config/db.js';
import { resumeThemesTable } from '../schema/resume.schema.js';

/**
 * Theme configurations that work with both backend PDF and frontend preview.
 * Each theme follows the schema defined in utils/theme-schema.js
 */
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
                // Margins in INCHES
                margins: { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 },
                // Spacing in POINTS
                spacing: { section: 18, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#1a1a2e',
                secondary: '#16213e',
                accent: '#0f3460',
                text: '#333333',
                textLight: '#666666',
                background: '#ffffff',
                border: '#dddddd',
                headerBg: '#f5f5f5'
            },
            typography: {
                fontFamily: "Georgia, 'Times New Roman', serif",
                headerFontFamily: "Georgia, 'Times New Roman', serif",
                baseFontSize: 10,
                sizes: {
                    name: 22,
                    title: 13,
                    sectionHeading: 12,
                    subheading: 11,
                    body: 10,
                    small: 9
                },
                weights: {
                    light: 300,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'underline',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.6, right: 0.7, bottom: 0.6, left: 0.7 },
                spacing: { section: 20, item: 12, line: 5, paragraph: 8 }
            },
            colors: {
                primary: '#2d3436',
                secondary: '#636e72',
                accent: '#00b894',
                text: '#2d3436',
                textLight: '#636e72',
                background: '#ffffff',
                border: '#e0e0e0',
                headerBg: '#fafafa'
            },
            typography: {
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                headerFontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                baseFontSize: 10,
                sizes: {
                    name: 24,
                    title: 14,
                    sectionHeading: 11,
                    subheading: 10,
                    body: 10,
                    small: 9
                },
                weights: {
                    light: 300,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 4,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
                spacing: { section: 14, item: 8, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#2c3e50',
                secondary: '#34495e',
                accent: '#3498db',
                text: '#333333',
                textLight: '#7f8c8d',
                background: '#ffffff',
                border: '#ecf0f1',
                headerBg: '#f8f9fa'
            },
            typography: {
                fontFamily: "'Roboto', Arial, sans-serif",
                headerFontFamily: "'Roboto', Arial, sans-serif",
                baseFontSize: 9,
                sizes: {
                    name: 20,
                    title: 12,
                    sectionHeading: 11,
                    subheading: 10,
                    body: 9,
                    small: 8
                },
                weights: {
                    light: 300,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.4
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 4,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'circle',
                headingStyle: 'accent-left',
                datePosition: 'below',
                skillsLayout: 'list',
                experienceLayout: 'compact',
                photoEnabled: false,
                photoPosition: 'left',
                photoSize: 70
            }
        },
        thumbnailURL: '/themes/two-column-pro-thumb.png',
        previewURL: '/themes/two-column-pro-preview.png',
        isSystemTheme: true,
        isATSOptimized: false, // Two-column can be harder for ATS
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
                margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
                spacing: { section: 14, item: 8, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#000000',
                secondary: '#333333',
                accent: '#000000',
                text: '#000000',
                textLight: '#333333',
                background: '#ffffff',
                border: '#cccccc',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "Arial, sans-serif",
                headerFontFamily: "Arial, sans-serif",
                baseFontSize: 11,
                sizes: {
                    name: 18,
                    title: 12,
                    sectionHeading: 12,
                    subheading: 11,
                    body: 11,
                    small: 10
                },
                weights: {
                    light: 400,
                    regular: 400,
                    medium: 400,
                    semibold: 700,
                    bold: 700
                },
                lineHeight: 1.4
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'underline',
                datePosition: 'right',
                skillsLayout: 'comma-separated',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
                spacing: { section: 20, item: 10, line: 5, paragraph: 6 }
            },
            colors: {
                primary: '#6c5ce7',
                secondary: '#2d3436',
                accent: '#fd79a8',
                text: '#2d3436',
                textLight: '#636e72',
                background: '#ffffff',
                border: '#dfe6e9',
                headerBg: '#f8f9fa'
            },
            typography: {
                fontFamily: "'Montserrat', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Montserrat', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: {
                    name: 26,
                    title: 14,
                    sectionHeading: 12,
                    subheading: 11,
                    body: 10,
                    small: 9
                },
                weights: {
                    light: 300,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 8,
                dividerStyle: 'solid',
                dividerWidth: 2,
                bulletStyle: 'square',
                headingStyle: 'background',
                datePosition: 'right',
                skillsLayout: 'pills',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 },
                spacing: { section: 16, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#1e3a5f',
                secondary: '#4a6fa5',
                accent: '#166088',
                text: '#333333',
                textLight: '#666666',
                background: '#ffffff',
                border: '#d0d0d0',
                headerBg: '#f5f7fa'
            },
            typography: {
                fontFamily: "'Times New Roman', Georgia, serif",
                headerFontFamily: "'Times New Roman', Georgia, serif",
                baseFontSize: 11,
                sizes: {
                    name: 20,
                    title: 13,
                    sectionHeading: 12,
                    subheading: 11,
                    body: 11,
                    small: 10
                },
                weights: {
                    light: 400,
                    regular: 400,
                    medium: 400,
                    semibold: 700,
                    bold: 700
                },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'education', 'experience', 'skills', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'underline',
                datePosition: 'right',
                skillsLayout: 'list',
                experienceLayout: 'detailed',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.45, right: 0.45, bottom: 0.45, left: 0.45 },
                spacing: { section: 16, item: 10, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#0d1117',
                secondary: '#21262d',
                accent: '#58a6ff',
                text: '#333333',
                textLight: '#586069',
                background: '#ffffff',
                border: '#e1e4e8',
                headerBg: '#f6f8fa'
            },
            typography: {
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                headerFontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                baseFontSize: 10,
                sizes: {
                    name: 22,
                    title: 13,
                    sectionHeading: 11,
                    subheading: 10,
                    body: 10,
                    small: 9
                },
                weights: {
                    light: 300,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'skills', 'experience', 'education', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 6,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'dash',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'grouped',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
                margins: { top: 0.65, right: 0.65, bottom: 0.65, left: 0.65 },
                spacing: { section: 20, item: 12, line: 5, paragraph: 7 }
            },
            colors: {
                primary: '#1a1a2e',
                secondary: '#4a4e69',
                accent: '#9a8c98',
                text: '#22223b',
                textLight: '#4a4e69',
                background: '#ffffff',
                border: '#c9ada7',
                headerBg: '#f9f7f7'
            },
            typography: {
                fontFamily: "'Playfair Display', Georgia, serif",
                headerFontFamily: "'Playfair Display', Georgia, serif",
                baseFontSize: 11,
                sizes: {
                    name: 24,
                    title: 14,
                    sectionHeading: 12,
                    subheading: 11,
                    body: 11,
                    small: 10
                },
                weights: {
                    light: 400,
                    regular: 400,
                    medium: 500,
                    semibold: 600,
                    bold: 700
                },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: {
                    personalInfo: true,
                    summary: true,
                    experience: true,
                    education: true,
                    skills: true,
                    additionalSections: true
                }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'detailed',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80
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
    console.log('🌱 Starting theme seeding/update...');
    
    try {
        const { eq } = await import('drizzle-orm');
        let updatedCount = 0;
        let insertedCount = 0;

        for (const theme of themes) {
            // Check if theme exists by slug
            const existingTheme = await db
                .select({ id: resumeThemesTable.id })
                .from(resumeThemesTable)
                .where(eq(resumeThemesTable.slug, theme.slug))
                .limit(1);

            if (existingTheme.length > 0) {
                // Update existing theme
                await db
                    .update(resumeThemesTable)
                    .set({
                        name: theme.name,
                        description: theme.description,
                        category: theme.category,
                        config: theme.config,
                        thumbnailURL: theme.thumbnailURL,
                        previewURL: theme.previewURL,
                        isSystemTheme: theme.isSystemTheme,
                        isATSOptimized: theme.isATSOptimized,
                        isPublic: theme.isPublic,
                        updatedAt: new Date()
                    })
                    .where(eq(resumeThemesTable.slug, theme.slug));
                
                console.log(`   ✅ Updated: ${theme.name} (${theme.slug})`);
                updatedCount++;
            } else {
                // Insert new theme
                await db
                    .insert(resumeThemesTable)
                    .values({
                        ...theme,
                        usageCount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                
                console.log(`   ✅ Inserted: ${theme.name} (${theme.slug})`);
                insertedCount++;
            }
        }

        console.log(`\n🎉 Theme seeding complete!`);
        console.log(`   Updated: ${updatedCount} themes`);
        console.log(`   Inserted: ${insertedCount} themes`);

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
