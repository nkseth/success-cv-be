# Job System API - Frontend Integration Guide

This document provides the complete API reference for integrating the Job System into your frontend application.

## Base URL
```
/api/v1
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Job Preferences

Job preferences allow users to set their job search criteria. These preferences are automatically applied when browsing jobs without filters.

### Get Job Preferences
Retrieves the user's saved job preferences.

```http
GET /api/v1/job-preferences
```

**Response:**
```json
{
  "success": true,
  "message": "Job preferences fetched successfully",
  "data": {
    "id": 1,
    "preferredTitles": ["Software Engineer", "Full Stack Developer"],
    "preferredLocations": ["San Francisco, CA", "Remote"],
    "remotePreference": "remote_only",
    "employmentTypes": ["full-time", "contract"],
    "experienceLevels": ["mid", "senior"],
    "minSalary": 100000,
    "maxSalary": 200000,
    "currency": "USD",
    "mustHaveSkills": ["React", "Node.js", "TypeScript"],
    "excludedCompanies": ["Company A"],
    "notificationEnabled": true,
    "notificationFrequency": "daily",
    "minMatchScoreForNotification": 70,
    "createdAt": "2026-01-26T00:00:00.000Z",
    "updatedAt": "2026-01-26T00:00:00.000Z"
  }
}
```

**Note:** Returns `null` if no preferences are set.

---

### Update Job Preferences
Creates or updates the user's job preferences.

```http
PUT /api/v1/job-preferences
```

**Request Body:**
```json
{
  "preferredTitles": ["Software Engineer", "Backend Developer"],
  "preferredLocations": ["New York, NY", "Remote"],
  "remotePreference": "remote_only",
  "employmentTypes": ["full-time"],
  "experienceLevels": ["senior"],
  "minSalary": 120000,
  "maxSalary": 180000,
  "mustHaveSkills": ["Python", "AWS"],
  "excludedCompanies": ["Bad Company Inc"],
  "notificationEnabled": true,
  "notificationFrequency": "daily",
  "minMatchScoreForNotification": 75
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `preferredTitles` | `string[]` | Job titles user is interested in |
| `preferredLocations` | `string[]` | Preferred work locations |
| `remotePreference` | `string` | One of: `remote_only`, `hybrid`, `onsite`, `no_preference` |
| `employmentTypes` | `string[]` | Array of: `full-time`, `part-time`, `contract`, `internship` |
| `experienceLevels` | `string[]` | Array of: `entry`, `mid`, `senior`, `lead`, `executive` |
| `minSalary` | `number` | Minimum desired salary |
| `maxSalary` | `number` | Maximum salary cap |
| `mustHaveSkills` | `string[]` | Required skills (jobs must have these) |
| `excludedCompanies` | `string[]` | Companies to exclude from results |
| `notificationEnabled` | `boolean` | Enable/disable job notifications |
| `notificationFrequency` | `string` | One of: `realtime`, `daily`, `weekly`, `never` |
| `minMatchScoreForNotification` | `number` | Minimum match score (0-100) to trigger notification |

**Response:**
```json
{
  "success": true,
  "message": "Job preferences updated successfully",
  "data": { /* updated preferences object */ }
}
```

---

## Job Browsing

### Get All Jobs
Browse available jobs with filtering and pagination. **If no filters are provided, user's saved preferences are automatically applied.**

```http
GET /api/v1/jobs
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `20` | Items per page (max: 100) |
| `q` | `string` | - | Search query (searches title, company, description) |
| `location` | `string` | - | Location filter (fuzzy match) |
| `remoteType` | `string` | - | Comma-separated: `remote`, `hybrid`, `onsite` |
| `employmentType` | `string` | - | Comma-separated: `full-time`, `part-time`, `contract` |
| `experienceLevel` | `string` | - | Comma-separated: `entry`, `mid`, `senior` |
| `minSalary` | `number` | - | Minimum salary filter |
| `maxSalary` | `number` | - | Maximum salary filter |
| `skills` | `string` | - | Comma-separated required skills |
| `postedAfter` | `string` | - | ISO date string (jobs posted after this date) |
| `sortBy` | `string` | `postedDate` | Sort field: `postedDate`, `salary`, `company` |
| `sortOrder` | `string` | `desc` | Sort order: `asc`, `desc` |

**Example Requests:**

```javascript
// No filters - uses saved preferences
GET /api/v1/jobs

// With explicit filters - ignores preferences
GET /api/v1/jobs?remoteType=remote&experienceLevel=senior&skills=React,Node.js

// Search with pagination
GET /api/v1/jobs?q=software+engineer&page=2&limit=10

// Salary range filter
GET /api/v1/jobs?minSalary=100000&maxSalary=150000&sortBy=salary&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "message": "Jobs fetched successfully",
  "data": {
    "jobs": [
      {
        "id": 123,
        "externalId": "1129758",
        "source": "remoteok",
        "title": "Senior Software Engineer",
        "company": "Tech Company",
        "location": "San Francisco, CA",
        "remoteType": "remote",
        "employmentType": "full-time",
        "experienceLevel": "senior",
        "salaryMin": 150000,
        "salaryMax": 200000,
        "salaryCurrency": "USD",
        "description": "We're looking for a senior engineer...",
        "requirements": ["5+ years experience", "React expertise"],
        "benefits": ["Health insurance", "401k matching"],
        "skillsRequired": { "primary": ["React", "Node.js"], "secondary": ["TypeScript"] },
        "educationLevel": "bachelor",
        "applicationUrl": "https://company.com/apply",
        "postedDate": "2026-01-25T00:00:00.000Z",
        "expiresAt": null,
        "isActive": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 97,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "appliedPreferences": true  // true if user's preferences were used
  }
}
```

---

### Get Job by ID
Get detailed information about a specific job.

```http
GET /api/v1/jobs/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Job fetched successfully",
  "data": {
    "id": 123,
    "title": "Senior Software Engineer",
    "company": "Tech Company",
    // ... full job object
  }
}
```

---

## Job Matches

Job matches are AI-generated recommendations based on the user's resume analysis.

### Get User's Job Matches
Retrieve all job matches for the authenticated user.

```http
GET /api/v1/job-matches
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `20` | Items per page |
| `minScore` | `number` | - | Minimum match score (0-100) |
| `status` | `string` | - | Filter by status: `new`, `viewed`, `saved`, `applied`, `rejected` |
| `saved` | `boolean` | - | Filter by saved: `true` or `false` |
| `applied` | `boolean` | - | Filter by applied: `true` or `false` |
| `analysisId` | `number` | - | Filter matches for specific resume analysis |
| `sortBy` | `string` | `matchScore` | Sort field: `matchScore`, `createdAt`, `appliedAt` |
| `sortOrder` | `string` | `desc` | Sort order: `asc`, `desc` |

**Example Requests:**

```javascript
// Get top matches
GET /api/v1/job-matches?minScore=70&sortBy=matchScore

// Get saved jobs
GET /api/v1/job-matches?saved=true

// Get applied jobs
GET /api/v1/job-matches?applied=true

// Get matches for specific resume
GET /api/v1/job-matches?analysisId=45
```

**Response:**
```json
{
  "success": true,
  "message": "Job matches fetched successfully",
  "data": {
    "matches": [
      {
        "id": 1,
        "jobID": 123,
        "matchScore": 85,
        "matchReasons": {
          "skills": ["React", "Node.js matched"],
          "experience": "5+ years matches requirement",
          "location": "Remote preference matched"
        },
        "status": "new",
        "saved": false,
        "applied": false,
        "appliedAt": null,
        "rejectedAt": null,
        "createdAt": "2026-01-26T00:00:00.000Z",
        "job": {
          "id": 123,
          "title": "Senior Software Engineer",
          "company": "Tech Company",
          "location": "Remote",
          "salaryMin": 150000,
          "salaryMax": 200000
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 15,
      "totalPages": 1
    }
  }
}
```

---

### Get Job Match by ID

```http
GET /api/v1/job-matches/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Job match fetched successfully",
  "data": {
    "id": 1,
    "jobID": 123,
    "matchScore": 85,
    // ... full match object with job details
  }
}
```

---

### Generate Job Matches
Trigger AI job matching for a resume analysis.

```http
POST /api/v1/job-matches/generate
```

**Request Body:**
```json
{
  "analysisId": 45,
  "minScore": 50,
  "maxResults": 50,
  "replaceExisting": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `analysisId` | `number` | Yes | - | Resume analysis ID to match against |
| `minScore` | `number` | No | `50` | Minimum match score threshold |
| `maxResults` | `number` | No | `50` | Maximum number of matches to generate |
| `replaceExisting` | `boolean` | No | `true` | Replace existing matches or add to them |

**Response:**
```json
{
  "success": true,
  "message": "Job matching started. Results will be available shortly.",
  "data": {
    "jobId": "job-123456",
    "userId": 14,
    "analysisId": 45,
    "status": "processing"
  }
}
```

**Note:** This is an async operation. Poll `/api/v1/job-matches` to see results.

---

### Regenerate Job Matches
Re-run job matching (e.g., after changing preferences).

```http
POST /api/v1/job-matches/regenerate
```

**Request Body:**
```json
{
  "analysisId": 45,
  "minScore": 60,
  "maxResults": 30
}
```

**Response:** Same as Generate Job Matches.

---

### Update Job Match
Update a job match status (save, apply, reject).

```http
PUT /api/v1/job-matches/:id
```

**Request Body:**
```json
{
  "saved": true,
  "applied": false,
  "status": "saved"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | One of: `new`, `viewed`, `saved`, `applied`, `rejected` |
| `saved` | `boolean` | Mark as saved/bookmarked |
| `applied` | `boolean` | Mark as applied (sets `appliedAt` timestamp) |
| `rejectedAt` | `string` | ISO date string to mark rejection |

**Response:**
```json
{
  "success": true,
  "message": "Job match updated successfully",
  "data": {
    "id": 1,
    "saved": true,
    "applied": false,
    "status": "saved",
    // ... updated match object
  }
}
```

---

### Delete Job Match

```http
DELETE /api/v1/job-matches/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Job match deleted successfully",
  "data": null
}
```

---

## Job-Aware Resume Rewrite

Trigger a resume rewrite optimized for a specific job.

```http
POST /api/v1/job-matches/:jobMatchId/rewrite
```

**Request Body:**
```json
{
  "resumeId": 10,
  "analysisId": 45
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resumeId` | `number` | Yes | Resume to rewrite |
| `analysisId` | `number` | No | Specific analysis (defaults to match's analysis) |

**Response:**
```json
{
  "success": true,
  "message": "Job-aware resume rewrite started. Check back soon for results.",
  "data": {
    "rewriteJobId": "rewrite-123456",
    "jobMatchId": 1,
    "jobTitle": "Senior Software Engineer",
    "jobCompany": "Tech Company",
    "resumeId": 10,
    "status": "processing"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

**Common Error Codes:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body or parameters |
| 401 | `TOKEN_EXPIRED` | JWT token has expired |
| 403 | `INVALID_TOKEN` | Invalid or missing JWT token |
| 404 | `NOT_FOUND` | Resource not found |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Frontend Implementation Example

### React Hook Example

```typescript
// hooks/useJobs.ts
import { useState, useEffect } from 'react';
import api from '../services/api';

interface JobFilters {
  q?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  experienceLevel?: string;
  minSalary?: number;
  maxSalary?: number;
  skills?: string;
}

export function useJobs(filters: JobFilters = {}, page = 1, limit = 20) {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [appliedPreferences, setAppliedPreferences] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== undefined)
          )
        });

        const response = await api.get(`/jobs?${params}`);
        setJobs(response.data.data.jobs);
        setPagination(response.data.data.pagination);
        setAppliedPreferences(response.data.data.appliedPreferences);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [JSON.stringify(filters), page, limit]);

  return { jobs, pagination, appliedPreferences, loading, error };
}
```

### Preferences Component Example

```typescript
// components/JobPreferences.tsx
import { useState, useEffect } from 'react';
import api from '../services/api';

export function JobPreferences() {
  const [preferences, setPreferences] = useState({
    preferredTitles: [],
    preferredLocations: [],
    remotePreference: 'no_preference',
    employmentTypes: [],
    experienceLevels: [],
    minSalary: null,
    maxSalary: null,
    mustHaveSkills: [],
    notificationEnabled: true,
    notificationFrequency: 'daily'
  });

  useEffect(() => {
    // Fetch current preferences
    api.get('/job-preferences').then(res => {
      if (res.data.data) {
        setPreferences(res.data.data);
      }
    });
  }, []);

  const savePreferences = async () => {
    await api.put('/job-preferences', preferences);
    alert('Preferences saved! Job listings will now use these filters.');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); savePreferences(); }}>
      {/* Form fields for each preference */}
      <button type="submit">Save Preferences</button>
    </form>
  );
}
```

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Set Preferences (Optional)                                   │
│     PUT /job-preferences                                         │
│         │                                                        │
│         ▼                                                        │
│  2. Browse Jobs                                                  │
│     GET /jobs  ──────► Uses preferences if no filters            │
│         │                                                        │
│         ▼                                                        │
│  3. Upload Resume & Analyze                                      │
│     (Uses existing resume endpoints)                             │
│         │                                                        │
│         ▼                                                        │
│  4. Generate Job Matches                                         │
│     POST /job-matches/generate                                   │
│         │                                                        │
│         ▼                                                        │
│  5. View Matches                                                 │
│     GET /job-matches?sortBy=matchScore                           │
│         │                                                        │
│         ▼                                                        │
│  6. Save/Apply to Jobs                                           │
│     PUT /job-matches/:id { saved: true }                         │
│     PUT /job-matches/:id { applied: true }                       │
│         │                                                        │
│         ▼                                                        │
│  7. Optimize Resume for Job (Optional)                           │
│     POST /job-matches/:id/rewrite                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
