import billingModel from '../models/billing.model.js';
import razorpayService from './razorpay.service.js';
import { CREDIT_CONFIG, validateCreditAmount, calculatePrice } from '../config/razorpay.config.js';
import { AppError } from '../middleware/error.js';
import logger from '../middleware/logger.js';
import { db } from '../config/db.js';
import { razorpayWebhooksTable } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { userTypeConstants } from '../utils/constants.js';

// ========== CREDIT CONFIG ==========

/**
 * Get credit system configuration (for frontend)
 */
export const getCreditConfig = () => {
    return {
        pricePerCredit: CREDIT_CONFIG.pricePerCredit,
        minCredits: CREDIT_CONFIG.minCredits,
        maxCredits: CREDIT_CONFIG.maxCredits,
        currency: CREDIT_CONFIG.currency
    };
};

// ========== CREDITS ==========

/**
 * Get credit balance for user or candidate
 * 
 * IMPORTANT:
 * - Users (individual): Get their personal wallet balance
 * - Candidates: Get their organisation's wallet balance (they don't have personal wallets)
 */
export const getCreditBalance = async (userID, organisationID = null, userType = 'user') => {
    // Candidates can only see organisation credits
    if (userType === userTypeConstants.CANDIDATE) {
        if (!organisationID) {
            return {
                balance: 0,
                pending: 0,
                lifetimeCredits: 0,
                lifetimeUsed: 0,
                type: 'organisation',
                message: 'Candidate not associated with an organisation'
            };
        }
        
        const orgWallet = await billingModel.getOrCreateWallet('organisation', organisationID);
        return {
            balance: orgWallet.balance,
            pending: orgWallet.pendingBalance,
            lifetimeCredits: orgWallet.lifetimeCredits,
            lifetimeUsed: orgWallet.lifetimeUsed,
            type: 'organisation',
            organisationID
        };
    }
    
    // Users get their personal wallet balance
    const personalWallet = await billingModel.getOrCreateWallet('user', userID);
    
    return {
        balance: personalWallet.balance,
        pending: personalWallet.pendingBalance,
        lifetimeCredits: personalWallet.lifetimeCredits,
        lifetimeUsed: personalWallet.lifetimeUsed,
        type: 'user'
    };
};

/**
 * Get transaction history
 * 
 * - Users: See their personal transaction history
 * - Candidates: See their organisation's transaction history
 */
export const getCreditHistory = async (userID, organisationID, userType = 'user', options = {}) => {
    let wallet;
    
    // Candidates see org transaction history
    if (userType === userTypeConstants.CANDIDATE) {
        if (!organisationID) {
            return { transactions: [], wallet: { balance: 0, pending: 0 }, total: 0 };
        }
        wallet = await billingModel.getOrCreateWallet('organisation', organisationID);
    } 
    // Users see their personal transaction history
    else {
        wallet = await billingModel.getOrCreateWallet('user', userID);
    }
    
    const [transactions, total] = await Promise.all([
        billingModel.getTransactionHistory(wallet.id, options),
        billingModel.getTransactionCount(wallet.id)
    ]);
    
    return {
        transactions,
        wallet: {
            balance: wallet.balance,
            pending: wallet.pendingBalance,
            lifetimeCredits: wallet.lifetimeCredits,
            lifetimeUsed: wallet.lifetimeUsed
        },
        total,
        page: options.page || 1,
        limit: options.limit || 20
    };
};

// ========== CREDIT PURCHASE ==========

/**
 * Create credit purchase order
 * 
 * @param {number} userID - User making the purchase
 * @param {number|null} forOrganisationID - If purchasing for an org (null = personal wallet)
 * @param {number} credits - Number of credits to purchase
 */
export const createCreditPurchaseOrder = async (userID, forOrganisationID, credits) => {
    // Validate credit amount
    const validation = validateCreditAmount(credits);
    if (!validation.valid) {
        throw new AppError(validation.error, 400);
    }
    
    // Calculate price (1:1 ratio)
    const price = calculatePrice(credits);
    
    // Get or create the target wallet
    const ownerType = forOrganisationID ? 'organisation' : 'user';
    const ownerID = forOrganisationID || userID;
    const wallet = await billingModel.getOrCreateWallet(ownerType, ownerID);
    
    // Create Razorpay order
    const receipt = `credits_${userID}_${Date.now()}`;
    const order = await razorpayService.createOrder(
        price,
        CREDIT_CONFIG.currency,
        receipt,
        { 
            userID: String(userID), 
            credits: String(credits),
            forOrganisationID: forOrganisationID ? String(forOrganisationID) : '',
            walletID: String(wallet.id)
        }
    );
    
    // Save order to database
    const paymentOrder = await billingModel.createPaymentOrder({
        userID,
        walletID: wallet.id,
        forOrganisationID: forOrganisationID || null,
        creditsAmount: credits,
        amount: price,
        currency: CREDIT_CONFIG.currency,
        razorpayOrderId: order.id
    });
    
    logger.info('[BILLING] Credit purchase order created', {
        orderID: paymentOrder.id,
        userID,
        forOrganisationID,
        credits,
        price
    });
    
    return {
        orderId: order.id,
        amount: order.amount, // in paise
        amountInRupees: price,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        credits,
        internalOrderId: paymentOrder.id,
        walletType: forOrganisationID ? 'organisation' : 'personal'
    };
};

// ========== PAYMENT VERIFICATION ==========

/**
 * Verify and complete payment
 * 
 * CRITICAL SECURITY: This function performs two-step verification:
 * 1. Verify the signature from Razorpay callback (client-side)
 * 2. Verify payment status directly with Razorpay API (server-side authoritative check)
 * 
 * Never trust frontend data alone - always verify with Razorpay API
 */
export const verifyAndCompletePayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    console.log('[BILLING DEBUG] verifyAndCompletePayment started:', {
        razorpayOrderId,
        razorpayPaymentId
    });
    
    // Step 1: Verify signature (quick initial check)
    console.log('[BILLING DEBUG] Step 1: Verifying payment signature');
    const isSignatureValid = razorpayService.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    );
    
    console.log('[BILLING DEBUG] Signature verification result:', isSignatureValid);
    
    if (!isSignatureValid) {
        console.log('[BILLING DEBUG] Invalid payment signature - rejecting');
        logger.warn('[BILLING] Invalid payment signature', { razorpayOrderId, razorpayPaymentId });
        throw new AppError('Invalid payment signature', 400);
    }
    
    // Get our order first
    console.log('[BILLING DEBUG] Fetching order from database for:', razorpayOrderId);
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    console.log('[BILLING DEBUG] Order found:', order ? { id: order.id, status: order.status, walletID: order.walletID, creditsAmount: order.creditsAmount } : 'NOT FOUND');
    
    if (!order) {
        console.log('[BILLING DEBUG] Order not found - rejecting');
        throw new AppError('Order not found', 404);
    }
    
    if (order.status === 'paid') {
        console.log('[BILLING DEBUG] Order already paid - returning early');
        logger.info('[BILLING] Payment already processed', { orderID: order.id });
        return { 
            message: 'Payment already processed', 
            credits: order.creditsAmount,
            newBalance: null // Already processed, can't get new balance easily
        };
    }
    
    // Step 2: CRITICAL - Verify payment status directly with Razorpay API
    // This is the authoritative check - never trust frontend data alone
    console.log('[BILLING DEBUG] Step 2: Verifying payment with Razorpay API');
    // Pass expected amount in paise for capture if needed
    const expectedAmountInPaise = Math.round(order.amount * 100);
    const apiVerification = await razorpayService.verifyPaymentWithRazorpay(
        razorpayPaymentId, 
        razorpayOrderId,
        expectedAmountInPaise
    );
    
    console.log('[BILLING DEBUG] API verification result:', {
        verified: apiVerification.verified,
        error: apiVerification.error,
        paymentStatus: apiVerification.payment?.status,
        paymentAmount: apiVerification.payment?.amount
    });
    
    if (!apiVerification.verified) {
        console.log('[BILLING DEBUG] API verification failed - rejecting');
        logger.error('[BILLING] Payment verification failed with Razorpay API', { 
            razorpayOrderId, 
            razorpayPaymentId,
            error: apiVerification.error,
            paymentStatus: apiVerification.payment?.status
        });
        
        // Update order status to failed
        await billingModel.updatePaymentOrder(order.id, {
            status: 'failed',
            razorpayPaymentId,
            failureReason: apiVerification.error
        });
        
        throw new AppError(`Payment verification failed: ${apiVerification.error}`, 400);
    }
    
    // Verify amount matches our order (in paise) - use the already calculated value
    console.log('[BILLING DEBUG] Verifying amount:', {
        expectedAmountInPaise,
        actualAmount: apiVerification.payment.amount,
        orderAmount: order.amount
    });
    
    if (apiVerification.payment.amount !== expectedAmountInPaise) {
        console.log('[BILLING DEBUG] Amount mismatch - rejecting');
        logger.error('[BILLING] Payment amount mismatch', { 
            razorpayOrderId, 
            expectedAmount: expectedAmountInPaise,
            actualAmount: apiVerification.payment.amount
        });
        
        await billingModel.updatePaymentOrder(order.id, {
            status: 'failed',
            razorpayPaymentId,
            failureReason: 'Payment amount mismatch'
        });
        
        throw new AppError('Payment amount does not match order', 400);
    }
    
    // All verifications passed - Update order status
    console.log('[BILLING DEBUG] All verifications passed, updating order status to paid');
    console.log('[BILLING DEBUG] Order details:', {
        orderID: order.id,
        walletID: order.walletID,
        creditsAmount: order.creditsAmount,
        userID: order.userID
    });
    
    await billingModel.updatePaymentOrder(order.id, {
        status: 'paid',
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date()
    });
    
    console.log('[BILLING DEBUG] Order status updated to paid, now adding credits to wallet');
    
    // Add credits to wallet
    try {
        const wallet = await billingModel.addCredits(
            order.walletID,
            order.creditsAmount,
            'purchase',
            'purchase',
            order.id,
            `Purchased ${order.creditsAmount} credits`,
            order.userID
        );
        
        console.log('[BILLING DEBUG] Credits added successfully:', {
            walletID: wallet.id,
            newBalance: wallet.balance
        });
        
        logger.info('[BILLING] Payment verified and credits added', { 
            orderID: order.id,
            credits: order.creditsAmount,
            newBalance: wallet.balance,
            razorpayPaymentId
        });
        
        return { 
            message: 'Payment successful',
            credits: order.creditsAmount,
            newBalance: wallet.balance
        };
    } catch (error) {
        console.error('[BILLING DEBUG] ERROR adding credits:', error.message, error.stack);
        // Order is marked as paid but credits failed - this needs manual intervention
        logger.error('[BILLING] CRITICAL: Payment marked as paid but credits failed to add', {
            orderID: order.id,
            walletID: order.walletID,
            creditsAmount: order.creditsAmount,
            error: error.message
        });
        throw error;
    }
};

// ========== WEBHOOK HANDLING ==========

/**
 * Handle Razorpay webhook
 * 
 * IMPORTANT: 
 * - Signature must be verified BEFORE calling this function
 * - This function should NOT throw errors - all errors are handled internally
 */
export const handleWebhook = async (payload) => {
    // Use Razorpay's account_id + event for a more unique event ID, 
    // or fall back to payment/order entity ID
    const eventId = payload.payload?.payment?.entity?.id || 
                    payload.payload?.order?.entity?.id ||
                    `${payload.event}-${Date.now()}`;
    const eventType = payload.event;
    
    logger.info('[WEBHOOK] Processing webhook', { eventType, eventId });
    
    // Check for duplicate (idempotency)
    try {
        const [existing] = await db.select()
            .from(razorpayWebhooksTable)
            .where(eq(razorpayWebhooksTable.eventId, eventId));
        
        if (existing) {
            logger.info('[WEBHOOK] Duplicate webhook ignored', { eventId, eventType });
            return { status: 'duplicate' };
        }
    } catch (error) {
        logger.error('[WEBHOOK] Error checking for duplicate', { eventId, error: error.message });
        // Continue processing - better to potentially duplicate than to skip
    }
    
    // Log webhook to database
    try {
        await db.insert(razorpayWebhooksTable).values({
            eventType,
            eventId,
            payload,
            status: 'received'
        });
    } catch (error) {
        logger.error('[WEBHOOK] Error logging webhook', { eventId, error: error.message });
        // Continue processing even if logging fails
    }
    
    try {
        // Process based on event type
        switch (eventType) {
            case 'payment.authorized':
                // Payment authorized but not yet captured
                // Useful for logging, but actual credit addition happens on capture
                logger.info('[WEBHOOK] Payment authorized', { 
                    paymentId: payload.payload?.payment?.entity?.id 
                });
                break;
                
            case 'payment.captured':
                await handlePaymentCaptured(payload.payload.payment.entity);
                break;
            
            case 'payment.failed':
                await handlePaymentFailed(payload.payload.payment.entity);
                break;
                
            case 'order.paid':
                // Order fully paid - this is another trigger point for credit addition
                await handleOrderPaid(payload.payload.order.entity, payload.payload.payment?.entity);
                break;
            
            default:
                logger.info('[WEBHOOK] Unhandled webhook event type', { eventType });
        }
        
        // Update webhook status to processed
        await db.update(razorpayWebhooksTable)
            .set({ status: 'processed', processedAt: new Date() })
            .where(eq(razorpayWebhooksTable.eventId, eventId));
        
        return { status: 'processed', eventType };
    } catch (error) {
        logger.error('[WEBHOOK] Error processing webhook', { 
            eventId, 
            eventType,
            error: error.message,
            stack: error.stack 
        });
        
        // Update webhook status to failed
        try {
            await db.update(razorpayWebhooksTable)
                .set({ status: 'failed', errorMessage: error.message })
                .where(eq(razorpayWebhooksTable.eventId, eventId));
        } catch (updateError) {
            logger.error('[WEBHOOK] Error updating webhook status', { eventId, error: updateError.message });
        }
        
        // Return error status but don't throw - webhook should still return 200
        return { status: 'error', error: error.message };
    }
};

/**
 * Handle payment.captured webhook
 */
const handlePaymentCaptured = async (payment) => {
    const razorpayOrderId = payment.order_id;
    const paymentId = payment.id;
    
    logger.info('[WEBHOOK] Processing payment.captured', { 
        paymentId, 
        razorpayOrderId,
        amount: payment.amount,
        currency: payment.currency
    });
    
    if (!razorpayOrderId) {
        logger.warn('[WEBHOOK] Payment captured without order_id', { paymentId });
        return;
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        logger.warn('[WEBHOOK] Order not found for captured payment', { razorpayOrderId, paymentId });
        return;
    }
    
    if (order.status === 'paid') {
        logger.info('[WEBHOOK] Order already paid (via verify-payment or previous webhook)', { orderID: order.id });
        return;
    }
    
    // Update order and add credits
    await billingModel.updatePaymentOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: paymentId,
        paidAt: new Date()
    });
    
    await billingModel.addCredits(
        order.walletID,
        order.creditsAmount,
        'purchase',
        'purchase',
        order.id,
        `Purchased ${order.creditsAmount} credits (via payment.captured webhook)`,
        order.userID
    );
    
    logger.info('[WEBHOOK] Payment captured - credits added successfully', { 
        orderID: order.id, 
        credits: order.creditsAmount,
        paymentId,
        razorpayOrderId
    });
};

/**
 * Handle payment.failed webhook
 */
const handlePaymentFailed = async (payment) => {
    const razorpayOrderId = payment.order_id;
    
    if (!razorpayOrderId) {
        logger.warn('[WEBHOOK] Payment failed without order_id', { paymentId: payment.id });
        return;
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        logger.warn('[WEBHOOK] Order not found for failed payment', { razorpayOrderId });
        return;
    }
    
    // Don't update if already paid
    if (order.status === 'paid') {
        logger.info('[WEBHOOK] Order already paid, ignoring failure', { orderID: order.id });
        return;
    }
    
    // Update order status
    await billingModel.updatePaymentOrder(order.id, {
        status: 'failed',
        razorpayPaymentId: payment.id,
        failureReason: payment.error_description || payment.error_reason || 'Payment failed'
    });
    
    logger.info('[WEBHOOK] Payment failed webhook processed', { 
        orderID: order.id,
        reason: payment.error_description 
    });
};

/**
 * Handle order.paid webhook
 * This is an alternative event that Razorpay sends when an order is fully paid
 */
const handleOrderPaid = async (orderEntity, paymentEntity) => {
    const razorpayOrderId = orderEntity?.id;
    
    if (!razorpayOrderId) {
        logger.warn('[WEBHOOK] Order paid without order id');
        return;
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        logger.warn('[WEBHOOK] Order not found for order.paid event', { razorpayOrderId });
        return;
    }
    
    if (order.status === 'paid') {
        logger.info('[WEBHOOK] Order already paid', { orderID: order.id });
        return;
    }
    
    // Update order and add credits
    const paymentId = paymentEntity?.id || orderEntity?.payments?.items?.[0]?.id;
    
    await billingModel.updatePaymentOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: paymentId || null,
        paidAt: new Date()
    });
    
    await billingModel.addCredits(
        order.walletID,
        order.creditsAmount,
        'purchase',
        'purchase',
        order.id,
        `Purchased ${order.creditsAmount} credits (via order.paid webhook)`,
        order.userID
    );
    
    logger.info('[WEBHOOK] Order paid webhook processed', { 
        orderID: order.id, 
        credits: order.creditsAmount 
    });
};

// ========== ADMIN CREDIT ADJUSTMENT ==========

/**
 * Admin adjust credits - add or remove credits from a user's or organisation's wallet
 * 
 * @param {'user' | 'organisation'} ownerType - Type of wallet owner
 * @param {number} ownerID - User ID or Organisation ID
 * @param {number} amount - Credits to add (positive) or remove (negative)
 * @param {string} reason - Reason for adjustment
 * @param {number} adminID - Admin making the adjustment
 */
export const adminAdjustCredits = async (ownerType, ownerID, amount, reason, adminID) => {
    // Get or create wallet
    const wallet = await billingModel.getOrCreateWallet(ownerType, ownerID);
    
    // Perform adjustment
    const result = await billingModel.adminAdjustCredits(wallet.id, amount, reason, adminID);
    
    logger.info('[BILLING] Admin adjusted credits', {
        ownerType,
        ownerID,
        walletID: wallet.id,
        amount,
        adminID,
        newBalance: result.wallet.balance
    });
    
    return {
        wallet: {
            id: result.wallet.id,
            balance: result.wallet.balance,
            pendingBalance: result.wallet.pendingBalance,
            lifetimeCredits: result.wallet.lifetimeCredits,
            lifetimeUsed: result.wallet.lifetimeUsed
        },
        transaction: {
            id: result.transaction.id,
            type: result.transaction.type,
            amount: result.transaction.amount,
            balanceAfter: result.transaction.balanceAfter,
            description: result.transaction.description,
            createdAt: result.transaction.createdAt
        }
    };
};

/**
 * Get wallet info for admin (by user or organisation)
 */
export const getWalletForAdmin = async (ownerType, ownerID) => {
    const wallet = await billingModel.getOrCreateWallet(ownerType, ownerID);
    
    // Get recent transactions
    const transactions = await billingModel.getTransactionHistory(wallet.id, { page: 1, limit: 10 });
    
    return {
        wallet: {
            id: wallet.id,
            balance: wallet.balance,
            pendingBalance: wallet.pendingBalance,
            lifetimeCredits: wallet.lifetimeCredits,
            lifetimeUsed: wallet.lifetimeUsed,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt
        },
        recentTransactions: transactions
    };
};

export default {
    getCreditConfig,
    getCreditBalance,
    getCreditHistory,
    createCreditPurchaseOrder,
    verifyAndCompletePayment,
    handleWebhook,
    adminAdjustCredits,
    getWalletForAdmin
};
