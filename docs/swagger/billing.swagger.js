/**
 * @swagger
 * tags:
 *   - name: Billing
 *     description: Credit management and payment processing endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CreditConfig:
 *       type: object
 *       properties:
 *         pricePerCredit:
 *           type: number
 *           description: Price per credit in INR
 *           example: 1
 *         minCredits:
 *           type: integer
 *           description: Minimum credits per purchase
 *           example: 10
 *         maxCredits:
 *           type: integer
 *           description: Maximum credits per purchase
 *           example: 10000
 *         currency:
 *           type: string
 *           example: INR
 *
 *     CreditBalance:
 *       type: object
 *       properties:
 *         balance:
 *           type: integer
 *           description: Available credits
 *           example: 25
 *         pending:
 *           type: integer
 *           description: Credits reserved for in-progress tasks
 *           example: 2
 *         lifetimeCredits:
 *           type: integer
 *           description: Total credits ever purchased
 *           example: 100
 *         lifetimeUsed:
 *           type: integer
 *           description: Total credits ever consumed
 *           example: 73
 *         type:
 *           type: string
 *           enum: [user, organisation]
 *           example: user
 *         organisationID:
 *           type: integer
 *           nullable: true
 *           description: Only present for organisation wallets
 *           example: null
 *
 *     CreditTransaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         walletID:
 *           type: integer
 *           example: 1
 *         initiatedByUserID:
 *           type: integer
 *           nullable: true
 *           example: 123
 *         initiatedByCandidateID:
 *           type: integer
 *           nullable: true
 *           example: null
 *         type:
 *           type: string
 *           enum: [purchase, debit, refund, admin_adjustment]
 *           example: debit
 *         amount:
 *           type: integer
 *           description: Positive = credit, Negative = debit
 *           example: -1
 *         balanceAfter:
 *           type: integer
 *           example: 24
 *         referenceType:
 *           type: string
 *           enum: [analysis, rewrite, purchase, admin]
 *           nullable: true
 *           example: analysis
 *         referenceID:
 *           type: string
 *           nullable: true
 *           example: job_abc123
 *         status:
 *           type: string
 *           enum: [pending, completed, reversed]
 *           example: completed
 *         description:
 *           type: string
 *           nullable: true
 *           example: Credit deducted for resume analysis
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     CreditHistoryResponse:
 *       type: object
 *       properties:
 *         transactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CreditTransaction'
 *         wallet:
 *           type: object
 *           properties:
 *             balance:
 *               type: integer
 *               example: 25
 *             pending:
 *               type: integer
 *               example: 2
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *
 *     CreditPurchaseRequest:
 *       type: object
 *       required:
 *         - credits
 *       properties:
 *         credits:
 *           type: integer
 *           description: Number of credits to purchase (min 10, max 10000)
 *           example: 100
 *         forOrganisation:
 *           type: boolean
 *           description: Whether to purchase for organisation wallet
 *           example: false
 *
 *     CreditPurchaseOrderResponse:
 *       type: object
 *       properties:
 *         orderID:
 *           type: string
 *           format: uuid
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         razorpayOrderId:
 *           type: string
 *           example: order_abc123
 *         amount:
 *           type: number
 *           example: 100
 *         currency:
 *           type: string
 *           example: INR
 *         credits:
 *           type: integer
 *           example: 100
 *         forOrganisation:
 *           type: boolean
 *           example: false
 *         razorpayKeyId:
 *           type: string
 *           description: Razorpay key ID for frontend
 *           example: rzp_test_xxxxxxxxxxxxx
 *
 *     PaymentVerificationRequest:
 *       type: object
 *       required:
 *         - razorpay_order_id
 *         - razorpay_payment_id
 *         - razorpay_signature
 *       properties:
 *         razorpay_order_id:
 *           type: string
 *           example: order_abc123
 *         razorpay_payment_id:
 *           type: string
 *           example: pay_xyz789
 *         razorpay_signature:
 *           type: string
 *           example: 9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d
 *
 *     PaymentVerificationResponse:
 *       type: object
 *       properties:
 *         verified:
 *           type: boolean
 *           example: true
 *         creditsAdded:
 *           type: integer
 *           description: Number of credits added
 *           example: 100
 *         newBalance:
 *           type: integer
 *           description: New wallet balance
 *           example: 125
 */

// ========== PUBLIC ROUTES ==========

/**
 * @swagger
 * /api/v1/billing/config:
 *   get:
 *     summary: Get credit system configuration
 *     description: |
 *       Returns the credit system configuration including pricing and limits.
 *       
 *       **Pricing:**
 *       - 1 Credit = ₹1 INR
 *       - Minimum purchase: 10 credits
 *       - Maximum purchase: 10,000 credits
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Credit configuration fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Credit configuration fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/CreditConfig'
 *             example:
 *               success: true
 *               message: Credit configuration fetched successfully
 *               data:
 *                 pricePerCredit: 1
 *                 minCredits: 10
 *                 maxCredits: 10000
 *                 currency: INR
 */

/**
 * @swagger
 * /api/v1/billing/webhook:
 *   post:
 *     summary: Razorpay webhook handler
 *     description: |
 *       Handles webhook events from Razorpay for payment lifecycle events.
 *       
 *       **Supported Events:**
 *       - `payment.captured` - Payment successfully captured
 *       - `payment.failed` - Payment failed
 *       
 *       **Security:**
 *       - Webhook signature is verified using `x-razorpay-signature` header
 *       - Uses timing-safe comparison to prevent timing attacks
 *       - No authentication required (public endpoint)
 *     tags: [Billing]
 *     parameters:
 *       - in: header
 *         name: x-razorpay-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Razorpay webhook signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 example: payment.captured
 *               payload:
 *                 type: object
 *                 description: Event-specific payload from Razorpay
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 processed:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing signature
 *       401:
 *         description: Invalid signature
 */

// ========== PROTECTED ROUTES ==========

/**
 * @swagger
 * /api/v1/billing/credits:
 *   get:
 *     summary: Get credit balance
 *     description: |
 *       Returns the current credit balance for the authenticated user or their organisation.
 *       
 *       **User Types:**
 *       - **Users (Individual):** Returns their personal wallet balance
 *       - **Candidates:** Returns the organisation wallet balance (they use org credits)
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit balance fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Credit balance fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/CreditBalance'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/billing/credits/purchase:
 *   post:
 *     summary: Create credit purchase order
 *     description: |
 *       Creates a Razorpay order for purchasing credits.
 *       
 *       **Important Notes:**
 *       - Only Users can purchase credits (not Candidates)
 *       - Candidates must contact their organisation admin to purchase credits
 *       - Users can purchase for themselves or their organisation
 *       - Pricing: 1 Credit = ₹1 INR
 *       - Minimum: 10 credits, Maximum: 10,000 credits
 *       
 *       **Response contains:**
 *       - Razorpay order ID for frontend checkout
 *       - Razorpay key ID for frontend initialization
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreditPurchaseRequest'
 *           examples:
 *             personal:
 *               summary: Purchase for personal wallet
 *               value:
 *                 credits: 100
 *             organisation:
 *               summary: Purchase for organisation wallet
 *               value:
 *                 credits: 500
 *                 forOrganisation: true
 *     responses:
 *       200:
 *         description: Payment order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payment order created
 *                 data:
 *                   $ref: '#/components/schemas/CreditPurchaseOrderResponse'
 *       400:
 *         description: Invalid credits amount or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Credits must be between 10 and 10000
 *       403:
 *         description: Candidates cannot purchase credits
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Candidates cannot purchase credits. Please contact your organisation admin.
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/billing/credits/history:
 *   get:
 *     summary: Get credit transaction history
 *     description: |
 *       Returns the credit transaction history for the authenticated user or their organisation.
 *       
 *       **User Types:**
 *       - **Users (Individual):** Returns their personal wallet transactions
 *       - **Candidates:** Returns the organisation wallet transactions
 *       
 *       **Transaction Types:**
 *       - `purchase` - Credits purchased via Razorpay
 *       - `debit` - Credit consumed for task (analysis/rewrite)
 *       - `refund` - Credit returned (failed task)
 *       - `admin_adjustment` - Manual adjustment by admin
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of transactions per page
 *     responses:
 *       200:
 *         description: Credit history fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Credit history fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/CreditHistoryResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/billing/verify-payment:
 *   post:
 *     summary: Verify Razorpay payment
 *     description: |
 *       Verifies a Razorpay payment after checkout and credits the user's wallet.
 *       
 *       **Process:**
 *       1. Frontend completes Razorpay checkout
 *       2. Frontend receives payment details from Razorpay
 *       3. Frontend calls this endpoint with payment details
 *       4. Backend verifies signature and credits wallet
 *       
 *       **Note:** This is the primary payment verification method. Webhooks provide a backup.
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentVerificationRequest'
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payment verified successfully
 *                 data:
 *                   $ref: '#/components/schemas/PaymentVerificationResponse'
 *       400:
 *         description: Missing payment verification data or invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_data:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   message: Missing payment verification data
 *               invalid_signature:
 *                 summary: Invalid payment signature
 *                 value:
 *                   success: false
 *                   message: Payment verification failed
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
