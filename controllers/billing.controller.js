import { asyncHandler, AppError } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import billingService from "../services/billing.service.js";
import razorpayService from "../services/razorpay.service.js";
import { validateInteger } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Get credit system configuration
 * GET /api/v1/billing/config
 * 
 * Returns min/max credits, price per credit for frontend
 */
export const getConfigController = asyncHandler(async (req, res) => {
    const config = billingService.getCreditConfig();
    sendSuccess(res, config, 'Credit configuration fetched successfully');
});

/**
 * Get credit balance
 * GET /api/v1/billing/credits
 */
export const getCreditsController = asyncHandler(async (req, res) => {
    const { userID, organisationID, type: userType } = req;
    
    const credits = await billingService.getCreditBalance(userID, organisationID, userType);
    
    sendSuccess(res, credits, 'Credit balance fetched successfully');
});

/**
 * Purchase credits - ONLY for users, NOT candidates
 * POST /api/v1/billing/credits/purchase
 * 
 * Body: { credits: number, forOrganisation?: boolean }
 * 
 * Candidates cannot purchase credits - they use organisation credits only.
 * Users can purchase credits for themselves or for their organisation.
 */
export const purchaseCreditsController = asyncHandler(async (req, res) => {
    const { userID, organisationID, type: userType } = req;
    const { credits, forOrganisation } = req.body;
    
    // Candidates cannot purchase credits
    if (userType === userTypeConstants.CANDIDATE) {
        throw new AppError('Candidates cannot purchase credits. Please contact your organisation admin.', 403);
    }
    
    // Validate credits
    if (!credits) {
        throw new AppError('Credits amount is required', 400);
    }
    
    const creditsAmount = validateInteger(credits, 'Credits');
    
    // If purchasing for org, must be a member of an org
    let targetOrgID = null;
    if (forOrganisation) {
        if (!organisationID) {
            throw new AppError('You are not a member of any organisation', 400);
        }
        targetOrgID = organisationID;
    }
    
    // Create purchase order
    const order = await billingService.createCreditPurchaseOrder(
        userID,
        targetOrgID,
        creditsAmount
    );
    
    sendSuccess(res, order, 'Payment order created');
});

/**
 * Get credit transaction history
 * GET /api/v1/billing/credits/history
 */
export const getCreditHistoryController = asyncHandler(async (req, res) => {
    const { userID, organisationID, type: userType } = req;
    const { page = 1, limit = 20 } = req.query;
    
    const history = await billingService.getCreditHistory(
        userID,
        organisationID,
        userType,
        { page: parseInt(page), limit: parseInt(limit) }
    );
    
    sendSuccess(res, history, 'Credit history fetched successfully');
});

/**
 * Verify payment and complete transaction
 * POST /api/v1/billing/verify-payment
 */
export const verifyPaymentController = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    console.log('[BILLING DEBUG] verifyPaymentController called with:', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: razorpay_signature ? `${razorpay_signature.substring(0, 10)}...` : 'MISSING'
    });
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.log('[BILLING DEBUG] Missing payment verification data');
        throw new AppError('Missing payment verification data', 400);
    }
    
    console.log('[BILLING DEBUG] Calling billingService.verifyAndCompletePayment');
    
    const result = await billingService.verifyAndCompletePayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    );
    
    console.log('[BILLING DEBUG] verifyAndCompletePayment result:', result);
    
    sendSuccess(res, result, 'Payment verified successfully');
});

/**
 * Razorpay webhook handler
 * POST /api/v1/billing/webhook
 * 
 * IMPORTANT: This endpoint must:
 * 1. Receive raw body for signature verification
 * 2. Verify signature before processing
 * 3. Always return 200 to Razorpay (even on errors, to prevent retries)
 */
export const webhookController = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        
        if (!signature) {
            logger.warn('[WEBHOOK] Missing signature header');
            // Still return 200 to prevent Razorpay from retrying invalid requests
            return res.status(200).json({ status: 'error', error: 'Missing signature' });
        }
        
        // Get raw body for signature verification
        // The raw body should be set by middleware before JSON parsing
        const rawBody = req.rawBody;
        
        if (!rawBody) {
            logger.error('[WEBHOOK] Raw body not available - middleware not configured correctly');
            return res.status(200).json({ status: 'error', error: 'Server configuration error' });
        }
        
        // Verify webhook signature
        const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
        
        if (!isValid) {
            logger.warn('[WEBHOOK] Invalid signature', { 
                signatureLength: signature?.length,
                bodyLength: rawBody?.length 
            });
            // Return 200 to prevent retries of invalid signature requests
            return res.status(200).json({ status: 'error', error: 'Invalid signature' });
        }
        
        // Log incoming webhook for debugging
        logger.info('[WEBHOOK] Received valid webhook', {
            event: req.body?.event,
            paymentId: req.body?.payload?.payment?.entity?.id,
            orderId: req.body?.payload?.payment?.entity?.order_id
        });
        
        // Process webhook - errors are handled internally
        const result = await billingService.handleWebhook(req.body);
        
        // Always return 200 to Razorpay
        res.status(200).json({ status: 'ok', ...result });
    } catch (error) {
        // Log the error but still return 200 to Razorpay
        logger.error('[WEBHOOK] Unhandled error in webhook processing', {
            error: error.message,
            stack: error.stack,
            body: req.body?.event
        });
        
        // CRITICAL: Always return 200 to prevent Razorpay from retrying
        res.status(200).json({ status: 'error', error: 'Internal processing error' });
    }
};

export default {
    getConfigController,
    getCreditsController,
    purchaseCreditsController,
    getCreditHistoryController,
    verifyPaymentController,
    webhookController
};
