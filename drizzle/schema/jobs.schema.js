import { boolean, integer, pgTable, timestamp, varchar, text, jsonb, index, uniqueIndex, serial } from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";
import { analysisTable, candidateAnalysisTable } from "./analytics-rewrite-schema.js";
import { resumeRewritesTable, candidateResumeRewritesTable } from "./resume.schema.js";

/**
 * JOB MATCHING SYSTEM SCHEMA
 * 
 * This schema supports:
 * - Periodic scraping of jobs from external sources (Indeed, RemoteOK, etc.)
 * - AI-powered job matching based on analyzed resumes
 * - Job-aware resume rewrites (tailor resume to specific job)
 * - User job preferences and tracking
 * 
 * Workflow:
 * 1. Background worker scrapes jobs every 6 hours → jobs table
 * 2. User has analyzed resume → matching service scores jobs → job_matches table
 * 3. User views matched jobs, can save/apply
 * 4. User requests rewrite for specific job → references jobId in resume_rewrites
 */

// ========== JOBS TABLE ==========
/**
 * Stores job listings scraped from external sources.
 * Jobs are periodically refreshed and deduplicated by external_id + source.
 */
export const jobsTable = pgTable("jobs", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // External source tracking
    externalId: varchar("external_id", { length: 255 }).notNull(), // Job ID from source (Indeed, RemoteOK, etc.)
    source: varchar({ length: 50 }).notNull(), // 'indeed', 'remoteok', 'adzuna', 'stackoverflow', etc.
    
    // Basic job information
    title: varchar({ length: 255 }).notNull(),
    company: varchar({ length: 255 }).notNull(),
    companyLogo: varchar("company_logo", { length: 500 }), // URL to company logo
    location: varchar({ length: 255 }), // City, State or "Remote"
    remoteType: varchar("remote_type", { length: 50 }), // 'remote', 'hybrid', 'onsite', null
    
    // Employment details
    employmentType: varchar("employment_type", { length: 50 }), // 'full-time', 'part-time', 'contract', 'internship'
    experienceLevel: varchar("experience_level", { length: 50 }), // 'entry', 'mid', 'senior', 'lead'
    
    // Compensation
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    currency: varchar({ length: 10 }).default('USD'),
    salaryPeriod: varchar("salary_period", { length: 20 }), // 'yearly', 'monthly', 'hourly'
    
    // Job content (for matching & display)
    description: text(), // nullable — some scrapers (Internshala, LinkedIn-India, Shine) may return null
    requirements: text(),
    responsibilities: text(),
    benefits: text(),
    
    // Structured skills for matching
    /**
     * Skills extracted from job description
     * Structure: {
     *   required: string[], // Must-have skills
     *   preferred: string[], // Nice-to-have skills
     *   technical: string[], // Programming languages, frameworks, tools
     *   soft: string[] // Communication, leadership, etc.
     * }
     */
    skillsRequired: jsonb("skills_required"),
    
    // Education & experience requirements
    educationLevel: varchar("education_level", { length: 100 }), // 'Bachelor', 'Master', 'PhD', etc.
    yearsExperienceMin: integer("years_experience_min"),
    yearsExperienceMax: integer("years_experience_max"),
    
    // Links
    url: varchar({ length: 1000 }).notNull(), // Original job posting URL
    applyUrl: varchar("apply_url", { length: 1000 }), // Direct application URL
    
    // Dates
    postedDate: timestamp("posted_date").notNull(),
    expiresAt: timestamp("expires_at"),
    lastScrapedAt: timestamp("last_scraped_at").defaultNow().notNull(),
    
    // Status
    isActive: boolean("is_active").default(true).notNull(),
    
    // Raw data from source (for debugging/analytics)
    rawData: jsonb("raw_data"),
    
    // Metadata
    meta: jsonb(), // Extra data: industry, tags, etc.
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    // Unique constraint for deduplication
    uniqueIndex("jobs_external_source_unique_idx").on(table.externalId, table.source),
    
    // Search indexes
    index("jobs_title_idx").on(table.title),
    index("jobs_company_idx").on(table.company),
    index("jobs_location_idx").on(table.location),
    index("jobs_remote_type_idx").on(table.remoteType),
    index("jobs_employment_type_idx").on(table.employmentType),
    index("jobs_experience_level_idx").on(table.experienceLevel),
    
    // Filtering indexes
    index("jobs_active_posted_idx").on(table.isActive, table.postedDate),
    index("jobs_source_idx").on(table.source),
    index("jobs_source_active_idx").on(table.source, table.isActive),
    
    // Skills matching (GIN index for JSONB array operations)
    index("jobs_skills_idx").using('gin', table.skillsRequired),
    
    // Date range queries
    index("jobs_posted_date_idx").on(table.postedDate),
    index("jobs_expires_at_idx").on(table.expiresAt),
]);

// ========== JOB MATCHES TABLE ==========
/**
 * Stores pre-computed job matches for users based on their resume analysis.
 * Matches are generated in background and cached for fast retrieval.
 */
export const jobMatchesTable = pgTable("job_matches", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // User references (support both B2C users and B2B candidates)
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }),
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }),
    userType: varchar("user_type", { length: 20 }).notNull(), // 'user' or 'candidate'
    
    // Job reference
    jobID: integer("jobID").references(() => jobsTable.id, { onDelete: 'cascade' }).notNull(),
    
    // Which resume analysis was used for matching
    analysisID: integer("analysisID").references(() => analysisTable.id, { onDelete: 'cascade' }),
    candidateAnalysisID: integer("candidate_analysisID").references(() => candidateAnalysisTable.id, { onDelete: 'cascade' }),
    
    // Match scores (0-100)
    matchScore: integer("match_score").notNull(), // Overall match score
    skillMatchScore: integer("skill_match_score").notNull(),
    experienceMatchScore: integer("experience_match_score").notNull(),
    educationMatchScore: integer("education_match_score").notNull(),
    locationMatch: boolean("location_match").default(false),
    
    // Detailed matching analysis
    /**
     * Structure: {
     *   matchedSkills: string[], // Skills from resume that match job
     *   missingSkills: string[], // Job requirements not in resume
     *   strengthAreas: string[], // Areas where user excels
     *   improvementAreas: string[], // Areas to highlight in application
     *   fitReason: string // AI-generated explanation
     * }
     */
    matchReasons: jsonb("match_reasons"),
    mismatchReasons: jsonb("mismatch_reasons"),
    
    // User actions
    status: varchar({ length: 50 }).default('new').notNull(), // 'new', 'viewed', 'saved', 'applied', 'rejected', 'archived'
    isSaved: boolean("is_saved").default(false).notNull(),
    isApplied: boolean("is_applied").default(false).notNull(),
    appliedAt: timestamp("applied_at"),
    viewedAt: timestamp("viewed_at"),
    
    // User notes
    notes: text(),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    // Ensure one match per user/job/analysis combination
    uniqueIndex("job_matches_unique_idx").on(table.userType, table.jobID, table.analysisID),
    
    // User lookups (separate indexes for B2C vs B2B)
    index("job_matches_user_idx").on(table.userID),
    index("job_matches_candidate_idx").on(table.candidateID),
    
    // Job lookups
    index("job_matches_job_idx").on(table.jobID),
    
    // Analysis lookups
    index("job_matches_analysis_idx").on(table.analysisID),
    index("job_matches_candidate_analysis_idx").on(table.candidateAnalysisID),
    
    // Score-based filtering (descending for sorting)
    index("job_matches_user_score_idx").on(table.userID, table.matchScore),
    index("job_matches_candidate_score_idx").on(table.candidateID, table.matchScore),
    
    // Status filtering
    index("job_matches_status_idx").on(table.status),
    index("job_matches_user_status_idx").on(table.userID, table.status),
    index("job_matches_candidate_status_idx").on(table.candidateID, table.status),
    
    // Saved/Applied filtering
    index("job_matches_saved_idx").on(table.isSaved),
    index("job_matches_applied_idx").on(table.isApplied),
    
    // Date-based queries
    index("job_matches_created_idx").on(table.createdAt),
]);

// ========== JOB SCRAPING LOGS TABLE ==========
/**
 * Tracks job scraping runs for monitoring and debugging.
 * One record per scraping run per source.
 */
export const jobScrapingLogsTable = pgTable("job_scraping_logs", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // Source info
    source: varchar({ length: 50 }).notNull(), // 'indeed', 'remoteok', etc.
    
    // Run status
    status: varchar({ length: 50 }).notNull(), // 'running', 'completed', 'failed', 'partial'
    
    // Statistics
    jobsFound: integer("jobs_found").default(0), // Total jobs in source response
    jobsNew: integer("jobs_new").default(0), // New jobs added
    jobsUpdated: integer("jobs_updated").default(0), // Existing jobs updated
    jobsDeactivated: integer("jobs_deactivated").default(0), // Jobs marked inactive
    
    // Timing
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    duration: integer(), // Duration in milliseconds
    
    // Error tracking
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    
    // Request metadata
    requestParams: jsonb("request_params"), // Search params used
    rateLimitHit: boolean("rate_limit_hit").default(false),
    
    // Worker info
    workerID: varchar("workerID", { length: 100 }), // Which worker processed
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    // Source lookups
    index("job_scraping_logs_source_idx").on(table.source),
    
    // Status filtering
    index("job_scraping_logs_status_idx").on(table.status),
    
    // Date-based queries
    index("job_scraping_logs_created_idx").on(table.createdAt),
    index("job_scraping_logs_started_idx").on(table.startedAt),
    
    // Composite for source performance tracking
    index("job_scraping_logs_source_status_idx").on(table.source, table.status),
]);

// ========== USER JOB PREFERENCES TABLE ==========
/**
 * Stores user preferences for job matching and notifications.
 * Optional feature - can enable smarter matching and email alerts.
 */
export const userJobPreferencesTable = pgTable("user_job_preferences", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // User references (support both B2C users and B2B candidates)
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }).unique(),
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }).unique(),
    userType: varchar("user_type", { length: 20 }).notNull(), // 'user' or 'candidate'
    
    // Job preferences
    /**
     * Preferred job titles (flexible matching)
     * e.g., ["Software Engineer", "Full Stack Developer", "Backend Engineer"]
     */
    preferredTitles: jsonb("preferred_titles"),
    
    /**
     * Preferred locations
     * e.g., ["San Francisco, CA", "New York, NY", "Remote"]
     */
    preferredLocations: jsonb("preferred_locations"),
    
    /**
     * Remote work preference
     * 'remote_only', 'hybrid', 'onsite', 'no_preference'
     */
    remotePreference: varchar("remote_preference", { length: 50 }),
    
    /**
     * Employment types
     * e.g., ["full-time", "contract"]
     */
    employmentTypes: jsonb("employment_types"),
    
    /**
     * Experience levels interested in
     * e.g., ["mid", "senior"]
     */
    experienceLevels: jsonb("experience_levels"),
    
    // Compensation preferences
    minSalary: integer("min_salary"),
    maxSalary: integer("max_salary"),
    currency: varchar({ length: 10 }).default('USD'),
    
    /**
     * Excluded companies (blacklist)
     * e.g., ["Company A", "Company B"]
     */
    excludedCompanies: jsonb("excluded_companies"),
    
    /**
     * Required skills/keywords (must be in job)
     * e.g., ["React", "Node.js"]
     */
    mustHaveSkills: jsonb("must_have_skills"),
    
    // Notification preferences
    notificationEnabled: boolean("notification_enabled").default(true),
    notificationFrequency: varchar("notification_frequency", { length: 50 }).default('daily'), // 'realtime', 'daily', 'weekly', 'never'
    minMatchScoreForNotification: integer("min_match_score_notification").default(70), // Only notify for matches above this
    lastNotificationAt: timestamp("last_notification_at"),
    
    // Metadata
    meta: jsonb(),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    // User lookups
    index("user_job_preferences_user_idx").on(table.userID),
    index("user_job_preferences_candidate_idx").on(table.candidateID),
    
    // Notification queries
    index("user_job_preferences_notification_idx").on(table.notificationEnabled, table.lastNotificationAt),
]);
