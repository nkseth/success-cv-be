-- Fix: The old unique index on job_matches only used analysisID, which is NULL
-- for candidates (they use candidate_analysisID). SQL treats NULL != NULL, so
-- the constraint never prevented duplicate candidate matches.
--
-- Solution: Drop the old index and create a new one using COALESCE so that
-- candidates are properly deduplicated.

-- Drop the broken unique index
DROP INDEX IF EXISTS "job_matches_unique_idx";

-- Create the fixed unique index that works for both users and candidates
CREATE UNIQUE INDEX "job_matches_unique_v2_idx"
  ON "job_matches" ("user_type", "jobID", COALESCE("analysisID", "candidate_analysisID"));
