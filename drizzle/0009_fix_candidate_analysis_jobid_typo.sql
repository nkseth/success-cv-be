-- Rename jpbID to jobID (fixing typo) - preserve any existing data
ALTER TABLE "candidate_analyses" RENAME COLUMN "jpbID" TO "jobID";--> statement-breakpoint
ALTER TABLE "candidate_resume_content" ADD COLUMN IF NOT EXISTS "analysisSummary" json;--> statement-breakpoint
ALTER TABLE "candidate_resume_rewrites" ADD COLUMN IF NOT EXISTS "rewriteSummary" json;--> statement-breakpoint
ALTER TABLE "resume_content" ADD COLUMN IF NOT EXISTS "analysisSummary" json;--> statement-breakpoint
ALTER TABLE "resume_rewrites" ADD COLUMN IF NOT EXISTS "rewriteSummary" json;