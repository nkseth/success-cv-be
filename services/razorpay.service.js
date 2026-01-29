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
 * 
 * CRITICAL: This verifies the signature is authentic, but you should
 * also verify the payment status from Razorpay API for critical operations.
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
    // Ensure secret is configured
    if (!process.env.RAZORPAY_KEY_SECRET) {
        logger.error('[RAZORPAY] RAZORPAY_KEY_SECRET not configured for signature verification');
        throw new AppError('Payment verification not configured', 500);
    }
    
    const body = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(generatedSignature)
        );
    } catch (error) {
        // Buffers have different lengths - signatures don't match
        return false;
    }
};

/**
 * Capture an authorized payment
 * This transfers the funds from the customer's account
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in paise
 * @returns {Promise<Object>} - Captured payment object
 */
export const capturePayment = async (paymentId, amount) => {
    try {
        console.log('[RAZORPAY DEBUG] Capturing payment:', { paymentId, amount });
        const payment = await razorpay.payments.capture(paymentId, amount);
        console.log('[RAZORPAY DEBUG] Payment captured successfully:', { 
            paymentId, 
            status: payment.status 
        });
        logger.info('[RAZORPAY] Payment captured', { paymentId, amount, status: payment.status });
        return payment;
    } catch (error) {
        console.error('[RAZORPAY DEBUG] Failed to capture payment:', error.message);
        logger.error('[RAZORPAY] Failed to capture payment', { paymentId, error: error.message });
        throw error;
    }
};

/**
 * Verify payment is actually captured/paid by fetching from Razorpay API
 * If payment is in "authorized" state, it will be captured automatically
 * This is the authoritative check - never trust frontend data alone
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} expectedOrderId - Expected order ID (for additional validation)
 * @param {number} expectedAmount - Expected amount in paise (for capture)
 * @returns {Promise<{verified: boolean, payment?: Object, error?: string}>}
 */
export const verifyPaymentWithRazorpay = async (paymentId, expectedOrderId, expectedAmount = null) => {
    try {
        let payment = await razorpay.payments.fetch(paymentId);
        
        console.log('[RAZORPAY DEBUG] Payment fetched:', { 
            paymentId, 
            status: payment.status, 
            amount: payment.amount,
            order_id: payment.order_id 
        });
        
        // If payment is authorized but not captured, capture it
        if (payment.status === 'authorized') {
            console.log('[RAZORPAY DEBUG] Payment is authorized, attempting to capture...');
            const amountToCapture = expectedAmount || payment.amount;
            
            try {
                payment = await capturePayment(paymentId, amountToCapture);
            } catch (captureError) {
                logger.error('[RAZORPAY] Failed to capture authorized payment', { 
                    paymentId, 
                    error: captureError.message 
                });
                return { 
                    verified: false, 
                    error: `Failed to capture payment: ${captureError.message}`,
                    payment 
                };
            }
        }
        
        // Check payment status - must be captured for funds to be received
        if (payment.status !== 'captured') {
            logger.warn('[RAZORPAY] Payment not captured', { 
                paymentId, 
                status: payment.status,
                expectedOrderId 
            });
            return { 
                verified: false, 
                error: `Payment status is ${payment.status}, expected captured`,
                payment 
            };
        }
        
        // Verify the payment belongs to the expected order
        if (payment.order_id !== expectedOrderId) {
            logger.warn('[RAZORPAY] Payment order mismatch', { 
                paymentId, 
                paymentOrderId: payment.order_id,
                expectedOrderId 
            });
            return { 
                verified: false, 
                error: 'Payment order ID mismatch',
                payment 
            };
        }
        
        logger.info('[RAZORPAY] Payment verified with API', { 
            paymentId, 
            orderId: payment.order_id,
            amount: payment.amount,
            status: payment.status 
        });
        
        return { verified: true, payment };
    } catch (error) {
        logger.error('[RAZORPAY] Failed to verify payment with API', { 
            paymentId, 
            error: error.message 
        });
        return { verified: false, error: error.message };
    }
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
    verifyPaymentWithRazorpay,
    capturePayment,
    verifyWebhookSignature,
    fetchPayment,
    fetchOrder
};
