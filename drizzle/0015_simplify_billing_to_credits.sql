-- Migration: Simplify Billing System to Credits Only
-- Created: 2025-01-27
-- Description: Remove subscription system and simplify to credit-only billing
-- BREAKING CHANGE: This removes subscription tables

-- ========== DROP SUBSCRIPTION SYSTEM ==========
-- Drop foreign key constraint from payment_orders first
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_planID_subscription_plans_id_fk";
--> statement-breakpoint

-- Drop user_subscriptions table and its constraints
ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_userID_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_organisationID_organisations_id_fk";
--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "user_subscriptions_planID_subscription_plans_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_subscriptions";
--> statement-breakpoint

-- Drop subscription_plans table
DROP TABLE IF EXISTS "subscription_plans";
--> statement-breakpoint

-- ========== UPDATE CREDIT WALLETS ==========
-- Add lifetime tracking columns
ALTER TABLE "credit_wallets" ADD COLUMN IF NOT EXISTS "lifetimeCredits" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD COLUMN IF NOT EXISTS "lifetimeUsed" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ========== UPDATE PAYMENT ORDERS ==========
-- Remove old columns not needed in simplified system
ALTER TABLE "payment_orders" DROP COLUMN IF EXISTS "orderType";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP COLUMN IF EXISTS "planID";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP COLUMN IF EXISTS "organisationID";
--> statement-breakpoint

-- Add wallet reference for better tracking
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "walletID" integer REFERENCES "credit_wallets"("id");
--> statement-breakpoint

-- Add forOrganisationID to track org purchases (replaces organisationID)
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "forOrganisationID" integer REFERENCES "organisations"("id");
--> statement-breakpoint

-- Add metadata column for additional context
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint

-- Make userID NOT NULL (required for all orders)
-- First update any null values (shouldn't exist, but safety check)
UPDATE "payment_orders" SET "userID" = (
    SELECT u.id FROM "users" u LIMIT 1
) WHERE "userID" IS NULL;
--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "userID" SET NOT NULL;
--> statement-breakpoint

-- Add razorpay_order_id unique constraint if not exists
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_razorpayOrderId_unique";
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_razorpayOrderId_unique" UNIQUE ("razorpayOrderId");
--> statement-breakpoint

-- ========== UPDATE CREDIT TRANSACTIONS ==========
-- Add metadata column for additional context
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint

-- Add reference index for faster lookups
CREATE INDEX IF NOT EXISTS "credit_transactions_reference_idx" ON "credit_transactions" ("referenceType", "referenceID");
--> statement-breakpoint

-- ========== UPDATE RAZORPAY WEBHOOKS ==========
-- Add index on eventId for idempotency checks
CREATE INDEX IF NOT EXISTS "razorpay_webhooks_event_id_idx" ON "razorpay_webhooks" ("eventId");
--> statement-breakpoint

-- ========== ADD NEW INDEXES ==========
-- Add wallet index on payment orders
CREATE INDEX IF NOT EXISTS "payment_orders_wallet_idx" ON "payment_orders" ("walletID");
--> statement-breakpoint

-- Add forOrganisationID index
CREATE INDEX IF NOT EXISTS "payment_orders_for_org_idx" ON "payment_orders" ("forOrganisationID");
--> statement-breakpoint

-- ========== BACKFILL LIFETIME CREDITS ==========
-- Set lifetimeCredits based on purchase transactions
UPDATE "credit_wallets" w 
SET "lifetimeCredits" = COALESCE((
    SELECT SUM(t.amount) 
    FROM "credit_transactions" t 
    WHERE t."walletID" = w.id 
    AND t.type = 'purchase' 
    AND t.amount > 0
), 0);
--> statement-breakpoint

-- Set lifetimeUsed based on debit transactions
UPDATE "credit_wallets" w 
SET "lifetimeUsed" = COALESCE((
    SELECT ABS(SUM(t.amount)) 
    FROM "credit_transactions" t 
    WHERE t."walletID" = w.id 
    AND t.type = 'debit' 
    AND t.amount < 0
), 0);
--> statement-breakpoint
