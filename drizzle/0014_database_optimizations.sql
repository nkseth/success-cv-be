-- Migration: Database Performance Optimizations
-- Created: 2026-01-26
-- Description: Add performance indexes, full-text search, and monitoring functions

-- ========== PARTIAL INDEXES FOR FILTERED QUERIES ==========
-- Index only active jobs (reduces index size by ~50% if half are inactive)
CREATE INDEX IF NOT EXISTS "jobs_active_only_idx" ON "jobs" ("posted_date" DESC) 
WHERE "is_active" = true;
--> statement-breakpoint

-- Index only pending analyses for job queue
CREATE INDEX IF NOT EXISTS "analyses_pending_idx" ON "analyses" ("created_at")
WHERE "status" = 'pending';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "candidate_analyses_pending_idx" ON "candidate_analyses" ("created_at")
WHERE "status" = 'pending';
--> statement-breakpoint

-- Index only active job matches
CREATE INDEX IF NOT EXISTS "job_matches_active_idx" ON "job_matches" ("userID", "match_score" DESC)
WHERE "status" = 'new' OR "status" = 'viewed';
--> statement-breakpoint

-- ========== FULL-TEXT SEARCH FOR JOBS ==========
-- Add tsvector column for full-text search
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
--> statement-breakpoint

-- Create GIN index for full-text search (much faster than LIKE queries)
CREATE INDEX IF NOT EXISTS "jobs_search_vector_idx" ON "jobs" USING gin("search_vector");
--> statement-breakpoint

-- Create trigger function to update search vector
CREATE OR REPLACE FUNCTION jobs_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.requirements, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Attach trigger to jobs table
DROP TRIGGER IF EXISTS jobs_search_update ON "jobs";
--> statement-breakpoint

CREATE TRIGGER jobs_search_update
  BEFORE INSERT OR UPDATE OF title, company, description, requirements
  ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION jobs_search_trigger();
--> statement-breakpoint

-- Backfill search vector for existing jobs
UPDATE "jobs" 
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(company, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(requirements, '')), 'D')
WHERE search_vector IS NULL;
--> statement-breakpoint

-- ========== COMPOSITE INDEXES FOR COMMON PATTERNS ==========
-- User's saved/applied jobs with date sorting
CREATE INDEX IF NOT EXISTS "job_matches_user_saved_date_idx" ON "job_matches" ("userID", "is_saved", "created_at" DESC)
WHERE "is_saved" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "job_matches_user_applied_date_idx" ON "job_matches" ("userID", "is_applied", "applied_at" DESC)
WHERE "is_applied" = true;
--> statement-breakpoint

-- Analysis with status and date for dashboard queries
CREATE INDEX IF NOT EXISTS "analyses_user_status_date_idx" ON "analyses" ("userID", "status", "createdAt" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "candidate_analyses_candidate_status_date_idx" ON "candidate_analyses" ("candidateID", "status", "createdAt" DESC);
--> statement-breakpoint

-- Resume rewrites with target job lookup
CREATE INDEX IF NOT EXISTS "resume_rewrites_user_job_status_idx" ON "resume_rewrites" ("userID", "target_job_id", "status")
WHERE "target_job_id" IS NOT NULL;
--> statement-breakpoint

-- ========== ORGANIZATION PERFORMANCE INDEXES ==========
-- Active org members lookup
CREATE INDEX IF NOT EXISTS "organisation_members_org_active_idx" ON "organisation_members" ("organisationID", "isActive")
WHERE "isActive" = true;
--> statement-breakpoint

-- Candidate lookup by org with deleted filter
CREATE INDEX IF NOT EXISTS "candidates_org_deleted_idx" ON "candidates" ("organisationID", "deletedAt")
WHERE "deletedAt" IS NULL;
--> statement-breakpoint

-- ========== SUBSCRIPTION & BILLING INDEXES ==========
-- Active subscriptions lookup
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_status_idx" ON "user_subscriptions" ("userID", "status")
WHERE "status" = 'active' OR "status" = 'trialing';
--> statement-breakpoint

-- Credit wallet balance queries
CREATE INDEX IF NOT EXISTS "credit_wallets_user_balance_idx" ON "credit_wallets" ("userID", "balance")
WHERE "balance" > 0;
--> statement-breakpoint

-- ========== MONITORING & PERFORMANCE FUNCTIONS ==========
-- Function to check for slow queries (requires pg_stat_statements)
CREATE OR REPLACE FUNCTION check_slow_queries(threshold_ms INTEGER DEFAULT 100) 
RETURNS TABLE (
  query_short text,
  calls bigint,
  mean_time_ms numeric,
  max_time_ms numeric,
  total_time_hours numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    LEFT(query, 100) as query_short,
    calls,
    ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
    ROUND(max_exec_time::numeric, 2) as max_time_ms,
    ROUND((total_exec_time / 1000 / 60 / 60)::numeric, 2) as total_time_hours
  FROM pg_stat_statements
  WHERE mean_exec_time > threshold_ms
  ORDER BY mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Function to find unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes() 
RETURNS TABLE(
  table_name text,
  index_name text,
  index_size text,
  idx_scan bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (s.schemaname || '.' || s.relname)::text AS table_name,
    s.indexrelname::text AS index_name,
    pg_size_pretty(pg_relation_size(s.indexrelid))::text AS index_size,
    s.idx_scan::bigint AS idx_scan
  FROM pg_stat_user_indexes s
  WHERE s.idx_scan < 50
    AND s.indexrelname NOT LIKE 'pg_toast%'
    AND s.indexrelname NOT LIKE '%pkey'
  ORDER BY pg_relation_size(s.indexrelid) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Function to check cache hit ratio
CREATE OR REPLACE FUNCTION cache_hit_ratio() 
RETURNS TABLE (
  cache_hit_ratio numeric,
  shared_buffers text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(
      (sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0))::numeric * 100, 
      2
    ) as cache_hit_ratio,
    current_setting('shared_buffers') as shared_buffers
  FROM pg_stat_database;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Function to check table bloat
CREATE OR REPLACE FUNCTION check_table_bloat()
RETURNS TABLE(
  table_name text,
  bloat_pct numeric,
  bloat_mb numeric,
  dead_tuples bigint,
  last_vacuum timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (t.schemaname || '.' || t.relname)::text AS table_name,
    ROUND(
      CASE 
        WHEN t.n_live_tup > 0 
        THEN (t.n_dead_tup::numeric / t.n_live_tup::numeric * 100)
        ELSE 0 
      END, 2
    ) AS bloat_pct,
    ROUND((t.n_dead_tup * current_setting('autovacuum_vacuum_scale_factor')::numeric) / 1024 / 1024, 2) AS bloat_mb,
    t.n_dead_tup AS dead_tuples,
    t.last_vacuum
  FROM pg_stat_user_tables t
  WHERE t.n_dead_tup > 1000
  ORDER BY t.n_dead_tup DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Function to get table sizes
CREATE OR REPLACE FUNCTION table_sizes() 
RETURNS TABLE (
  table_name text,
  row_count bigint,
  total_size text,
  table_size text,
  indexes_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || relname as table_name,
    n_live_tup,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as indexes_size
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(relid) DESC;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- ========== ADD HELPFUL COMMENTS ==========
COMMENT ON FUNCTION check_slow_queries IS 'Returns queries with mean execution time above threshold (default 100ms). Requires pg_stat_statements extension.';
--> statement-breakpoint

COMMENT ON FUNCTION find_unused_indexes IS 'Finds indexes that have never been scanned. Consider dropping these to improve write performance.';
--> statement-breakpoint

COMMENT ON FUNCTION cache_hit_ratio IS 'Returns cache hit ratio (should be >99%). Low ratio means need more shared_buffers or queries are not cached efficiently.';
--> statement-breakpoint

COMMENT ON FUNCTION check_table_bloat IS 'Shows tables with dead tuples that need VACUUM. High dead percentage impacts query performance.';
--> statement-breakpoint

COMMENT ON FUNCTION table_sizes IS 'Shows all tables with their sizes including indexes. Useful for capacity planning.';
