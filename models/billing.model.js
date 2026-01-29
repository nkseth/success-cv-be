import { db } from "../config/db.js";
import { 
    creditWalletsTable, 
    creditTransactionsTable,
    paymentOrdersTable
} from "../drizzle/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { AppError } from "../middleware/error.js";
import logger from "../middleware/logger.js";

// ========== WALLET OPERATIONS ==========

/**
 * Get or create wallet for user/organisation
 * @param {'user' | 'organisation'} ownerType - Type of wallet owner
 * @param {number} ownerID - User ID or Organisation ID
 */
export const getOrCreateWallet = async (ownerType, ownerID) => {
    const column = ownerType === 'organisation' ? 'organisationID' : 'userID';
    
    // Try to get existing wallet
    let [wallet] = await db.select()
        .from(creditWalletsTable)
        .where(eq(creditWalletsTable[column], ownerID));
    
    // Create if doesn't exist
    if (!wallet) {
        [wallet] = await db.insert(creditWalletsTable)
            .values({ [column]: ownerID })
            .returning();
        
        logger.info('[BILLING] Created new wallet', { ownerType, ownerID, walletID: wallet.id });
    }
    
    return wallet;
};

/**
 * Get wallet by ID
 */
export const getWalletByID = async (walletID) => {
    const [wallet] = await db.select()
        .from(creditWalletsTable)
        .where(eq(creditWalletsTable.id, walletID));
    return wallet || null;
};

/**
 * Get wallet balance summary
 */
export const getWalletBalance = async (ownerType, ownerID) => {
    const wallet = await getOrCreateWallet(ownerType, ownerID);
    return {
        walletID: wallet.id,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        availableBalance: wallet.balance,
        lifetimeCredits: wallet.lifetimeCredits,
        lifetimeUsed: wallet.lifetimeUsed
    };
};

/**
 * Check if wallet has enough credits
 */
export const hasCredits = async (walletID, amount = 1) => {
    const [wallet] = await db.select()
        .from(creditWalletsTable)
        .where(eq(creditWalletsTable.id, walletID));
    
    return wallet && wallet.balance >= amount;
};

// ========== CREDIT OPERATIONS ==========

/**
 * Reserve credits for a task (move to pending)
 * Returns transaction ID for later confirmation/reversal
 * 
 * @param {number} walletID - Wallet to debit
 * @param {number} amount - Credits to reserve
 * @param {string} referenceType - 'analysis' | 'rewrite'
 * @param {string|null} referenceID - Job ID or null
 * @param {Object} initiatedBy - { userID, candidateID }
 */
export const reserveCredits = async (walletID, amount, referenceType, referenceID, initiatedBy) => {
    return await db.transaction(async (tx) => {
        // Lock wallet row for update
        const [wallet] = await tx.select()
            .from(creditWalletsTable)
            .where(eq(creditWalletsTable.id, walletID))
            .for('update');
        
        if (!wallet || wallet.balance < amount) {
            throw new AppError('Insufficient credits', 402);
        }
        
        // Update wallet: move credits from balance to pending
        await tx.update(creditWalletsTable)
            .set({
                balance: sql`${creditWalletsTable.balance} - ${amount}`,
                pendingBalance: sql`${creditWalletsTable.pendingBalance} + ${amount}`,
                updatedAt: new Date()
            })
            .where(eq(creditWalletsTable.id, walletID));
        
        // Create pending transaction
        const [transaction] = await tx.insert(creditTransactionsTable)
            .values({
                walletID,
                initiatedByUserID: initiatedBy.userID || null,
                initiatedByCandidateID: initiatedBy.candidateID || null,
                type: 'debit',
                amount: -amount,
                balanceAfter: wallet.balance - amount,
                referenceType,
                referenceID: referenceID || null,
                status: 'pending',
                description: `Credit reserved for ${referenceType}`
            })
            .returning();
        
        logger.info('[BILLING] Credits reserved', { 
            transactionID: transaction.id, 
            walletID, 
            amount, 
            referenceType 
        });
        
        return transaction;
    });
};

/**
 * Confirm credit deduction (task completed successfully)
 */
export const confirmDeduction = async (transactionID) => {
    return await db.transaction(async (tx) => {
        const [transaction] = await tx.select()
            .from(creditTransactionsTable)
            .where(eq(creditTransactionsTable.id, transactionID));
        
        if (!transaction) {
            logger.warn('[BILLING] Transaction not found for confirmation', { transactionID });
            return false;
        }
        
        if (transaction.status !== 'pending') {
            logger.warn('[BILLING] Transaction already processed', { transactionID, status: transaction.status });
            return false;
        }
        
        const amount = Math.abs(transaction.amount);
        
        // Update wallet: remove from pending, add to lifetimeUsed
        await tx.update(creditWalletsTable)
            .set({
                pendingBalance: sql`${creditWalletsTable.pendingBalance} - ${amount}`,
                lifetimeUsed: sql`${creditWalletsTable.lifetimeUsed} + ${amount}`,
                updatedAt: new Date()
            })
            .where(eq(creditWalletsTable.id, transaction.walletID));
        
        // Mark transaction as completed
        await tx.update(creditTransactionsTable)
            .set({
                status: 'completed',
                completedAt: new Date()
            })
            .where(eq(creditTransactionsTable.id, transactionID));
        
        logger.info('[BILLING] Credit deduction confirmed', { transactionID, amount });
        
        return true;
    });
};

/**
 * Refund credits (task failed)
 */
export const refundCredits = async (transactionID, reason) => {
    return await db.transaction(async (tx) => {
        const [transaction] = await tx.select()
            .from(creditTransactionsTable)
            .where(eq(creditTransactionsTable.id, transactionID));
        
        if (!transaction) {
            logger.warn('[BILLING] Transaction not found for refund', { transactionID });
            return false;
        }
        
        if (transaction.status !== 'pending') {
            logger.warn('[BILLING] Transaction already processed, cannot refund', { 
                transactionID, 
                status: transaction.status 
            });
            return false;
        }
        
        const amount = Math.abs(transaction.amount);
        
        // Update wallet: move credits from pending back to balance
        const [wallet] = await tx.update(creditWalletsTable)
            .set({
                balance: sql`${creditWalletsTable.balance} + ${amount}`,
                pendingBalance: sql`${creditWalletsTable.pendingBalance} - ${amount}`,
                updatedAt: new Date()
            })
            .where(eq(creditWalletsTable.id, transaction.walletID))
            .returning();
        
        // Mark original transaction as reversed
        await tx.update(creditTransactionsTable)
            .set({
                status: 'reversed',
                completedAt: new Date()
            })
            .where(eq(creditTransactionsTable.id, transactionID));
        
        // Create refund transaction record
        await tx.insert(creditTransactionsTable)
            .values({
                walletID: transaction.walletID,
                initiatedByUserID: transaction.initiatedByUserID,
                initiatedByCandidateID: transaction.initiatedByCandidateID,
                type: 'refund',
                amount: amount,
                balanceAfter: wallet.balance,
                referenceType: transaction.referenceType,
                referenceID: transaction.referenceID,
                status: 'completed',
                description: `Credit refunded: ${reason}`,
                completedAt: new Date()
            });
        
        logger.info('[BILLING] Credits refunded', { transactionID, amount, reason });
        
        return true;
    });
};

/**
 * Add credits to wallet (after successful purchase)
 * 
 * @param {number} walletID - Wallet to credit
 * @param {number} amount - Credits to add
 * @param {string} type - Transaction type ('purchase', 'admin_adjustment')
 * @param {string} referenceType - 'purchase', 'admin'
 * @param {string} referenceID - Order ID or null
 * @param {string} description - Transaction description
 * @param {number|null} initiatedByUserID - User who initiated (for org purchases)
 */
export const addCredits = async (walletID, amount, type, referenceType, referenceID, description, initiatedByUserID = null) => {
    console.log('[BILLING DEBUG] addCredits called with:', { 
        walletID, amount, type, referenceType, referenceID, description, initiatedByUserID 
    });
    
    try {
        return await db.transaction(async (tx) => {
            console.log('[BILLING DEBUG] Starting transaction to add credits');
            
            // Update wallet balance
            console.log('[BILLING DEBUG] Updating wallet balance for walletID:', walletID);
            const [wallet] = await tx.update(creditWalletsTable)
                .set({
                    balance: sql`${creditWalletsTable.balance} + ${amount}`,
                    lifetimeCredits: sql`${creditWalletsTable.lifetimeCredits} + ${amount}`,
                    updatedAt: new Date()
                })
                .where(eq(creditWalletsTable.id, walletID))
                .returning();
            
            if (!wallet) {
                console.error('[BILLING DEBUG] ERROR: Wallet not found or update failed for walletID:', walletID);
                throw new AppError('Wallet not found', 404);
            }
            
            console.log('[BILLING DEBUG] Wallet updated successfully:', { 
                walletID: wallet.id, 
                newBalance: wallet.balance,
                lifetimeCredits: wallet.lifetimeCredits 
            });
            
            // Create transaction record
            const transactionData = {
                walletID,
                initiatedByUserID,
                type,
                amount,
                balanceAfter: wallet.balance,
                referenceType: referenceType || null,
                referenceID: referenceID ? String(referenceID) : null,
                status: 'completed',
                description,
                completedAt: new Date()
            };
            
            console.log('[BILLING DEBUG] Inserting transaction record:', transactionData);
            
            const [transaction] = await tx.insert(creditTransactionsTable)
                .values(transactionData)
                .returning();
            
            if (!transaction) {
                console.error('[BILLING DEBUG] ERROR: Failed to insert transaction record');
                throw new AppError('Failed to create transaction record', 500);
            }
            
            console.log('[BILLING DEBUG] Transaction record created successfully:', {
                transactionID: transaction.id,
                type: transaction.type,
                amount: transaction.amount,
                status: transaction.status
            });
            
            logger.info('[BILLING] Credits added', { 
                walletID, 
                amount, 
                type, 
                newBalance: wallet.balance,
                transactionID: transaction.id
            });
            
            return wallet;
        });
    } catch (error) {
        console.error('[BILLING DEBUG] ERROR in addCredits:', error.message, error.stack);
        throw error;
    }
};

// ========== TRANSACTION HISTORY ==========

/**
 * Get credit transaction history
 */
export const getTransactionHistory = async (walletID, options = {}) => {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const transactions = await db.select()
        .from(creditTransactionsTable)
        .where(eq(creditTransactionsTable.walletID, walletID))
        .orderBy(desc(creditTransactionsTable.createdAt))
        .limit(limit)
        .offset(offset);
    
    return transactions;
};

/**
 * Get total transaction count for pagination
 */
export const getTransactionCount = async (walletID) => {
    const result = await db.select({ count: sql`count(*)` })
        .from(creditTransactionsTable)
        .where(eq(creditTransactionsTable.walletID, walletID));
    
    return parseInt(result[0]?.count || 0);
};

// ========== PAYMENT ORDER OPERATIONS ==========

/**
 * Create payment order
 */
export const createPaymentOrder = async (data) => {
    const [order] = await db.insert(paymentOrdersTable)
        .values(data)
        .returning();
    
    logger.info('[BILLING] Payment order created', { 
        orderID: order.id, 
        credits: data.creditsAmount,
        amount: data.amount 
    });
    
    return order;
};

/**
 * Get payment order by Razorpay order ID
 */
export const getPaymentOrderByRazorpayID = async (razorpayOrderId) => {
    const [order] = await db.select()
        .from(paymentOrdersTable)
        .where(eq(paymentOrdersTable.razorpayOrderId, razorpayOrderId));
    return order || null;
};

/**
 * Get payment order by ID
 */
export const getPaymentOrderByID = async (orderID) => {
    const [order] = await db.select()
        .from(paymentOrdersTable)
        .where(eq(paymentOrdersTable.id, orderID));
    return order || null;
};

/**
 * Update payment order
 */
export const updatePaymentOrder = async (orderID, data) => {
    const [order] = await db.update(paymentOrdersTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(paymentOrdersTable.id, orderID))
        .returning();
    
    return order;
};

/**
 * Get user's payment order history
 */
export const getPaymentOrderHistory = async (userID, options = {}) => {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;
    
    let conditions = [eq(paymentOrdersTable.userID, userID)];
    if (status) {
        conditions.push(eq(paymentOrdersTable.status, status));
    }
    
    const orders = await db.select()
        .from(paymentOrdersTable)
        .where(and(...conditions))
        .orderBy(desc(paymentOrdersTable.createdAt))
        .limit(limit)
        .offset(offset);
    
    return orders;
};

/**
 * Admin credit adjustment - add or remove credits from a wallet
 * 
 * @param {number} walletID - Wallet to adjust
 * @param {number} amount - Credits to add (positive) or remove (negative)
 * @param {string} reason - Reason for adjustment
 * @param {number} adminID - Admin making the adjustment
 */
export const adminAdjustCredits = async (walletID, amount, reason, adminID) => {
    return await db.transaction(async (tx) => {
        // Lock wallet row for update
        const [wallet] = await tx.select()
            .from(creditWalletsTable)
            .where(eq(creditWalletsTable.id, walletID))
            .for('update');
        
        if (!wallet) {
            throw new AppError('Wallet not found', 404);
        }
        
        // If removing credits, check balance
        if (amount < 0 && wallet.balance < Math.abs(amount)) {
            throw new AppError(`Insufficient balance. Current balance: ${wallet.balance}, trying to remove: ${Math.abs(amount)}`, 400);
        }
        
        const newBalance = wallet.balance + amount;
        
        // Update wallet
        const updateData = {
            balance: newBalance,
            updatedAt: new Date()
        };
        
        // If adding credits, also update lifetime credits
        if (amount > 0) {
            updateData.lifetimeCredits = sql`${creditWalletsTable.lifetimeCredits} + ${amount}`;
        }
        
        const [updatedWallet] = await tx.update(creditWalletsTable)
            .set(updateData)
            .where(eq(creditWalletsTable.id, walletID))
            .returning();
        
        // Create transaction record
        const [transaction] = await tx.insert(creditTransactionsTable)
            .values({
                walletID,
                type: 'admin_adjustment',
                amount,
                balanceAfter: updatedWallet.balance,
                referenceType: 'admin',
                referenceID: `admin_${adminID}`,
                status: 'completed',
                description: reason || `Admin adjustment by admin ID: ${adminID}`,
                metadata: { adminID, adjustmentType: amount > 0 ? 'add' : 'remove' },
                completedAt: new Date()
            })
            .returning();
        
        logger.info('[BILLING] Admin credit adjustment', { 
            walletID, 
            amount, 
            adminID,
            previousBalance: wallet.balance,
            newBalance: updatedWallet.balance,
            transactionID: transaction.id
        });
        
        return {
            wallet: updatedWallet,
            transaction
        };
    });
};

export default {
    // Wallet
    getOrCreateWallet,
    getWalletByID,
    getWalletBalance,
    hasCredits,
    // Credits
    reserveCredits,
    confirmDeduction,
    refundCredits,
    addCredits,
    adminAdjustCredits,
    getTransactionHistory,
    getTransactionCount,
    // Payment orders
    createPaymentOrder,
    getPaymentOrderByRazorpayID,
    getPaymentOrderByID,
    updatePaymentOrder,
    getPaymentOrderHistory
};
