# Dynamic User Tables Implementation

## Overview

This document describes the implementation of dynamic table selection based on user type, allowing the same API routes to work for both regular users and candidates (B2B flow) without needing separate routes.

## Architecture

### User Types

The system supports three user types defined in `utils/constants.js`:
- `user`: Regular users (uses `users`, `user_documents`, `analyses`, etc.)
- `candidate`: B2B candidates (uses `candidates`, `candidate_documents`, `candidate_analyses`, etc.)
- `admin`: Admin users

### Dynamic Table Selector

A new utility was created at `utils/dynamic-tables.js` that provides helper functions to select the appropriate database tables based on user type:

```javascript
import { getDynamicTables, isCandidate } from "../utils/dynamic-tables.js";

// Usage in controllers/services
const userType = req.type || userTypeConstants.USER;
const tables = getDynamicTables(userType);
// tables.analysisTable, tables.documentTable, etc.
```

### How It Works

1. **Authentication Middleware** (`middleware/authenticate-routes.js`):
   - Decodes JWT token and extracts `type` field
   - Sets `req.type` based on token type ('user', 'candidate', or 'admin')
   - Sets `req.userID` as the user/candidate ID

2. **Subdomain Middleware** (`middleware/subdomain.js`):
   - Provides additional context based on token type
   - Sets `req.subdomainContext` with flags like `isAdmin`, `isApp`, `isOrganisation`

3. **Controllers**:
   - Extract `userType` from `req.type`
   - Pass `userType` to service functions

4. **Services/Models**:
   - Accept `userType` parameter
   - Use `getDynamicTables(userType)` to get appropriate tables
   - Query the correct tables based on user type

## Files Modified

### New Files
- `utils/dynamic-tables.js` - Dynamic table selector utility

### Updated Files

#### Controllers
- `controllers/resume-analysis.controller.js` - Updated all functions to use dynamic tables
- `controllers/resume.controller.js` - Updated all functions to pass userType
- `controllers/download.controller.js` - Updated all functions to pass userType

#### Models
- `models/resume-and-analysis.model.js` - Added candidate-specific functions:
  - `createCandidateDocument()`
  - `createCandidateAnalysisRecord()`
- `models/resume.model.js` - Added imports and helper function `getTablesForUserType()`

#### Routes
- `routes/v1/user.route.js` - Changed from `authenticateUser` to `commonAuthenticate`

## Routes Affected

All these routes now support both users and candidates via token-based authentication:

### Resume Analysis APIs
- `GET /resume-analysis` - Get all resume analyses
- `GET /resume-analysis/:id` - Get specific analysis
- `PUT /resume-analysis/:id` - Update analysis

### Resume APIs
- `GET /resumes` - Get all resumes
- `GET /resumes/:id` - Get specific resume
- `GET /resumes/by-analysis/:analysisId` - Get resume by analysis
- `GET /resumes/:id/render` - Get resume for rendering
- `PATCH /resumes/:id/sections/:sectionName` - Update section
- `PATCH /resumes/:id/sections` - Update multiple sections
- `POST /resumes/:id/publish` - Publish resume

### Rewrite APIs
- `POST /resumes/:id/rewrites` - Create rewrite
- `POST /resumes/by-analysis/:analysisId/rewrites` - Create by analysis
- `GET /resumes/:id/rewrites` - Get all rewrites
- `GET /resumes/:id/rewrites/:rewriteId` - Get specific rewrite
- `POST /resumes/:id/rewrites/:rewriteId/apply` - Apply rewrite
- `POST /resumes/:id/rewrites/:rewriteId/switch` - Switch version
- `GET /resumes/:id/rewrites/active` - Get active rewrite
- `DELETE /resumes/:id/rewrites/active` - Clear active rewrite
- `GET /resumes/:id/rewrites/compare` - Compare versions

### Theme APIs
- `GET /themes` - Get available themes (public)
- `GET /themes/:id` - Get theme by ID (public)
- `GET /themes/category/:category` - Get by category (public)
- `POST /resumes/:id/theme` - Apply theme
- `PATCH /resumes/:id/theme` - Update theme config

### Download APIs
- `GET /resumes/:id/download` - Download resume PDF
- `GET /resumes/analysis/:analysisId/download` - Download by analysis
- `GET /resumes/:id/rewrites/:rewriteId/download` - Download rewrite
- `GET /resumes/:id/preview` - Preview resume
- `POST /resumes/:id/download/custom` - Custom theme download
- `GET /resumes/:id/download/info` - Get download info

### Upload APIs
- `POST /upload/presigned` - Generate presigned URL
- `POST /upload/access` - Generate access URL

### User APIs
- `POST /user/:id/resumes` - Create resume (supports both users and candidates)

### SSE APIs
- `GET /sse/job/:jobId` - Job progress (already type-agnostic)

## Completed Implementation Details

The following components have been updated to support dynamic table selection:

### 1. Model Layer Functions

All model layer functions now accept `userType` parameter and use dynamic tables:

#### resume.model.js
- `createResumeContent()` - Creates resume content in correct table
- `getResumeContentByID()` - Fetches from correct table
- `getResumeContentByAnalysisID()` - Fetches by analysis from correct table
- `getAllResumeContents()` - Lists all resumes from correct table
- `updateResumeSection()` - Updates section in correct table
- `updateMultipleSections()` - Updates multiple sections
- `updateResumeScores()` - Updates scores
- `createRewrite()` - Creates rewrite in correct table
- `getRewriteByID()` - Fetches rewrite from correct table
- `getRewritesByAnalysisID()` - Lists rewrites from correct table
- `updateRewrite()` - Updates rewrite
- `applyRewrite()` - Applies rewrite to correct content table
- `switchRewriteVersion()` - Switches version in correct tables
- `getActiveRewrite()` - Gets active rewrite from correct table
- `clearActiveRewrite()` - Clears active rewrite in correct table
- `getAnalysisDataForRewrite()` - Fetches analysis data from correct table

#### theme.model.js
- `applyTheme()` - Applies theme to correct user theme table
- `getUserTheme()` - Fetches theme from correct table
- `updateUserTheme()` - Updates theme in correct table
- `restoreThemeFromSnapshot()` - Restores theme to correct table
- `publishResume()` - Publishes in correct table

#### download.model.js
- `getResumeForDownload()` - Fetches from correct tables with joins
- `getResumeForDownloadByAnalysisID()` - Fetches by analysis from correct tables
- `getRewriteForDownload()` - Fetches rewrite from correct table

### 2. Service Layer Functions

All service layer functions now accept and pass `userType` parameter:

#### resume.service.js
- `createResumeFromAnalysis()` - Passes userType to model
- `getResumeByID()` - Passes userType to model
- `getResumeByAnalysisID()` - Passes userType to model
- `getAllResumes()` - Extracts userType from options, passes to model
- `updateSection()` - Passes userType to model
- `updateSections()` - Passes userType to model
- `createRewrite()` - Extracts userType from options, includes in job data
- `getRewrite()` - Passes userType to model
- `getRewritesByAnalysis()` - Extracts userType from options, passes to model
- `applyRewrite()` - Passes userType to model
- `switchRewriteVersion()` - Passes userType to model
- `getActiveRewrite()` - Passes userType to model
- `clearActiveRewrite()` - Passes userType to model
- `compareRewriteVersions()` - Passes userType to model
- `applyTheme()` - Passes userType to themeModel
- `updateThemeConfig()` - Passes userType to themeModel
- `getResumeForRender()` - Passes userType to models
- `publishResume()` - Passes userType to themeModel

#### download.service.js
- `downloadResumePDF()` - Extracts userType from options, passes to model
- `downloadRewritePDF()` - Extracts userType from options, passes to model
- `getPreviewPDF()` - Extracts userType from options, passes to model
- `getHTMLPreview()` - Extracts userType from options, passes to model
- `downloadResumePDFByAnalysis()` - Extracts userType from options, passes to model

### 3. Queue Workers

Both workers have been updated to support dynamic tables:

#### resume-analysis.worker.js
- Accepts `userType` in job data
- Uses `getTablesForUserType()` to select correct tables
- Writes analysis, processed data to correct tables
- Passes `userType` to `resumeService.createResumeFromAnalysis()`

#### resume-rewrite.worker.js
- Accepts `userType` in job data
- Uses `getTablesForUserType()` to select correct tables
- Updates rewrite status, content in correct tables
- Auto-applies rewrite to correct resume content table

### 4. Controllers

Controllers already extract `userType` from `req.type` and pass to services:

- `resume.controller.js` - Passes `userType: req.type` in options
- `download.controller.js` - Passes `userType: req.type` in options
- `resume-analysis.controller.js` - Uses dynamic tables utility

## Token Structure

Tokens must include a `type` field:

```json
{
  "id": 123,
  "type": "user",  // or "candidate" or "admin"
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Testing

To test the implementation:

1. **User Token**: Create a token with `type: "user"` and verify data goes to user tables
2. **Candidate Token**: Create a token with `type: "candidate"` and verify data goes to candidate tables
3. **Cross-access Prevention**: Ensure users can't access candidate data and vice versa

## Database Schema Reference

### User Tables
- `users` → `usersTable`
- `documents` → `userDocumentTable`
- `analyses` → `analysisTable`
- `processed_and_raw_data` → `processedAndRawDataTable`
- `resume_content` → `resumeContentTable`
- `resume_rewrites` → `resumeRewritesTable`
- `user_resume_themes` → `userResumeThemeTable`

### Candidate Tables
- `candidates` → `candidatesTable`
- `candidate_documents` → `candidateDocumentTable`
- `candidate_analyses` → `candidateAnalysisTable`
- `candidate_processed_and_raw_data` → `candidateProcessedAndRawDataTable`
- `candidate_resume_content` → `candidateResumeContentTable`
- `candidate_resume_rewrites` → `candidateResumeRewritesTable`
- `candidate_resume_themes` → `candidateResumeThemeTable`

### Shared Tables
- `resume_themes` → `resumeThemesTable` (same themes for all users)
