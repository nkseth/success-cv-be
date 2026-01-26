# Job Sourcing System - How It Works

## Overview

The Success CV platform automatically sources job listings from multiple external job boards and APIs. Jobs are scraped periodically, deduplicated, stored in the database, and then used for matching against user resumes.

---

## 📊 Architecture

```
┌─────────────────┐
│  External APIs  │
│  & Job Boards   │
└────────┬────────┘
         │
         ├──> RemoteOK API (Free JSON API)
         ├──> Indeed RSS Feed (Free RSS)
         ├──> Adzuna API (Planned - 5000 calls/month free)
         ├──> StackOverflow Jobs (Planned - RSS)
         └──> AngelList/Wellfound (Planned - Startup jobs)
         │
         ▼
┌────────────────────────────┐
│  Job Scraping Scheduler    │
│  (BullMQ Queue + Worker)   │
│  Runs every 6 hours        │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  Job Board Services        │
│  - remoteok.service.js     │
│  - indeed.service.js       │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  Job Normalization         │
│  Converts to standard      │
│  schema with deduplication │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  Database (jobs table)     │
│  - Upsert by external_id   │
│  - Mark stale jobs inactive│
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  Job Matching System       │
│  Matches users with jobs   │
│  based on resume analysis  │
└────────────────────────────┘
```

---

## 🔄 How Job Scraping Works

### 1. **Automatic Periodic Scraping**

The system uses a **BullMQ job queue** with scheduled recurring jobs:

- **Scrape All Sources**: Runs every **6 hours** (00:00, 06:00, 12:00, 18:00)
- **Cleanup Stale Jobs**: Runs daily at **3:00 AM**

```javascript
// Schedule is set in: queues/job-scraping.queue.js
schedulePeriodicScraping() {
  // Scrape all sources every 6 hours
  pattern: '0 */6 * * *'
  
  // Cleanup stale jobs daily at 3 AM
  pattern: '0 3 * * *'
}
```

### 2. **Supported Job Sources**

#### **RemoteOK** (Currently Active)
- **Type**: Free JSON API
- **URL**: `https://remoteok.com/api`
- **Data**: Remote jobs with full details
- **Features**: 
  - No authentication required
  - Rich job data (salary, skills, tags)
  - ~500+ active remote jobs
- **Implementation**: `services/jobBoards/remoteok.service.js`

#### **Indeed** (Currently Active)
- **Type**: RSS Feed
- **URL**: `https://www.indeed.com/rss?q={query}&l={location}`
- **Data**: General jobs (limited info)
- **Limitations**:
  - Basic data only (no salary info)
  - No structured skills data
  - Rate limits apply
- **Implementation**: `services/jobBoards/indeed.service.js`

#### **Planned Sources** (Not Yet Implemented)
- **Adzuna API**: 5000 free calls/month
- **StackOverflow Jobs**: RSS feed
- **AngelList/Wellfound**: Startup jobs
- **LinkedIn**: If API access available
- **GitHub Jobs**: If available

---

## 🛠️ Job Scraping Process

### Step 1: Queue Job
```javascript
// Manually trigger scraping (for testing)
import { addScrapeSourceJob } from './queues/job-scraping.queue.js';

await addScrapeSourceJob({
  source: 'remoteok',
  options: { limit: 100, tags: ['javascript', 'react'] }
});
```

### Step 2: Worker Processes Job
```javascript
// Worker runs in: queues/workers/job-scraping.worker.js

1. Fetch jobs from external API
2. Parse and normalize data
3. Validate required fields
4. Deduplicate by external_id + source
5. Upsert jobs into database
6. Log scraping results
```

### Step 3: Job Normalization
Each source has different data formats. Jobs are normalized to a standard schema:

```javascript
{
  externalId: string,       // Unique ID from source
  source: string,           // 'remoteok', 'indeed', etc.
  title: string,
  company: string,
  location: string,
  remoteType: enum,         // 'remote', 'hybrid', 'onsite'
  employmentType: string,   // 'full-time', 'part-time', etc.
  experienceLevel: string,  // 'entry', 'mid', 'senior'
  salaryMin: number,
  salaryMax: number,
  description: string,
  requirements: string[],
  skillsRequired: string[],
  benefits: string[],
  applyUrl: string,
  postedDate: timestamp,
  expiresAt: timestamp,
  isActive: boolean
}
```

### Step 4: Deduplication & Upsert
```javascript
// In job-scraping.worker.js

- Jobs are identified by: external_id + source
- If job exists: UPDATE (refresh data, mark as active)
- If job is new: INSERT
- Prevents duplicate jobs from same source
```

### Step 5: Cleanup Stale Jobs
```javascript
// Runs daily at 3 AM

- Jobs not seen in 30+ days → marked as isActive: false
- Expired jobs (past expiresAt date) → marked inactive
- Keeps database clean and relevant
```

---

## 📂 File Structure

```
services/jobBoards/
  ├── index.js              # Main aggregation service
  ├── remoteok.service.js   # RemoteOK scraper
  └── indeed.service.js     # Indeed RSS scraper

queues/
  ├── job-scraping.queue.js # Queue definition & scheduling
  └── workers/
      └── job-scraping.worker.js # Worker that processes jobs

drizzle/schema/
  └── jobs.schema.js        # Database schema for jobs table

models/
  └── job.model.js          # Database queries for jobs

controllers/
  └── job.controller.js     # API endpoints for job browsing

routes/v1/
  └── job.route.js          # Job API routes
```

---

## 🚀 How to Trigger Job Scraping

### **Option 1: Wait for Scheduled Scraping**
Jobs are automatically scraped every 6 hours. Just wait!

### **Option 2: Manual Trigger via Code**
```javascript
import { addScrapeAllSourcesJob } from './queues/job-scraping.queue.js';

// Scrape all sources
await addScrapeAllSourcesJob({
  globalOptions: { 
    limit: 100 
  }
});

// Or scrape specific source
import { addScrapeSourceJob } from './queues/job-scraping.queue.js';

await addScrapeSourceJob({
  source: 'remoteok',
  options: { limit: 50, tags: ['javascript'] }
});
```

### **Option 3: Manual Seed (For Testing)**
```bash
# Add sample jobs manually (8 jobs)
node drizzle/seeds/sample-jobs.seed.js
```

---

## 🔍 Monitoring Job Scraping

### Check Scraping Logs
```sql
SELECT * FROM job_scraping_logs 
ORDER BY started_at DESC 
LIMIT 10;
```

Columns:
- `source`: Which source was scraped
- `status`: 'completed', 'failed', 'running'
- `jobs_found`: Total jobs scraped from source
- `jobs_new`: New jobs inserted
- `jobs_updated`: Existing jobs updated
- `duration`: Time taken (ms)
- `error_message`: If failed

### Check Active Jobs Count
```sql
SELECT COUNT(*) FROM jobs WHERE is_active = true;
```

### Check Jobs by Source
```sql
SELECT source, COUNT(*) as count 
FROM jobs 
WHERE is_active = true 
GROUP BY source;
```

---

## 🧪 Testing the System

### 1. Test Job Scraping System
```bash
# Make sure server is running
npm run dev

# In another terminal, test the API
AUTH_TOKEN=your_token node scripts/test-job-system.js
```

This script will:
- ✅ Browse all jobs (GET /api/v1/jobs)
- ✅ Get specific job details
- ✅ Test filtering (remote jobs)
- ✅ Check job matches (if user has analyzed resume)
- ✅ Check job preferences

### 2. Manual Scraping Test
```javascript
// In Node.js REPL or script
import jobBoardsService from './services/jobBoards/index.js';

// Test RemoteOK
const result = await jobBoardsService.scrapeJobsFromSource('remoteok', {
  limit: 10,
  tags: ['javascript']
});

console.log(`Found ${result.jobs.length} jobs`);
console.log(result.stats);
```

---

## 📊 Job Data Flow

```
1. External API/RSS Feed
   ↓
2. Scraper Service (remoteok.service.js, indeed.service.js)
   ↓
3. Normalization (convert to standard format)
   ↓
4. Validation (check required fields)
   ↓
5. Worker (job-scraping.worker.js)
   ↓
6. Deduplication (check external_id + source)
   ↓
7. Database (jobs table)
   ↓
8. API (GET /api/v1/jobs)
   ↓
9. Job Matching (match with user resumes)
   ↓
10. User sees matches (GET /api/v1/job-matches)
```

---

## ⚙️ Configuration

### Environment Variables
```bash
# Redis for BullMQ (job queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker concurrency
JOB_SCRAPING_WORKER_CONCURRENCY=2
```

### Scraping Frequency
Edit in `queues/job-scraping.queue.js`:
```javascript
// Change from every 6 hours to every 12 hours
pattern: '0 */12 * * *'

// Or once per day at noon
pattern: '0 12 * * *'
```

---

## 🐛 Troubleshooting

### Problem: No jobs in database
**Solutions:**
1. Check if scraping worker is running:
   ```bash
   pm2 list
   # Should see: job-scraping-worker
   ```

2. Manually trigger scraping:
   ```javascript
   import { addScrapeAllSourcesJob } from './queues/job-scraping.queue.js';
   await addScrapeAllSourcesJob();
   ```

3. Check scraping logs:
   ```sql
   SELECT * FROM job_scraping_logs WHERE status = 'failed';
   ```

4. Use sample seed data:
   ```bash
   node drizzle/seeds/sample-jobs.seed.js
   ```

### Problem: Scraping fails with rate limit
**Solutions:**
- Add delays between requests
- Use caching (store responses for 1 hour)
- Reduce scraping frequency
- Use API keys if available

### Problem: Duplicate jobs
**Solution:**
- Check `external_id` uniqueness constraint
- Verify deduplication logic in worker
- Clean database: 
  ```sql
  DELETE FROM jobs WHERE id NOT IN (
    SELECT MIN(id) FROM jobs GROUP BY external_id, source
  );
  ```

---

## 🎯 Future Enhancements

1. **Add More Sources**
   - LinkedIn Jobs API
   - Glassdoor
   - Monster.com
   - ZipRecruiter

2. **Smart Scraping**
   - Only scrape jobs matching user preferences
   - Prioritize high-quality sources
   - ML-based job quality filtering

3. **Real-time Updates**
   - WebSocket notifications for new jobs
   - Email alerts for matching jobs
   - Browser push notifications

4. **Advanced Deduplication**
   - Fuzzy matching for similar jobs
   - Detect reposted jobs
   - Merge duplicate company listings

---

## 📝 Summary

The job sourcing system:
- ✅ **Automatically scrapes** jobs every 6 hours
- ✅ **Supports multiple sources** (RemoteOK, Indeed, more coming)
- ✅ **Deduplicates** jobs by external ID + source
- ✅ **Cleans up stale** jobs daily
- ✅ **Logs all operations** for monitoring
- ✅ **Provides API** for browsing and filtering jobs
- ✅ **Powers job matching** system for resume optimization

You don't need to manually add jobs - they're automatically sourced and updated!
