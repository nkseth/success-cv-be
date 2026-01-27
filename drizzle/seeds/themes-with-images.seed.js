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
 * Full theme configurations with detailed configs
 * 30 Professional Single-Column Resume Themes
 */
const themeConfigs = {
    // ============================================
    // PROFESSIONAL THEMES (1-6)
    // ============================================
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
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'executive-leadership': {
        name: 'Executive Leadership',
        slug: 'executive-leadership',
        description: 'Sophisticated design for senior executives and leadership roles. Emphasizes achievements and strategic impact with elegant typography.',
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
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'corporate-elegant': {
        name: 'Corporate Elegant',
        slug: 'corporate-elegant',
        description: 'A refined corporate design with subtle elegance. Ideal for finance, consulting, and management positions.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 },
                spacing: { section: 18, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#2c3e50',
                secondary: '#34495e',
                accent: '#1abc9c',
                text: '#2c3e50',
                textLight: '#7f8c8d',
                background: '#ffffff',
                border: '#bdc3c7',
                headerBg: '#ecf0f1'
            },
            typography: {
                fontFamily: "'Libre Baskerville', Georgia, serif",
                headerFontFamily: "'Libre Baskerville', Georgia, serif",
                baseFontSize: 10,
                sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'circle',
                headingStyle: 'underline',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'business-formal': {
        name: 'Business Formal',
        slug: 'business-formal',
        description: 'A formal business resume design with structured sections and professional presentation for corporate environments.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 16, item: 9, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#1f2937',
                secondary: '#374151',
                accent: '#3b82f6',
                text: '#1f2937',
                textLight: '#6b7280',
                background: '#ffffff',
                border: '#d1d5db',
                headerBg: '#f9fafb'
            },
            typography: {
                fontFamily: "'Source Serif Pro', Georgia, serif",
                headerFontFamily: "'Source Serif Pro', Georgia, serif",
                baseFontSize: 10,
                sizes: { name: 21, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'comma-separated',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'polished-pro': {
        name: 'Polished Pro',
        slug: 'polished-pro',
        description: 'A polished and refined professional template with balanced proportions and clear visual hierarchy.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.6, bottom: 0.5, left: 0.6 },
                spacing: { section: 17, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#0f172a',
                secondary: '#1e293b',
                accent: '#0ea5e9',
                text: '#0f172a',
                textLight: '#64748b',
                background: '#ffffff',
                border: '#cbd5e1',
                headerBg: '#f8fafc'
            },
            typography: {
                fontFamily: "'Merriweather', Georgia, serif",
                headerFontFamily: "'Merriweather', Georgia, serif",
                baseFontSize: 10,
                sizes: { name: 22, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 2,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'capitalize',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'senior-manager': {
        name: 'Senior Manager',
        slug: 'senior-manager',
        description: 'Designed for senior management and director-level positions with emphasis on leadership and strategic achievements.',
        category: 'professional',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 0.6, right: 0.65, bottom: 0.6, left: 0.65 },
                spacing: { section: 19, item: 11, line: 5, paragraph: 7 }
            },
            colors: {
                primary: '#18181b',
                secondary: '#27272a',
                accent: '#a1a1aa',
                text: '#18181b',
                textLight: '#52525b',
                background: '#ffffff',
                border: '#d4d4d8',
                headerBg: '#fafafa'
            },
            typography: {
                fontFamily: "'Crimson Pro', Georgia, serif",
                headerFontFamily: "'Crimson Pro', Georgia, serif",
                baseFontSize: 11,
                sizes: { name: 24, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'none',
                headingStyle: 'underline',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'detailed',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    // ============================================
    // MINIMAL THEMES (7-12)
    // ============================================
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
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'capitalize',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'clean-slate': {
        name: 'Clean Slate',
        slug: 'clean-slate',
        description: 'Ultra-clean design with maximum readability and generous whitespace. Perfect for those who value simplicity.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.7, right: 0.75, bottom: 0.7, left: 0.75 },
                spacing: { section: 22, item: 14, line: 6, paragraph: 9 }
            },
            colors: {
                primary: '#111827',
                secondary: '#374151',
                accent: '#6366f1',
                text: '#111827',
                textLight: '#6b7280',
                background: '#ffffff',
                border: '#e5e7eb',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 26, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.65
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'swiss-design': {
        name: 'Swiss Design',
        slug: 'swiss-design',
        description: 'Inspired by Swiss design principles with grid-based layout, clean typography, and perfect balance.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.6, right: 0.65, bottom: 0.6, left: 0.65 },
                spacing: { section: 20, item: 12, line: 5, paragraph: 7 }
            },
            colors: {
                primary: '#000000',
                secondary: '#333333',
                accent: '#ff0000',
                text: '#000000',
                textLight: '#555555',
                background: '#ffffff',
                border: '#e0e0e0',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                headerFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                baseFontSize: 10,
                sizes: { name: 28, title: 14, sectionHeading: 10, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'elegant-simple': {
        name: 'Elegant Simple',
        slug: 'elegant-simple',
        description: 'Combines elegance with simplicity. Refined typography and subtle design elements for a timeless look.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.65, right: 0.7, bottom: 0.65, left: 0.7 },
                spacing: { section: 21, item: 13, line: 5, paragraph: 8 }
            },
            colors: {
                primary: '#1a1a1a',
                secondary: '#4a4a4a',
                accent: '#b8860b',
                text: '#1a1a1a',
                textLight: '#666666',
                background: '#ffffff',
                border: '#d0d0d0',
                headerBg: '#fafafa'
            },
            typography: {
                fontFamily: "'Lora', Georgia, serif",
                headerFontFamily: "'Lora', Georgia, serif",
                baseFontSize: 10,
                sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'capitalize',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'nordic-light': {
        name: 'Nordic Light',
        slug: 'nordic-light',
        description: 'Inspired by Scandinavian design with light colors, clean lines, and functional minimalism.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.65, right: 0.7, bottom: 0.65, left: 0.7 },
                spacing: { section: 20, item: 12, line: 5, paragraph: 8 }
            },
            colors: {
                primary: '#2e3440',
                secondary: '#3b4252',
                accent: '#5e81ac',
                text: '#2e3440',
                textLight: '#4c566a',
                background: '#ffffff',
                border: '#d8dee9',
                headerBg: '#eceff4'
            },
            typography: {
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.6
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 4,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'circle',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'capitalize',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'zen-minimal': {
        name: 'Zen Minimal',
        slug: 'zen-minimal',
        description: 'A zen-inspired minimalist design with balanced whitespace and harmonious proportions.',
        category: 'minimal',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.7, right: 0.75, bottom: 0.7, left: 0.75 },
                spacing: { section: 24, item: 14, line: 6, paragraph: 10 }
            },
            colors: {
                primary: '#2d2d2d',
                secondary: '#4d4d4d',
                accent: '#8b9dc3',
                text: '#2d2d2d',
                textLight: '#6d6d6d',
                background: '#ffffff',
                border: '#e8e8e8',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "'Nunito Sans', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Nunito Sans', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 26, title: 14, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.7
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'none',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'lowercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    // ============================================
    // TECHNICAL THEMES (13-17)
    // ============================================
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
                margins: { top: 0.45, right: 0.5, bottom: 0.45, left: 0.5 },
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
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'software-engineer': {
        name: 'Software Engineer',
        slug: 'software-engineer',
        description: 'Tailored for software engineers with emphasis on technical expertise, programming languages, and project achievements.',
        category: 'technical',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 15, item: 9, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#1e1e1e',
                secondary: '#2d2d2d',
                accent: '#007acc',
                text: '#1e1e1e',
                textLight: '#6a6a6a',
                background: '#ffffff',
                border: '#d4d4d4',
                headerBg: '#f3f3f3'
            },
            typography: {
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                headerFontFamily: "'Inter', 'Segoe UI', sans-serif",
                baseFontSize: 10,
                sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'skills', 'experience', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 4,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'square',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'grouped',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'data-scientist': {
        name: 'Data Scientist',
        slug: 'data-scientist',
        description: 'Designed for data scientists and analysts. Emphasizes analytical skills, tools, and data-driven achievements.',
        category: 'technical',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 16, item: 10, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#1a365d',
                secondary: '#2a4365',
                accent: '#3182ce',
                text: '#1a202c',
                textLight: '#4a5568',
                background: '#ffffff',
                border: '#cbd5e0',
                headerBg: '#ebf8ff'
            },
            typography: {
                fontFamily: "'Source Sans Pro', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Source Sans Pro', 'Helvetica Neue', sans-serif",
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
                borderRadius: 4,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'grouped',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'devops-engineer': {
        name: 'DevOps Engineer',
        slug: 'devops-engineer',
        description: 'Built for DevOps and cloud engineers. Highlights infrastructure, automation, and deployment expertise.',
        category: 'technical',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 15, item: 9, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#232f3e',
                secondary: '#37475a',
                accent: '#ff9900',
                text: '#232f3e',
                textLight: '#545b64',
                background: '#ffffff',
                border: '#d5dbdb',
                headerBg: '#fafafa'
            },
            typography: {
                fontFamily: "'Ubuntu', 'Segoe UI', sans-serif",
                headerFontFamily: "'Ubuntu', 'Segoe UI', sans-serif",
                baseFontSize: 10,
                sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'skills', 'experience', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 4,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'dash',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'grouped',
                experienceLayout: 'compact',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'cybersecurity-pro': {
        name: 'Cybersecurity Pro',
        slug: 'cybersecurity-pro',
        description: 'Professional template for cybersecurity specialists. Emphasizes certifications, security tools, and threat analysis.',
        category: 'technical',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 16, item: 10, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#0a0a0a',
                secondary: '#1a1a1a',
                accent: '#00ff88',
                text: '#1a1a1a',
                textLight: '#4a4a4a',
                background: '#ffffff',
                border: '#d0d0d0',
                headerBg: '#f5f5f5'
            },
            typography: {
                fontFamily: "'Roboto Mono', 'Courier New', monospace",
                headerFontFamily: "'Roboto', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 22, title: 12, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.5
            },
            sections: {
                order: ['personalInfo', 'summary', 'skills', 'experience', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 2,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'square',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'grouped',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    // ============================================
    // ATS-OPTIMIZED THEMES (18-21)
    // ============================================
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
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'ats-friendly': {
        name: 'ATS Friendly',
        slug: 'ats-friendly',
        description: 'A clean, ATS-compliant design with standard formatting. Guaranteed to be parsed correctly by all major ATS systems.',
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
                primary: '#1a1a1a',
                secondary: '#333333',
                accent: '#1a1a1a',
                text: '#1a1a1a',
                textLight: '#444444',
                background: '#ffffff',
                border: '#cccccc',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "'Times New Roman', Times, serif",
                headerFontFamily: "'Times New Roman', Times, serif",
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
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'comma-separated',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'ats-standard': {
        name: 'ATS Standard',
        slug: 'ats-standard',
        description: 'Industry-standard ATS format with Calibri font, clear sections, and maximum compatibility with applicant tracking systems.',
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
                accent: '#2b5797',
                text: '#000000',
                textLight: '#333333',
                background: '#ffffff',
                border: '#cccccc',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
                headerFontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
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
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'ats-modern': {
        name: 'ATS Modern',
        slug: 'ats-modern',
        description: 'A modern take on ATS-compliant resumes. Clean design while maintaining full ATS compatibility.',
        category: 'ats-optimized',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 15, item: 9, line: 4, paragraph: 5 }
            },
            colors: {
                primary: '#2d3748',
                secondary: '#4a5568',
                accent: '#2d3748',
                text: '#1a202c',
                textLight: '#4a5568',
                background: '#ffffff',
                border: '#e2e8f0',
                headerBg: '#ffffff'
            },
            typography: {
                fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
                headerFontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
                baseFontSize: 11,
                sizes: { name: 20, title: 12, sectionHeading: 11, subheading: 11, body: 11, small: 10 },
                weights: { light: 400, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.45
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'inline',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    // ============================================
    // CREATIVE THEMES (22-25)
    // ============================================
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
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
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
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: false
    },

    'designer-portfolio': {
        name: 'Designer Portfolio',
        slug: 'designer-portfolio',
        description: 'Perfect for designers and visual creatives. Features modern typography and stylish layout elements.',
        category: 'creative',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 },
                spacing: { section: 22, item: 12, line: 5, paragraph: 7 }
            },
            colors: {
                primary: '#e84393',
                secondary: '#2d3436',
                accent: '#00cec9',
                text: '#2d3436',
                textLight: '#636e72',
                background: '#ffffff',
                border: '#dfe6e9',
                headerBg: '#ffeef5'
            },
            typography: {
                fontFamily: "'Poppins', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Poppins', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 28, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 12,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'circle',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'pills',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'capitalize',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: false
    },

    'artistic-flair': {
        name: 'Artistic Flair',
        slug: 'artistic-flair',
        description: 'An artistically styled resume for creative industry professionals. Features unique typography and color combinations.',
        category: 'creative',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 },
                spacing: { section: 20, item: 11, line: 5, paragraph: 6 }
            },
            colors: {
                primary: '#5f27cd',
                secondary: '#341f97',
                accent: '#ff6b6b',
                text: '#2d3436',
                textLight: '#636e72',
                background: '#ffffff',
                border: '#dfe6e9',
                headerBg: '#f5f3ff'
            },
            typography: {
                fontFamily: "'Raleway', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Playfair Display', Georgia, serif",
                baseFontSize: 10,
                sizes: { name: 26, title: 14, sectionHeading: 12, subheading: 11, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 16,
                dividerStyle: 'dashed',
                dividerWidth: 1,
                bulletStyle: 'circle',
                headingStyle: 'background',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'capitalize',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: false
    },

    'modern-creative': {
        name: 'Modern Creative',
        slug: 'modern-creative',
        description: 'A contemporary creative design that balances professionalism with artistic expression.',
        category: 'creative',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.55, right: 0.6, bottom: 0.55, left: 0.6 },
                spacing: { section: 18, item: 11, line: 5, paragraph: 6 }
            },
            colors: {
                primary: '#10b981',
                secondary: '#064e3b',
                accent: '#f59e0b',
                text: '#1f2937',
                textLight: '#4b5563',
                background: '#ffffff',
                border: '#d1fae5',
                headerBg: '#ecfdf5'
            },
            typography: {
                fontFamily: "'Work Sans', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Work Sans', 'Helvetica Neue', sans-serif",
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
                borderRadius: 8,
                dividerStyle: 'solid',
                dividerWidth: 2,
                bulletStyle: 'disc',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'uppercase',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: false
    },

    // ============================================
    // ACADEMIC THEMES (26-28)
    // ============================================
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
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'research-scientist': {
        name: 'Research Scientist',
        slug: 'research-scientist',
        description: 'Tailored for researchers and scientists. Emphasizes research experience, publications, and academic credentials.',
        category: 'academic',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 },
                spacing: { section: 16, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#003366',
                secondary: '#336699',
                accent: '#0066cc',
                text: '#333333',
                textLight: '#666666',
                background: '#ffffff',
                border: '#cccccc',
                headerBg: '#f0f4f8'
            },
            typography: {
                fontFamily: "'Charter', Georgia, serif",
                headerFontFamily: "'Charter', Georgia, serif",
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
                borderRadius: 0,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'disc',
                headingStyle: 'simple',
                datePosition: 'right',
                skillsLayout: 'list',
                experienceLayout: 'detailed',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'university-professor': {
        name: 'University Professor',
        slug: 'university-professor',
        description: 'Classic academic CV format for professors and university educators. Includes space for teaching and research achievements.',
        category: 'academic',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'Letter',
                margins: { top: 0.65, right: 0.65, bottom: 0.65, left: 0.65 },
                spacing: { section: 18, item: 11, line: 5, paragraph: 7 }
            },
            colors: {
                primary: '#2c2c54',
                secondary: '#474787',
                accent: '#706fd3',
                text: '#2c2c54',
                textLight: '#5a5a5a',
                background: '#ffffff',
                border: '#c8c8c8',
                headerBg: '#f8f8fc'
            },
            typography: {
                fontFamily: "'Garamond', 'Times New Roman', serif",
                headerFontFamily: "'Garamond', 'Times New Roman', serif",
                baseFontSize: 11,
                sizes: { name: 22, title: 14, sectionHeading: 12, subheading: 11, body: 11, small: 10 },
                weights: { light: 400, regular: 400, medium: 400, semibold: 700, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'education', 'experience', 'skills', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
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
                photoSize: 80,
                headerAlignment: 'center',
                certificationsDisplay: 'separate',
                sectionTitleCase: 'uppercase',
                showIcons: false,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    // ============================================
    // MODERN THEMES (29-30)
    // ============================================
    'startup-modern': {
        name: 'Startup Modern',
        slug: 'startup-modern',
        description: 'A fresh, modern design perfect for startup environments. Emphasizes innovation and adaptability.',
        category: 'modern',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 18, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#7c3aed',
                secondary: '#4c1d95',
                accent: '#a78bfa',
                text: '#1f2937',
                textLight: '#6b7280',
                background: '#ffffff',
                border: '#e5e7eb',
                headerBg: '#f5f3ff'
            },
            typography: {
                fontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Space Grotesk', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 8,
                dividerStyle: 'none',
                dividerWidth: 0,
                bulletStyle: 'disc',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'capitalize',
                showIcons: true,
                compactMode: false
            }
        },
        isATSOptimized: true
    },

    'contemporary-edge': {
        name: 'Contemporary Edge',
        slug: 'contemporary-edge',
        description: 'A cutting-edge contemporary design for forward-thinking professionals. Modern aesthetics with professional structure.',
        category: 'modern',
        config: {
            layout: {
                columns: 1,
                orientation: 'portrait',
                pageSize: 'A4',
                margins: { top: 0.5, right: 0.55, bottom: 0.5, left: 0.55 },
                spacing: { section: 18, item: 10, line: 4, paragraph: 6 }
            },
            colors: {
                primary: '#0f766e',
                secondary: '#134e4a',
                accent: '#2dd4bf',
                text: '#1f2937',
                textLight: '#4b5563',
                background: '#ffffff',
                border: '#ccfbf1',
                headerBg: '#f0fdfa'
            },
            typography: {
                fontFamily: "'Outfit', 'Helvetica Neue', sans-serif",
                headerFontFamily: "'Outfit', 'Helvetica Neue', sans-serif",
                baseFontSize: 10,
                sizes: { name: 24, title: 13, sectionHeading: 11, subheading: 10, body: 10, small: 9 },
                weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
                lineHeight: 1.55
            },
            sections: {
                order: ['personalInfo', 'summary', 'experience', 'skills', 'education', 'additionalSections'],
                visibility: { personalInfo: true, summary: true, experience: true, education: true, skills: true, additionalSections: true }
            },
            style: {
                borderRadius: 6,
                dividerStyle: 'solid',
                dividerWidth: 1,
                bulletStyle: 'circle',
                headingStyle: 'accent-left',
                datePosition: 'right',
                skillsLayout: 'tags',
                experienceLayout: 'standard',
                photoEnabled: false,
                photoPosition: 'right',
                photoSize: 80,
                headerAlignment: 'left',
                certificationsDisplay: 'with-skills',
                sectionTitleCase: 'capitalize',
                showIcons: true,
                compactMode: false
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
