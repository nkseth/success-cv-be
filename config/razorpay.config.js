import Razorpay from 'razorpay';

// Initialize Razorpay instance
export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Webhook secret from environment (CRITICAL for security)
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Credit system configuration
// 1 Credit = 1 INR (simple pricing)
export const CREDIT_CONFIG = {
    // Price per credit in INR
    pricePerCredit: 1,
    
    // Minimum credits user can purchase
    minCredits: 10,
    
    // Maximum credits in a single purchase
    maxCredits: 10000,
    
    // Currency
    currency: 'INR'
};

/**
 * Calculate price for given credits (1:1 ratio)
 * @param {number} credits - Number of credits
 * @returns {number} - Price in INR
 */
export const calculatePrice = (credits) => {
    return credits * CREDIT_CONFIG.pricePerCredit;
};

/**
 * Validate credit amount
 * @param {number} credits - Number of credits to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateCreditAmount = (credits) => {
    if (!Number.isInteger(credits) || credits <= 0) {
        return { valid: false, error: 'Credits must be a positive integer' };
    }
    
    if (credits < CREDIT_CONFIG.minCredits) {
        return { valid: false, error: `Minimum ${CREDIT_CONFIG.minCredits} credits required` };
    }
    
    if (credits > CREDIT_CONFIG.maxCredits) {
        return { valid: false, error: `Maximum ${CREDIT_CONFIG.maxCredits} credits per purchase` };
    }
    
    return { valid: true };
};

export default razorpay;

