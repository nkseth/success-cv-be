-- Fix: The old unique index on job_matches only used analysisID, which is NULL
-- for candidates (they use candidate_analysisID). SQL treats NULL != NULL, so
-- the constraint never prevented duplicate candidate matches.
--
-- Solution: Drop the old index and create a new one using COALESCE so that
-- candidates are properly deduplicated.

-- Drop the broken unique index
DROP INDEX IF EXISTS "job_matches_unique_idx";

-- ── Pre-migration safety checks ───────────────────────────────────────────

-- 1. Verify that every row has exactly one of analysisID / candidate_analysisID set
--    (i.e. the XOR invariant holds).  If this query returns any rows, fix the data
--    before running the migration.
DO $$
DECLARE
    bad_rows INTEGER;
BEGIN
    SELECT COUNT(*) INTO bad_rows
    FROM "job_matches"
    WHERE
        -- Both NULL (neither set)
        ("analysisID" IS NULL AND "candidate_analysisID" IS NULL)
        OR
        -- Both non-NULL (both set)
        ("analysisID" IS NOT NULL AND "candidate_analysisID" IS NOT NULL);

    IF bad_rows > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % row(s) in job_matches violate the XOR invariant '
            '(exactly one of analysisID / candidate_analysisID must be non-NULL). '
            'Fix these rows before retrying.', bad_rows;
    END IF;
END;
$$;

-- 2. Detect and remove duplicate rows that would violate the new unique index.
--    Keeps the row with the lowest id (earliest insert) and deletes all others.
DELETE FROM "job_matches"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "job_matches"
    GROUP BY "user_type", "jobID", COALESCE("analysisID", "candidate_analysisID")
);

-- 3. Add a CHECK constraint to enforce the XOR invariant going forward.
ALTER TABLE "job_matches"
    ADD CONSTRAINT "job_matches_analysis_xor"
    CHECK (
        ("analysisID" IS NULL) <> ("candidate_analysisID" IS NULL)
    );

-- ── Create the corrected unique index ────────────────────────────────────────
-- Create the fixed unique index that works for both users and candidates
CREATE UNIQUE INDEX "job_matches_unique_v2_idx"
  ON "job_matches" ("user_type", "jobID", COALESCE("analysisID", "candidate_analysisID"));
