# Job Scraping & Filtration System — Detailed Architecture & Production Risk Assessment

> **Last Updated**: 19 March 2026  
> **Status**: Internal Engineering Documentation  
> **Scope**: End-to-end data flow from external job boards → database → user-facing matched results

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Sources](#3-data-sources)
4. [Scraping Pipeline — Detailed Flow](#4-scraping-pipeline--detailed-flow)
5. [Filtration & Search System](#5-filtration--search-system)
6. [Job Matching Engine](#6-job-matching-engine)
7. [User Preferences System](#7-user-preferences-system)
8. [Infrastructure & Resilience](#8-infrastructure--resilience)
9. [Database Schema Summary](#9-database-schema-summary)
10. [API Endpoints](#10-api-endpoints)
11. [Background Workers](#11-background-workers)
12. [🐛 Production Bugs & Risks — Detailed List](#12--production-bugs--risks--detailed-list)

---

## 1. System Overview

The Job Scraping & Filtration system is a multi-layered pipeline that:

1. **Scrapes** job listings from 11 external sources (6 international remote boards + 5 Indian job portals)
2. **Deduplicates & stores** jobs in PostgreSQL with UPSERT logic
3. **Filters & searches** the job database with full-text search, multi-value filters, salary ranges, and skills-based JSONB queries
4. **Matches** jobs to users via a weighted scoring algorithm (Skills 40%, Experience 30%, Education 20%, Location 10%)
5. **Personalises** results using saved user preferences with automatic fallback

### Key Technologies
| Component | Technology |
|-----------|-----------|
| Queue System | BullMQ (Redis-backed) |
| Database | PostgreSQL + Drizzle ORM |
| Caching | Redis (DB 0 for cache, DB 1 for queues) |
| Circuit Breakers | `opossum` library |
| Indian Board Scraping | External Python FastAPI microservice (Scrapling) |
| Scheduling | BullMQ cron repeatable jobs |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL JOB SOURCES                             │
│                                                                             │
│  ┌──────────┐ ┌──────────┐ ┌─────┐ ┌──────────┐ ┌───────┐ ┌──────┐        │
│  │ RemoteOK │ │ Remotive │ │ WWR │ │Himalayas │ │Jobicy │ │Indeed│        │
│  │  (JSON)  │ │  (RSS)   │ │(RSS)│ │  (JSON)  │ │(JSON) │ │(RSS) │        │
│  └────┬─────┘ └────┬─────┘ └──┬──┘ └────┬─────┘ └───┬───┘ └──┬───┘        │
│       │             │          │          │           │        │            │
│  ┌────┴─────────────┴──────────┴──────────┴───────────┴────────┴───┐        │
│  │                 Node.js Scraper Services                        │        │
│  │      (services/jobBoards/*.service.js)                          │        │
│  └───────────────────────────┬─────────────────────────────────────┘        │
│                              │                                              │
│  ┌──────────┐ ┌──────────┐ ┌┴─────────┐ ┌─────────┐ ┌────────┐            │
│  │  Naukri  │ │Internshala│ │ LinkedIn │ │ Foundit │ │ Shine  │            │
│  │          │ │          │ │  India   │ │         │ │        │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └───┬────┘            │
│       │             │            │             │          │                 │
│  ┌────┴─────────────┴────────────┴─────────────┴──────────┴───┐            │
│  │         Python Scrapling Microservice (FastAPI)              │            │
│  │         POST /api/v1/scrape  →  Headless Browser            │            │
│  └────────────────────────────┬────────────────────────────────┘            │
│                               │                                             │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        BullMQ JOB SCRAPING QUEUE                         │
│                                                                           │
│  Types: SCRAPE_SOURCE | SCRAPE_ALL | SCRAPE_INDIAN_SOURCE | CLEANUP      │
│  Worker: concurrency=2, rate=10 jobs/min                                  │
│  Retry: 3 attempts, exponential backoff (5s→10s→20s)                     │
│                                                                           │
│  Cron Schedules:                                                          │
│  ├── Remotive:       Daily at midnight                                    │
│  ├── RemoteOK:       Every 6 hours                                        │
│  ├── WeWorkRemotely: Every 2 hours                                        │
│  ├── Himalayas:      Every 4 hours                                        │
│  ├── Jobicy:         Hourly at :15                                        │
│  ├── Naukri:         Every 4 hours                                        │
│  ├── LinkedIn-India: Every 3 hours                                        │
│  ├── Internshala:    Every 6 hours                                        │
│  ├── Foundit:        Every 6 hours                                        │
│  ├── Shine:          Every 8 hours                                        │
│  └── Cleanup:        Daily at 3 AM                                        │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        UPSERT → PostgreSQL                                │
│                                                                           │
│  ON CONFLICT (external_id, source) DO UPDATE                              │
│  Batch insert in single transaction                                       │
│  In-memory dedup filter by source                                         │
│                                                                           │
│  Tables: jobs, job_scraping_logs                                          │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        FILTRATION & MATCHING                              │
│                                                                           │
│  ┌──────────────┐    ┌──────────────────────────────┐                     │
│  │ GET /api/v1/ │    │ POST /api/v1/job-matches/    │                     │
│  │    jobs      │    │       generate               │                     │
│  │              │    │                              │                     │
│  │ Filters:     │    │ Matching Service:            │                     │
│  │ • Full-text  │    │ • Skills:      40% weight    │                     │
│  │ • Location   │    │ • Experience:  30% weight    │                     │
│  │ • Remote     │    │ • Education:   20% weight    │                     │
│  │ • Salary     │    │ • Location:    10% weight    │                     │
│  │ • Skills     │    │ • Pref boost:  up to +10     │                     │
│  │ • Experience │    │ • Levenshtein fuzzy matching  │                     │
│  │ • Posted date│    │                              │                     │
│  └──────────────┘    └──────────────────────────────┘                     │
│                                                                           │
│  Tables: job_matches, user_job_preferences                                │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Sources

### 3.1 International Remote Boards (Direct Node.js)

| Source | Type | API Endpoint | Rate Limit | Scrape Interval | Data Quality |
|--------|------|-------------|------------|-----------------|--------------|
| **RemoteOK** | JSON API | `https://remoteok.com/api` | Informal — be respectful | Every 6h | ✅ Good — salary, tags, logos |
| **Remotive** | RSS Feed | `https://remotive.com/remote-jobs/feed` | None (RSS) | Daily | ⚠️ 24h delay, basic data |
| **WeWorkRemotely** | RSS Feed | Multiple category feeds | None (RSS) | Every 2h | ⚠️ Basic data, no salary |
| **Himalayas** | JSON API | `https://himalayas.app/jobs/api` | Max 20/request | Every 4h | ✅ Good — seniority field |
| **Jobicy** | JSON API | `https://jobicy.com/api/v2/remote-jobs` | ≤1 req/hour recommended | Hourly at :15 | ✅ Good — geo/industry filters |
| **Indeed** | RSS Feed | Dynamic RSS | Informal | Not scheduled | ⚠️ Very limited data |

### 3.2 Indian Job Boards (Python Scrapling Microservice)

| Source | Type | Scrape Interval | CB Timeout | Notes |
|--------|------|-----------------|------------|-------|
| **Naukri.com** | Browser scraper | Every 4h | 120s (2min) | Most important Indian board, aggressive rate limiting |
| **LinkedIn India** | Guest API scraper | Every 3h | 60s | 2-3 pages/keyword, no auth |
| **Internshala** | Browser scraper | Every 6h | 60s | Internships + fresher jobs |
| **Foundit** | Browser scraper | Every 6h | 60s | Mid-level, ex-Monster India |
| **Shine.com** | Browser scraper | Every 8h | 60s | Verified companies |

---

## 4. Scraping Pipeline — Detailed Flow

### Step 1: Cron Trigger
BullMQ repeatable jobs fire on schedule. Each source gets its own cron pattern registered in `schedulePeriodicScraping()` and `scheduleIndianScraping()`.

### Step 2: Worker Picks Up Job
The `job-scraping.worker.js` processes with:
- **Concurrency**: 2 workers processing in parallel
- **Rate limit**: Max 10 jobs per minute
- **Retry policy**: 3 attempts with exponential backoff (5s → 10s → 20s)

### Step 3: Scrape External Source
```
Worker → jobBoardsService.scrapeJobsFromSource(source, options)
       → Cache check (skip if `skipCache: true`)
       → Circuit breaker wraps the actual HTTP call
       → Source-specific scraper normalises to common schema
       → Result cached in Redis with source-specific TTL
```

**Cache TTLs**:
| Source | TTL |
|--------|-----|
| Remotive | 24 hours |
| RemoteOK | 6 hours |
| WeWorkRemotely | 2 hours |
| Himalayas | 4 hours |
| Jobicy | 1 hour |

### Step 4: Normalisation
Each scraper normalises raw data into the standard job schema:
```javascript
{
  externalId, source, title, company, companyLogo, location,
  remoteType, employmentType, experienceLevel,
  salaryMin, salaryMax, currency, salaryPeriod,
  description, requirements, responsibilities, benefits,
  skillsRequired, educationLevel,
  yearsExperienceMin, yearsExperienceMax,
  url, applyUrl, postedDate, expiresAt,
  isActive, rawData, meta
}
```

### Step 5: Upsert to Database
```
upsertJobs(jobs):
  1. Query existing (externalId, source) pairs
  2. Filter in-memory by source (avoids SQL injection from composite tuple)
  3. Calculate jobsNew vs jobsUpdated counts
  4. Single batch INSERT ... ON CONFLICT DO UPDATE
  5. Wrapped in DB transaction for atomicity
```

### Step 6: Logging
Every scrape run creates a `job_scraping_logs` entry with:
- Source, status (running → completed/failed)
- jobsFound, jobsNew, jobsUpdated counts
- Duration, error details if failed
- Worker ID, request params

### Step 7: Cleanup (Daily at 3 AM)
```
cleanupStaleJobs():
  1. Mark jobs as inactive if lastScrapedAt > 30 days ago
  2. Hard-delete inactive jobs older than 90 days
```

---

## 5. Filtration & Search System

### 5.1 Available Filters (GET /api/v1/jobs)

| Filter | Type | DB Operation | Notes |
|--------|------|-------------|-------|
| `q` (search) | String | `ILIKE %q%` on title, company, description | No full-text index — uses `OR` of 3 `ILIKE` |
| `location` | String | `ILIKE %location%` | Fuzzy match |
| `remoteType` | CSV | `IN (values)` | remote, hybrid, onsite |
| `employmentType` | CSV | `IN (values)` | full-time, part-time, contract, internship |
| `experienceLevel` | CSV | `IN (values)` | entry, mid, senior, lead |
| `source` | CSV | `IN (values)` | remoteok, remotive, etc. |
| `salaryMin` | Number | `salary_max >= salaryMin OR salary_max IS NULL` | Includes jobs with no salary data |
| `salaryMax` | Number | `salary_min <= salaryMax OR salary_min IS NULL` | Includes jobs with no salary data |
| `skills` | CSV | JSONB `@>` operator per skill | Checks both `required` and `technical` arrays |
| `postedAfter` | ISO Date | `posted_date >= date` | — |
| `sortBy` | String | Dynamic column | Default: `postedDate` |
| `sortOrder` | String | asc/desc | Default: `desc` |

### 5.2 Preferences Fallback
When **no filters** are provided and user is authenticated:
1. Load `user_job_preferences` from DB
2. Apply saved preferences as filters:
   - `preferredLocations[0]` → location filter
   - `remotePreference` → remoteType filter
   - `employmentTypes` → employmentType filter
   - `experienceLevels` → experienceLevel filter
   - `minSalary/maxSalary` → salary filter
   - `mustHaveSkills` → skills filter
3. Response includes `appliedPreferences: true` flag

### 5.3 Pagination
Standard offset-based pagination with metadata:
```json
{
  "currentPage": 1,
  "pageSize": 20,
  "totalCount": 1500,
  "totalPages": 75,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

---

## 6. Job Matching Engine

### 6.1 Trigger Flow
```
User clicks "Generate Matches"
  → POST /api/v1/job-matches/generate
  → Controller finds latest completed analysis (if no analysisId provided)
  → Enqueues BullMQ job (MATCH_FOR_USER)
  → Worker calls matchJobsForUser()
  → Returns 202 Accepted immediately
```

### 6.2 Matching Algorithm

**Input**: Resume analysis (processed data) + All active jobs (up to 1000)

**Scoring** (0–100 scale):

| Component | Weight | How It Works |
|-----------|--------|-------------|
| **Skills** | 40% | Fuzzy match (substring + Levenshtein ≤2) of resume skills against job `required` + `technical` skills. Up to 80pts for required matches, 20pts for preferred. Default 75 if no job skills. |
| **Experience** | 30% | 60% from years comparison (penalises under/over-qualified), 40% from title relevance (Levenshtein ≤5). |
| **Education** | 20% | Hierarchical level comparison (PhD=5, Master=4, Bachelor=3, Associate=2, Diploma=1). ±1 level = 70pts. |
| **Location** | 10% | Remote = 100, Hybrid = 90, same city = 100, different = 30, unknown = 50. |

**Preference Boost** (up to +10 points):
- Matching preferred title: +5
- Matching preferred location: +3
- Matching remote preference: +2

**Thresholds**:
- Default minimum score: 50
- Default max results: 50
- `replaceExisting`: false by default for generate, true for regenerate

### 6.3 Match Storage
Results stored in `job_matches` with:
- All 4 sub-scores + overall score
- `matchReasons` (matched skills, strengths, fit reason)
- `mismatchReasons` (missing skills, improvement areas)
- User actions: status, isSaved, isApplied, viewedAt, appliedAt

### 6.4 Auto-Matching After Analysis
When resume analysis completes, `triggerMatchingAfterAnalysis()` is called from the analysis worker, auto-enqueuing a matching job.

---

## 7. User Preferences System

### Stored Preferences
| Field | Type | Used In |
|-------|------|---------|
| `preferredTitles` | string[] | Matching score boost (+5) |
| `preferredLocations` | string[] | Browse filter fallback + match boost (+3) |
| `remotePreference` | enum | Browse filter fallback + match boost (+2) |
| `employmentTypes` | string[] | Browse filter fallback |
| `experienceLevels` | string[] | Browse filter fallback |
| `minSalary` / `maxSalary` | integer | Browse filter fallback + matching pre-filter |
| `mustHaveSkills` | string[] | Browse filter fallback |
| `excludedCompanies` | string[] | **⚠️ Stored but NEVER used in filtering or matching** |
| `notificationEnabled` | boolean | **⚠️ Stored but notification system not implemented** |
| `notificationFrequency` | enum | **⚠️ Stored but notification system not implemented** |
| `minMatchScoreForNotification` | integer | **⚠️ Stored but notification system not implemented** |

---

## 8. Infrastructure & Resilience

### 8.1 Circuit Breakers (per source)
- **Library**: `opossum`
- **Error threshold**: 50% failure rate
- **Reset timeout**: 5 minutes (10 minutes for Naukri)
- **Rolling window**: 1 minute (2 minutes for Naukri)
- **Fallback**: Returns `{ jobs: [], stats: { error: '...' } }` when open
- **Manual reset**: `POST /api/v1/health/scraping/reset-circuit-breaker/:source`

### 8.2 Redis Cache
- **DB 0**: Job scraping cache (per-source TTLs)
- **DB 1**: BullMQ queues
- **Supports**: Cluster mode, TLS, URL-based connection

### 8.3 Queue Configuration
| Queue | Concurrency | Rate Limit | Retry | Backoff |
|-------|-------------|-----------|-------|---------|
| job-scraping | 2 | 10/min | 3 attempts | Exponential 5s |
| job-matching | 5 | 20/min | 3 attempts | Exponential 5s |

### 8.4 Feature Flag
`JOB_MATCHING_ENABLED` (env: `JOB_MATCHING_ENABLED=true`)
- Controls: matching queue, matching worker startup, matching API routes
- When disabled: matching routes return 404, workers exit immediately

---

## 9. Database Schema Summary

### `jobs` Table
- 30+ columns with all job metadata
- **Unique constraint**: `(external_id, source)` — prevents duplicates
- **Indexes**: title, company, location, remote_type, employment_type, experience_level, source, is_active+posted_date, skills (GIN), posted_date, expires_at

### `job_matches` Table
- Stores pre-computed matches per user+job+analysis
- **Unique constraint**: `(user_type, jobID, analysisID)` — one match per combo
- **Indexes**: userID, candidateID, jobID, analysisID, matchScore, status, saved, applied

### `job_scraping_logs` Table
- Audit trail for every scrape run
- **Indexes**: source, status, created_at, started_at, source+status

### `user_job_preferences` Table
- One row per user (unique userID / candidateID)
- **Indexes**: userID, candidateID, notification_enabled+last_notification_at

---

## 10. API Endpoints

### Job Browsing
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/jobs` | ✅ | Browse/search jobs with filters |
| GET | `/api/v1/jobs/:id` | ✅ | Get single job details |

### Job Matching (Feature-flagged)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/job-matches` | ✅ | Get user's matched jobs |
| GET | `/api/v1/job-matches/:id` | ✅ | Get single match details |
| POST | `/api/v1/job-matches/generate` | ✅ | Trigger matching |
| POST | `/api/v1/job-matches/regenerate` | ✅ | Re-match (replace existing) |
| PUT | `/api/v1/job-matches/:id` | ✅ | Update status/saved/applied |
| DELETE | `/api/v1/job-matches/:id` | ✅ | Delete match |

### Job-Aware Rewrite
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/job-matches/:jobMatchId/rewrite` | ✅ | Trigger job-tailored resume rewrite |

### Preferences (Feature-flagged)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/job-preferences` | ✅ | Get preferences |
| PUT | `/api/v1/job-preferences` | ✅ | Update preferences |

### Health & Monitoring
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health/scraping` | ❌ | System health check |
| GET | `/api/v1/health/scraping/stats` | ❌ | Per-source stats |
| GET | `/api/v1/health/scraping/logs` | ❌ | Recent scraping logs |
| POST | `/api/v1/health/scraping/reset-circuit-breaker/:source` | ❌ | Reset circuit breaker |

---

## 11. Background Workers

### `job-scraping.worker.js`
- **Process**: Standalone Node.js process (`npm run worker:job-scraping`)
- **Handles**: SCRAPE_SOURCE, SCRAPE_ALL, SCRAPE_INDIAN_SOURCE, CLEANUP_STALE
- **Concurrency**: 2 (env: `JOB_SCRAPING_WORKER_CONCURRENCY`)
- **Rate**: 10 jobs/minute
- **Graceful shutdown**: SIGTERM/SIGINT handlers

### `job-matching.worker.js`
- **Process**: Standalone Node.js process (`npm run worker:job-matching`)
- **Handles**: MATCH_FOR_USER, REMATCH_FOR_USER, BATCH_MATCH
- **Concurrency**: 5
- **Rate**: 20 jobs/minute
- **Feature gated**: Exits immediately if `JOB_MATCHING_ENABLED !== 'true'`

---

## 12. 🐛 Production Bugs & Risks — Detailed List

### 🔴 CRITICAL (Will break in production)

#### BUG-001: `addMatchJobsForUserJob` passes queue object instead of queue name
**File**: `queues/job-matching.queue.js` (lines 69-79)  
**Issue**: `getJobMatchingQueue()` returns the queue instance from `queueService.getQueue()`. Then `addMatchJobsForUserJob` passes this instance as the first arg to `queueService.addJob(queue, jobData, ...)`. However, `queueService.addJob()` in the job-scraping queue (and presumably throughout the codebase) expects a **queue name string** as the first arg, not a queue object.  
**Impact**: Every call to generate/regenerate job matches will throw an error or add jobs to the wrong queue.  
**Fix**: Either pass the string `'job-matching'` or ensure `queueService.addJob` handles both formats.

#### BUG-002: `skillsRequired` schema mismatch between scrapers and DB queries
**File**: `services/jobBoards/remoteok.service.js` (line ~226), `models/job.model.js` (lines ~137-142)  
**Issue**: RemoteOK normaliser sets `skillsRequired` as a **flat array of strings** (`job.tags || []`), but the skills filter query and matching service expect a **JSONB object** with `{ required: [], technical: [], preferred: [] }` structure. The JSONB `@>` operator in the filter query will **never match** RemoteOK jobs because the shape is wrong.  
**Impact**: Skills-based filtering returns 0 results for RemoteOK-sourced jobs. Skills matching in the scoring engine will also give default 75 score to all RemoteOK jobs.  
**Fix**: Normalise RemoteOK skills to `{ required: job.tags, technical: [], preferred: [] }` format.

#### BUG-003: Indian scraping scheduled but Python microservice may not exist
**File**: `services/jobBoards/indianBoards.service.js`, `queues/job-scraping.queue.js`  
**Issue**: `scheduleIndianScraping()` is called at startup and creates 5 recurring cron jobs for Indian boards. These call a Python FastAPI service at `SCRAPER_SERVICE_URL` (default: `http://localhost:8001`). If this service is not deployed, every Indian scrape will fail, trigger retries (3×), trip circuit breakers, and fill `job_scraping_logs` with error entries every few hours forever.  
**Impact**: Wasted Redis/DB resources, noisy error logs, potentially thousands of failed-job records per day.  
**Fix**: Add a startup health check (`isScrapeServiceHealthy()` exists but is never called). Skip Indian scheduling if the service is unreachable.

#### BUG-004: `job_matches` unique index is incomplete for candidates
**File**: `drizzle/schema/jobs.schema.js` (line ~164)  
**Issue**: The unique index is `(user_type, jobID, analysisID)`. For candidates, `analysisID` is NULL and `candidateAnalysisID` is used instead. This means ALL candidate matches for the same job will conflict on `(candidate, jobID, NULL)`, causing only **one candidate match per job** regardless of which analysis was used.  
**Impact**: Candidate users cannot have matches from different analysis runs for the same job. `bulkCreateJobMatches` with `onConflictDoNothing()` silently drops these rows.  
**Fix**: The unique index should include `candidateAnalysisID` or be restructured: `(user_type, jobID, COALESCE(analysisID, 0), COALESCE(candidate_analysisID, 0))`.

#### BUG-005: `updateJobMatchController` sets wrong column names
**File**: `controllers/job.controller.js` (lines ~395-400)  
**Issue**: Controller builds `updates.saved = saved` and `updates.applied = applied`, but the actual DB column names are `isSaved` and `isApplied`. Drizzle ORM will either ignore these unknown fields or throw.  
**Impact**: Users cannot save or mark jobs as applied via the API.  
**Fix**: Change to `updates.isSaved = saved` and `updates.isApplied = applied`.

---

### 🟠 HIGH (Likely to cause issues in production)

#### BUG-006: `SCRAPE_ALL` double-processes remote sources
**File**: `queues/workers/job-scraping.worker.js` (lines ~137-188)  
**Issue**: `scrapeAllSources()` calls `jobBoardsService.scrapeAllSources()` which scrapes all 5 remote sources in parallel. Then it ALSO enqueues 5 separate `SCRAPE_SOURCE` jobs for Indian boards. But the **remote sources are already on their own recurring cron schedules**. If `SCRAPE_ALL` is ever triggered (e.g., manually), it scrapes remote sources twice — once immediately and once via cron — causing duplicate API calls and potential rate-limit violations.  
**Impact**: Unnecessary load on external APIs, potential IP bans.

#### BUG-007: No salary currency normalisation
**File**: All scrapers  
**Issue**: RemoteOK defaults to USD, Jobicy can return various currencies, Himalayas has its own format, Indian boards return INR. All salaries are stored as integers in the same columns (`salary_min`, `salary_max`) with a `currency` field, but the **salary filter in `getJobs()` does raw integer comparison across currencies**. A filter of `minSalary=50000` will match both $50K USD and ₹50K INR jobs.  
**Impact**: Salary-based filtering is meaningless across multi-currency data.  
**Fix**: Either normalise all salaries to a common currency on ingest, or filter by currency alongside salary range.

#### BUG-008: Job matching loads up to 1000 jobs into memory
**File**: `services/job-matching.service.js` (line ~72-78)  
**Issue**: `matchJobsForUser()` fetches `{ limit: 1000 }` jobs from the DB and iterates through all of them in-memory to calculate match scores. With 11 sources scraping hundreds of jobs each, the jobs table could have 10K+ rows. Only the first 1000 (by `postedDate DESC`) are matched.  
**Impact**: Older but highly relevant jobs are missed. As the database grows, matching becomes increasingly incomplete. Memory pressure under concurrent matching requests.  
**Fix**: Implement database-level pre-filtering using user skills/preferences before loading into memory, or use cursor-based pagination.

#### BUG-009: `getJobMatchByID` builds query incorrectly
**File**: `models/job.model.js` (lines ~250-270)  
**Issue**: The function chains two separate `.where()` calls. In Drizzle ORM, chaining `.where()` **replaces** the previous condition rather than AND-ing them. So the ownership check overwrites the `id = matchId` condition, meaning any user can access any match if they guess the ID structure.  
**Impact**: Authorization bypass — users can view other users' job matches.  
**Fix**: Combine all conditions into a single `.where(and(...allConditions))`.

#### BUG-010: Levenshtein distance has O(n×m) complexity on every job × every skill
**File**: `services/job-matching.service.js`  
**Issue**: `calculateSkillMatch()` calls `levenshteinDistance()` for every pair of (resume skill × job skill). With 20 resume skills and 10 job skills, that's 200 Levenshtein computations per job. Across 1000 jobs, that's 200,000 string-distance computations per match request.  
**Impact**: Slow matching (seconds per user). Under batch matching for 100+ users, this becomes a serious bottleneck.  
**Fix**: Pre-compute skill embeddings or use simpler heuristics (lowercase exact match + common abbreviation mapping).

#### BUG-011: `postedAfter` filter doesn't validate date
**File**: `controllers/job.controller.js` (line ~106)  
**Issue**: `new Date(postedAfter)` can produce `Invalid Date` if the query param is malformed. This invalid date is passed to the DB query, which may either throw or return no results silently.  
**Impact**: API returns 500 or misleading empty results.  
**Fix**: Validate the date and return 400 if invalid.

---

### 🟡 MEDIUM (Will cause degraded experience)

#### BUG-012: `excludedCompanies` preference is never applied
**File**: `services/job-matching.service.js`, `controllers/job.controller.js`  
**Issue**: Users can save `excludedCompanies` in preferences, but this list is **never checked** during job browsing or matching. Jobs from excluded companies will still appear.  
**Impact**: Users who explicitly block certain companies still see their jobs.

#### BUG-013: Only first preferred location used in browse fallback
**File**: `controllers/job.controller.js` (line ~124)  
**Issue**: `options.location = preferences.preferredLocations[0]` — only the first location from the user's list is used. If a user prefers "Bangalore" and "Remote", only "Bangalore" is searched.  
**Impact**: Users with multiple preferred locations see incomplete results.  
**Fix**: Support multi-location filter (comma-separate or OR condition).

#### BUG-014: No validation on `sortBy` column name
**File**: `models/job.model.js` (line ~160)  
**Issue**: `const orderByField = jobsTable[sortBy] || jobsTable.postedDate;` — the `sortBy` value comes directly from user input. If a malicious user passes a non-existent column name, it falls through to `postedDate`. But if they pass a valid but unintended column (e.g., `rawData`), it could cause performance issues sorting on JSONB columns.  
**Impact**: Potential performance degradation or unexpected sorting behaviour.  
**Fix**: Whitelist allowed sort columns.

#### BUG-015: Skills JSONB filter is case-sensitive in matching direction
**File**: `models/job.model.js` (lines ~137-142)  
**Issue**: The skills filter lowercases the search input (`s.trim().toLowerCase()`) and uses `@>` to check against `skillsRequired.required` and `skillsRequired.technical`. But the stored skills may be mixed-case (e.g., "React", "JavaScript"). The JSONB `@>` operator is **case-sensitive**, so searching for "react" won't match `"React"`.  
**Impact**: Skills filter frequently returns no results even when matching jobs exist.  
**Fix**: Store skills normalised to lowercase, or use `jsonb_array_elements_text()` with `ILIKE`.

#### BUG-016: Circuit breaker creates new instance per call for Indian boards
**File**: `services/jobBoards/circuit-breaker.service.js`  
**Issue**: `getOrCreateBreaker(source, action)` caches breakers by source key, but the `action` function parameter is only used on first creation. For Indian boards, `scrapeIndianSource()` creates a new closure `(opts) => _doScrape(source, opts)` each time. If the first call creates the breaker with one closure and the cache returns it, it still uses the original closure — this works but is fragile.  
**Impact**: No immediate bug, but if sources are called with different action functions, the cached breaker uses the first one forever.

#### BUG-017: No pagination on `SCRAPE_ALL` remote source results
**File**: `services/jobBoards/index.js` (lines ~174-184)  
**Issue**: `scrapeAllSources()` hardcodes `limit: 100` for most sources but Himalayas max is 20. If any API returns more than the limit, only the first page is scraped. There's no pagination/cursor logic for any source.  
**Impact**: Missing jobs from sources with large datasets.

#### BUG-018: `appliedPreferences` flag always true when user logged in with no filters
**File**: `controllers/job.controller.js` (line ~138)  
**Issue**: `appliedPreferences: !hasFilters && userID ? true : false` — this is `true` even if the user has NO saved preferences (null). The flag tells the frontend preferences were applied when they weren't.  
**Impact**: Frontend may display incorrect "filtered by your preferences" UI.  
**Fix**: Set to `true` only when `preferences !== null`.

#### BUG-019: RSS parsers (Remotive, WWR, Indeed) may break on feed format changes
**File**: `services/jobBoards/remotive.service.js`, `weworkremotely.service.js`, `indeed.service.js`  
**Issue**: RSS feeds have no versioning guarantees. Feed structure changes (new namespaces, removed fields, URL changes) will silently produce empty results or errors.  
**Impact**: Jobs stop appearing from affected sources without any alert.  
**Fix**: Add feed format validation and alerting on zero-job scrapes.

#### BUG-020: Health/scraping endpoints have no authentication
**File**: `routes/v1/health-scraping.route.js`  
**Issue**: All health scraping endpoints (`/health/scraping`, stats, logs, and circuit breaker reset) have **no auth middleware**. Anyone can view scraping stats, logs (which contain internal IPs, error stacks), and **reset circuit breakers** (which could cause a flood of requests to external APIs).  
**Impact**: Information disclosure + ability to trigger aggressive scraping via circuit breaker reset.  
**Fix**: Add admin authentication to health endpoints, or at minimum to the reset endpoint.

---

### 🔵 LOW (Edge cases / quality issues)

#### BUG-021: Experience calculation uses `new Date()` for missing start dates
**File**: `services/job-matching.service.js` (line ~290)  
**Issue**: `const start = exp.startDate ? new Date(exp.startDate) : new Date()` — if startDate is missing, it uses today. Then `end - start` = 0 years. This is correct. But if **endDate** is missing, `new Date()` is used, which means ongoing jobs count as of today — this is actually correct. However, invalid date strings like "Present" will produce NaN.  
**Impact**: Experience calculation may produce NaN for some resumes.

#### BUG-022: `SCRAPE_INDIAN_SOURCE` job type shares handler with `SCRAPE_SOURCE`
**File**: `queues/workers/job-scraping.worker.js` (line ~44-45)  
**Issue**: Both `SCRAPE_SOURCE` and `SCRAPE_INDIAN_SOURCE` route to `scrapeSingleSource()`. This works because `scrapeJobsFromSource()` in the index routes to the correct scraper based on source name. But the Indian boards are **enqueued as `SCRAPE_SOURCE`** (not `SCRAPE_INDIAN_SOURCE`) in `scrapeAllSources()`, making the `SCRAPE_INDIAN_SOURCE` type unused dead code.  
**Impact**: No runtime issue, but confusing code. The type enum suggests separate handling that doesn't exist.

#### BUG-023: `testRemoteOKScraper` uses `console.log` instead of logger
**File**: `services/jobBoards/remoteok.service.js` (bottom)  
**Issue**: Test function uses `console.log` — violates project coding standards.  
**Impact**: Log output bypasses structured logging in production.

#### BUG-024: `deriveYearsFromLevel` doesn't handle all levels
**File**: `services/jobBoards/remoteok.service.js`  
**Issue**: Only handles `entry`, `mid`, `senior`, `lead`. The DB schema allows `executive` and other values.  
**Impact**: Unknown levels default to `mid` range (2-5 years), which may be inaccurate.

#### BUG-025: No rate limiting on job matching API endpoints
**File**: `routes/v1/job.route.js`  
**Issue**: `POST /job-matches/generate` and `POST /job-matches/regenerate` have no per-user rate limiting. A user could spam-trigger hundreds of matching jobs that each load 1000 DB rows and run 200K+ Levenshtein computations.  
**Impact**: Queue flooding, DB and CPU exhaustion.  
**Fix**: Add per-user rate limiting (e.g., max 3 matching requests per hour).

#### BUG-026: Batch upsert may fail for very large scrape results
**File**: `queues/workers/job-scraping.worker.js` (upsertJobs function)  
**Issue**: All scraped jobs are inserted in a single `INSERT ... VALUES (...)` statement within one transaction. PostgreSQL has parameter limits (~65535 params). With 30+ columns per job and 2000+ jobs, this exceeds the limit.  
**Impact**: Large scrapes will throw `too many parameters` DB error.  
**Fix**: Chunk the batch insert into groups of ~100 jobs.

#### BUG-027: `remotePreference` value mapping inconsistency
**File**: `controllers/job.controller.js` (line ~126)  
**Issue**: Preference `remote_only` is mapped to `remote`, but `hybrid` is passed as-is. The DB stores `hybrid` as-is in both tables. If user preference is `onsite`, it's not mapped at all and passed through, which works. But the mapping is inconsistent and undocumented.  
**Impact**: Minor — works but fragile if enum values change.

#### BUG-028: No index on `lastScrapedAt` for cleanup query
**File**: `drizzle/schema/jobs.schema.js`  
**Issue**: The cleanup job queries `WHERE is_active = true AND last_scraped_at < cutoff_date`. There's an index on `(is_active, posted_date)` but not on `(is_active, last_scraped_at)`.  
**Impact**: Cleanup query does full table scan on large `jobs` table.

#### BUG-029: WeWorkRemotely scraper may produce `null` externalId
**File**: `services/jobBoards/weworkremotely.service.js`  
**Issue**: RSS items may not have a stable unique ID. If the GUID field is missing, the externalId could be null, violating the NOT NULL constraint on the `jobs` table.  
**Impact**: Upsert fails for that batch, losing all WWR jobs for that scrape cycle.

#### BUG-030: `getJobMatchByID` model does not join with `jobsTable`
**File**: `models/job.model.js`  
**Issue**: `getJobMatchByID` returns the raw match row without the job details. The controller returns this directly. Unlike `getJobMatchesForUser` (which JOINs with `jobsTable`), the single-match endpoint returns no job information.  
**Impact**: Frontend must make a separate API call to get job details for a single match.

---

## Summary of Risk Distribution

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 5 | Queue routing, schema mismatch, missing infra, DB constraints, wrong column names |
| 🟠 High | 6 | Double-processing, currency issues, memory limits, auth bypass, perf, validation |
| 🟡 Medium | 9 | Missing features, case sensitivity, dead code, feed fragility, flag errors |
| 🔵 Low | 10 | Edge cases, code quality, missing indexes, parameter limits |
| **Total** | **30** | |

---

## Recommended Priority Actions

1. **Fix BUG-001** (queue name vs object) — matching is broken
2. **Fix BUG-005** (isSaved/isApplied column names) — save/apply is broken
3. **Fix BUG-002** (skillsRequired schema) — skills filtering and matching are unreliable
4. **Fix BUG-004** (unique index for candidates) — candidate matches silently lost
5. **Fix BUG-009** (getJobMatchByID auth bypass) — security vulnerability
6. **Fix BUG-020** (health endpoint auth) — information disclosure + abuse vector
7. **Add BUG-003** startup check — stop wasting resources on missing Python service
8. **Add BUG-025** rate limiting — prevent queue flooding
9. **Address BUG-007** currency normalisation — salary filter is unreliable
10. **Address BUG-008** matching memory — 1000-row limit will miss jobs as data grows
