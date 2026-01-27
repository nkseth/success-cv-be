/**
 * Resume Themes Seeder with Image Upload
 * 
 * Seeds 30 resume themes with their preview images uploaded to Azure Blob Storage.
 * 
 * Workflow:
 * 1. First run theme-image-downloader.js to generate preview images locally
 * 2. Then run this seeder to upload images and create themes with proper URLs
 * 
 * Usage: 
 *   node drizzle/seeds/themes-with-images.seed.js
 * 
 * Or with images generation:
 *   node drizzle/seeds/themes-with-images.seed.js --generate-images
 */

import 'dotenv/config';
import { db } from '../../config/db.js';
import { resumeThemesTable } from '../schema/resume.schema.js';
import { eq } from 'drizzle-orm';
import { themeDefinitions, downloadThemeImages } from './theme-image-downloader.js';
import {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    ContainerSASPermissions,
} from "@azure/storage-blob";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, '../../uploads/themes');

// Azure Storage configuration
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Container for theme assets
const THEMES_CONTAINER = 'theme-assets';

let blobServiceClient;
let sharedKeyCredential;

if (accountName && accountKey && connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
} else {
    console.warn('⚠️  Azure Storage environment variables not set. Will use local paths.');
}

/**
 * Upload image to Azure Blob Storage and return the public URL
 */
async function uploadImageToAzure(localPath, blobName) {
    if (!blobServiceClient) {
        // Return local path if Azure is not configured
        return `/themes/${path.basename(localPath)}`;
    }

    try {
        const containerClient = blobServiceClient.getContainerClient(THEMES_CONTAINER);
        
        // Ensure container exists with public access
        const exists = await containerClient.exists();
        if (!exists) {
            await containerClient.create({
                access: 'blob' // Public read access for blobs
            });
            console.log(`   📦 Created container: ${THEMES_CONTAINER}`);
        }

        // Read file
        const fileBuffer = fs.readFileSync(localPath);
        
        // Upload blob
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: 'image/png',
                blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
            }
        });

        // Generate a long-lived SAS URL (1 year)
        const expiresOn = new Date();
        expiresOn.setFullYear(expiresOn.getFullYear() + 1);

        const sasToken = generateBlobSASQueryParameters(
            {
                containerName: THEMES_CONTAINER,
                blobName,
                permissions: ContainerSASPermissions.parse("r"),
                expiresOn,
            },
            sharedKeyCredential
        ).toString();

        const url = `https://${accountName}.blob.core.windows.net/${THEMES_CONTAINER}/${blobName}?${sasToken}`;
        
        return url;
    } catch (error) {
        console.error(`   ❌ Failed to upload ${blobName}:`, error.message);
        // Fallback to local path
        return `/themes/${path.basename(localPath)}`;
    }
}

/**
 * Full theme configurations with detailed configs (from themes.seed.js)
 */
const themeConfigs = {
    'classic-professional': {
        name: 'Classic Professional',
        slug: 'classic-professional',
        description: 'A clean, traditional resume layout perfect for corporate and business roles. Features a single-column design with clear section headers.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 },
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
                sizes: { name: 22, title: 13, sectionHeading: 12, subheading: 11, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc',
                headingStyle: 'underline', datePosition: 'right', skillsLayout: 'inline',
                experienceLayout: 'standard', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'center', certificationsDisplay: 'separate'
            }
        },
        isATSOptimized: true
    },
    'modern-minimal': {
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
                sizes: { name: 24, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 4, dividerStyle: 'none', dividerWidth: 0, bulletStyle: 'none',
                headingStyle: 'simple', datePosition: 'right', skillsLayout: 'tags',
                experienceLayout: 'standard', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'left', certificationsDisplay: 'separate'
            }
        },
        isATSOptimized: true
    },
    'two-column-pro': {
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
                sizes: { name: 20, title: 12, sectionHeading: 11, subheading: 10, body: 9, small: 8 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.4
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 4, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'circle',
                headingStyle: 'accent-left', datePosition: 'below', skillsLayout: 'list',
                experienceLayout: 'compact', photoEnabled: false, photoPosition: 'left',
                photoSize: 70, headerAlignment: 'left', certificationsDisplay: 'with-skills'
            },
            twoColumn: {
                sidebarWidth: 35,
                sidebarPosition: 'left',
                sidebarPadding: 16,
                sidebarBg: '#f8f9fa'
            }
        },
        isATSOptimized: false
    },
    'ats-optimized': {
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
                sizes: { name: 18, title: 12, sectionHeading: 12, subheading: 11, body: 11, small: 10 },
                weights: { light: 400, regular: 400, medium: 400, semibold: 700, bold: 700 },
                lineHeight: 1.4
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc',
                headingStyle: 'underline', datePosition: 'right', skillsLayout: 'comma-separated',
                experienceLayout: 'standard', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'left', certificationsDisplay: 'separate'
            }
        },
        isATSOptimized: true
    },
    'creative-bold': {
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
                sizes: { name: 26, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 8, dividerStyle: 'solid', dividerWidth: 2, bulletStyle: 'square',
                headingStyle: 'background', datePosition: 'right', skillsLayout: 'pills',
                experienceLayout: 'standard', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'center', certificationsDisplay: 'with-skills'
            }
        },
        isATSOptimized: false
    },
    'academic-scholar': {
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
                sizes: { name: 20, title: 13, sectionHeading: 12, subheading: 11, body: 11, small: 10 },
                weights: { light: 400, regular: 400, medium: 400, semibold: 700, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'education', 'experience', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'disc',
                headingStyle: 'underline', datePosition: 'right', skillsLayout: 'list',
                experienceLayout: 'detailed', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'center', certificationsDisplay: 'separate'
            }
        },
        isATSOptimized: true
    },
    'tech-developer': {
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
                sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'skills', 'experience', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 6, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'dash',
                headingStyle: 'accent-left', datePosition: 'right', skillsLayout: 'grouped',
                experienceLayout: 'standard', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'left', certificationsDisplay: 'with-skills'
            }
        },
        isATSOptimized: true
    },
    'executive-leadership': {
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
                sizes: { name: 24, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 },
                weights: { light: 400, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0, dividerStyle: 'solid', dividerWidth: 1, bulletStyle: 'none',
                headingStyle: 'simple', datePosition: 'right', skillsLayout: 'inline',
                experienceLayout: 'detailed', photoEnabled: false, photoPosition: 'right',
                photoSize: 80, headerAlignment: 'center', certificationsDisplay: 'separate'
            }
        },
        isATSOptimized: true
    }
};

/**
 * Determine theme category from slug/name
 */
function getThemeCategory(themeConfig) {
    return themeConfig.category;
}

/**
 * Determine ATS optimization status
 */
function isATSOptimized(themeConfig) {
    return themeConfig.isATSOptimized;
}

/**
 * Main seeder function
 */
async function seedThemesWithImages(generateImages = false) {
    console.log('🌱 Starting theme seeding with images...\n');

    // Clear all existing themes first
    console.log('🗑️  Clearing existing themes from database...');
    await db.delete(resumeThemesTable);
    console.log('✅ All themes cleared\n');

    // Get list of themes to seed (only the ones with configs)
    const themesToSeed = Object.keys(themeConfigs);
    
    // Check if images exist, generate if needed
    const firstImagePath = path.join(IMAGES_DIR, `${themesToSeed[0]}-preview.png`);
    if (generateImages || !fs.existsSync(firstImagePath)) {
        console.log('📸 Generating theme preview images first...\n');
        await downloadThemeImages();
        console.log('\n');
    }

    console.log('📤 Uploading images and seeding themes...\n');

    let insertedCount = 0;
    let errorCount = 0;

    for (const slug of themesToSeed) {
        try {
            const themeConfig = themeConfigs[slug];
            console.log(`   ⏳ Processing: ${themeConfig.name}...`);

            // Prepare image path
            const previewImagePath = path.join(IMAGES_DIR, `${slug}-preview.png`);

            // Check if image exists
            let previewURL = `/themes/${slug}-preview.png`;

            if (fs.existsSync(previewImagePath)) {
                previewURL = await uploadImageToAzure(previewImagePath, `${slug}-preview.png`);
            } else {
                console.log(`      ⚠️  Preview image not found: ${previewImagePath}`);
            }

            // Prepare theme data
            const themeData = {
                name: themeConfig.name,
                slug: themeConfig.slug,
                description: themeConfig.description,
                category: getThemeCategory(themeConfig),
                config: themeConfig.config,
                thumbnailURL: previewURL,
                previewURL,
                isSystemTheme: true,
                isATSOptimized: isATSOptimized(themeConfig),
                isPublic: true,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Insert new theme
            await db.insert(resumeThemesTable).values(themeData);
            
            console.log(`   ✅ Inserted: ${themeConfig.name}`);
            insertedCount++;
        } catch (error) {
            console.error(`   ❌ Error processing ${slug}:`, error.message);
            errorCount++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 Theme seeding complete!`);
    console.log(`   ✅ Inserted: ${insertedCount} themes`);
    if (errorCount > 0) {
        console.log(`   ❌ Errors: ${errorCount} themes`);
    }
    console.log(`${'='.repeat(50)}\n`);

    return { inserted: insertedCount, errors: errorCount };
}

// Check command line args
const args = process.argv.slice(2);
const shouldGenerateImages = args.includes('--generate-images') || args.includes('-g');

// Run seeder
seedThemesWithImages(shouldGenerateImages)
    .then((result) => {
        console.log('✅ Seeding completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });

export { seedThemesWithImages, themeConfigs };
