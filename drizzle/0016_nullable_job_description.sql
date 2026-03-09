-- Migration: 0016_nullable_job_description
-- Description: Drop NOT NULL constraint on jobs.description
--   Several Indian board scrapers (Internshala, LinkedIn-India, Shine) legitimately
--   return null descriptions. Keeping NOT NULL causes constraint violations on every
--   upsert for those sources.

ALTER TABLE "jobs" ALTER COLUMN "description" DROP NOT NULL;
