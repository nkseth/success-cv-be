import { 
    integer, pgTable, timestamp, varchar, text, 
    jsonb, index, uniqueIndex, decimal, uuid 
} from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";
import { organisationsTable } from "./organisation.js";

// ========== CREDIT WALLETS ==========
// Stores credit balance for users and organisations
// Users have personal wallets, organisations have shared wallets for candidates
export const creditWalletsTable = pgTable("credit_wallets", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // Owner (one of these will be set, never both)
    userID: integer("userID").references(() => usersTable.id),
    organisationID: integer("organisationID").references(() => organisationsTable.id),
    
    // Balances
    balance: integer().notNull().default(0), // Available credits
    pendingBalance: integer().notNull().default(0), // Reserved for in-progress tasks
    lifetimeCredits: integer().notNull().default(0), // Total credits ever purchased
    lifetimeUsed: integer().notNull().default(0), // Total credits ever consumed
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    uniqueIndex("credit_wallets_user_idx").on(table.userID),
    uniqueIndex("credit_wallets_org_idx").on(table.organisationID),
    index("credit_wallets_balance_idx").on(table.balance),
]);

// ========== CREDIT TRANSACTIONS ==========
// Tracks all credit movements (purchases, usage, refunds)
export const creditTransactionsTable = pgTable("credit_transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Wallet reference
    walletID: integer("walletID").references(() => creditWalletsTable.id).notNull(),
    
    // Who initiated (for org wallets, tracks which user/candidate used credits)
    initiatedByUserID: integer("initiatedByUserID").references(() => usersTable.id),
    initiatedByCandidateID: integer("initiatedByCandidateID").references(() => candidatesTable.id),
    
    // Transaction type:
    // 'purchase' - Credits purchased via Razorpay
    // 'debit' - Credit consumed for task (analysis/rewrite)
    // 'refund' - Credit returned (failed task)
    // 'admin_adjustment' - Manual adjustment by admin
    type: varchar({ length: 50 }).notNull(),
    
    amount: integer().notNull(), // Positive = credit added, Negative = credit used
    balanceAfter: integer().notNull(), // Wallet balance after this transaction
    
    // Reference to what caused this transaction
    referenceType: varchar({ length: 50 }), // 'analysis', 'rewrite', 'purchase', 'admin'
    referenceID: varchar({ length: 100 }), // ID of related record (order ID, job ID)
    
    // Status for pending operations
    // 'pending' - Reserved for in-progress task
    // 'completed' - Transaction finalized
    // 'reversed' - Transaction was reversed (task failed, credits refunded)
    status: varchar({ length: 20 }).notNull().default('completed'),
    
    description: text(),
    metadata: jsonb(), // Additional context
    
    createdAt: timestamp().defaultNow().notNull(),
    completedAt: timestamp(),
}, (table) => [
    index("credit_transactions_wallet_idx").on(table.walletID),
    index("credit_transactions_type_idx").on(table.type),
    index("credit_transactions_status_idx").on(table.status),
    index("credit_transactions_created_idx").on(table.createdAt),
    index("credit_transactions_user_idx").on(table.initiatedByUserID),
    index("credit_transactions_candidate_idx").on(table.initiatedByCandidateID),
    index("credit_transactions_reference_idx").on(table.referenceType, table.referenceID),
]);

// ========== PAYMENT ORDERS ==========
// Tracks all Razorpay payment orders for credit purchases
export const paymentOrdersTable = pgTable("payment_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Who is paying (always a user, even for org purchases)
    userID: integer("userID").references(() => usersTable.id).notNull(),
    
    // Which wallet receives credits (null until payment success)
    walletID: integer("walletID").references(() => creditWalletsTable.id),
    
    // If purchasing for organisation (null = personal wallet)
    forOrganisationID: integer("forOrganisationID").references(() => organisationsTable.id),
    
    // Order details (1 credit = 1 INR)
    creditsAmount: integer().notNull(), // Credits being purchased
    amount: decimal({ precision: 10, scale: 2 }).notNull(), // Payment amount in INR
    currency: varchar({ length: 3 }).default('INR').notNull(),
    
    // Razorpay details
    razorpayOrderId: varchar({ length: 100 }).unique(),
    razorpayPaymentId: varchar({ length: 100 }),
    razorpaySignature: varchar({ length: 255 }),
    
    // Status: 'created', 'paid', 'failed'
    status: varchar({ length: 50 }).notNull().default('created'),
    
    paidAt: timestamp(),
    failureReason: text(),
    
    metadata: jsonb(),
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    index("payment_orders_user_idx").on(table.userID),
    index("payment_orders_wallet_idx").on(table.walletID),
    index("payment_orders_org_idx").on(table.forOrganisationID),
    index("payment_orders_status_idx").on(table.status),
    index("payment_orders_razorpay_order_idx").on(table.razorpayOrderId),
    index("payment_orders_created_idx").on(table.createdAt),
]);

// ========== RAZORPAY WEBHOOKS LOG ==========
// Logs all webhooks for idempotency and debugging
export const razorpayWebhooksTable = pgTable("razorpay_webhooks", {
    id: uuid("id").primaryKey().defaultRandom(),
    
    eventType: varchar({ length: 100 }).notNull(), // 'payment.captured', 'payment.failed', etc.
    eventId: varchar({ length: 100 }).notNull().unique(), // Razorpay event ID for idempotency
    
    payload: jsonb().notNull(), // Full webhook payload
    
    // Status: 'received', 'processed', 'failed', 'ignored'
    status: varchar({ length: 20 }).notNull().default('received'),
    
    processedAt: timestamp(),
    errorMessage: text(),
    
    createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
    index("razorpay_webhooks_event_type_idx").on(table.eventType),
    index("razorpay_webhooks_event_id_idx").on(table.eventId),
    index("razorpay_webhooks_status_idx").on(table.status),
    index("razorpay_webhooks_created_idx").on(table.createdAt),
]);

