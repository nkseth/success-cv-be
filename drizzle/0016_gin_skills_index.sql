-- Drop the existing B-tree index on skills_required and recreate as GIN.
-- GIN indexes support JSONB containment (@>) and overlap (&&) operators
-- used by the job-matching service for skills queries; a B-tree scan is O(N).
DROP INDEX IF EXISTS "jobs_skills_idx";
CREATE INDEX "jobs_skills_idx" ON "jobs" USING gin("skills_required");
