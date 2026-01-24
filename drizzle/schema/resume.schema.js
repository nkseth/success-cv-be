import { boolean, integer, pgTable, timestamp, varchar, text, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";
import { analysisTable, candidateAnalysisTable } from "./analytics-rewrite-schema.js";

/**
 * UNIFIED RESUME SYSTEM SCHEMA
 * 
 * This schema consolidates resume content, rewrites, and theming into a simpler structure:
 * 
 * Workflow:
 * 1. User uploads resume → Document created
 * 2. Analysis runs → Analysis record + ProcessedData created
 * 3. Resume Content created from analysis (initial state)
 * 4. User can:
 *    - Manually edit sections (updates resumeContent)
 *    - Request AI rewrite (creates rewrite record, updates resumeContent)
 *    - Apply/customize theme (presentation layer)
 * 
 * Key principles:
 * - ONE analysis per document
 * - MULTIPLE rewrites possible (each rewrite is a version)
 * - Resume content is the CURRENT state (single source of truth)
 * - Themes are pure presentation (separate from content)
 */

// ========== RESUME CONTENT TABLE ==========
/**
 * Stores the current state of a resume's content.
 * This is THE source of truth for resume data.
 * Both manual edits and AI rewrites update this table.
 */
export const resumeContentTable = pgTable("resume_content", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // Ownership
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),
    analysisID: integer("analysisID").references(() => analysisTable.id, { onDelete: 'cascade' }).notNull(),
    
    // Structured resume sections (JSON for flexibility)
    /**
     * Personal Info: { fullName, email, phone, location, linkedin, website, etc. }
     */
    personalInfo: json(),
    
    /**
     * Professional Summary: { summary: string, keywords: string[] }
     */
    summary: json(),
    
    /**
     * Work Experience: Array of {
     *   id, company, position, location, startDate, endDate, current,
     *   description, achievements: string[], keywords: string[]
     * }
     */
    experience: json(),
    
    /**
     * Education: Array of {
     *   id, institution, degree, field, location, startDate, endDate,
     *   gpa, honors, achievements: string[]
     * }
     */
    education: json(),
    
    /**
     * Skills: {
     *   technical: string[],
     *   soft: string[],
     *   languages: string[],
     *   tools: string[],
     *   certifications: string[]
     * }
     */
    skills: json(),
    
    /**
     * Additional sections: Array of {
     *   id, title, type, content (flexible based on type)
     * }
     * For: projects, publications, awards, volunteer, etc.
     */
    additionalSections: json(),
    
    // Current ATS/Quality scores (updated after each edit/rewrite)
    currentScores: json(), // { atsScore, contentScore, formatScore, overallScore }
    
    /**
     * Lightweight analysis summary for display purposes.
     * Full analysis data lives in processedAndRawDataTable and is fetched via analysisID.
     * When a rewrite is active, this shows what was improved.
     * Structure: {
     *   issuesCounts: { critical: number, major: number, minor: number },
     *   improvementSummary: string (what was fixed/changed),
     *   scoreChange: { before: number, after: number },
     *   version: 'initial' | 'rewrite_v1' | 'rewrite_v2' | ...,
     *   updatedAt: timestamp
     * }
     */
    analysisSummary: json(),
    
    // Version tracking
    version: integer().default(1).notNull(),
    lastEditType: varchar({ length: 20 }).default('initial'), // 'initial', 'manual', 'ai_rewrite'
    lastEditedSection: varchar({ length: 50 }),
    
    // Active rewrite reference (if content came from a rewrite)
    activeRewriteID: integer("activeRewriteID"),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    // Index for user resume lookup (very frequent)
    index("resume_content_user_id_idx").on(table.userID),
    // Unique index for analysis (1:1 relationship)
    uniqueIndex("resume_content_analysis_id_idx").on(table.analysisID),
    // Composite index for user + analysis lookups
    index("resume_content_user_analysis_idx").on(table.userID, table.analysisID),
    // Index for last edit type filtering
    index("resume_content_last_edit_type_idx").on(table.lastEditType),
    // Index for active rewrite lookups
    index("resume_content_active_rewrite_idx").on(table.activeRewriteID),
    // Index for updated_at ordering (recent resumes)
    index("resume_content_updated_at_idx").on(table.updatedAt),
    // Index for created_at ordering
    index("resume_content_created_at_idx").on(table.createdAt),
]);

// ========== RESUME REWRITES TABLE ==========
/**
 * Tracks AI rewrite jobs and their results.
 * Each rewrite is a version - users can have multiple rewrites.
 * When a rewrite is applied, it updates resumeContent.
 * 
 * VERSION SWITCHING WORKFLOW:
 * 1. User creates rewrite → captures sourceContentSnapshot (current resume state)
 * 2. AI generates optimized content → stored in rewrittenContent
 * 3. User can preview rewrittenContent before applying
 * 4. When user applies rewrite → resumeContent updated with rewrittenContent
 * 5. User can switch to any completed rewrite version:
 *    - Switching applies that version's rewrittenContent to resumeContent
 *    - The isActive flag tracks which version is currently applied
 * 6. User can edit resume after applying a rewrite
 *    - New rewrite will be based on the current (possibly edited) content
 */
export const resumeRewritesTable = pgTable("resume_rewrites", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // References
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),
    analysisID: integer("analysisID").references(() => analysisTable.id, { onDelete: 'cascade' }).notNull(),
    resumeContentID: integer("resumeContentID").references(() => resumeContentTable.id, { onDelete: 'cascade' }),
    
    // Rewrite job info
    jobID: varchar({ length: 255 }), // BullMQ job ID
    status: varchar({ length: 50 }).default("pending").notNull(), // pending, processing, completed, failed
    
    // Rewrite version info
    versionNumber: integer().default(1).notNull(),
    versionLabel: varchar({ length: 100 }), // Optional user-friendly label like "ATS Optimized v2"
    
    // Optimization settings used for this rewrite
    optimizationSettings: json(), // { targetATSScore, focusAreas, optimizationLevel }
    
    /**
     * Snapshot of resume content at time of rewrite request.
     * This captures what the resume looked like BEFORE AI optimization.
     * Useful for:
     * - Comparison with rewritten version
     * - Understanding what content the AI was working with
     * - Audit trail of changes
     */
    sourceContentSnapshot: json(), // { personalInfo, summary, experience, education, skills, additionalSections, scores }
    
    // Rewritten content (stored separately until user applies it)
    /**
     * Same structure as resumeContent fields but stores the AI-generated version.
     * User can preview before applying to main resumeContent.
     * This content is immutable once created - edits go to resumeContent.
     */
    rewrittenContent: json(), // Full rewritten resume object
    
    // Improvement metrics
    improvements: json(), // { before: scores, after: scores, changes: [] }
    
    /**
     * Lightweight summary of what was fixed/improved in this rewrite.
     * Full analysis comparison can be fetched via analysisID.
     * Structure: {
     *   improvementSummary: string,
     *   resolvedCounts: { critical: number, major: number, minor: number },
     *   scoreComparison: { before: { atsScore, ... }, after: { atsScore, ... }, improvement: { atsScore, ... } },
     *   version: 'rewrite_v1' | 'rewrite_v2' | ...,
     *   generatedAt: timestamp
     * }
     */
    rewriteSummary: json(),
    
    // Whether this rewrite is currently active (applied to resumeContent)
    isActive: boolean().default(false).notNull(),
    appliedAt: timestamp(),
    
    // Track if content has been modified after this rewrite was applied
    wasModifiedAfterApply: boolean().default(false),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
}, (table) => [
    // Index for user rewrites lookup
    index("resume_rewrites_user_id_idx").on(table.userID),
    // Index for analysis rewrites lookup
    index("resume_rewrites_analysis_id_idx").on(table.analysisID),
    // Index for resume content rewrites lookup
    index("resume_rewrites_content_id_idx").on(table.resumeContentID),
    // Index for status filtering (pending, processing, completed, failed)
    index("resume_rewrites_status_idx").on(table.status),
    // Index for job ID lookup (queue tracking)
    index("resume_rewrites_job_id_idx").on(table.jobID),
    // Composite index for user + status lookups
    index("resume_rewrites_user_status_idx").on(table.userID, table.status),
    // Index for active rewrites
    index("resume_rewrites_active_idx").on(table.isActive),
    // Composite index for finding active rewrite for a content
    index("resume_rewrites_content_active_idx").on(table.resumeContentID, table.isActive),
    // Index for version number ordering
    index("resume_rewrites_version_idx").on(table.versionNumber),
    // Index for created_at ordering
    index("resume_rewrites_created_at_idx").on(table.createdAt),
]);

// ========== RESUME THEMES TABLE ==========
/**
 * Predefined resume themes (presentation/styling only).
 * Themes define how content is displayed, not the content itself.
 */
export const resumeThemesTable = pgTable("resume_themes", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // Basic info
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    description: text(),
    category: varchar({ length: 50 }).notNull(), // 'professional', 'creative', 'minimal', 'ats-optimized', 'academic'
    
    // Theme configuration (pure presentation)
    /**
     * {
     *   layout: { columns: 1|2, orientation: 'portrait', pageSize: 'A4'|'Letter' },
     *   colors: { primary, secondary, accent, text, background },
     *   typography: { fontFamily, headingSize, bodySize, lineHeight },
     *   spacing: { margins, sectionGap, itemGap },
     *   sectionOrder: ['personalInfo', 'summary', 'experience', ...],
     *   sectionStyles: { experience: { showDates: true, bulletStyle: 'circle' }, ... }
     * }
     */
    config: json().notNull(),
    
    // Preview
    thumbnailURL: varchar({ length: 512 }),
    previewURL: varchar({ length: 512 }),
    
    // Flags
    isSystemTheme: boolean().default(true).notNull(),
    isATSOptimized: boolean().default(false).notNull(),
    isPublic: boolean().default(true).notNull(),
    
    // Popularity metrics
    usageCount: integer().default(0).notNull(),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    // Index for category-based filtering
    index("resume_themes_category_idx").on(table.category),
    // Index for public themes listing
    index("resume_themes_public_idx").on(table.isPublic),
    // Index for ATS-optimized themes
    index("resume_themes_ats_idx").on(table.isATSOptimized),
    // Composite index for public + category + ATS (common filter combo)
    index("resume_themes_public_category_ats_idx").on(table.isPublic, table.category, table.isATSOptimized),
    // Index for system themes
    index("resume_themes_system_idx").on(table.isSystemTheme),
    // Index for usage count (popularity)
    index("resume_themes_usage_count_idx").on(table.usageCount),
]);

// ========== USER RESUME THEME TABLE ==========
/**
 * Stores user's applied theme and customizations for their resume.
 * Links resumeContent to a theme with optional overrides.
 */
export const userResumeThemeTable = pgTable("user_resume_themes", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // References
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),
    resumeContentID: integer("resumeContentID").references(() => resumeContentTable.id, { onDelete: 'cascade' }).notNull(),
    themeID: integer("themeID").references(() => resumeThemesTable.id, { onDelete: 'set null' }),
    
    // Custom overrides (merges with base theme config)
    customOverrides: json(), // Partial theme config to override specific values
    
    // Section visibility and order overrides
    sectionVisibility: json(), // { experience: true, education: true, ... }
    sectionOrder: json(), // ['personalInfo', 'summary', 'experience', ...]
    
    // State
    isDraft: boolean().default(true).notNull(),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    publishedAt: timestamp(),
}, (table) => [
    // Index for user theme lookup
    index("user_resume_themes_user_id_idx").on(table.userID),
    // Unique index for resume content (1:1 relationship)
    uniqueIndex("user_resume_themes_content_id_idx").on(table.resumeContentID),
    // Index for theme lookup
    index("user_resume_themes_theme_id_idx").on(table.themeID),
    // Index for draft status
    index("user_resume_themes_draft_idx").on(table.isDraft),
]);

// ========== CANDIDATE VERSIONS (for B2B) ==========

/**
 * Resume content for candidates (B2B flow)
 */
export const candidateResumeContentTable = pgTable("candidate_resume_content", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }).notNull(),
    analysisID: integer("analysisID").references(() => candidateAnalysisTable.id, { onDelete: 'cascade' }).notNull(),
    
    personalInfo: json(),
    summary: json(),
    experience: json(),
    education: json(),
    skills: json(),
    additionalSections: json(),
    
    currentScores: json(),
    analysisSummary: json(), // Same structure as user resume analysisSummary
    version: integer().default(1).notNull(),
    lastEditType: varchar({ length: 20 }).default('initial'),
    lastEditedSection: varchar({ length: 50 }),
    activeRewriteID: integer("activeRewriteID"),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    // Index for candidate resume lookup (very frequent)
    index("candidate_resume_content_candidate_id_idx").on(table.candidateID),
    // Unique index for analysis (1:1 relationship)
    uniqueIndex("candidate_resume_content_analysis_id_idx").on(table.analysisID),
    // Composite index for candidate + analysis lookups
    index("candidate_resume_content_candidate_analysis_idx").on(table.candidateID, table.analysisID),
    // Index for last edit type filtering
    index("candidate_resume_content_last_edit_type_idx").on(table.lastEditType),
    // Index for active rewrite lookups
    index("candidate_resume_content_active_rewrite_idx").on(table.activeRewriteID),
    // Index for updated_at ordering
    index("candidate_resume_content_updated_at_idx").on(table.updatedAt),
]);

/**
 * Resume rewrites for candidates (B2B flow)
 */
export const candidateResumeRewritesTable = pgTable("candidate_resume_rewrites", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }).notNull(),
    analysisID: integer("analysisID").references(() => candidateAnalysisTable.id, { onDelete: 'cascade' }).notNull(),
    resumeContentID: integer("resumeContentID").references(() => candidateResumeContentTable.id, { onDelete: 'cascade' }),
    
    jobID: varchar({ length: 255 }),
    status: varchar({ length: 50 }).default("pending").notNull(),
    
    versionNumber: integer().default(1).notNull(),
    versionLabel: varchar({ length: 100 }),
    
    optimizationSettings: json(),
    rewrittenContent: json(),
    improvements: json(),
    rewriteSummary: json(), // Same structure as user resume rewrite rewriteSummary
    
    isActive: boolean().default(false).notNull(),
    appliedAt: timestamp(),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
}, (table) => [
    // Index for candidate rewrites lookup
    index("candidate_resume_rewrites_candidate_id_idx").on(table.candidateID),
    // Index for analysis rewrites lookup
    index("candidate_resume_rewrites_analysis_id_idx").on(table.analysisID),
    // Index for resume content rewrites lookup
    index("candidate_resume_rewrites_content_id_idx").on(table.resumeContentID),
    // Index for status filtering
    index("candidate_resume_rewrites_status_idx").on(table.status),
    // Index for job ID lookup
    index("candidate_resume_rewrites_job_id_idx").on(table.jobID),
    // Composite index for candidate + status lookups
    index("candidate_resume_rewrites_candidate_status_idx").on(table.candidateID, table.status),
    // Index for active rewrites
    index("candidate_resume_rewrites_active_idx").on(table.isActive),
    // Composite index for finding active rewrite for a content
    index("candidate_resume_rewrites_content_active_idx").on(table.resumeContentID, table.isActive),
]);

/**
 * User resume theme for candidates
 */
export const candidateResumeThemeTable = pgTable("candidate_resume_themes", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }).notNull(),
    resumeContentID: integer("resumeContentID").references(() => candidateResumeContentTable.id, { onDelete: 'cascade' }).notNull(),
    themeID: integer("themeID").references(() => resumeThemesTable.id, { onDelete: 'set null' }),
    
    customOverrides: json(),
    sectionVisibility: json(),
    sectionOrder: json(),
    
    isDraft: boolean().default(true).notNull(),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    publishedAt: timestamp(),
}, (table) => [
    // Index for candidate theme lookup
    index("candidate_resume_themes_candidate_id_idx").on(table.candidateID),
    // Unique index for resume content (1:1 relationship)
    uniqueIndex("candidate_resume_themes_content_id_idx").on(table.resumeContentID),
    // Index for theme lookup
    index("candidate_resume_themes_theme_id_idx").on(table.themeID),
    // Index for draft status
    index("candidate_resume_themes_draft_idx").on(table.isDraft),
]);
