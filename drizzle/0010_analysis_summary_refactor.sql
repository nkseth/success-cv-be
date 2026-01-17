-- Migration: Refactor analysisReport to lightweight analysisSummary
-- This migration renames analysisReport to analysisSummary in resume_content
-- and analysisReport to rewriteSummary in resume_rewrites

-- Rename column in resume_content table
ALTER TABLE "resume_content" 
RENAME COLUMN "analysisReport" TO "analysisSummary";

-- Rename column in resume_rewrites table  
ALTER TABLE "resume_rewrites" 
RENAME COLUMN "analysisReport" TO "rewriteSummary";

-- Rename column in candidate_resume_content table (B2B)
ALTER TABLE "candidate_resume_content" 
RENAME COLUMN "analysisReport" TO "analysisSummary";

-- Rename column in candidate_resume_rewrites table (B2B)
ALTER TABLE "candidate_resume_rewrites" 
RENAME COLUMN "analysisReport" TO "rewriteSummary";
