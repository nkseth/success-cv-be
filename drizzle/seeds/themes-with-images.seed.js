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
 * Full theme configurations matching theme-schema.js structure
 */
function generateThemeConfig(themeDefinition) {
    const baseConfig = {
        layout: {
            columns: themeDefinition.twoColumn ? 2 : 1,
            columnRatio: themeDefinition.twoColumn ? '1:2' : undefined,
            orientation: 'portrait',
            pageSize: 'A4',
            margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
            spacing: { section: 16, item: 10, line: 4, paragraph: 6 }
        },
        colors: {
            primary: themeDefinition.primaryColor,
            secondary: themeDefinition.primaryColor,
            accent: themeDefinition.accentColor,
            text: themeDefinition.textColor,
            textLight: '#666666',
            background: themeDefinition.bgColor,
            border: '#dddddd',
            headerBg: '#f5f5f5'
        },
        typography: {
            fontFamily: themeDefinition.fontFamily,
            headerFontFamily: themeDefinition.fontFamily,
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
            borderRadius: themeDefinition.headerStyle === 'background' ? 8 : 0,
            dividerStyle: 'solid',
            dividerWidth: 1,
            bulletStyle: 'disc',
            headingStyle: themeDefinition.headerStyle,
            datePosition: 'right',
            skillsLayout: themeDefinition.twoColumn ? 'list' : 'tags',
            experienceLayout: 'standard',
            photoEnabled: false,
            photoPosition: 'right',
            photoSize: 80
        }
    };

    return baseConfig;
}

/**
 * Determine theme category from slug/name
 */
function getThemeCategory(theme) {
    const slug = theme.slug.toLowerCase();
    const name = theme.name.toLowerCase();
    
    if (slug.includes('ats')) return 'ats-optimized';
    if (slug.includes('academic') || slug.includes('researcher') || slug.includes('teacher')) return 'academic';
    if (slug.includes('creative') || slug.includes('design') || slug.includes('artist')) return 'creative';
    if (slug.includes('minimal')) return 'minimal';
    if (slug.includes('tech') || slug.includes('developer') || slug.includes('engineer') || slug.includes('data')) return 'technical';
    if (slug.includes('executive') || slug.includes('corporate') || slug.includes('finance') || slug.includes('legal') || slug.includes('government')) return 'professional';
    if (slug.includes('marketing') || slug.includes('sales')) return 'marketing';
    if (slug.includes('healthcare')) return 'healthcare';
    
    return 'professional'; // default
}

/**
 * Determine ATS optimization status
 */
function isATSOptimized(theme) {
    const slug = theme.slug.toLowerCase();
    // Two column layouts and heavily styled themes are not ATS friendly
    if (theme.twoColumn) return false;
    if (theme.headerStyle === 'background') return false;
    if (slug.includes('ats')) return true;
    if (slug.includes('creative') || slug.includes('design') || slug.includes('artist')) return false;
    
    return true; // Most single-column themes are ATS friendly
}

/**
 * Generate description for theme
 */
function generateDescription(theme) {
    const descriptions = {
        'classic-professional': 'A clean, traditional resume layout perfect for corporate and business roles. Features a single-column design with clear section headers.',
        'modern-minimal': 'A minimalist design with plenty of white space. Perfect for creative professionals who want a clean, contemporary look.',
        'two-column-pro': 'A professional two-column layout that maximizes space usage. Sidebar for skills and contact, main column for experience.',
        'ats-optimized': 'Specifically designed to pass Applicant Tracking Systems. Simple formatting, standard fonts, no graphics.',
        'creative-bold': 'A bold, eye-catching design for creative professionals. Features strong colors and unique section dividers.',
        'academic-scholar': 'Designed for academic positions, research roles, and educational institutions. Emphasizes publications and education.',
        'tech-developer': 'Perfect for software developers and IT professionals. Highlights technical skills and projects prominently.',
        'executive-leadership': 'Sophisticated design for senior executives and leadership roles. Emphasizes achievements and strategic impact.',
        'startup-fresh': 'Energetic and modern design perfect for startup environments. Features bold accent colors and contemporary styling.',
        'corporate-elegant': 'Refined and sophisticated layout for corporate professionals. Classic typography with elegant touches.',
        'design-portfolio': 'Showcase your creative work with this visually striking design. Perfect for designers and artists.',
        'finance-professional': 'Trusted and authoritative design for finance and banking professionals. Clean and conservative styling.',
        'healthcare-clean': 'Professional and trustworthy design for healthcare workers. Clear organization and readable format.',
        'legal-formal': 'Formal and authoritative layout for legal professionals. Traditional styling with professional undertones.',
        'marketing-vibrant': 'Dynamic and engaging design for marketing professionals. Features vibrant colors and modern typography.',
        'consultant-sleek': 'Polished design for consultants and advisors. Emphasizes expertise and professionalism.',
        'engineer-modern': 'Contemporary layout for engineers and technical professionals. Clean lines and structured organization.',
        'data-science': 'Technical yet approachable design for data professionals. Highlights analytical skills and projects.',
        'product-manager': 'Strategic design for product professionals. Emphasizes leadership and product achievements.',
        'ux-designer': 'Creative and user-focused design for UX professionals. Showcases design thinking and process.',
        'sales-dynamic': 'High-energy design for sales professionals. Emphasizes achievements and results-driven approach.',
        'hr-professional': 'Warm and approachable design for HR professionals. Focuses on people skills and organizational abilities.',
        'project-manager': 'Organized and methodical layout for project managers. Highlights leadership and delivery excellence.',
        'architect-elegant': 'Refined design for architects and designers. Clean aesthetics with attention to visual hierarchy.',
        'teacher-friendly': 'Warm and approachable design for educators. Emphasizes teaching experience and educational philosophy.',
        'researcher-classic': 'Academic design for researchers and scholars. Traditional styling suitable for academic applications.',
        'journalist-bold': 'Strong and impactful design for journalists and writers. Emphasizes writing and storytelling.',
        'creative-artist': 'Expressive design for artists and creative professionals. Bold colors and artistic flair.',
        'government-formal': 'Official and formal design for government and public sector roles. Conservative and trustworthy.',
        'nonprofit-warm': 'Compassionate design for nonprofit professionals. Warm colors emphasizing mission-driven work.'
    };
    
    return descriptions[theme.slug] || `Professional resume theme with ${theme.headerStyle} styling and ${theme.fontFamily.split(',')[0]} typography.`;
}

/**
 * Main seeder function
 */
async function seedThemesWithImages(generateImages = false) {
    console.log('🌱 Starting theme seeding with images...\n');

    // Check if images exist, generate if needed
    const firstImagePath = path.join(IMAGES_DIR, `${themeDefinitions[0].slug}-preview.png`);
    if (generateImages || !fs.existsSync(firstImagePath)) {
        console.log('📸 Generating theme preview images first...\n');
        await downloadThemeImages();
        console.log('\n');
    }

    console.log('📤 Uploading images and seeding themes...\n');

    let updatedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;

    for (const themeDef of themeDefinitions) {
        try {
            console.log(`   ⏳ Processing: ${themeDef.name}...`);

            // Prepare image path
            const previewImagePath = path.join(IMAGES_DIR, `${themeDef.slug}-preview.png`);

            // Check if image exists
            let previewURL = `/themes/${themeDef.slug}-preview.png`;

            if (fs.existsSync(previewImagePath)) {
                previewURL = await uploadImageToAzure(previewImagePath, `${themeDef.slug}-preview.png`);
            } else {
                console.log(`      ⚠️  Preview image not found: ${previewImagePath}`);
            }

            // Prepare theme data (thumbnailURL uses same as previewURL)
            const themeData = {
                name: themeDef.name,
                slug: themeDef.slug,
                description: generateDescription(themeDef),
                category: getThemeCategory(themeDef),
                config: generateThemeConfig(themeDef),
                thumbnailURL: previewURL,
                previewURL,
                isSystemTheme: true,
                isATSOptimized: isATSOptimized(themeDef),
                isPublic: true
            };

            // Check if theme exists
            const existingTheme = await db
                .select({ id: resumeThemesTable.id })
                .from(resumeThemesTable)
                .where(eq(resumeThemesTable.slug, themeDef.slug))
                .limit(1);

            if (existingTheme.length > 0) {
                // Update existing theme
                await db
                    .update(resumeThemesTable)
                    .set({
                        ...themeData,
                        updatedAt: new Date()
                    })
                    .where(eq(resumeThemesTable.slug, themeDef.slug));
                
                console.log(`   ✅ Updated: ${themeDef.name}`);
                updatedCount++;
            } else {
                // Insert new theme
                await db
                    .insert(resumeThemesTable)
                    .values({
                        ...themeData,
                        usageCount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                
                console.log(`   ✅ Inserted: ${themeDef.name}`);
                insertedCount++;
            }
        } catch (error) {
            console.error(`   ❌ Error processing ${themeDef.name}:`, error.message);
            errorCount++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 Theme seeding complete!`);
    console.log(`   ✅ Updated: ${updatedCount} themes`);
    console.log(`   ✅ Inserted: ${insertedCount} themes`);
    if (errorCount > 0) {
        console.log(`   ❌ Errors: ${errorCount} themes`);
    }
    console.log(`${'='.repeat(50)}\n`);

    return { updated: updatedCount, inserted: insertedCount, errors: errorCount };
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

export { seedThemesWithImages, themeDefinitions };
