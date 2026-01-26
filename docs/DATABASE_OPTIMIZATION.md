# Database Optimization & Indexing Strategy

This document outlines the database optimization strategy, indexing patterns, and production-readiness checklist for the Success CV backend.

## Table of Contents

1. [Current Database Structure](#current-database-structure)
2. [Index Strategy](#index-strategy)
3. [Query Optimization Patterns](#query-optimization-patterns)
4. [Performance Monitoring](#performance-monitoring)
5. [Production Readiness Checklist](#production-readiness-checklist)
6. [Recommended Improvements](#recommended-improvements)

---

## Current Database Structure

### Core Tables (35 tables)

| Category | Tables | Purpose |
|----------|--------|---------|
| **Auth** | users, profiles, verify_tokens, forgot_password_tokens | User authentication |
| **Organizations** | organisations, organisation_members, invites, candidates | B2B multi-tenancy |
| **Resume** | documents, resume_content, resume_rewrites, resume_themes | Resume storage |
| **Analysis** | analyses, processed_and_raw_data | AI analysis results |
| **Admin** | admin_users, admin_activity_logs, system_settings | Admin system |
| **Billing** | subscription_plans, user_subscriptions, credit_wallets, credit_transactions, payment_orders | Payments |
| **Jobs** | jobs, job_matches, job_scraping_logs, user_job_preferences | Job matching (NEW) |

---

## Index Strategy

### Primary Key Indexes (Automatic)
All tables use `GENERATED ALWAYS AS IDENTITY` for primary keys, which automatically creates B-tree indexes.

### Foreign Key Indexes
**Critical for JOIN performance.** All foreign keys should be indexed.

```sql
-- Users table references
CREATE INDEX IF NOT EXISTS "analyses_user_id_idx" ON "analyses" ("userID");
CREATE INDEX IF NOT EXISTS "documents_user_id_idx" ON "documents" ("userID");
CREATE INDEX IF NOT EXISTS "resume_content_user_id_idx" ON "resume_content" ("userID");

-- Candidates table references
CREATE INDEX IF NOT EXISTS "candidate_analyses_candidate_id_idx" ON "candidate_analyses" ("candidateID");
CREATE INDEX IF NOT EXISTS "candidate_documents_candidate_id_idx" ON "candidate_documents" ("candidateID");
```

### Search & Filter Indexes

#### Jobs Table (Heavily Indexed for Search)
```sql
-- Deduplication
CREATE UNIQUE INDEX "jobs_external_source_unique_idx" ON "jobs" ("external_id", "source");

-- Standard B-tree for equality/range
CREATE INDEX "jobs_title_idx" ON "jobs" ("title");
CREATE INDEX "jobs_company_idx" ON "jobs" ("company");
CREATE INDEX "jobs_location_idx" ON "jobs" ("location");
CREATE INDEX "jobs_posted_date_idx" ON "jobs" ("posted_date");

-- Composite for common filter patterns
CREATE INDEX "jobs_active_posted_idx" ON "jobs" ("is_active", "posted_date");
CREATE INDEX "jobs_source_active_idx" ON "jobs" ("source", "is_active");

-- GIN for JSONB array operations (skill matching)
CREATE INDEX "jobs_skills_idx" ON "jobs" USING gin ("skills_required" jsonb_path_ops);

-- Trigram for fuzzy text search
CREATE INDEX "jobs_title_trgm_idx" ON "jobs" USING gin ("title" gin_trgm_ops);
CREATE INDEX "jobs_company_trgm_idx" ON "jobs" USING gin ("company" gin_trgm_ops);
```

#### Job Matches Table
```sql
-- Prevent duplicates
CREATE UNIQUE INDEX "job_matches_unique_idx" ON "job_matches" ("user_type", "jobID", "analysisID") 
  WHERE "analysisID" IS NOT NULL;

-- User lookups with score sorting
CREATE INDEX "job_matches_user_score_idx" ON "job_matches" ("userID", "match_score");
CREATE INDEX "job_matches_candidate_score_idx" ON "job_matches" ("candidateID", "match_score");

-- Status filtering
CREATE INDEX "job_matches_user_status_idx" ON "job_matches" ("userID", "status");
```

### Index Types Used

| Index Type | Use Case | Example |
|------------|----------|---------|
| **B-tree** (default) | Equality, range, sorting | `WHERE status = 'active'`, `ORDER BY created_at` |
| **GIN** | JSONB containment, arrays | `WHERE skills_required @> '["JavaScript"]'` |
| **GIN + pg_trgm** | Fuzzy text search | `WHERE title ILIKE '%developer%'` |
| **Unique** | Constraint enforcement | Deduplication of scraped jobs |
| **Partial** | Conditional indexing | `WHERE status = 'active'` only |

---

## Query Optimization Patterns

### 1. Pagination with Cursor-Based Approach
```javascript
// Avoid OFFSET for large datasets
// Use cursor-based pagination

// Good - Uses index efficiently
const jobs = await db.query.jobs.findMany({
  where: and(
    gt(jobsTable.id, lastSeenId),
    eq(jobsTable.isActive, true)
  ),
  limit: 20,
  orderBy: [asc(jobsTable.id)]
});

// Bad - Scans all previous rows
const jobs = await db.query.jobs.findMany({
  offset: 10000, // Slow!
  limit: 20
});
```

### 2. Selective Field Loading
```javascript
// Good - Select only needed columns
const jobs = await db
  .select({
    id: jobsTable.id,
    title: jobsTable.title,
    company: jobsTable.company
  })
  .from(jobsTable);

// Bad - Select all columns
const jobs = await db.select().from(jobsTable); // Loads description, rawData, etc.
```

### 3. Batch Operations
```javascript
// Good - Single batch insert
await db.insert(jobMatchesTable).values(matchesArray);

// Bad - Individual inserts in loop
for (const match of matches) {
  await db.insert(jobMatchesTable).values(match); // N queries!
}
```

### 4. Using Prepared Statements
```javascript
// Drizzle prepares statements automatically for parameterized queries
const getJobById = db.query.jobs.findFirst({
  where: eq(jobsTable.id, sql.placeholder('id'))
}).prepare('get_job_by_id');

const job = await getJobById.execute({ id: 123 });
```

---

## Performance Monitoring

### Key Queries to Monitor

```sql
-- 1. Slow queries (>100ms)
SELECT query, calls, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- 2. Unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%pkey%';

-- 3. Table sizes and row counts
SELECT 
  schemaname,
  relname,
  n_live_tup,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- 4. Index usage
SELECT 
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 5. Cache hit ratio (should be >99%)
SELECT 
  sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) as cache_hit_ratio
FROM pg_stat_database;
```

### Connection Pool Settings

```javascript
// postgres connection pool settings
const sql = postgres(process.env.DATABASE_URL, {
  max: 20,           // Max connections
  idle_timeout: 30,  // Close idle connections after 30s
  connect_timeout: 10,
  max_lifetime: 60 * 30  // Recycle connections every 30min
});
```

---

## Production Readiness Checklist

### Database Level

- [x] **All tables have primary keys**
- [x] **Foreign keys are indexed**
- [x] **Composite indexes for common query patterns**
- [x] **GIN indexes for JSONB operations**
- [x] **Trigram indexes for fuzzy search** (pg_trgm extension)
- [x] **Unique constraints for deduplication**
- [ ] **Connection pooling configured** (PgBouncer for high traffic)
- [ ] **pg_stat_statements enabled** (for query analysis)
- [ ] **Automated backups configured**
- [ ] **Read replicas for scaling** (if needed)

### Schema Level

- [x] **NOT NULL constraints where appropriate**
- [x] **DEFAULT values for optional fields**
- [x] **CASCADE deletes for child tables**
- [x] **JSONB instead of JSON** for better performance
- [x] **Appropriate column types** (varchar lengths, integer vs bigint)
- [ ] **Check constraints** for enum-like fields

### Application Level

- [x] **Parameterized queries** (Drizzle does this automatically)
- [ ] **Query result caching** (Redis for frequently accessed data)
- [x] **Batch inserts for bulk operations**
- [ ] **Connection pool monitoring**
- [ ] **Query timeout settings**

---

## Recommended Improvements

### 1. Add Partial Indexes for Common Filters

```sql
-- Index only active jobs (reduces index size)
CREATE INDEX "jobs_active_only_idx" ON "jobs" ("posted_date") 
WHERE "is_active" = true;

-- Index only pending analyses
CREATE INDEX "analyses_pending_idx" ON "analyses" ("created_at")
WHERE "status" = 'pending';
```

### 2. Add Text Search Configuration

```sql
-- Full-text search for job descriptions
ALTER TABLE "jobs" ADD COLUMN "search_vector" tsvector;

CREATE INDEX "jobs_search_idx" ON "jobs" USING gin("search_vector");

-- Trigger to update search vector
CREATE FUNCTION jobs_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_search_update
  BEFORE INSERT OR UPDATE ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION jobs_search_trigger();
```

### 3. Table Partitioning for Large Tables

```sql
-- Partition job_scraping_logs by month (for log retention)
CREATE TABLE "job_scraping_logs_partitioned" (
  LIKE "job_scraping_logs" INCLUDING ALL
) PARTITION BY RANGE ("created_at");

CREATE TABLE job_scraping_logs_2025_01 
  PARTITION OF job_scraping_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 4. Add Monitoring Alerts

```sql
-- Create function to check for slow queries
CREATE OR REPLACE FUNCTION check_slow_queries() RETURNS TABLE (
  query text,
  calls bigint,
  mean_time double precision
) AS $$
  SELECT query, calls, mean_time
  FROM pg_stat_statements
  WHERE mean_time > 100  -- > 100ms average
  ORDER BY mean_time DESC
  LIMIT 10;
$$ LANGUAGE sql;
```

### 5. Implement Read Replicas (For Scale)

```javascript
// Configure read/write splitting
const writeDb = postgres(process.env.DATABASE_URL);
const readDb = postgres(process.env.DATABASE_READ_REPLICA_URL);

// Use read replica for queries
const jobs = await readDb.query.jobs.findMany({ ... });

// Use primary for writes
await writeDb.insert(jobsTable).values({ ... });
```

---

## Index Maintenance

### Regular Maintenance Tasks

```sql
-- 1. Update statistics (usually automatic, but can force)
ANALYZE;

-- 2. Reindex bloated indexes
REINDEX INDEX CONCURRENTLY "jobs_title_idx";

-- 3. Vacuum to reclaim space
VACUUM ANALYZE "jobs";

-- 4. Check for index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Automated Maintenance (Add to Cron)

```bash
# Weekly VACUUM ANALYZE
0 2 * * 0 psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Monthly statistics update
0 3 1 * * psql $DATABASE_URL -c "ANALYZE;"
```

---

## Summary

The Success CV database is designed with:

1. **Comprehensive indexing** for all common query patterns
2. **JSONB columns** with GIN indexes for flexible data
3. **Fuzzy search capability** via pg_trgm
4. **Proper foreign key relationships** with cascading deletes
5. **Statement breakpoints** for reliable migrations

For production:
- Enable `pg_stat_statements` for query monitoring
- Configure connection pooling (PgBouncer)
- Set up automated backups
- Monitor cache hit ratio and slow queries
- Consider read replicas if read load is high
