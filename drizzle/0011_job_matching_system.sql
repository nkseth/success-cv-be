-- Migration: Job Matching System
-- Created: 2026-01-26
-- Description: Add tables for job scraping, matching, and job-aware resume rewrites

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- ========== JOBS TABLE ==========
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"company" varchar(255) NOT NULL,
	"company_logo" varchar(500),
	"location" varchar(255),
	"remote_type" varchar(50),
	"employment_type" varchar(50),
	"experience_level" varchar(50),
	"salary_min" integer,
	"salary_max" integer,
	"currency" varchar(10) DEFAULT 'USD',
	"salary_period" varchar(20),
	"description" text NOT NULL,
	"requirements" text,
	"responsibilities" text,
	"benefits" text,
	"skills_required" jsonb,
	"education_level" varchar(100),
	"years_experience_min" integer,
	"years_experience_max" integer,
	"url" varchar(1000) NOT NULL,
	"apply_url" varchar(1000),
	"posted_date" timestamp NOT NULL,
	"expires_at" timestamp,
	"last_scraped_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"raw_data" jsonb,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create unique index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_external_source_unique_idx" ON "jobs" USING btree ("external_id","source");
--> statement-breakpoint

-- Create search indexes
CREATE INDEX IF NOT EXISTS "jobs_title_idx" ON "jobs" USING btree ("title");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_company_idx" ON "jobs" USING btree ("company");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_location_idx" ON "jobs" USING btree ("location");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_remote_type_idx" ON "jobs" USING btree ("remote_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_employment_type_idx" ON "jobs" USING btree ("employment_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_experience_level_idx" ON "jobs" USING btree ("experience_level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_active_posted_idx" ON "jobs" USING btree ("is_active","posted_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_source_idx" ON "jobs" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_source_active_idx" ON "jobs" USING btree ("source","is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_posted_date_idx" ON "jobs" USING btree ("posted_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_expires_at_idx" ON "jobs" USING btree ("expires_at");
--> statement-breakpoint

-- Create GIN index for JSONB skills array operations
CREATE INDEX IF NOT EXISTS "jobs_skills_idx" ON "jobs" USING gin ("skills_required" jsonb_path_ops);
--> statement-breakpoint

-- Create trigram indexes for fuzzy text search on title and company
CREATE INDEX IF NOT EXISTS "jobs_title_trgm_idx" ON "jobs" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_company_trgm_idx" ON "jobs" USING gin ("company" gin_trgm_ops);
--> statement-breakpoint

-- ========== JOB MATCHES TABLE ==========
CREATE TABLE IF NOT EXISTS "job_matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer REFERENCES "users"("id") ON DELETE cascade,
	"candidateID" integer REFERENCES "candidates"("id") ON DELETE cascade,
	"user_type" varchar(20) NOT NULL,
	"jobID" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"analysisID" integer REFERENCES "analyses"("id") ON DELETE cascade,
	"candidate_analysisID" integer REFERENCES "candidate_analyses"("id") ON DELETE cascade,
	"match_score" integer NOT NULL,
	"skill_match_score" integer NOT NULL,
	"experience_match_score" integer NOT NULL,
	"education_match_score" integer NOT NULL,
	"location_match" boolean DEFAULT false,
	"match_reasons" jsonb,
	"mismatch_reasons" jsonb,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"is_saved" boolean DEFAULT false NOT NULL,
	"is_applied" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp,
	"viewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create unique index to prevent duplicate matches
CREATE UNIQUE INDEX IF NOT EXISTS "job_matches_unique_idx" ON "job_matches" USING btree ("user_type","jobID","analysisID") WHERE "analysisID" IS NOT NULL;
--> statement-breakpoint

-- Create user lookup indexes
CREATE INDEX IF NOT EXISTS "job_matches_user_idx" ON "job_matches" USING btree ("userID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_candidate_idx" ON "job_matches" USING btree ("candidateID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_job_idx" ON "job_matches" USING btree ("jobID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_analysis_idx" ON "job_matches" USING btree ("analysisID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_candidate_analysis_idx" ON "job_matches" USING btree ("candidate_analysisID");
--> statement-breakpoint

-- Create score-based indexes for sorting
CREATE INDEX IF NOT EXISTS "job_matches_user_score_idx" ON "job_matches" USING btree ("userID","match_score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_candidate_score_idx" ON "job_matches" USING btree ("candidateID","match_score");
--> statement-breakpoint

-- Create status filtering indexes
CREATE INDEX IF NOT EXISTS "job_matches_status_idx" ON "job_matches" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_user_status_idx" ON "job_matches" USING btree ("userID","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_candidate_status_idx" ON "job_matches" USING btree ("candidateID","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_saved_idx" ON "job_matches" USING btree ("is_saved");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_applied_idx" ON "job_matches" USING btree ("is_applied");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_created_idx" ON "job_matches" USING btree ("created_at");
--> statement-breakpoint

-- ========== JOB SCRAPING LOGS TABLE ==========
CREATE TABLE IF NOT EXISTS "job_scraping_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_scraping_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"jobs_found" integer DEFAULT 0,
	"jobs_new" integer DEFAULT 0,
	"jobs_updated" integer DEFAULT 0,
	"jobs_deactivated" integer DEFAULT 0,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"error_message" text,
	"error_stack" text,
	"request_params" jsonb,
	"rate_limit_hit" boolean DEFAULT false,
	"workerID" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create indexes for log queries
CREATE INDEX IF NOT EXISTS "job_scraping_logs_source_idx" ON "job_scraping_logs" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_scraping_logs_status_idx" ON "job_scraping_logs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_scraping_logs_created_idx" ON "job_scraping_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_scraping_logs_started_idx" ON "job_scraping_logs" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_scraping_logs_source_status_idx" ON "job_scraping_logs" USING btree ("source","status");
--> statement-breakpoint

-- ========== USER JOB PREFERENCES TABLE ==========
CREATE TABLE IF NOT EXISTS "user_job_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_job_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userID" integer UNIQUE REFERENCES "users"("id") ON DELETE cascade,
	"candidateID" integer UNIQUE REFERENCES "candidates"("id") ON DELETE cascade,
	"user_type" varchar(20) NOT NULL,
	"preferred_titles" jsonb,
	"preferred_locations" jsonb,
	"remote_preference" varchar(50),
	"employment_types" jsonb,
	"experience_levels" jsonb,
	"min_salary" integer,
	"max_salary" integer,
	"currency" varchar(10) DEFAULT 'USD',
	"excluded_companies" jsonb,
	"must_have_skills" jsonb,
	"notification_enabled" boolean DEFAULT true,
	"notification_frequency" varchar(50) DEFAULT 'daily',
	"min_match_score_notification" integer DEFAULT 70,
	"last_notification_at" timestamp,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create indexes for preferences lookups
CREATE INDEX IF NOT EXISTS "user_job_preferences_user_idx" ON "user_job_preferences" USING btree ("userID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_job_preferences_candidate_idx" ON "user_job_preferences" USING btree ("candidateID");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_job_preferences_notification_idx" ON "user_job_preferences" USING btree ("notification_enabled","last_notification_at");
--> statement-breakpoint

-- ========== ADD JOB-AWARE COLUMNS TO RESUME REWRITES ==========
-- Add columns for job-aware resume rewrites
ALTER TABLE "resume_rewrites" 
ADD COLUMN IF NOT EXISTS "target_job_id" integer,
ADD COLUMN IF NOT EXISTS "source_resume_id" integer REFERENCES "resume_content"("id");
--> statement-breakpoint

-- Create indexes for job-aware columns
CREATE INDEX IF NOT EXISTS "resume_rewrites_target_job_id_idx" ON "resume_rewrites" USING btree ("target_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_rewrites_source_resume_id_idx" ON "resume_rewrites" USING btree ("source_resume_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_rewrites_user_target_job_idx" ON "resume_rewrites" USING btree ("userID","target_job_id");
--> statement-breakpoint

-- Add columns for candidate resume rewrites
ALTER TABLE "candidate_resume_rewrites" 
ADD COLUMN IF NOT EXISTS "target_job_id" integer,
ADD COLUMN IF NOT EXISTS "source_resume_id" integer REFERENCES "candidate_resume_content"("id");
--> statement-breakpoint

-- Create indexes for candidate job-aware columns
CREATE INDEX IF NOT EXISTS "candidate_resume_rewrites_target_job_id_idx" ON "candidate_resume_rewrites" USING btree ("target_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_resume_rewrites_source_resume_id_idx" ON "candidate_resume_rewrites" USING btree ("source_resume_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_resume_rewrites_candidate_target_job_idx" ON "candidate_resume_rewrites" USING btree ("candidateID","target_job_id");
