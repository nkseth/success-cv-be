# Workers Directory

This directory contains BullMQ worker processes that handle background jobs asynchronously.

## Available Workers

### 1. Resume Analysis Worker
**File**: `resume-analysis.worker.js`

Processes resume analysis jobs including parsing, extracting information, and generating AI insights.

**Start Commands:**
```bash
npm run worker              # Production
npm run worker:dev          # Development
```

### 2. Resume Rewrite Worker
**File**: `resume-rewrite.worker.js`

Handles resume rewriting jobs with AI assistance.

**Start Commands:**
```bash
npm run worker:rewrite      # Production
npm run worker:rewrite:dev  # Development
```

### 3. Email Worker
**File**: `email.worker.js`

Processes email sending jobs asynchronously for non-blocking email delivery.

**Start Commands:**
```bash
npm run worker:email        # Production
npm run worker:email:dev    # Development
```

**Email Types Supported:**
- Verification emails
- Password reset emails
- Candidate verification emails (with credentials)
- Generic emails

### 4. Manual Analysis Worker
**File**: `manual-analysis.worker.js`

Analyzes manually-created resumes (blank resumes with user-entered content). Unlike the regular analysis worker, this does NOT extract content from files - it analyzes existing structured resume content and provides AI-powered scoring, mistake identification, and improvement recommendations.

**Start Commands:**
```bash
npm run worker:manual-analysis      # Production
npm run worker:manual-analysis:dev  # Development
```

**Features:**
- Validates resume has sufficient content
- Converts structured resume data to text for AI analysis
- Uses the same AI scoring schema as upload analysis
- Provides ATS scores, content quality scores, and improvement plans
- Integrates with billing (costs 1 credit per analysis)

## Architecture

```
API Server                Workers (Separate Processes)
    │                           │
    │  Add Job to Queue        │
    ├──────────────────────────>│
    │                           │
    │  Return Response          │
    │<─────────────             │
    │  (Immediately)            │
                                │
                                │  Process Jobs
                                │  in Background
                                ▼
```

## Running Workers

### Development (All Workers)
```bash
# Terminal 1: API Server
npm run dev

# Terminal 2: Resume Analysis Worker
npm run worker:dev

# Terminal 3: Email Worker
npm run worker:email:dev

# Terminal 4: Resume Rewrite Worker (if needed)
npm run worker:rewrite:dev
```

### Production (with PM2)
```bash
pm2 start npm --name "api" -- start
pm2 start npm --name "worker-analysis" -- run worker
pm2 start npm --name "worker-email" -- run worker:email
pm2 start npm --name "worker-rewrite" -- run worker:rewrite
```

## Prerequisites

All workers require:
- ✅ **Redis** running and accessible
- ✅ **PostgreSQL** database connection
- ✅ Proper environment variables configured

### Check Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

## Worker Configuration

### Environment Variables

```bash
# Resume Analysis Worker
RESUME_WORKER_CONCURRENCY=3

# Email Worker
EMAIL_WORKER_CONCURRENCY=5
EMAIL_RATE_LIMIT_MAX=10
EMAIL_RATE_LIMIT_DURATION=60000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword
REDIS_DB_QUEUE=1
```

## Monitoring Workers

### Check Worker Status
```bash
# With PM2
pm2 status

# Manual check
ps aux | grep worker
```

### View Worker Logs
```bash
# PM2 logs
pm2 logs worker-email

# Direct logs
tail -f logs/worker.log
```

### Queue Statistics

Each queue provides statistics:

```javascript
// In your code
import { getEmailQueueStats } from '../queues/email.queue.js';

const stats = await getEmailQueueStats();
console.log(stats);
// { waiting: 5, active: 2, completed: 150, failed: 3 }
```

## Error Handling

All workers implement:
- ✅ Automatic retries with exponential backoff
- ✅ Comprehensive error logging
- ✅ Graceful shutdown on SIGTERM/SIGINT
- ✅ Failed job preservation for debugging

## Best Practices

1. **Always run workers as separate processes**
   - Don't run workers in the same process as the API
   - Use PM2 or similar process manager

2. **Monitor worker health**
   - Set up alerts for high failure rates
   - Monitor queue lengths
   - Track processing times

3. **Scale workers independently**
   - Add more worker instances for high load
   - Adjust concurrency based on resources

4. **Handle graceful shutdowns**
   - Workers handle SIGTERM/SIGINT properly
   - Current jobs complete before shutdown

## Troubleshooting

### Worker won't start

**Check Redis connection:**
```bash
redis-cli ping
```

**Check environment variables:**
```bash
echo $REDIS_HOST
echo $REDIS_PORT
```

**Check worker logs:**
```bash
npm run worker:email:dev
# Look for connection errors
```

### Jobs not processing

**Check queue stats:**
```javascript
const stats = await getEmailQueueStats();
console.log('Queue stats:', stats);
```

**Verify worker is running:**
```bash
ps aux | grep email.worker
```

**Check Redis queues:**
```bash
redis-cli
> KEYS bull:email:*
```

### High failure rate

1. Check worker logs for error patterns
2. Verify external service credentials (Brevo, Azure, etc.)
3. Check network connectivity
4. Review resource limits (memory, CPU)

## Docker Deployment

### docker-compose.yml Example

```yaml
version: '3.8'

services:
  api:
    build: .
    command: npm start
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
      - postgres
    
  worker-email:
    build: .
    command: npm run worker:email
    environment:
      - NODE_ENV=production
      - EMAIL_WORKER_CONCURRENCY=10
    depends_on:
      - redis
      - postgres
    
  worker-analysis:
    build: .
    command: npm run worker
    environment:
      - NODE_ENV=production
      - RESUME_WORKER_CONCURRENCY=5
    depends_on:
      - redis
      - postgres
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=successcv
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
```

## Related Documentation

- [Email Queue System](../docs/EMAIL_QUEUE_SYSTEM.md)
- [Queue Service Usage](../docs/QUEUE_SERVICE_USAGE.md)
- [Redis BullMQ Setup](../docs/REDIS_BULLMQ_SETUP.md)
- [Resume Analysis Queue](../docs/RESUME_ANALYSIS_QUEUE.md)

---

**Last Updated**: January 25, 2026
