-- Migration: Add theme configuration support to resume_templates table
-- This migration adds new columns to support the theme system integration

-- Add slug column for URL-friendly identifiers
ALTER TABLE "resume_templates" ADD COLUMN IF NOT EXISTS "slug" varchar(255) UNIQUE;

-- Add preview URL column for full template preview
ALTER TABLE "resume_templates" ADD COLUMN IF NOT EXISTS "previewUrl" varchar(512);

-- Add themeConfig column for storing full theme configuration (follows theme-schema.js structure)
ALTER TABLE "resume_templates" ADD COLUMN IF NOT EXISTS "themeConfig" jsonb;

-- Add isATSOptimized flag for ATS-friendly templates
ALTER TABLE "resume_templates" ADD COLUMN IF NOT EXISTS "isATSOptimized" boolean DEFAULT false NOT NULL;

-- Add usageCount for tracking template popularity
ALTER TABLE "resume_templates" ADD COLUMN IF NOT EXISTS "usageCount" integer DEFAULT 0 NOT NULL;

-- Generate slugs for existing templates that don't have one
UPDATE "resume_templates" 
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
WHERE "slug" IS NULL;

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS "resume_templates_slug_idx" ON "resume_templates" ("slug");

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS "resume_templates_category_idx" ON "resume_templates" ("category");

-- Create index on isATSOptimized for filtering
CREATE INDEX IF NOT EXISTS "resume_templates_ats_optimized_idx" ON "resume_templates" ("isATSOptimized");

-- Comment on the themeConfig column structure
COMMENT ON COLUMN "resume_templates"."themeConfig" IS 'Theme configuration following THEME_CONFIG_SCHEMA: { layout, colors, typography, sections, style }';
