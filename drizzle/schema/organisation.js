import { boolean, integer, pgTable, timestamp, varchar, text, uuid, serial, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./auth.js";

export const organisationsTable = pgTable("organisations", {
    id: serial().primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    creatorID: integer("creatorID").references(() => usersTable.id).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    address: text(), // Optional field - no .notNull()
    country: varchar({ length: 100 }), // Optional field - no .notNull()
    state: varchar({ length: 100 }), // Optional field - no .notNull()
    city: varchar({ length: 100 }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    deletedAt: timestamp(), // Soft delete - null means not deleted
}, (table) => [
    // Index for creator lookups
    index("organisations_creator_id_idx").on(table.creatorID),
    // Index for soft-delete queries
    index("organisations_deleted_at_idx").on(table.deletedAt),
    // Index for location-based queries
    index("organisations_country_idx").on(table.country),
    index("organisations_city_idx").on(table.city),
    // Index for name search
    index("organisations_name_idx").on(table.name),
    // Index for created_at ordering
    index("organisations_created_at_idx").on(table.createdAt),
]);

export const orgMembersTable = pgTable("organisation_members", {
    id: serial().primaryKey(),
    userID: integer("userID").references(() => usersTable.id).notNull(),
    organisationID: integer("organisationID").references(() => organisationsTable.id).notNull(),
    role: varchar({ length: 100 }).notNull(), // e.g., 'admin', 'member',
    inviteRef: uuid("invite_ref").references(() => inviteTable.id), // Reference to the invite used
    joinedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    // Unique constraint: user can only be a member once per org
    uniqueIndex("org_members_user_org_unique_idx").on(table.userID, table.organisationID),
    // Index for user memberships lookup
    index("org_members_user_id_idx").on(table.userID),
    // Index for organisation members lookup
    index("org_members_organisation_id_idx").on(table.organisationID),
    // Index for role-based filtering
    index("org_members_role_idx").on(table.role),
    // Composite index for org + role lookups (e.g., find all admins in an org)
    index("org_members_org_role_idx").on(table.organisationID, table.role),
]);

export const inviteTable = pgTable("invites", {
    id: uuid("id").primaryKey().defaultRandom(),
    generatedBy: integer("generatedBy").references(() => usersTable.id).notNull(),
    organisationID: integer("organisationID").references(() => organisationsTable.id).notNull(),
    type: varchar({ length: 50 }).notNull(), // e.g., 'member', 'admin'
    email: varchar({ length: 255 }),
    isAccepted: boolean().default(false),
    acceptedCount: integer().default(0).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    expiresAt: timestamp().notNull(),
}, (table) => [
    // Index for organisation invites lookup
    index("invites_organisation_id_idx").on(table.organisationID),
    // Index for email-based invite lookup
    index("invites_email_idx").on(table.email),
    // Index for pending invites (not accepted yet)
    index("invites_accepted_idx").on(table.isAccepted),
    // Index for expiration cleanup
    index("invites_expires_at_idx").on(table.expiresAt),
    // Composite index for pending invites for an org
    index("invites_org_pending_idx").on(table.organisationID, table.isAccepted),
    // Composite index for email + org invite lookup
    index("invites_email_org_idx").on(table.email, table.organisationID),
]);