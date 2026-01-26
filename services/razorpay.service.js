import crypto from 'crypto';
import { razorpay, RAZORPAY_WEBHOOK_SECRET } from '../config/razorpay.config.js';
import logger from '../middleware/logger.js';
import { AppError } from '../middleware/error.js';

/**
 * Create a Razorpay order for credit purchase
 * @param {number} amount - Amount in INR
 * @param {string} currency - Currency code (default: INR)
 * @param {string} receipt - Unique receipt ID
 * @param {Object} notes - Additional notes
 */
export const createOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
    try {
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency,
            receipt,
            notes
        });
        
        logger.info('[RAZORPAY] Order created', { orderId: order.id, amount, currency });
        return order;
    } catch (error) {
        logger.error('[RAZORPAY] Failed to create order', { error: error.message });
        throw new AppError('Failed to create payment order', 500);
    }
};

/**
 * Verify Razorpay payment signature
 * Used after frontend receives payment confirmation
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const body = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    
    return generatedSignature === signature;
};

/**
 * Verify Razorpay webhook signature
 * CRITICAL: Always verify before processing any webhook
 * 
 * @param {string} rawBody - Raw request body (not parsed JSON)
 * @param {string} signature - X-Razorpay-Signature header value
 */
export const verifyWebhookSignature = (rawBody, signature) => {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        logger.error('[RAZORPAY] RAZORPAY_WEBHOOK_SECRET not configured');
        throw new AppError('Webhook secret not configured', 500);
    }
    
    if (!signature) {
        return false;
    }
    
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (error) {
        // Buffers have different lengths
        return false;
    }
};

/**
 * Fetch payment details from Razorpay
 */
export const fetchPayment = async (paymentId) => {
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        logger.error('[RAZORPAY] Failed to fetch payment', { error: error.message });
        throw new AppError('Failed to fetch payment details', 500);
    }
};

/**
 * Fetch order details from Razorpay
 */
export const fetchOrder = async (orderId) => {
    try {
        const order = await razorpay.orders.fetch(orderId);
        return order;
    } catch (error) {
        logger.error('[RAZORPAY] Failed to fetch order', { error: error.message });
        throw new AppError('Failed to fetch order details', 500);
    }
};

export default {
    createOrder,
    verifyPaymentSignature,
    verifyWebhookSignature,
    fetchPayment,
    fetchOrder
};
