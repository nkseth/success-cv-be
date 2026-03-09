import { integer, pgTable, timestamp, varchar, text, json, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth.js";
import { resumeContentTable } from "./resume.schema.js";

/**
 * Career Roadmaps Table
 *
 * Stores AI-generated career roadmaps for users.
 * Each roadmap is linked to a specific resume_content (source of truth).
 * The AI generates multiple career path options; users select one.
 *
 * Flow:
 *   User selects a resume → answers questionnaire → createRoadmap()
 *   → BullMQ worker reads resume_content → AI generates paths
 *   → paths saved here → SSE notifies frontend
 *   → user views/selects a path
 */
export const careerRoadmapsTable = pgTable("career_roadmaps", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),

    // Ownership
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }).notNull(),

    // Source resume (most recently updated live resume)
    resumeContentID: integer("resumeContentID").references(() => resumeContentTable.id, { onDelete: 'cascade' }).notNull(),

    // User input — questionnaire answers
    // { targetRole: string[], industry: string, timeframe: string, priorities: string[], constraints: string }
    questionnaire: json(),

    // AI output — array of CareerPath objects
    // [ { title, summary, timeframe, confidence, steps: [], gap_analysis: {} } ]
    paths: json(),

    // User's chosen path (0-indexed into paths array), null = not yet selected
    selectedPathIndex: integer("selectedPathIndex"),

    // BullMQ job tracking (same pattern as resume-rewrite)
    jobID: varchar({ length: 255 }),
    status: varchar({ length: 50 }).default("pending").notNull(), // pending | processing | completed | failed

    // Detailed generative agent state tracking
    detailedPlan: json(),
    detailedStatus: varchar({ length: 50 }).default("none").notNull(), // none | pending | processing | completed | failed
    detailedJobID: varchar({ length: 255 }),

    // Error info for failed jobs
    errorMsg: text(),

    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
}, (table) => [
    // Index for listing user's roadmaps
    index("career_roadmaps_user_id_idx").on(table.userID),
    // Index for resume → roadmap lookup
    index("career_roadmaps_resume_content_id_idx").on(table.resumeContentID),
    // Index for status filtering
    index("career_roadmaps_status_idx").on(table.status),
    // Index for queue job tracking
    index("career_roadmaps_job_id_idx").on(table.jobID),
    // Index for created_at ordering
    index("career_roadmaps_created_at_idx").on(table.createdAt),
]);
