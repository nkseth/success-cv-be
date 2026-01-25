# Resume Theme Seeding System

This directory contains scripts for seeding resume themes with preview images.

## Overview

The theme seeding system consists of two main components:

1. **Theme Image Downloader** (`theme-image-downloader.js`) - Generates preview images for themes using Puppeteer
2. **Theme Seeder** (`themes-with-images.seed.js`) - Seeds themes to database with uploaded preview images

## Quick Start

### Generate Images + Seed Themes (Full Process)

```bash
pnpm seed:themes:full
```

This will:
1. Generate preview images for all 30 themes using Puppeteer
2. Upload images to Azure Blob Storage
3. Create/update themes in the database with preview URLs

### Step-by-Step Process

#### Step 1: Generate Theme Preview Images

```bash
pnpm generate:theme-images
```

This generates PNG preview images for all themes and saves them to `uploads/themes/`:
- `{theme-slug}-preview.png` - Full-size preview (595x842 pixels, A4 at 72 DPI, 2x scale)
- `{theme-slug}-thumb.png` - Thumbnail version

#### Step 2: Seed Themes with Image Upload

```bash
pnpm seed:themes:images
```

This will:
1. Read existing images from `uploads/themes/`
2. Upload to Azure Blob Storage (if configured)
3. Create/update themes in database with preview URLs

## Theme Categories

The 30 themes cover various professional categories:

| Category | Themes |
|----------|--------|
| Professional | Classic Professional, Corporate Elegant, Executive Leadership, etc. |
| Technical | Tech Developer, Engineer Modern, Data Science |
| Creative | Creative Bold, Design Portfolio, Creative Artist |
| Academic | Academic Scholar, Researcher Classic, Teacher Friendly |
| ATS Optimized | ATS Optimized |
| Minimal | Modern Minimal |
| Marketing | Marketing Vibrant, Sales Dynamic |
| Healthcare | Healthcare Clean |

## File Structure

```
drizzle/seeds/
├── theme-image-downloader.js   # Image generation with Puppeteer
├── themes-with-images.seed.js  # Main seeder with upload
├── themes.seed.js              # Legacy seeder (no images)
└── THEME_SEEDING.md            # This documentation

uploads/themes/                  # Generated images output
├── classic-professional-preview.png
├── classic-professional-thumb.png
├── modern-minimal-preview.png
├── modern-minimal-thumb.png
└── ... (30 themes × 2 images = 60 files)
```

## Environment Variables

Required for Azure upload:
```env
AZURE_STORAGE_ACCOUNT_NAME=your-account-name
AZURE_STORAGE_ACCOUNT_KEY=your-account-key
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
```

If Azure is not configured, themes will use local paths (`/themes/{slug}-preview.png`).

## Theme Schema

Each theme contains:

```javascript
{
  name: 'Theme Name',
  slug: 'theme-slug',
  description: 'Theme description...',
  category: 'professional', // professional, creative, technical, etc.
  config: {
    layout: { columns, margins, spacing },
    colors: { primary, accent, text, background },
    typography: { fontFamily, sizes, weights },
    sections: { order, visibility },
    style: { headerStyle, bulletStyle, etc. }
  },
  thumbnailURL: 'https://...thumb.png',
  previewURL: 'https://...preview.png',
  isSystemTheme: true,
  isATSOptimized: true/false,
  isPublic: true
}
```

## Adding New Themes

1. Add theme definition to `themeDefinitions` array in `theme-image-downloader.js`:

```javascript
{
    slug: 'new-theme',
    name: 'New Theme',
    primaryColor: '#123456',
    accentColor: '#654321',
    textColor: '#333333',
    bgColor: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    headerStyle: 'underline'  // underline, simple, accent-left, background
}
```

2. Run the full seeding process:
```bash
pnpm seed:themes:full
```

## Troubleshooting

### Puppeteer Issues
If you encounter Puppeteer browser launch issues:
```bash
# On Linux, you may need Chrome dependencies:
sudo apt-get install -y chromium-browser

# Or run with no-sandbox (already configured in script):
# puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
```

### Azure Upload Issues
- Ensure Azure credentials are set in `.env`
- Check that `theme-assets` container has public blob access
- Verify network connectivity to Azure Storage

### Image Quality
Images are generated at 2x device scale factor for high quality. Adjust `deviceScaleFactor` in the downloader script if needed.
