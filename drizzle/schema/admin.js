import { boolean, integer, pgTable, timestamp, varchar, text, jsonb } from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";

// Admin users table - stores admin accounts
export const adminUsersTable = pgTable("admin_users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fullname: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar({ length: 255 }).notNull(),
    role: varchar({ length: 50 }).notNull().default('admin'), // 'super_admin', 'admin', 'moderator'
    isActive: boolean().default(true).notNull(),
    lastLoginAt: timestamp(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    deletedAt: timestamp(), // Soft delete
});

// System settings table - stores configurable system settings
export const systemSettingsTable = pgTable("system_settings", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    settingKey: varchar({ length: 255 }).notNull().unique(),
    settingValue: text(),
    settingType: varchar({ length: 50 }).notNull().default('string'), // 'string', 'number', 'boolean', 'json'
    category: varchar({ length: 100 }).notNull().default('general'), // 'general', 'email', 'security', 'features', 'limits'
    description: text(),
    isPublic: boolean().default(false).notNull(), // Whether this setting is visible to non-admins
    createdBy: integer("createdBy").references(() => adminUsersTable.id),
    updatedBy: integer("updatedBy").references(() => adminUsersTable.id),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});

// Resume templates table - stores admin-uploaded resume templates
export const resumeTemplatesTable = pgTable("resume_templates", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    thumbnailUrl: varchar({ length: 512 }),
    templateFileUrl: varchar({ length: 512 }).notNull(),
    templateType: varchar({ length: 50 }).notNull().default('pdf'), // 'pdf', 'docx', 'html'
    category: varchar({ length: 100 }).default('general'), // 'general', 'tech', 'creative', 'executive', etc.
    isActive: boolean().default(true).notNull(),
    isPremium: boolean().default(false).notNull(),
    sortOrder: integer().default(0),
    metadata: jsonb(), // Additional template metadata (colors, fonts, etc.)
    createdBy: integer("createdBy").references(() => adminUsersTable.id),
    updatedBy: integer("updatedBy").references(() => adminUsersTable.id),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    deletedAt: timestamp(), // Soft delete
});

// Blocked users table - tracks blocked users and candidates
export const blockedUsersTable = pgTable("blocked_users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }),
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }),
    userType: varchar({ length: 20 }).notNull(), // 'user' or 'candidate'
    reason: text(),
    blockedBy: integer("blockedBy").references(() => adminUsersTable.id),
    blockedAt: timestamp().defaultNow().notNull(),
    unblockedAt: timestamp(),
    unblockedBy: integer("unblockedBy").references(() => adminUsersTable.id),
    isActive: boolean().default(true).notNull(), // false means unblocked
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});

// Admin activity log - tracks admin actions for audit purposes
export const adminActivityLogTable = pgTable("admin_activity_logs", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    adminId: integer("adminId").references(() => adminUsersTable.id).notNull(),
    action: varchar({ length: 100 }).notNull(), // 'login', 'update_settings', 'block_user', 'upload_template', etc.
    resourceType: varchar({ length: 100 }), // 'user', 'candidate', 'setting', 'template'
    resourceId: integer(),
    details: jsonb(), // Additional action details
    ipAddress: varchar({ length: 45 }),
    userAgent: text(),
    createdAt: timestamp().defaultNow().notNull(),
});
