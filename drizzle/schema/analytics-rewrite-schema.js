import { boolean, integer, pgTable, timestamp, varchar, text, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";

export const userDocumentTable = pgTable("documents", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userID: integer("userID").references(() => usersTable.id).notNull(),
    title: varchar({ length: 255 }),
    fileURL: varchar({ length: 512 }).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
    deletedAt: timestamp(), // Soft delete - null means not deleted
}, (table) => [
    // Index for user documents lookup (very frequent)
    index("documents_user_id_idx").on(table.userID),
    // Index for soft-delete queries
    index("documents_deleted_at_idx").on(table.deletedAt),
    // Composite index for active documents by user
    index("documents_user_deleted_idx").on(table.userID, table.deletedAt),
    // Index for created_at ordering
    index("documents_created_at_idx").on(table.createdAt),
]);

export const analysisTable = pgTable("analyses", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userID: integer("userID").references(() => usersTable.id).notNull(),
    documentID: integer("documentID").references(() => userDocumentTable.id).notNull(),
    status: varchar({ length: 50 }).default("pending").notNull(), // e.g., 'pending', 'completed', 'failed'
    jobID: varchar({ length: 255 }), // ID from job service
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
    completedAt: timestamp(), // When the analysis was completed
}, (table) => [
    // Index for user analyses lookup
    index("analyses_user_id_idx").on(table.userID),
    // Index for document analysis lookup
    index("analyses_document_id_idx").on(table.documentID),
    // Index for status filtering (pending, completed, failed)
    index("analyses_status_idx").on(table.status),
    // Index for job ID lookup (queue tracking)
    index("analyses_job_id_idx").on(table.jobID),
    // Composite index for user + status lookups
    index("analyses_user_status_idx").on(table.userID, table.status),
    // Index for created_at ordering
    index("analyses_created_at_idx").on(table.createdAt),
]);

export const processedAndRawDataTable = pgTable("processed_and_raw_data", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    analysisID: integer("analysisID").references(() => analysisTable.id).notNull(),
    documentID: integer("documentID").references(() => userDocumentTable.id).notNull(),
    rawData: text().notNull(), //extracted data
    processedData: text().notNull(), //AI generated DData
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
}, (table) => [
    // Unique index for analysis (1:1 relationship)
    uniqueIndex("processed_raw_data_analysis_id_idx").on(table.analysisID),
    // Index for document lookup
    index("processed_raw_data_document_id_idx").on(table.documentID),
]);

export const rewritesTable = pgTable("rewrites", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    analysisID: integer("analysisID").references(() => analysisTable.id).notNull(),
    documentID: integer("documentID").references(() => userDocumentTable.id).notNull(),
    processedDataID: integer("processedDataID").references(() => processedAndRawDataTable.id).notNull(),
    rewriteContent: text(),
    jobID: varchar({ length: 255 }), // ID from jpb service for rewrite
    status: varchar({ length: 50 }).default("pending").notNull(), // e.g., 'pending', 'completed', 'failed'
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
}, (table) => [
    // Index for analysis rewrites lookup
    index("rewrites_analysis_id_idx").on(table.analysisID),
    // Index for document rewrites lookup
    index("rewrites_document_id_idx").on(table.documentID),
    // Index for status filtering
    index("rewrites_status_idx").on(table.status),
    // Index for job ID lookup
    index("rewrites_job_id_idx").on(table.jobID),
    // Composite index for analysis + status
    index("rewrites_analysis_status_idx").on(table.analysisID, table.status),
]);

// ========== CANDIDATE ANALYTICS TABLES ==========

export const candidateDocumentTable = pgTable("candidate_documents", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    candidateID: integer("candidateID").references(() => candidatesTable.id).notNull(),
    title: varchar({ length: 255 }),
    fileURL: varchar({ length: 512 }).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
    deletedAt: timestamp(), // Soft delete - null means not deleted
}, (table) => [
    // Index for candidate documents lookup (very frequent)
    index("candidate_documents_candidate_id_idx").on(table.candidateID),
    // Index for soft-delete queries
    index("candidate_documents_deleted_at_idx").on(table.deletedAt),
    // Composite index for active documents by candidate
    index("candidate_documents_candidate_deleted_idx").on(table.candidateID, table.deletedAt),
    // Index for created_at ordering
    index("candidate_documents_created_at_idx").on(table.createdAt),
]);

export const candidateAnalysisTable = pgTable("candidate_analyses", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    candidateID: integer("candidateID").references(() => candidatesTable.id).notNull(),
    documentID: integer("documentID").references(() => candidateDocumentTable.id).notNull(),
    status: varchar({ length: 50 }).default("pending").notNull(), // e.g., 'pending', 'completed', 'failed'
    jobID: varchar({ length: 255 }), // ID from job service
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
    completedAt: timestamp(), // When the analysis was completed
}, (table) => [
    // Index for candidate analyses lookup
    index("candidate_analyses_candidate_id_idx").on(table.candidateID),
    // Index for document analysis lookup
    index("candidate_analyses_document_id_idx").on(table.documentID),
    // Index for status filtering
    index("candidate_analyses_status_idx").on(table.status),
    // Index for job ID lookup
    index("candidate_analyses_job_id_idx").on(table.jobID),
    // Composite index for candidate + status lookups
    index("candidate_analyses_candidate_status_idx").on(table.candidateID, table.status),
    // Index for created_at ordering
    index("candidate_analyses_created_at_idx").on(table.createdAt),
]);

export const candidateProcessedAndRawDataTable = pgTable("candidate_processed_and_raw_data", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    analysisID: integer("analysisID").references(() => candidateAnalysisTable.id).notNull(),
    documentID: integer("documentID").references(() => candidateDocumentTable.id).notNull(),
    rawData: text().notNull(), //extracted data
    processedData: text().notNull(), //AI generated DData
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
}, (table) => [
    // Unique index for analysis (1:1 relationship)
    uniqueIndex("candidate_processed_raw_data_analysis_id_idx").on(table.analysisID),
    // Index for document lookup
    index("candidate_processed_raw_data_document_id_idx").on(table.documentID),
]);

export const candidateRewritesTable = pgTable("candidate_rewrites", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    analysisID: integer("analysisID").references(() => candidateAnalysisTable.id).notNull(),
    documentID: integer("documentID").references(() => candidateDocumentTable.id).notNull(),
    processedDataID: integer("processedDataID").references(() => candidateProcessedAndRawDataTable.id).notNull(),
    rewriteContent: text(),
    jobID: varchar({ length: 255 }), // ID from jpb service for rewrite
    status: varchar({ length: 50 }).default("pending").notNull(), // e.g., 'pending', 'completed', 'failed'
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    meta: text(),
}, (table) => [
    // Index for analysis rewrites lookup
    index("candidate_rewrites_analysis_id_idx").on(table.analysisID),
    // Index for document rewrites lookup
    index("candidate_rewrites_document_id_idx").on(table.documentID),
    // Index for status filtering
    index("candidate_rewrites_status_idx").on(table.status),
    // Index for job ID lookup
    index("candidate_rewrites_job_id_idx").on(table.jobID),
    // Composite index for analysis + status
    index("candidate_rewrites_analysis_status_idx").on(table.analysisID, table.status),
]);
