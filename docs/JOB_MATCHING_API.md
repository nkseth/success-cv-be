# Job Matching System API Documentation

## Overview
The Job Matching System automatically scrapes jobs from RemoteOK and Indeed, matches them against user resumes using AI-powered scoring, and enables job-aware resume rewrites.

## Features
- 🔄 Automatic job scraping (every 6 hours)
- 🎯 AI-powered job matching (Skills 40%, Experience 30%, Education 20%, Location 10%)
- 📝 Job-aware resume rewriting
- ⚙️ User preferences for filtering and boosting matches
- 💾 Complete job browsing and filtering

---

## Job Browsing APIs

### Get All Jobs
```http
GET /api/v1/jobs
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)
- `search` (string) - Search in title, company, description
- `location` (string) - Filter by location
- `remoteType` (string) - Filter by: `remote`, `hybrid`, `onsite`
- `employmentType` (string) - Filter by: `full-time`, `part-time`, `contract`, `internship`
- `experienceLevel` (string) - Filter by: `entry`, `mid`, `senior`, `lead`
- `minSalary` (number) - Minimum salary
- `maxSalary` (number) - Maximum salary
- `skills` (string[]) - Filter by skills (comma-separated or array)
- `educationLevel` (string) - Filter by education requirement
- `postedAfter` (ISO date) - Jobs posted after this date
- `sortBy` (string) - Sort field (default: `postedDate`)
- `sortOrder` (string) - `asc` or `desc` (default: `desc`)

**Response:**
```json
{
  "success": true,
  "message": "Jobs fetched successfully",
  "data": [
    {
      "id": 1,
      "external_id": "remote-ok-12345",
      "source": "remoteok",
      "title": "Senior Full Stack Developer",
      "company": "Tech Corp",
      "company_logo": "https://logo.url",
      "location": "Remote",
      "remote_type": "remote",
      "employment_type": "full-time",
      "experience_level": "senior",
      "salary_min": 120000,
      "salary_max": 180000,
      "currency": "USD",
      "salary_period": "annual",
      "description": "We're looking for...",
      "requirements": "5+ years experience...",
      "responsibilities": "Lead development team...",
      "benefits": "Health insurance, 401k...",
      "skills_required": {
        "required": ["JavaScript", "Node.js", "React"],
        "preferred": ["TypeScript", "GraphQL"]
      },
      "education_level": "Bachelor",
      "years_experience_min": 5,
      "years_experience_max": 10,
      "url": "https://job.url",
      "apply_url": "https://apply.url",
      "posted_date": "2026-01-25T10:00:00Z",
      "expires_at": "2026-02-25T10:00:00Z",
      "is_active": true,
      "created_at": "2026-01-25T10:00:00Z",
      "updated_at": "2026-01-25T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

### Get Job by ID
```http
GET /api/v1/jobs/:id
```

**Response:** Same as single job object above

---

## Job Matching APIs

### Get User's Job Matches
```http
GET /api/v1/job-matches
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20)
- `minScore` (number) - Minimum match score (0-100)
- `status` (string) - Filter by status (comma-separated)
- `saved` (boolean) - Filter saved matches
- `applied` (boolean) - Filter applied matches
- `analysisId` (number) - Filter by specific analysis
- `sortBy` (string) - Sort field (default: `matchScore`)
- `sortOrder` (string) - `asc` or `desc` (default: `desc`)

**Response:**
```json
{
  "success": true,
  "message": "Job matches fetched successfully",
  "data": [
    {
      "id": 1,
      "userID": 123,
      "jobID": 456,
      "analysisID": 789,
      "match_score": 85,
      "skill_match_score": 90,
      "experience_match_score": 80,
      "education_match_score": 85,
      "location_match": true,
      "match_reasons": {
        "matchedSkills": ["JavaScript", "React", "Node.js"],
        "strengthAreas": ["Strong skill match", "Relevant experience", "Matches preferred job title"],
        "fitReason": "Excellent match - strong alignment across all areas"
      },
      "mismatch_reasons": {
        "missingSkills": ["GraphQL"],
        "improvementAreas": []
      },
      "status": "new",
      "is_saved": false,
      "is_applied": false,
      "applied_at": null,
      "rejected_at": null,
      "created_at": "2026-01-26T10:00:00Z",
      "updated_at": "2026-01-26T10:00:00Z",
      "job": {
        "id": 456,
        "title": "Senior Full Stack Developer",
        "company": "Tech Corp",
        "location": "Remote",
        "salary_min": 120000,
        "salary_max": 180000,
        "posted_date": "2026-01-25T10:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Get Job Match by ID
```http
GET /api/v1/job-matches/:id
```

**Response:** Same as single job match object above

### Generate Job Matches
```http
POST /api/v1/job-matches/generate
```

**Request Body:**
```json
{
  "analysisId": 789,
  "minScore": 50,
  "maxResults": 50,
  "replaceExisting": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job matching started. Results will be available shortly.",
  "data": {
    "jobId": "match-123-789-1706256000000",
    "userId": 123,
    "analysisId": 789,
    "status": "processing"
  }
}
```

### Regenerate Job Matches
```http
POST /api/v1/job-matches/regenerate
```

**Request Body:** Same as generate
**Response:** Same as generate

### Update Job Match
```http
PUT /api/v1/job-matches/:id
```

**Request Body:**
```json
{
  "status": "viewed",
  "saved": true,
  "applied": true,
  "rejectedAt": "2026-01-26T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job match updated successfully",
  "data": {
    "id": 1,
    "status": "viewed",
    "is_saved": true,
    "is_applied": true,
    "applied_at": "2026-01-26T10:00:00Z"
  }
}
```

### Delete Job Match
```http
DELETE /api/v1/job-matches/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Job match deleted successfully"
}
```

---

## Job-Aware Resume Rewrite

### Rewrite Resume for Specific Job
```http
POST /api/v1/job-matches/:jobMatchId/rewrite
```

This endpoint creates a tailored version of your resume optimized for a specific job match.

**Request Body:**
```json
{
  "resumeId": 456,
  "analysisId": 789
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job-aware resume rewrite started. Check back soon for results.",
  "data": {
    "rewriteJobId": "rewrite-123-456-1706256000000",
    "jobMatchId": 1,
    "jobTitle": "Senior Full Stack Developer",
    "jobCompany": "Tech Corp",
    "resumeId": 456,
    "status": "processing"
  }
}
```

**How it works:**
1. Retrieves job details (title, description, required skills)
2. Fetches your resume content
3. AI rewrites resume with job-aware prompt:
   - Incorporates relevant job keywords
   - Aligns experience descriptions with job requirements
   - Highlights achievements matching job needs
   - Maintains ATS optimization
4. Stores `targetJobID` and `sourceResumeID` for tracking

---

## Job Preferences APIs

### Get User Preferences
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
    "userID": 123,
    "user_type": "user",
    "preferred_titles": ["Senior Developer", "Tech Lead"],
    "preferred_locations": ["San Francisco", "Remote"],
    "remote_preference": "remote",
    "min_salary": 120000,
    "max_commute_time": null,
    "preferred_company_size": null,
    "preferred_industries": [],
    "notification_enabled": true,
    "notification_frequency": "daily",
    "last_notification_at": null,
    "created_at": "2026-01-26T10:00:00Z",
    "updated_at": "2026-01-26T10:00:00Z"
  }
}
```

### Update User Preferences
```http
PUT /api/v1/job-preferences
```

**Request Body:**
```json
{
  "preferredTitles": ["Senior Developer", "Tech Lead"],
  "preferredLocations": ["San Francisco", "Remote"],
  "remotePreference": "remote",
  "minSalary": 120000,
  "notificationEnabled": true
}
```

**Response:** Same as get preferences

**How preferences affect matching:**
- Jobs matching preferred titles get +5 score boost
- Jobs in preferred locations get +3 score boost
- Jobs matching remote preference get +2 score boost
- Jobs are filtered by minSalary and remotePreference before scoring

---

## Matching Algorithm

### Scoring Weights
- **Skills (40%)**: Matches required/technical skills with resume
- **Experience (30%)**: Years of experience and job title relevance
- **Education (20%)**: Education level requirements
- **Location (10%)**: Location compatibility (remote gets 100%)

### Preference Boosting
- Preferred titles: +5 points
- Preferred locations: +3 points
- Remote preference match: +2 points
- **Maximum boost: +10 points**

### Example Match Flow
1. User uploads resume → Analysis generates skills, experience, education
2. Job matching triggered automatically after analysis
3. System fetches 1000 active jobs
4. Applies user preference filters (remoteType, minSalary)
5. Calculates match score for each job:
   ```
   Base Score = (Skills × 0.4) + (Experience × 0.3) + (Education × 0.2) + (Location × 0.1)
   Final Score = min(100, Base Score + Preference Boost)
   ```
6. Filters jobs above minScore threshold (default: 50)
7. Sorts by score and stores top 50 matches

---

## Job Scraping

### Automatic Scraping
- **Schedule**: Every 6 hours via cron: `0 */6 * * *`
- **Sources**: RemoteOK (JSON API), Indeed (RSS feeds)
- **Deduplication**: By `external_id` + `source` composite key
- **Cleanup**: Daily at 3 AM, marks jobs >30 days old as inactive

### Scraping Logs
Query via `job_scraping_logs` table:
- `source`: "remoteok" or "indeed"
- `status`: "running", "success", "partial", "failed"
- `jobs_found`: Total jobs scraped
- `jobs_new`: New jobs added
- `jobs_updated`: Existing jobs updated
- `jobs_errors`: Number of errors
- `error_message`: Error details if failed

---

## Error Codes

- `400` - Bad Request (missing required fields, invalid data)
- `401` - Unauthorized (invalid/missing auth token)
- `404` - Not Found (job/match/preference not found)
- `500` - Internal Server Error (database/service errors)

---

## Authentication

All endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

User type is automatically detected from the JWT token (`user` or `candidate`).

---

## Rate Limits

- Job browsing: 100 requests/minute
- Job matching: 10 requests/minute (background job)
- Job-aware rewrite: 5 requests/minute (background job)
- Preferences: 20 requests/minute

---

## Testing

### Test Job Scraping
```bash
# Start job scraping worker
npm run worker:job-scraping

# Check logs
tail -f logs/job-scraping.log

# Verify in database
SELECT source, COUNT(*) FROM jobs GROUP BY source;
```

### Test Job Matching
```bash
# Start job matching worker
npm run worker:job-matching

# Trigger manual match
curl -X POST http://localhost:3000/api/v1/job-matches/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"analysisId": 789}'

# Check results
curl http://localhost:3000/api/v1/job-matches \
  -H "Authorization: Bearer <token>"
```

### Test Job-Aware Rewrite
```bash
# Get a job match ID
curl http://localhost:3000/api/v1/job-matches \
  -H "Authorization: Bearer <token>"

# Trigger rewrite
curl -X POST http://localhost:3000/api/v1/job-matches/1/rewrite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"resumeId": 456}'
```

---

## Database Schema

### Jobs Table
- Stores scraped job listings
- Indexed for fast searching (title, company, location, skills)
- Full-text search with pg_trgm extension
- JSONB skills for flexible matching

### Job Matches Table
- Stores pre-computed match scores
- Links users/candidates to jobs via analysis
- Tracks application status (saved, applied, rejected)
- Indexed for fast user queries

### Job Scraping Logs Table
- Audit trail for all scraping runs
- Performance metrics (jobs found/new/updated)
- Error tracking

### User Job Preferences Table
- User-specific job preferences
- Notification settings
- Used for filtering and boosting matches

---

## Workers

### Resume Analysis Worker
Auto-triggers job matching after resume analysis completes.

### Job Scraping Worker
Runs every 6 hours, scrapes jobs from RemoteOK and Indeed.

### Job Matching Worker
Processes job matching requests with concurrency of 5.

### Resume Rewrite Worker (Enhanced)
Now supports job-aware rewrites with job context in AI prompts.

---

## Future Enhancements

- [ ] Email notifications for high-score matches
- [ ] More job sources (LinkedIn, Glassdoor, AngelList)
- [ ] Machine learning for personalized scoring weights
- [ ] Job application tracking
- [ ] Interview preparation based on job requirements
- [ ] Salary negotiation insights
