# Job Sourcing System - How It Works

> **Last Updated**: 19 March 2026
> **Status**: Production-ready

## Overview

The Success CV platform automatically sources job listings from **11 external job boards and APIs** across two tiers:

1. **6 International Remote Boards** — scraped directly by Node.js services (JSON APIs + RSS feeds)
2. **5 Indian Job Portals** — scraped by a Python FastAPI microservice using Scrapling (headless browser)

Jobs are scraped on per-source schedules, cached in Redis, protected by circuit breakers, deduplicated, stored in PostgreSQL, and then used for matching against user resumes.

---

## 📊 Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL JOB SOURCES                               │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────┐ ┌──────────┐ ┌───────┐ ┌──────┐         │
│  │ RemoteOK │ │ Remotive │ │ WWR │ │Himalayas │ │Jobicy │ │Indeed│         │
│  │  (JSON)  │ │  (RSS)   │ │(RSS)│ │  (JSON)  │ │(JSON) │ │(RSS) │         │
│  └────┬─────┘ └────┬─────┘ └──┬──┘ └────┬─────┘ └───┬───┘ └──┬───┘         │
│       │             │          │          │           │        │             │
│  ┌────┴─────────────┴──────────┴──────────┴───────────┴────────┴───┐         │
│  │              Node.js Scraper Services (Direct HTTP)             │         │
│  │              services/jobBoards/*.service.js                    │         │
│  └───────────────────────────┬─────────────────────────────────────┘         │
│                              │                                               │
│  ┌──────────┐ ┌──────────┐ ┌┴─────────┐ ┌─────────┐ ┌────────┐             │
│  │  Naukri  │ │Internshala│ │ LinkedIn │ │ Foundit │ │ Shine  │             │
│  │  (.com)  │ │          │ │  India   │ │  (.in)  │ │ (.com) │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └───┬────┘             │
│       │             │            │             │          │                  │
│  ┌────┴─────────────┴────────────┴─────────────┴──────────┴───┐             │
│  │       Python Scrapling Microservice (FastAPI + headless)    │             │
│  │       POST /api/v1/scrape  →  StealthyFetcher / Fetcher    │             │
│  └────────────────────────────┬────────────────────────────────┘             │
│                               │                                              │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                    BullMQ JOB SCRAPING QUEUE (Redis)                          │
│                                                                               │
│  Job Types: SCRAPE_SOURCE | SCRAPE_ALL | SCRAPE_INDIAN_SOURCE | CLEANUP_STALE│
│  Worker: concurrency=2, rate=10 jobs/min                                      │
│  Retry: 3 attempts, exponential backoff (5s → 10s → 20s)                     │
│                                                                               │
│  ┌─────────────── Per-Source Cron Schedules ──────────────────┐               │
│  │ Remotive:         Daily at midnight                        │               │
│  │ RemoteOK:         Every 6 hours                            │               │
│  │ WeWorkRemotely:   Every 2 hours                            │               │
│  │ Himalayas:        Every 4 hours                            │               │
│  │ Jobicy:           Hourly at :15                            │               │
│  │ Naukri:           Every 4 hours                            │               │
│  │ LinkedIn-India:   Every 3 hours                            │               │
│  │ Internshala:      Every 6 hours                            │               │
│  │ Foundit:          Every 6 hours                            │               │
│  │ Shine:            Every 8 hours                            │               │
│  │ Cleanup:          Daily at 3 AM                            │               │
│  └────────────────────────────────────────────────────────────┘               │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│              RESILIENCE LAYER (per source)                                    │
│                                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ Circuit Breaker  │  │   Redis Cache    │  │  Job Scraping Logs (DB)     │ │
│  │ (opossum lib)    │  │ per-source TTL   │  │  source, status, counts,    │ │
│  │                  │  │                  │  │  duration, errors           │ │
│  │ States:          │  │ remotive: 24h    │  └──────────────────────────────┘ │
│  │ CLOSED → normal  │  │ remoteok: 6h     │                                  │
│  │ OPEN → fast fail │  │ wwr:      2h     │                                  │
│  │ HALF_OPEN → test │  │ himalayas:4h     │                                  │
│  │                  │  │ jobicy:   1h     │                                  │
│  │ 50% error → trip │  │ indian:   1h     │                                  │
│  │ 5min reset       │  │ (each)           │                                  │
│  │ (10min for Naukri)│  │                  │                                  │
│  └─────────────────┘  └──────────────────┘                                  │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                       UPSERT → PostgreSQL                                    │
│                                                                               │
│  Batch INSERT … ON CONFLICT (external_id, source) DO UPDATE                  │
│  Single transaction, in-memory dedup by source                               │
│  Tables: jobs, job_scraping_logs                                             │
│  Cleanup: isActive=false after 30 days, hard-delete after 90 days            │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      FILTRATION & MATCHING                                    │
│                                                                               │
│  GET /api/v1/jobs                  POST /api/v1/job-matches/generate         │
│  Full-text, location, remote,      Skills 40%, Experience 30%,               │
│  salary, skills (JSONB), posted    Education 20%, Location 10%,              │
│  date, user preferences fallback   Preference boost up to +10               │
│                                                                               │
│  Tables: job_matches, user_job_preferences                                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How Job Scraping Works

### 1. **Per-Source Scheduled Scraping**

Each source has its own **BullMQ cron schedule** optimised for data freshness vs. rate limits:

| Source | Type | Interval | Reasoning |
|--------|------|----------|-----------|
| **Remotive** | RSS | Daily at midnight | Data has 24h delay |
| **RemoteOK** | JSON API | Every 6 hours | Good freshness |
| **WeWorkRemotely** | RSS | Every 2 hours | Frequent updates |
| **Himalayas** | JSON API | Every 4 hours | Rate limited, max 20/req |
| **Jobicy** | JSON API | Hourly at :15 | Recommends ≤1 req/hour |
| **Naukri** | Browser scraper | Every 4 hours | Most important Indian board |
| **LinkedIn India** | Guest API | Every 3 hours | Global companies, India |
| **Internshala** | Browser scraper | Every 6 hours | Freshers + internships |
| **Foundit** | Browser scraper | Every 6 hours | Mid-level roles |
| **Shine** | Browser scraper | Every 8 hours | Verified companies |
| **Cleanup** | DB maintenance | Daily at 3 AM | Deactivate stale jobs |

Schedules are registered at startup via `schedulePeriodicScraping()` and `scheduleIndianScraping()` in `queues/job-scraping.queue.js`.

### 2. **Supported Job Sources**

#### International Remote Boards (Node.js — Direct HTTP)

| Source | API / Endpoint | Data Quality | Notes |
|--------|---------------|-------------|-------|
| **RemoteOK** | `https://remoteok.com/api` (JSON) | ✅ Good — salary, tags, logos | No auth required |
| **Remotive** | `https://remotive.com/remote-jobs/feed` (RSS) | ⚠️ 24h delay, basic data | Attribution required |
| **WeWorkRemotely** | Multiple category RSS feeds | ⚠️ Basic data, no salary | Attribution required |
| **Himalayas** | `https://himalayas.app/jobs/api` (JSON) | ✅ Good — seniority field | Max 20 per request |
| **Jobicy** | `https://jobicy.com/api/v2/remote-jobs` (JSON) | ✅ Good — geo/industry filters | 6h data delay |
| **Indeed** | Dynamic RSS feeds | ⚠️ Very limited data | Not scheduled by default |

#### Indian Job Boards (Python Scrapling Microservice)

| Source | URL | Method | Circuit Breaker Timeout |
|--------|-----|--------|------------------------|
| **Naukri.com** | naukri.com | StealthyFetcher (headless) | 120s (2 min) |
| **LinkedIn India** | linkedin.com (guest search) | Fetcher (HTTP) | 60s |
| **Internshala** | internshala.com | StealthyFetcher (headless) | 60s |
| **Foundit** | foundit.in (ex-Monster India) | StealthyFetcher (headless) | 60s |
| **Shine** | shine.com | StealthyFetcher (headless) | 60s |

The Indian boards are scraped by a separate Python FastAPI service (`scraper-service/`) that uses the [Scrapling](https://github.com/D4Vinci/Scrapling) library. The Node.js backend calls it via `POST /api/v1/scrape` through `indianBoards.service.js`.

---

## 🛠️ Scraping Pipeline — Step by Step

### Step 1: Cron Trigger
BullMQ repeatable jobs fire on per-source schedules. Each source gets its own cron pattern.

### Step 2: Worker Picks Up Job
`job-scraping.worker.js` processes with:
- **Concurrency**: 2 workers in parallel
- **Rate limit**: Max 10 jobs per minute
- **Retry**: 3 attempts, exponential backoff (5s → 10s → 20s)

### Step 3: Cache Check
```
Cache hit? → Return cached result (skip scraping)
Cache miss? → Continue to scrape
```
Per-source TTLs aligned with scrape intervals (e.g., RemoteOK cached for 6h, scraped every 6h).

### Step 4: Circuit Breaker
```
Breaker CLOSED? → Execute scrape
Breaker OPEN?   → Return { jobs: [], stats: { error: '...' } } immediately
Breaker HALF_OPEN? → Try one request to test recovery
```
Each source has its own circuit breaker (library: `opossum`). Opens after 50% error rate in rolling window.

### Step 5: Scrape External Source
```
International → Node.js HTTP client → External API/RSS
Indian        → Node.js HTTP client → Python FastAPI → Headless browser → Job board
```

### Step 6: Normalisation
Each scraper normalises raw data into the standard job schema:
```javascript
{
  externalId, source, title, company, companyLogo, location,
  remoteType, employmentType, experienceLevel,
  salaryMin, salaryMax, currency, salaryPeriod,
  description, requirements, responsibilities, benefits,
  skillsRequired: { required: [], technical: [], preferred: [] },
  educationLevel, yearsExperienceMin, yearsExperienceMax,
  url, applyUrl, postedDate, expiresAt,
  isActive, rawData, meta
}
```

Indian board jobs are returned in snake_case by Python and normalised to camelCase by `indianBoards.service.js`.

### Step 7: Cache Result
Fresh results are cached in Redis with source-specific TTL.

### Step 8: Upsert to Database
```
upsertJobs(jobs):
  1. Query existing (externalId, source) pairs using parameterised inArray()
  2. Filter in-memory by source (avoids SQL injection from composite tuple)
  3. Calculate jobsNew vs jobsUpdated counts
  4. Single batch INSERT ... ON CONFLICT DO UPDATE
  5. Wrapped in DB transaction for atomicity
```

### Step 9: Logging
Every scrape run creates a `job_scraping_logs` entry:
- Source, status (running → completed/failed)
- jobsFound, jobsNew, jobsUpdated counts
- Duration, error details if failed
- Worker ID, request params

### Step 10: Cleanup (Daily at 3 AM)
```
cleanupStaleJobs():
  1. Mark jobs inactive if lastScrapedAt > 30 days ago
  2. Hard-delete inactive jobs older than 90 days (prevents unbounded growth)
```

---

## 📂 File Structure

```
services/jobBoards/
  ├── index.js                  # Central aggregation — scrapeJobsFromSource(), scrapeAllSources()
  ├── remoteok.service.js       # RemoteOK JSON API scraper
  ├── remotive.service.js       # Remotive RSS scraper
  ├── weworkremotely.service.js # We Work Remotely RSS scraper
  ├── himalayas.service.js      # Himalayas JSON API scraper
  ├── jobicy.service.js         # Jobicy JSON API scraper
  ├── indeed.service.js         # Indeed RSS scraper (not scheduled)
  ├── indianBoards.service.js   # HTTP client for Python microservice (Naukri etc.)
  ├── circuit-breaker.service.js # Per-source circuit breakers (opossum)
  └── cache.service.js          # Redis cache with per-source TTLs

scraper-service/
  ├── main.py                   # FastAPI app — all 5 Indian board scrapers
  ├── requirements.txt          # scrapling, fastapi, uvicorn
  ├── Dockerfile                # Production Docker image
  ├── docker-compose.yml        # Dev/prod compose
  └── README.md                 # Scraper service docs

queues/
  ├── job-scraping.queue.js     # Queue definition, cron scheduling, helper functions
  └── workers/
      └── job-scraping.worker.js # Worker — scrape, upsert, cleanup

controllers/
  └── job.controller.js         # API endpoints for job browsing + matching

models/
  └── job.model.js              # Database queries for jobs

routes/v1/
  ├── job.route.js              # Job API routes (auth required)
  └── health-scraping.route.js  # Health/monitoring endpoints (no auth)

scripts/
  └── test-scraping-system.js   # Comprehensive test script
```

---

## 🚀 How to Trigger Job Scraping

### **Option 1: Wait for Scheduled Scraping**
Jobs are automatically scraped on per-source schedules. Just start the worker:
```bash
npm run worker:job-scraping
```

### **Option 2: Manual Trigger via Code**
```javascript
import { addScrapeSourceJob, addScrapeAllSourcesJob } from './queues/job-scraping.queue.js';

// Scrape a specific source
await addScrapeSourceJob({
  source: 'remoteok',
  options: { limit: 50, tags: ['javascript'] }
});

// Scrape all sources (remote in parallel + enqueues Indian boards)
await addScrapeAllSourcesJob({
  globalOptions: { limit: 100 }
});
```

### **Option 3: Quick Test Script**
```bash
# Test a single source (no queue/worker needed)
node test-scraping.js remoteok 10

# Comprehensive system test
node scripts/test-scraping-system.js

# Test only specific subsystems
node scripts/test-scraping-system.js --sources    # Source scrapers only
node scripts/test-scraping-system.js --indian     # Indian boards only
node scripts/test-scraping-system.js --cache      # Cache tests
node scripts/test-scraping-system.js --circuit    # Circuit breaker tests
node scripts/test-scraping-system.js --queue      # Queue tests
node scripts/test-scraping-system.js --health     # Health endpoints
node scripts/test-scraping-system.js --source=remoteok  # Single source
```

### **Option 4: Sample Seed Data (For Testing)**
```bash
node drizzle/seeds/sample-jobs.seed.js
```

---

## 🔍 Monitoring Job Scraping

### Health Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health/scraping` | Comprehensive health: per-source status, circuit breakers, cache, queue |
| GET | `/api/v1/health/scraping/stats` | Per-source job counts and last scrape times |
| GET | `/api/v1/health/scraping/logs` | Recent scraping log entries |
| POST | `/api/v1/health/scraping/reset-circuit-breaker/:source` | Reset a tripped circuit breaker |

### Check Scraping Logs (SQL)
```sql
SELECT source, status, jobs_found, jobs_new, jobs_updated, duration, error_message
FROM job_scraping_logs
ORDER BY started_at DESC
LIMIT 20;
```

### Check Active Jobs Count
```sql
SELECT source, COUNT(*) as count
FROM jobs
WHERE is_active = true
GROUP BY source
ORDER BY count DESC;
```

### Check Circuit Breaker Status
```bash
curl http://localhost:3000/api/v1/health/scraping | jq '.data.circuitBreakers'
```

---

## 🧪 Testing the System

### Comprehensive Test Script
```bash
# Run ALL tests (sources, cache, circuit breakers, queue, health, schema validation)
node scripts/test-scraping-system.js

# Skip slow scrapers
node scripts/test-scraping-system.js --fast

# Test only remote sources
node scripts/test-scraping-system.js --sources

# Test only Indian boards (requires Python scraper service running)
node scripts/test-scraping-system.js --indian
```

The test script validates:
- ✅ Each source returns valid job objects
- ✅ Job schema compliance (required fields, data types, enums)
- ✅ No duplicate externalIds within results
- ✅ Snake→camelCase normalisation for Indian boards
- ✅ Circuit breaker states and operations (fire, reset)
- ✅ Cache set/get/invalidate/miss/stats
- ✅ Queue add/remove job operations
- ✅ Health endpoint responses
- ✅ Python scraper service reachability

### Quick Single-Source Test
```bash
node test-scraping.js remoteok 10
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host for queues + cache |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_TLS` | `false` | Enable TLS for Redis |
| `JOB_SCRAPING_WORKER_CONCURRENCY` | `2` | Worker concurrency |
| `SCRAPER_SERVICE_URL` | `http://localhost:8001` | Python scraper microservice URL |
| `SCRAPER_SERVICE_SECRET` | *(empty)* | API key shared with Python service |
| `JOB_MATCHING_ENABLED` | `true` | Feature flag for matching system |

### Python Scraper Service Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_API_KEY` | *(empty)* | Must match `SCRAPER_SERVICE_SECRET` |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8001` | Bind port |
| `HEADLESS` | `true` | Run browsers headless |
| `PROXY` | *(none)* | HTTP/SOCKS5 proxy for anti-bot |

### Starting the Python Scraper
```bash
cd scraper-service
pip install -r requirements.txt
python -m scrapling install   # Install browser binaries
python main.py                # Dev mode
# OR
uvicorn main:app --host 0.0.0.0 --port 8001  # Production
# OR
docker compose up -d          # Docker (recommended)
```

---

## 🐛 Troubleshooting

### Problem: No jobs in database
1. Check if the scraping worker is running: `npm run worker:job-scraping`
2. Check Redis is running and accessible
3. Check scraping logs: `SELECT * FROM job_scraping_logs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 10;`
4. Manually trigger: `node test-scraping.js remoteok 10`
5. Use seed data: `node drizzle/seeds/sample-jobs.seed.js`

### Problem: Indian board scraping fails
1. Check Python service is running: `curl http://localhost:8001/api/v1/health`
2. Check `SCRAPER_SERVICE_URL` and `SCRAPER_SERVICE_SECRET` match
3. Check circuit breaker status: `curl http://localhost:3000/api/v1/health/scraping`
4. Reset circuit breaker: `curl -X POST http://localhost:3000/api/v1/health/scraping/reset-circuit-breaker/naukri`

### Problem: Scraping fails with rate limit
- Circuit breakers auto-trip after 50% error rate — wait for reset timeout
- Check per-source scrape intervals aren't too aggressive
- Use the cache (don't pass `skipCache: true` in production)
- Consider adding a proxy (`PROXY` env var in Python service)

### Problem: Duplicate jobs
- Jobs are deduplicated by `(external_id, source)` unique constraint
- The batch upsert uses `ON CONFLICT DO UPDATE`
- If duplicates appear: check that `externalId` is deterministic for each source

### Problem: Circuit breaker stuck open
```bash
# Reset a specific breaker
curl -X POST http://localhost:3000/api/v1/health/scraping/reset-circuit-breaker/remoteok

# Check all breaker statuses
curl http://localhost:3000/api/v1/health/scraping | jq '.data.circuitBreakers'
```

---

## 📊 Data Flow Summary

```
1. Cron trigger (BullMQ repeatable job)
   ↓
2. Worker picks up job (concurrency=2, rate=10/min)
   ↓
3. Cache check (Redis, source-specific TTL)
   ↓
4. Circuit breaker gate (opossum, per-source)
   ↓
5. Scrape external source
   ├── International → Node.js HTTP → API/RSS
   └── Indian → Node.js HTTP → Python FastAPI → Headless browser → Job board
   ↓
6. Normalise to standard schema (camelCase)
   ↓
7. Cache fresh result (Redis)
   ↓
8. Batch UPSERT to PostgreSQL (transaction)
   ↓
9. Log to job_scraping_logs table
   ↓
10. Jobs available via GET /api/v1/jobs
    ↓
11. Job matching engine (BullMQ, separate worker)
    ↓
12. User sees matches via GET /api/v1/job-matches
```

---

## 📝 Summary

The job sourcing system:
- ✅ **11 sources** — 6 international remote + 5 Indian job boards
- ✅ **Per-source cron schedules** — optimised for data freshness vs. rate limits
- ✅ **Circuit breakers** — per-source fault isolation (opossum)
- ✅ **Redis caching** — per-source TTLs to reduce API calls
- ✅ **Batch UPSERT** — deduplicate by (externalId, source) in single transaction
- ✅ **Python microservice** — Scrapling-based headless browser scraping for Indian boards
- ✅ **Cleanup cron** — deactivate after 30 days, hard-delete after 90 days
- ✅ **Health monitoring** — per-source status, circuit breakers, cache stats, queue stats
- ✅ **Comprehensive test script** — `node scripts/test-scraping-system.js`
- ✅ **Powers job matching** — weighted scoring (Skills 40%, Experience 30%, Education 20%, Location 10%)
