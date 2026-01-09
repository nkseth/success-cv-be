-- Admin System Migration
-- Creates tables for admin users, system settings, resume templates, blocked users, and activity logs

-- Admin users table
CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "fullname" varchar(255) NOT NULL,
    "email" varchar(255) NOT NULL UNIQUE,
    "passwordHash" varchar(255) NOT NULL,
    "role" varchar(50) NOT NULL DEFAULT 'admin',
    "isActive" boolean NOT NULL DEFAULT true,
    "lastLoginAt" timestamp,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    "deletedAt" timestamp
);

-- System settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "settingKey" varchar(255) NOT NULL UNIQUE,
    "settingValue" text,
    "settingType" varchar(50) NOT NULL DEFAULT 'string',
    "category" varchar(100) NOT NULL DEFAULT 'general',
    "description" text,
    "isPublic" boolean NOT NULL DEFAULT false,
    "createdBy" integer REFERENCES "admin_users"("id"),
    "updatedBy" integer REFERENCES "admin_users"("id"),
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Resume templates table
CREATE TABLE IF NOT EXISTS "resume_templates" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "name" varchar(255) NOT NULL,
    "description" text,
    "thumbnailUrl" varchar(512),
    "templateFileUrl" varchar(512) NOT NULL,
    "templateType" varchar(50) NOT NULL DEFAULT 'pdf',
    "category" varchar(100) DEFAULT 'general',
    "isActive" boolean NOT NULL DEFAULT true,
    "isPremium" boolean NOT NULL DEFAULT false,
    "sortOrder" integer DEFAULT 0,
    "metadata" jsonb,
    "createdBy" integer REFERENCES "admin_users"("id"),
    "updatedBy" integer REFERENCES "admin_users"("id"),
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    "deletedAt" timestamp
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS "blocked_users" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "userID" integer REFERENCES "users"("id") ON DELETE CASCADE,
    "candidateID" integer REFERENCES "candidates"("id") ON DELETE CASCADE,
    "userType" varchar(20) NOT NULL,
    "reason" text,
    "blockedBy" integer REFERENCES "admin_users"("id"),
    "blockedAt" timestamp NOT NULL DEFAULT now(),
    "unblockedAt" timestamp,
    "unblockedBy" integer REFERENCES "admin_users"("id"),
    "isActive" boolean NOT NULL DEFAULT true,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Admin activity logs table
CREATE TABLE IF NOT EXISTS "admin_activity_logs" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "adminId" integer NOT NULL REFERENCES "admin_users"("id"),
    "action" varchar(100) NOT NULL,
    "resourceType" varchar(100),
    "resourceId" integer,
    "details" jsonb,
    "ipAddress" varchar(45),
    "userAgent" text,
    "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_admin_users_email" ON "admin_users"("email");
CREATE INDEX IF NOT EXISTS "idx_admin_users_role" ON "admin_users"("role");
CREATE INDEX IF NOT EXISTS "idx_system_settings_key" ON "system_settings"("settingKey");
CREATE INDEX IF NOT EXISTS "idx_system_settings_category" ON "system_settings"("category");
CREATE INDEX IF NOT EXISTS "idx_resume_templates_category" ON "resume_templates"("category");
CREATE INDEX IF NOT EXISTS "idx_resume_templates_active" ON "resume_templates"("isActive");
CREATE INDEX IF NOT EXISTS "idx_blocked_users_user" ON "blocked_users"("userID");
CREATE INDEX IF NOT EXISTS "idx_blocked_users_candidate" ON "blocked_users"("candidateID");
CREATE INDEX IF NOT EXISTS "idx_blocked_users_active" ON "blocked_users"("isActive");
CREATE INDEX IF NOT EXISTS "idx_admin_activity_logs_admin" ON "admin_activity_logs"("adminId");
CREATE INDEX IF NOT EXISTS "idx_admin_activity_logs_action" ON "admin_activity_logs"("action");
CREATE INDEX IF NOT EXISTS "idx_admin_activity_logs_created" ON "admin_activity_logs"("createdAt");
