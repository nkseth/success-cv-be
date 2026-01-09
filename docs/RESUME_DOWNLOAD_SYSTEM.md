# Resume Download System

This document describes the resume PDF download system architecture and usage.

## Overview

The download system allows users to download their resumes as professionally formatted PDF files with theme support. The system is designed to be:

- **Scalable**: Uses Puppeteer with browser instance pooling for efficient PDF generation
- **Customizable**: Supports theme configurations and custom overrides
- **Cached**: PDFs are cached for 15 minutes to reduce regeneration overhead
- **Secure**: All downloads require authentication and verify ownership

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Download Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client Request                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │  Controller │───▶│   Service    │───▶│   PDF Service   │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│                            │                     │               │
│                            ▼                     ▼               │
│                     ┌─────────────┐    ┌─────────────────┐      │
│                     │    Model    │    │ HTML Templates  │      │
│                     └─────────────┘    └─────────────────┘      │
│                            │                     │               │
│                            ▼                     ▼               │
│                     ┌─────────────┐    ┌─────────────────┐      │
│                     │  Database   │    │   Puppeteer     │      │
│                     └─────────────┘    └─────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Download Resume as PDF
```
GET /api/v1/resumes/:id/download
```

Query Parameters:
- `format` (string): Output format, currently only `pdf` supported
- `showPageNumbers` (boolean): Include page numbers in footer
- `includeTimestamp` (boolean): Add date to filename

Response: Binary PDF file with appropriate headers

### Get Download Info
```
GET /api/v1/resumes/:id/download/info
```

Returns metadata about the resume and available download options.

### Preview Resume
```
GET /api/v1/resumes/:id/preview
```

Query Parameters:
- `format` (string): `pdf` or `html` (html useful for debugging)

Response: PDF or HTML for inline viewing (not as download attachment)

### Download with Custom Theme
```
POST /api/v1/resumes/:id/download/custom
```

Request Body:
```json
{
  "themeId": 1,
  "themeOverrides": {
    "colors": {
      "primary": "#059669"
    },
    "typography": {
      "fontFamily": "Georgia, serif"
    }
  },
  "sectionVisibility": {
    "additionalSections": false
  },
  "sectionOrder": ["personalInfo", "skills", "experience", "education"],
  "showPageNumbers": true,
  "includeTimestamp": false
}
```

### Download Rewrite Version
```
GET /api/v1/resumes/:id/rewrites/:rewriteId/download
```

Downloads a specific AI rewrite version as PDF.

### Download by Analysis ID
```
GET /api/v1/resumes/analysis/:analysisId/download
```

Downloads the resume associated with a specific analysis.

## File Structure

```
services/
├── download.service.js       # Main download service
└── pdf/
    ├── pdf.service.js        # Puppeteer PDF generation
    ├── theme-merger.js       # Theme configuration merging
    └── templates/
        ├── index.js          # Main HTML generator
        ├── styles/
        │   └── base-styles.js
        └── sections/
            ├── index.js      # Section renderers
            └── helpers.js    # Template utilities

models/
└── download.model.js         # Data fetching for downloads

controllers/
└── download.controller.js    # HTTP request handlers
```

## Theme Configuration

The PDF generator supports comprehensive theme customization:

### Layout Options
```javascript
{
  layout: {
    orientation: 'portrait',     // portrait | landscape
    pageSize: 'A4',              // A4 | Letter | Legal
    columns: 1,                  // 1 | 2 (two-column layout)
    margins: {
      top: 0.6,
      right: 0.6,
      bottom: 0.6,
      left: 0.6
    },
    spacing: {
      section: 16,
      item: 10,
      line: 6
    }
  }
}
```

### Color Scheme
```javascript
{
  colors: {
    primary: '#2563eb',      // Headers, accents
    secondary: '#1e293b',    // Subheadings
    accent: '#0ea5e9',       // Links, highlights
    text: '#1f2937',         // Body text
    textLight: '#6b7280',    // Muted text
    background: '#ffffff',
    border: '#e5e7eb',
    headerBg: '#f8fafc'
  }
}
```

### Typography
```javascript
{
  typography: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    headerFontFamily: "'Inter', sans-serif",
    baseFontSize: 10,
    sizes: {
      name: 24,
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
  }
}
```

### Style Options
```javascript
{
  style: {
    headingStyle: 'underline',    // underline | background | accent-left | simple
    bulletStyle: 'disc',          // disc | circle | square | dash | none
    dividerStyle: 'solid',        // solid | dashed | dotted | none
    skillsLayout: 'pills',        // pills | list | inline | grouped
    experienceLayout: 'standard', // standard | compact | detailed
    photoEnabled: false,
    photoPosition: 'right',       // left | right | center
    photoSize: 80
  }
}
```

### Section Control
```javascript
{
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
  }
}
```

## Caching

Generated PDFs are cached in Redis for 15 minutes. The cache key includes:
- Resume content ID
- Theme overrides hash
- Section visibility/order options

Cache is automatically invalidated when resume content is updated.

## Performance Considerations

1. **Browser Instance Pooling**: A single Puppeteer browser instance is reused across requests
2. **Lazy Loading**: Puppeteer is only loaded when the first PDF is requested
3. **Preview Mode**: Preview generation skips some optimizations for faster response
4. **Font Preloading**: Google Fonts are preconnected for faster font loading

## Error Handling

The system handles various error cases:
- Resume not found (404)
- Unauthorized access (401)
- Rewrite not completed (400)
- PDF generation failure (500)

All errors are logged with context for debugging.

## Usage Examples

### Basic Download
```javascript
// Frontend
const downloadResume = async (resumeId) => {
  const response = await fetch(`/api/v1/resumes/${resumeId}/download`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = response.headers.get('Content-Disposition')
    .split('filename=')[1].replace(/"/g, '');
  a.click();
};
```

### Custom Theme Download
```javascript
const downloadWithCustomTheme = async (resumeId) => {
  const response = await fetch(`/api/v1/resumes/${resumeId}/download/custom`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      themeOverrides: {
        colors: { primary: '#dc2626' }
      },
      showPageNumbers: true
    })
  });
  
  // Handle blob download...
};
```

### Preview in Browser
```javascript
const previewResume = async (resumeId) => {
  const response = await fetch(`/api/v1/resumes/${resumeId}/preview`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  
  // Open in new tab for viewing
  window.open(url, '_blank');
};
```

## Dependencies

- **puppeteer**: Headless Chrome for PDF rendering
- **Redis**: Caching layer (via cache.service.js)

## Production Considerations

1. **Container Setup**: Ensure Puppeteer dependencies are installed in Docker
2. **Memory**: Puppeteer uses ~100-200MB RAM per browser instance
3. **Concurrency**: Consider limiting concurrent PDF generations
4. **Fonts**: Ensure required fonts are available or use web fonts
5. **Sandbox**: May need `--no-sandbox` flag in some environments
