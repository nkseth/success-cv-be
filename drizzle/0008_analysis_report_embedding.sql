-- Migration: Add analysisReport field to resume tables
-- Purpose: Embed analysis report in resume content and rewrites for unified API response
-- This allows frontend to use a single API call to get resume + analysis data

-- Add analysisReport to resume_content table
ALTER TABLE "resume_content" 
ADD COLUMN IF NOT EXISTS "analysisReport" json;

-- Add analysisReport to resume_rewrites table  
ALTER TABLE "resume_rewrites"
ADD COLUMN IF NOT EXISTS "analysisReport" json;

-- Add analysisReport to candidate_resume_content table (B2B)
ALTER TABLE "candidate_resume_content"
ADD COLUMN IF NOT EXISTS "analysisReport" json;

-- Add analysisReport to candidate_resume_rewrites table (B2B)
ALTER TABLE "candidate_resume_rewrites"
ADD COLUMN IF NOT EXISTS "analysisReport" json;
