import { boolean, integer, pgTable, timestamp, varchar, text, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fullname: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar({ length: 255 }).notNull(),
    isVerified: boolean().default(false).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    deletedAt: timestamp(), // Soft delete - null means not deleted
}, (table) => [
    // Index for soft-delete queries (common pattern: WHERE deletedAt IS NULL)
    index("users_deleted_at_idx").on(table.deletedAt),
    // Index for verification status filtering
    index("users_verified_idx").on(table.isVerified),
    // Composite index for active verified users
    index("users_verified_deleted_idx").on(table.isVerified, table.deletedAt),
    // Index for created_at ordering (recent users)
    index("users_created_at_idx").on(table.createdAt),
]);

export const candidatesTable = pgTable("candidates", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fullname: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    organisationID: integer('organisationID').notNull(),
    passwordHash: varchar({ length: 255 }).notNull(),
    isVerified: boolean().default(false).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    deletedAt: timestamp(), // Soft delete - null means not deleted
}, (table) => [
    // Index for organisation-based lookups (very frequent)
    index("candidates_organisation_id_idx").on(table.organisationID),
    // Index for soft-delete queries
    index("candidates_deleted_at_idx").on(table.deletedAt),
    // Index for verification status filtering
    index("candidates_verified_idx").on(table.isVerified),
    // Composite index for candidates in an org (common query pattern)
    index("candidates_org_deleted_idx").on(table.organisationID, table.deletedAt),
    // Composite index for verified candidates in an org
    index("candidates_org_verified_deleted_idx").on(table.organisationID, table.isVerified, table.deletedAt),
    // Index for created_at ordering
    index("candidates_created_at_idx").on(table.createdAt),
]);

export const profilesTable = pgTable("profiles", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userID: integer().references(() => usersTable.id, { onDelete: 'cascade' }),
    candidateID: integer().references(() => candidatesTable.id, { onDelete: 'cascade' }),
    bio: text(),
    imageURL: varchar({ length: 512 }),
    location: varchar({ length: 255 }),
    country: varchar({ length: 255 }),
    city: varchar({ length: 255 }),
    state: varchar({ length: 255 }),
    zipCode: varchar({ length: 20 }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    // Index for user profile lookup (1:1 relationship)
    uniqueIndex("profiles_user_id_idx").on(table.userID),
    // Index for candidate profile lookup (1:1 relationship)
    uniqueIndex("profiles_candidate_id_idx").on(table.candidateID),
    // Index for location-based queries
    index("profiles_country_idx").on(table.country),
    index("profiles_city_idx").on(table.city),
]);

export const forgotPasswordTokenTable = pgTable("forgot_password_tokens", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }),
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }),
    userType: varchar({ length: 20 }).notNull().default('user'), // 'user' or 'candidate'
    token: varchar({ length: 255 }).notNull().unique(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    expiresAt: timestamp().notNull(),
    isUsed: boolean().default(false).notNull(),
}, (table) => [
    // Index for user token lookup
    index("forgot_password_tokens_user_id_idx").on(table.userID),
    // Index for candidate token lookup
    index("forgot_password_tokens_candidate_id_idx").on(table.candidateID),
    // Composite index for active token lookup (common pattern)
    index("forgot_password_tokens_user_unused_idx").on(table.userID, table.isUsed),
    index("forgot_password_tokens_candidate_unused_idx").on(table.candidateID, table.isUsed),
    // Index for token expiration cleanup
    index("forgot_password_tokens_expires_at_idx").on(table.expiresAt),
    // Index for user type filtering
    index("forgot_password_tokens_user_type_idx").on(table.userType),
]);

export const verifyTable = pgTable("verify_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userID: integer("userID").references(() => usersTable.id, { onDelete: 'cascade' }),
    candidateID: integer("candidateID").references(() => candidatesTable.id, { onDelete: 'cascade' }),
    userType: varchar({ length: 20 }).notNull().default('user'), // 'user' or 'candidate'
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    isUsed: boolean().default(false).notNull(),
}, (table) => [
    // Index for user verification lookup
    index("verify_tokens_user_id_idx").on(table.userID),
    // Index for candidate verification lookup
    index("verify_tokens_candidate_id_idx").on(table.candidateID),
    // Composite index for unused tokens lookup (common pattern)
    index("verify_tokens_user_unused_idx").on(table.userID, table.userType, table.isUsed),
    index("verify_tokens_candidate_unused_idx").on(table.candidateID, table.userType, table.isUsed),
]);
