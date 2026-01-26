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
 */
export const verifyAndCompletePayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    );
    
    if (!isValid) {
        logger.warn('[BILLING] Invalid payment signature', { razorpayOrderId });
        throw new AppError('Invalid payment signature', 400);
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        throw new AppError('Order not found', 404);
    }
    
    if (order.status === 'paid') {
        logger.info('[BILLING] Payment already processed', { orderID: order.id });
        return { 
            message: 'Payment already processed', 
            credits: order.creditsAmount,
            newBalance: null // Already processed, can't get new balance easily
        };
    }
    
    // Update order status
    await billingModel.updatePaymentOrder(order.id, {
        status: 'paid',
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date()
    });
    
    // Add credits to wallet
    const wallet = await billingModel.addCredits(
        order.walletID,
        order.creditsAmount,
        'purchase',
        'purchase',
        order.id,
        `Purchased ${order.creditsAmount} credits`,
        order.userID
    );
    
    logger.info('[BILLING] Payment verified and credits added', { 
        orderID: order.id,
        credits: order.creditsAmount,
        newBalance: wallet.balance
    });
    
    return { 
        message: 'Payment successful',
        credits: order.creditsAmount,
        newBalance: wallet.balance
    };
};

// ========== WEBHOOK HANDLING ==========

/**
 * Handle Razorpay webhook
 * 
 * IMPORTANT: Signature must be verified BEFORE calling this function
 */
export const handleWebhook = async (payload) => {
    const eventId = payload.payload?.payment?.entity?.id || 
                    payload.payload?.order?.entity?.id ||
                    `${payload.event}-${Date.now()}`;
    const eventType = payload.event;
    
    // Check for duplicate (idempotency)
    const [existing] = await db.select()
        .from(razorpayWebhooksTable)
        .where(eq(razorpayWebhooksTable.eventId, eventId));
    
    if (existing) {
        logger.info('[BILLING] Duplicate webhook ignored', { eventId, eventType });
        return { status: 'duplicate' };
    }
    
    // Log webhook
    await db.insert(razorpayWebhooksTable).values({
        eventType,
        eventId,
        payload,
        status: 'received'
    });
    
    try {
        // Process based on event type
        switch (eventType) {
            case 'payment.captured':
                await handlePaymentCaptured(payload.payload.payment.entity);
                break;
            
            case 'payment.failed':
                await handlePaymentFailed(payload.payload.payment.entity);
                break;
            
            default:
                logger.info('[BILLING] Unhandled webhook event', { eventType });
        }
        
        // Update webhook status
        await db.update(razorpayWebhooksTable)
            .set({ status: 'processed', processedAt: new Date() })
            .where(eq(razorpayWebhooksTable.eventId, eventId));
        
        return { status: 'processed' };
    } catch (error) {
        logger.error('[BILLING] Webhook processing error', { eventId, error: error.message });
        
        await db.update(razorpayWebhooksTable)
            .set({ status: 'failed', errorMessage: error.message })
            .where(eq(razorpayWebhooksTable.eventId, eventId));
        
        throw error;
    }
};

/**
 * Handle payment.captured webhook
 */
const handlePaymentCaptured = async (payment) => {
    const razorpayOrderId = payment.order_id;
    
    if (!razorpayOrderId) {
        logger.warn('[BILLING] Payment captured without order_id', { paymentId: payment.id });
        return;
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        logger.warn('[BILLING] Order not found for captured payment', { razorpayOrderId });
        return;
    }
    
    if (order.status === 'paid') {
        logger.info('[BILLING] Order already paid (via verify-payment)', { orderID: order.id });
        return;
    }
    
    // Update order and add credits
    await billingModel.updatePaymentOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: payment.id,
        paidAt: new Date()
    });
    
    await billingModel.addCredits(
        order.walletID,
        order.creditsAmount,
        'purchase',
        'purchase',
        order.id,
        `Purchased ${order.creditsAmount} credits (via webhook)`,
        order.userID
    );
    
    logger.info('[BILLING] Payment captured via webhook', { 
        orderID: order.id, 
        credits: order.creditsAmount 
    });
};

/**
 * Handle payment.failed webhook
 */
const handlePaymentFailed = async (payment) => {
    const razorpayOrderId = payment.order_id;
    
    if (!razorpayOrderId) {
        logger.warn('[BILLING] Payment failed without order_id', { paymentId: payment.id });
        return;
    }
    
    // Get our order
    const order = await billingModel.getPaymentOrderByRazorpayID(razorpayOrderId);
    if (!order) {
        logger.warn('[BILLING] Order not found for failed payment', { razorpayOrderId });
        return;
    }
    
    // Update order status
    await billingModel.updatePaymentOrder(order.id, {
        status: 'failed',
        razorpayPaymentId: payment.id,
        failureReason: payment.error_description || payment.error_reason || 'Payment failed'
    });
    
    logger.info('[BILLING] Payment failed webhook processed', { 
        orderID: order.id,
        reason: payment.error_description 
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
