# Database Monitoring Quick Reference

This guide shows how to use the database monitoring functions added in migration 0014.

## Prerequisites

Enable `pg_stat_statements` extension for query monitoring:

```sql
-- Run as superuser or request from DBA
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

For managed databases (Supabase, RDS, etc.), enable via their console.

---

## Monitoring Functions

### 1. Check Slow Queries

Returns queries with mean execution time above threshold (default 100ms).

```sql
-- Find queries slower than 100ms (default)
SELECT * FROM check_slow_queries();

-- Find queries slower than 500ms
SELECT * FROM check_slow_queries(500);
```

**Output:**
- `query_short`: First 100 chars of query
- `calls`: Number of times executed
- `mean_time_ms`: Average execution time
- `max_time_ms`: Maximum execution time
- `total_time_hours`: Total time spent on this query

**Action:** Optimize queries with high mean_time or total_time.

---

### 2. Find Unused Indexes

Shows indexes with low usage (< 50 scans).

```sql
SELECT * FROM find_unused_indexes();
```

**Output:**
- `table_name`: Table name (with schema)
- `index_name`: Index name
- `index_size`: Size of index
- `idx_scan`: Number of times scanned

**Action:** Consider dropping unused indexes (idx_scan = 0):
```sql
DROP INDEX CONCURRENTLY "index_name";
```

---

### 3. Cache Hit Ratio

Shows database cache efficiency (should be >99%).

```sql
SELECT * FROM cache_hit_ratio();
```

**Output:**
- `cache_hit_ratio`: Percentage of queries served from cache
- `shared_buffers`: Current shared_buffers setting

**What's Good:**
- ✅ **>99%**: Excellent, most queries cached
- ⚠️ **90-99%**: OK, but could be better
- ❌ **<90%**: Poor, increase `shared_buffers` or optimize queries

**Action if low:**
1. Increase shared_buffers in postgresql.conf
2. Analyze query patterns
3. Check if working set fits in memory

---

### 4. Check Table Bloat

Shows tables with significant dead tuples (>1000).

```sql
SELECT * FROM check_table_bloat();
```

**Output:**
- `table_name`: Table name (with schema)
- `bloat_pct`: Percentage of bloat
- `bloat_mb`: Estimated bloat size in MB
- `dead_tuples`: Number of dead rows
- `last_vacuum`: Last manual VACUUM

**Action if bloat_pct > 10%:**
```sql
VACUUM ANALYZE table_name;

-- For heavy bloat (requires table lock!)
VACUUM FULL table_name;
```

---

### 5. Table Sizes

Shows all tables with their sizes (useful for capacity planning).

```sql
SELECT * FROM table_sizes();
```

**Output:**
- `table_name`: Table name
- `row_count`: Number of rows
- `total_size`: Total size (table + indexes)
- `table_size`: Data size only
- `indexes_size`: All indexes size

**Action:** Monitor growth trends, plan partitioning if needed.

---

## Full-Text Search

The optimization migration added full-text search capability to jobs table.

### Using Full-Text Search

```javascript
// In your job search queries
const jobs = await db.execute(sql`
  SELECT id, title, company, location, match_score
  FROM jobs, 
       ts_rank(search_vector, websearch_to_tsquery('english', ${searchTerm})) as match_score
  WHERE search_vector @@ websearch_to_tsquery('english', ${searchTerm})
    AND is_active = true
  ORDER BY match_score DESC, posted_date DESC
  LIMIT 50
`);
```

**Search Examples:**
```sql
-- Search for "JavaScript developer"
websearch_to_tsquery('english', 'JavaScript developer')

-- Search with AND: "React AND TypeScript"
websearch_to_tsquery('english', 'React AND TypeScript')

-- Search with OR: "Python OR Java"
websearch_to_tsquery('english', 'Python OR Java')

-- Exclude: "developer -PHP"
websearch_to_tsquery('english', 'developer -PHP')
```

**Benefits:**
- 10-100x faster than `LIKE '%keyword%'`
- Supports stemming (developer = develop = develops)
- Relevance ranking with `ts_rank`

---

## Performance Monitoring Dashboard

Create a monitoring script to check all metrics:

```javascript
// scripts/check-db-health.js
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function checkHealth() {
  console.log('🔍 Database Health Check\n');
  
  // Cache hit ratio
  const cache = await sql`SELECT * FROM cache_hit_ratio()`;
  console.log('📊 Cache Hit Ratio:', cache[0].cache_hit_ratio + '%');
  
  // Slow queries
  const slow = await sql`SELECT * FROM check_slow_queries(100) LIMIT 5`;
  console.log('\n⏱️  Top 5 Slow Queries:');
  slow.forEach(q => {
    console.log(`  - ${q.query_short.substring(0, 50)}... (${q.mean_time_ms}ms avg)`);
  });
  
  // Table bloat
  const bloat = await sql`SELECT * FROM check_table_bloat() LIMIT 5`;
  if (bloat.length > 0) {
    console.log('\n🗑️  Tables Needing VACUUM:');
    bloat.forEach(t => {
      console.log(`  - ${t.table_name}: ${t.dead_percentage}% dead tuples`);
    });
  }
  
  // Unused indexes
  const unused = await sql`SELECT * FROM find_unused_indexes() LIMIT 3`;
  if (unused.length > 0) {
    console.log('\n📦 Unused Indexes:');
    unused.forEach(i => {
      console.log(`  - ${i.index_name} (${i.index_size})`);
    });
  }
  
  await sql.end();
}

checkHealth();
```

Run with:
```bash
node scripts/check-db-health.js
```

---

## Recommended Monitoring Schedule

- **Daily**: Check cache hit ratio
- **Weekly**: Check slow queries and table bloat
- **Monthly**: Review unused indexes and table sizes

Set up automated alerts if:
- Cache hit ratio < 95%
- Any query > 1000ms average
- Any table > 20% dead tuples
- Database size growing unexpectedly

---

## Performance Tips

### 1. Use Partial Indexes
Now available for common patterns:
```sql
-- Only active jobs are indexed
jobs_active_only_idx

-- Only pending analyses
analyses_pending_idx
```

### 2. Full-Text Search Instead of LIKE
```sql
-- ❌ Slow
WHERE title LIKE '%developer%'

-- ✅ Fast
WHERE search_vector @@ to_tsquery('developer')
```

### 3. Monitor & Optimize
```sql
-- Weekly health check
SELECT * FROM check_slow_queries(100);
SELECT * FROM check_table_bloat();
SELECT * FROM cache_hit_ratio();
```

### 4. Regular Maintenance
```bash
# Weekly VACUUM ANALYZE
VACUUM ANALYZE;

# Monthly statistics update
ANALYZE;
```

---

## Emergency Troubleshooting

### High CPU Usage
```sql
-- Find active queries
SELECT pid, state, query, now() - query_start as duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Kill slow query if needed
SELECT pg_terminate_backend(pid);
```

### High Memory Usage
```sql
-- Check connections
SELECT count(*) FROM pg_stat_activity;

-- Check cache usage
SELECT * FROM cache_hit_ratio();
```

### Slow Queries
```sql
-- Analyze specific query
EXPLAIN ANALYZE <your query>;

-- Check if indexes are used
EXPLAIN <your query>;
```
