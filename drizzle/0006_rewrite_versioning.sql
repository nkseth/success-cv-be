-- Migration: Add rewrite versioning support
-- This migration adds fields to support proper version switching and content synchronization

-- Add sourceContentSnapshot to store the content at time of rewrite request
ALTER TABLE "resume_rewrites" ADD COLUMN IF NOT EXISTS "sourceContentSnapshot" jsonb;

-- Add wasModifiedAfterApply to track if content was edited after applying a rewrite
ALTER TABLE "resume_rewrites" ADD COLUMN IF NOT EXISTS "wasModifiedAfterApply" boolean DEFAULT false;

-- Add similar columns to candidate_resume_rewrites for B2B flow
ALTER TABLE "candidate_resume_rewrites" ADD COLUMN IF NOT EXISTS "sourceContentSnapshot" jsonb;
ALTER TABLE "candidate_resume_rewrites" ADD COLUMN IF NOT EXISTS "wasModifiedAfterApply" boolean DEFAULT false;

-- Create index for faster queries on active rewrites
CREATE INDEX IF NOT EXISTS "idx_resume_rewrites_active" ON "resume_rewrites" ("analysisID", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_resume_rewrites_status" ON "resume_rewrites" ("status", "userID");
CREATE INDEX IF NOT EXISTS "idx_resume_rewrites_version" ON "resume_rewrites" ("analysisID", "versionNumber");

-- Similar indexes for candidate rewrites
CREATE INDEX IF NOT EXISTS "idx_candidate_rewrites_active" ON "candidate_resume_rewrites" ("analysisID", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "idx_candidate_rewrites_status" ON "candidate_resume_rewrites" ("status", "candidateID");
CREATE INDEX IF NOT EXISTS "idx_candidate_rewrites_version" ON "candidate_resume_rewrites" ("analysisID", "versionNumber");
