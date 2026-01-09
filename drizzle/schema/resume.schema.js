import { boolean, integer, pgTable, timestamp, varchar, text, json } from "drizzle-orm/pg-core";
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
     * Analysis report containing issues and improvement suggestions.
     * For initial upload: Contains issues found during analysis
     * When rewrite is active: Contains issues resolved vs remaining
     * Structure: {
     *   criticalMistakes: Array<{ issue, impact, fix_suggestion }>,
     *   majorIssues: Array<{ issue, impact, fix_suggestion }>,
     *   minorImprovements: Array<{ area, suggestion }>,
     *   resumeQuality: { ats_compatibility_score, content_quality_score, ... },
     *   optimizationOpportunities: Array<string>,
     *   version: 'initial' | 'rewrite_v1' | 'rewrite_v2' | ...
     * }
     */
    analysisReport: json(),
    
    // Version tracking
    version: integer().default(1).notNull(),
    lastEditType: varchar({ length: 20 }).default('initial'), // 'initial', 'manual', 'ai_rewrite'
    lastEditedSection: varchar({ length: 50 }),
    
    // Active rewrite reference (if content came from a rewrite)
    activeRewriteID: integer("activeRewriteID"),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});

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
     * Post-rewrite analysis report showing what was fixed.
     * Structure: {
     *   resolvedIssues: Array<{ issue, howFixed }>,
     *   remainingIssues: Array<{ issue, impact, fix_suggestion }>,
     *   newScores: { atsScore, contentScore, ... },
     *   improvementSummary: string,
     *   version: 'rewrite_v1' | 'rewrite_v2' | ...
     * }
     */
    analysisReport: json(),
    
    // Whether this rewrite is currently active (applied to resumeContent)
    isActive: boolean().default(false).notNull(),
    appliedAt: timestamp(),
    
    // Track if content has been modified after this rewrite was applied
    wasModifiedAfterApply: boolean().default(false),
    
    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
});

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
});

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
});

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
    analysisReport: json(), // Same structure as user resume analysisReport
    version: integer().default(1).notNull(),
    lastEditType: varchar({ length: 20 }).default('initial'),
    lastEditedSection: varchar({ length: 50 }),
    activeRewriteID: integer("activeRewriteID"),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});

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
    analysisReport: json(), // Same structure as user resume rewrite analysisReport
    
    isActive: boolean().default(false).notNull(),
    appliedAt: timestamp(),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
});

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
});
