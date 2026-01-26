# Credit System Documentation

## Overview

The Credit System provides a simple, pay-as-you-go payment infrastructure for Success-CV using **Razorpay** as the payment gateway. 

**Core Principles:**
- **1 Credit = ₹1 INR** (Simple, transparent pricing)
- **No Subscriptions** - Users buy credits when they need them
- **Credits Never Expire** - Once purchased, credits are valid forever
- **Organisation Credits** - Candidates use credits from their organisation creator's wallet

---

## Key Concepts

### User Types & Credit Access

| User Type | Has Personal Wallet | Can Purchase Credits | Credit Source |
|-----------|---------------------|---------------------|---------------|
| **User** (Individual) | ✅ Yes | ✅ Yes | Personal wallet |
| **Organisation Creator** (User) | ✅ Yes + Org Wallet | ✅ Yes (for org) | Personal + Org wallet |
| **Candidate** (B2B) | ❌ No | ❌ No | Organisation wallet ONLY |

### Key Distinctions

1. **Users (B2C):**
   - Can purchase credits for personal use
   - If they create an organisation, they also manage the org's wallet
   - Personal credits and org credits are separate

2. **Organisation Creators:**
   - Are Users who created an organisation
   - Purchase credits for the organisation wallet
   - Org wallet is used by all candidates under that organisation

3. **Candidates (B2B):**
   - Created by organisations
   - Cannot purchase credits
   - All their operations consume credits from the organisation wallet
   - If org has no credits, candidates cannot perform paid operations

---

## Credit Consumption

| Operation | Credits |
|-----------|---------|
| Resume Analysis | 1 credit |
| Resume Rewrite | 1 credit |

### Credit Flow

```
[User/Candidate Initiates Task]
        │
        ▼
┌──────────────────────────────────────────┐
│ Determine Wallet:                        │
│ - User → Personal Wallet                 │
│ - Candidate → Organisation Wallet        │
│   (from org creator)                     │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────┐     No      ┌────────────────┐
│ Has Credits? │ ──────────▶ │ Return 402     │
└──────────────┘             │ Insufficient   │
        │ Yes                └────────────────┘
        ▼
┌──────────────────────┐
│ Reserve 1 Credit     │
│ (Move to pending)    │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Process Task (Queue) │
└──────────────────────┘
        │
        ├──────────────┬────────────────┐
        ▼              ▼                ▼
   [SUCCESS]      [FAILED]         [TIMEOUT]
        │              │                │
        ▼              ▼                ▼
   Confirm          Refund           Refund
   Deduction        Credit           Credit
```

---

## Credit Packages

Simple pricing: **1 Credit = ₹1**

| Package | Credits | Price (INR) | Bonus | Total Credits |
|---------|---------|-------------|-------|---------------|
| Starter | 50 | ₹50 | 0 | 50 |
| Basic | 100 | ₹100 | 0 | 100 |
| Value | 250 | ₹250 | 25 (10%) | 275 |
| Pro | 500 | ₹500 | 75 (15%) | 575 |
| Business | 1000 | ₹1000 | 200 (20%) | 1200 |

> **Note:** Larger packages include bonus credits as an incentive.

---

## Database Schema

### Simplified Tables (No Subscription Tables)

```javascript
// drizzle/schema/billing.js

import { 
    integer, pgTable, timestamp, varchar, text, 
    jsonb, index, uniqueIndex, decimal, uuid 
} from "drizzle-orm/pg-core";
import { usersTable, candidatesTable } from "./auth.js";
import { organisationsTable } from "./organisation.js";

// ========== CREDIT WALLETS ==========
export const creditWalletsTable = pgTable("credit_wallets", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    
    // Owner (one of these will be set, never both)
    userID: integer("userID").references(() => usersTable.id).unique(),
    organisationID: integer("organisationID").references(() => organisationsTable.id).unique(),
    
    // Balances
    balance: integer().notNull().default(0), // Available credits
    pendingBalance: integer().notNull().default(0), // Reserved for in-progress tasks
    lifetimeCredits: integer().notNull().default(0), // Total credits ever purchased
    lifetimeUsed: integer().notNull().default(0), // Total credits ever consumed
    
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
    uniqueIndex("credit_wallets_user_unique_idx").on(table.userID),
    uniqueIndex("credit_wallets_org_unique_idx").on(table.organisationID),
    index("credit_wallets_balance_idx").on(table.balance),
]);

// ========== CREDIT TRANSACTIONS ==========
export const creditTransactionsTable = pgTable("credit_transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Wallet reference
    walletID: integer("walletID").references(() => creditWalletsTable.id).notNull(),
    
    // Who initiated (for org wallets, tracks which user/candidate used credits)
    initiatedByUserID: integer("initiatedByUserID").references(() => usersTable.id),
    initiatedByCandidateID: integer("initiatedByCandidateID").references(() => candidatesTable.id),
    
    // Transaction type
    type: varchar({ length: 50 }).notNull(),
    // 'purchase' - Credits purchased via Razorpay
    // 'debit' - Credit consumed for task
    // 'refund' - Credit returned (failed task)
    // 'admin_adjustment' - Manual adjustment by admin
    // 'bonus' - Bonus credits from package purchase
    
    amount: integer().notNull(), // Positive = credit added, Negative = credit used
    balanceAfter: integer().notNull(), // Wallet balance after this transaction
    
    // Reference to what caused this transaction
    referenceType: varchar({ length: 50 }), // 'analysis', 'rewrite', 'purchase', 'admin'
    referenceID: varchar({ length: 100 }), // ID of related record (e.g., order ID, job ID)
    
    // Status for pending operations
    status: varchar({ length: 20 }).notNull().default('completed'),
    // 'pending' - Reserved for in-progress task
    // 'completed' - Transaction finalized
    // 'reversed' - Transaction was reversed (task failed, credits refunded)
    
    description: text(),
    metadata: jsonb(), // Additional context (package info, task details, etc.)
    
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
export const paymentOrdersTable = pgTable("payment_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Who is paying (for org purchases, userID is the org creator who initiated)
    userID: integer("userID").references(() => usersTable.id).notNull(),
    
    // Which wallet receives credits (user's personal OR org wallet)
    walletID: integer("walletID").references(() => creditWalletsTable.id).notNull(),
    forOrganisationID: integer("forOrganisationID").references(() => organisationsTable.id),
    
    // Order details
    creditsAmount: integer().notNull(), // Base credits being purchased
    bonusCredits: integer().default(0), // Bonus credits included
    amount: decimal({ precision: 10, scale: 2 }).notNull(), // Payment amount in INR
    currency: varchar({ length: 3 }).default('INR').notNull(),
    
    // Package info
    packageId: varchar({ length: 50 }), // Reference to credit package
    packageName: varchar({ length: 100 }),
    
    // Razorpay details
    razorpayOrderId: varchar({ length: 100 }).unique(),
    razorpayPaymentId: varchar({ length: 100 }),
    razorpaySignature: varchar({ length: 255 }),
    
    // Status: 'created', 'paid', 'failed', 'refunded'
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
```

---

## Implementation Plan

### Phase 1: Database Migration (Remove Subscription Tables)

**Files to modify:**
- `drizzle/schema/billing.js` - Simplify schema (remove subscription tables)
- Create new migration to drop `subscription_plans` and `user_subscriptions` tables

**Migration SQL:**
```sql
-- Drop subscription-related tables
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS subscription_plans;

-- Add new columns to credit_wallets if needed
ALTER TABLE credit_wallets ADD COLUMN IF NOT EXISTS lifetime_credits INTEGER DEFAULT 0;
ALTER TABLE credit_wallets ADD COLUMN IF NOT EXISTS lifetime_used INTEGER DEFAULT 0;

-- Update payment_orders table
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS wallet_id INTEGER REFERENCES credit_wallets(id);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS package_id VARCHAR(50);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS package_name VARCHAR(100);

-- Drop subscription-related columns
ALTER TABLE payment_orders DROP COLUMN IF EXISTS plan_id;
ALTER TABLE payment_orders DROP COLUMN IF EXISTS order_type;
ALTER TABLE payment_orders DROP COLUMN IF EXISTS billing_cycle;
```

### Phase 2: Configuration Updates

**Update `config/razorpay.config.js`:**
```javascript
import Razorpay from 'razorpay';

// Initialize Razorpay instance
export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Webhook secret from environment
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Credit packages (1 credit = ₹1)
export const CREDIT_PACKAGES = [
    { id: 'starter-50', credits: 50, price: 50, bonus: 0, name: 'Starter Pack' },
    { id: 'basic-100', credits: 100, price: 100, bonus: 0, name: 'Basic Pack' },
    { id: 'value-250', credits: 250, price: 250, bonus: 25, name: 'Value Pack' },
    { id: 'pro-500', credits: 500, price: 500, bonus: 75, name: 'Pro Pack' },
    { id: 'business-1000', credits: 1000, price: 1000, bonus: 200, name: 'Business Pack' },
];

// Get credit package by ID
export const getCreditPackage = (packageId) => {
    return CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
};

// Calculate total credits (base + bonus)
export const getTotalCredits = (packageId) => {
    const pkg = getCreditPackage(packageId);
    return pkg ? pkg.credits + pkg.bonus : 0;
};

export default razorpay;
```

### Phase 3: Model Updates

**Simplify `models/billing.model.js`:**
- Remove all subscription-related functions
- Keep wallet operations (getOrCreateWallet, reserveCredits, confirmDeduction, refundCredits, addCredits)
- Remove `getActivePlans`, `getPlanByID`, `getCurrentSubscription`, `createSubscription`, `updateSubscription`

### Phase 4: Service Updates

**Simplify `services/billing.service.js`:**
- Remove subscription-related functions
- Keep credit purchase flow
- Simplify webhook handling (only `payment.captured` and `payment.failed`)

**Simplify `services/razorpay.service.js`:**
- Remove `createSubscription`, `cancelSubscription`, `getSubscription`
- Keep `createOrder`, `verifyPaymentSignature`, `verifyWebhookSignature`, `createCustomer`

### Phase 5: Controller & Route Updates

**Simplify `controllers/billing.controller.js`:**
- Remove `getPlansController`, `getSubscriptionController`, `createSubscriptionController`, `cancelSubscriptionController`
- Keep/update credit-related controllers

**Simplify `routes/v1/billing.route.js`:**
- Remove subscription routes
- Keep credit routes

### Phase 6: Middleware Updates

**Update `middleware/billing.middleware.js`:**
- Simplify credit checking logic
- Remove any subscription checks

---

## API Endpoints (Simplified)

### Credit Packages (Public)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/billing/packages` | Get all credit packages | No |

### Credits (Protected)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/billing/credits` | Get credit balance | Yes |
| POST | `/api/v1/billing/credits/purchase` | Create credit purchase order | Yes (User only) |
| GET | `/api/v1/billing/credits/history` | Get transaction history | Yes |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/billing/verify-payment` | Verify Razorpay payment | Yes |
| POST | `/api/v1/billing/webhook` | Razorpay webhook handler | No* |

*Webhook uses signature verification with `RAZORPAY_WEBHOOK_SECRET`

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/admin/billing/wallets` | List all wallets | Admin |
| GET | `/api/v1/admin/billing/transactions` | List all transactions | Admin |
| POST | `/api/v1/admin/billing/credits/adjust` | Manual credit adjustment | Admin |
| GET | `/api/v1/admin/billing/revenue` | Revenue reports | Admin |

---

## File Structure (Final)

```
├── config/
│   └── razorpay.config.js          # Razorpay client + packages
├── controllers/
│   └── billing.controller.js        # Credit APIs (simplified)
├── drizzle/
│   ├── schema/
│   │   └── billing.js               # Simplified schema (no subscriptions)
│   └── 0015_simplified_credits.sql  # Migration to remove subscriptions
├── middleware/
│   └── billing.middleware.js        # Credit check middleware
├── models/
│   └── billing.model.js             # Wallet & credit operations
├── routes/v1/
│   └── billing.route.js             # Credit routes only
├── services/
│   ├── billing.service.js           # Credit business logic
│   └── razorpay.service.js          # Razorpay API (simplified)
└── docs/
    └── BILLING_SYSTEM.md            # This documentation
```

---

## Environment Variables

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx  # CRITICAL for security
```

---

## Webhook Security

### Signature Verification (CRITICAL)

```javascript
// services/razorpay.service.js
import crypto from 'crypto';
import { RAZORPAY_WEBHOOK_SECRET } from '../config/razorpay.config.js';

/**
 * Verify Razorpay webhook signature
 * ALWAYS verify before processing any webhook
 */
export const verifyWebhookSignature = (rawBody, signature) => {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
    }
    
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};
```

### Webhook Handler Security

```javascript
// controllers/billing.controller.js
export const webhookController = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
        logger.warn('[WEBHOOK] Missing signature header');
        return res.status(400).json({ error: 'Missing signature' });
    }
    
    // CRITICAL: Verify signature before processing
    const isValid = razorpayService.verifyWebhookSignature(
        req.rawBody, // Must use raw body, not parsed JSON
        signature
    );
    
    if (!isValid) {
        logger.warn('[WEBHOOK] Invalid signature', { signature });
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    await billingService.handleWebhook(req.body);
    
    res.status(200).json({ status: 'ok' });
});
```

### Express Raw Body Middleware

```javascript
// In your Express setup (server.js or app.js)
// IMPORTANT: Raw body must be preserved for webhook signature verification

app.use('/api/v1/billing/webhook', 
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
        req.rawBody = req.body.toString();
        req.body = JSON.parse(req.rawBody);
        next();
    }
);
```

---

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `payment.captured` | Credit the wallet, update order status |
| `payment.failed` | Mark order as failed, log reason |

**Simplified from old system** - No subscription webhooks needed.

---

## Edge Cases & Error Handling

### 1. Insufficient Credits

```javascript
// When user/candidate tries to perform operation without credits
if (wallet.balance < creditsRequired) {
    throw new AppError(
        userType === 'candidate' 
            ? 'Organisation has insufficient credits. Please contact your admin.'
            : 'Insufficient credits. Please purchase more credits.',
        402,
        { 
            currentBalance: wallet.balance, 
            required: creditsRequired 
        }
    );
}
```

### 2. Candidate Without Organisation

```javascript
// Should never happen due to DB constraints, but handle gracefully
if (userType === 'candidate' && !organisationID) {
    throw new AppError('Candidate not associated with an organisation', 400);
}
```

### 3. Organisation Without Wallet

```javascript
// Auto-create wallet when needed (handled by getOrCreateWallet)
const wallet = await billingModel.getOrCreateWallet('organisation', organisationID);
```

### 4. Candidate Trying to Purchase Credits

```javascript
if (userType === userTypeConstants.CANDIDATE) {
    throw new AppError(
        'Candidates cannot purchase credits. Please contact your organisation admin.',
        403
    );
}
```

### 5. Double Payment Prevention (Idempotency)

```javascript
// Check for duplicate webhook events
const existingWebhook = await db.select()
    .from(razorpayWebhooksTable)
    .where(eq(razorpayWebhooksTable.eventId, eventId))
    .limit(1);

if (existingWebhook.length > 0) {
    logger.info('[WEBHOOK] Duplicate event, ignoring', { eventId });
    return { status: 'ignored', reason: 'duplicate' };
}
```

### 6. Task Failure - Credit Refund

```javascript
// In worker on job failure (after all retries)
if (job.data.creditTransactionID) {
    await billingModel.refundCredits(
        job.data.creditTransactionID,
        `Task failed: ${error.message}`
    );
}
```

### 7. Organisation Creator Leaves

```javascript
// Org wallet remains - transfer ownership or keep for remaining candidates
// (Business decision: may need admin intervention)
```

---

## Testing Checklist

### Razorpay Test Mode

1. Test Key: `rzp_test_xxxxxxxxxxxxx`
2. Test Card: `4111 1111 1111 1111` (any future expiry, any CVV)
3. Test UPI: `success@razorpay`

### Test Scenarios

- [ ] User creates wallet on first operation
- [ ] User purchases credits (all packages)
- [ ] User wallet shows correct balance after purchase
- [ ] Credit deduction on resume analysis
- [ ] Credit deduction on resume rewrite
- [ ] Credit refund on task failure
- [ ] Organisation wallet created when org is created
- [ ] Org creator can purchase credits for org
- [ ] Candidate uses org credits successfully
- [ ] Candidate blocked when org has no credits
- [ ] Candidate cannot purchase credits (403 error)
- [ ] Webhook signature verification works
- [ ] Duplicate webhooks are ignored
- [ ] Payment failure is logged correctly
- [ ] Transaction history shows correct entries
- [ ] Admin can adjust credits manually

---

## Migration Checklist

1. [ ] Backup database before migration
2. [ ] Create migration file for schema changes
3. [ ] Update `drizzle/schema/billing.js`
4. [ ] Update `drizzle/schema.js` exports
5. [ ] Run migration: `pnpm db:generate && pnpm db:push`
6. [ ] Update `config/razorpay.config.js`
7. [ ] Simplify `models/billing.model.js`
8. [ ] Simplify `services/billing.service.js`
9. [ ] Simplify `services/razorpay.service.js`
10. [ ] Simplify `controllers/billing.controller.js`
11. [ ] Simplify `routes/v1/billing.route.js`
12. [ ] Update `middleware/billing.middleware.js`
13. [ ] Add raw body middleware for webhook route
14. [ ] Verify `RAZORPAY_WEBHOOK_SECRET` is set in env
15. [ ] Configure Razorpay webhook URL in dashboard
16. [ ] Test complete purchase flow
17. [ ] Test credit consumption flow
18. [ ] Test webhook handling
19. [ ] Update Swagger documentation
20. [ ] Remove old subscription-related Swagger docs

---

## Security Considerations

1. **Webhook Signature Verification**: ALWAYS verify before processing
2. **Use Environment Variables**: Never hardcode secrets
3. **Idempotency**: Use event IDs to prevent duplicate processing
4. **Transaction Atomicity**: Use DB transactions for all credit operations
5. **Rate Limiting**: Apply rate limits to payment endpoints
6. **PCI Compliance**: Card data never touches our servers
7. **Audit Trail**: Log all billing operations
8. **Input Validation**: Validate package IDs, amounts
9. **Authorization**: Verify user can purchase for target wallet

---

## Future Enhancements

- [ ] Promo codes / Discount codes
- [ ] Referral credits
- [ ] Bulk purchase API for enterprises
- [ ] Invoice generation (PDF)
- [ ] Low balance notifications
- [ ] Credit transfer between users (if needed)
- [ ] Multiple currency support
