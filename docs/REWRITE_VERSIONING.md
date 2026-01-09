# Resume Rewrite Versioning System

## Overview

The rewrite versioning system allows users to create multiple AI-optimized versions of their resume, switch between versions, and track changes. This document explains the workflow and API endpoints.

## Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESUME REWRITE WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

1. ANALYSIS PHASE
   ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
   │   Upload    │ ──► │   Analysis  │ ──► │  Resume Content │
   │   Resume    │     │   (AI)      │     │   Created       │
   └─────────────┘     └─────────────┘     └─────────────────┘

2. EDITING PHASE (Optional)
   ┌─────────────────┐     ┌─────────────────┐
   │  Resume Content │ ──► │  User Edits     │
   │                 │     │  (Manual)       │
   └─────────────────┘     └─────────────────┘

3. REWRITE PHASE
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │  Current        │ ──► │  AI Rewrite     │ ──► │  Rewrite v1     │
   │  Content        │     │  (Queue Job)    │     │  Created        │
   └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                                                   ┌─────────────────┐
                                                   │  Apply Rewrite  │
                                                   │  (Optional)     │
                                                   └─────────────────┘

4. VERSION MANAGEMENT
   ┌─────────────────────────────────────────────────────────────────┐
   │                    REWRITE VERSIONS                             │
   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
   │  │ v1       │  │ v2       │  │ v3       │  │ v4       │        │
   │  │          │  │          │  │ (ACTIVE) │  │          │        │
   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
   │                                   │                             │
   │                                   ▼                             │
   │                          ┌─────────────────┐                   │
   │                          │ Resume Content  │                   │
   │                          │ (Current State) │                   │
   │                          └─────────────────┘                   │
   └─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Resume Content
- Single source of truth for the current resume state
- Updated when user edits manually OR when a rewrite is applied
- Tracks `activeRewriteID` to know which version is currently applied
- `version` field increments with each change

### Rewrite Versions
- Each rewrite is immutable once completed
- Contains:
  - `sourceContentSnapshot`: What the resume looked like when rewrite was requested
  - `rewrittenContent`: AI-optimized content (never changes)
  - `isActive`: Whether this version is currently applied
  - `wasModifiedAfterApply`: Whether content was edited after applying this version

### Version Switching
- User can switch to any completed rewrite version
- Switching updates the resume content with that version's `rewrittenContent`
- Only one version can be active at a time
- Switching preserves all version history

## API Endpoints

### Create New Rewrite
```
POST /api/v1/resumes/:id/rewrites
```
Creates a new AI rewrite job based on the CURRENT resume content.

**Request Body:**
```json
{
  "versionLabel": "ATS Optimized Version",
  "targetATSScore": 90,
  "focusAreas": ["experience", "skills"],
  "optimizationLevel": "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "jobId": "rewrite-5-1735689600000",
    "versionNumber": 3,
    "versionLabel": "ATS Optimized Version",
    "status": "pending",
    "basedOnVersion": 7,
    "message": "Rewrite job created and queued"
  }
}
```

### Get All Rewrites
```
GET /api/v1/resumes/:id/rewrites
```
Returns all rewrite versions with their status and active state.

### Switch Rewrite Version
```
POST /api/v1/resumes/:id/rewrites/:rewriteId/switch
```
Switches to a different rewrite version, updating resume content.

**Response:**
```json
{
  "success": true,
  "data": {
    "content": { /* Updated resume content */ },
    "activeRewrite": {
      "id": 2,
      "versionNumber": 2,
      "versionLabel": "Rewrite v2",
      "isActive": true,
      "appliedAt": "2025-01-01T10:00:00.000Z"
    },
    "message": "Switched to rewrite version 2"
  }
}
```

### Get Active Rewrite
```
GET /api/v1/resumes/:id/rewrites/active
```
Returns the currently active rewrite version, or null if in manual mode.

### Clear Active Rewrite
```
DELETE /api/v1/resumes/:id/rewrites/active
```
Removes the active rewrite link, putting the resume in manual editing mode.

### Compare Versions
```
GET /api/v1/resumes/:id/rewrites/compare?version1=1&version2=3
```
Returns both rewrite versions for side-by-side comparison.

## State Diagram

```
                    ┌──────────────────┐
                    │   Manual Mode    │
                    │ (No active       │
                    │  rewrite)        │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │ Apply Rewrite v1  │                   │ Apply Rewrite v2
         ▼                   │                   ▼
┌─────────────────┐          │         ┌─────────────────┐
│  Rewrite v1     │◄─────────┼────────►│  Rewrite v2     │
│  Active         │  Switch  │  Switch │  Active         │
└────────┬────────┘          │         └────────┬────────┘
         │                   │                   │
         │ Edit Content      │ Clear Active      │ Edit Content
         ▼                   ▼                   ▼
┌─────────────────┐  ┌──────────────┐   ┌─────────────────┐
│  v1 Modified    │  │ Manual Mode  │   │  v2 Modified    │
│  (wasModified   │  │              │   │  (wasModified   │
│   = true)       │  │              │   │   = true)       │
└─────────────────┘  └──────────────┘   └─────────────────┘
```

## Database Schema Changes

### resume_rewrites table additions:
- `sourceContentSnapshot` (JSONB): Captures resume state at rewrite request time
- `wasModifiedAfterApply` (BOOLEAN): Tracks if content was edited after applying

### Indexes added:
- `idx_resume_rewrites_active`: Fast lookup of active rewrites
- `idx_resume_rewrites_status`: Status-based filtering
- `idx_resume_rewrites_version`: Version number lookups

## Best Practices

1. **New rewrites are always based on current content**
   - If user edits after applying v1, a new rewrite (v2) will be based on the edited content
   - This ensures user's manual changes are preserved and enhanced

2. **Version labels are optional but recommended**
   - Help users identify versions: "ATS Optimized", "Tech Focus", etc.

3. **Use compare endpoint before switching**
   - Let users see differences before applying a version

4. **Track wasModifiedAfterApply**
   - Warn users if switching will overwrite manual edits

## Migration

Run the migration to add new columns:
```sql
-- File: drizzle/0006_rewrite_versioning.sql
ALTER TABLE "resume_rewrites" ADD COLUMN IF NOT EXISTS "sourceContentSnapshot" jsonb;
ALTER TABLE "resume_rewrites" ADD COLUMN IF NOT EXISTS "wasModifiedAfterApply" boolean DEFAULT false;
```
