/**
 * Progress Tracking and SSE Utility
 * Handles progress updates via Redis Pub/Sub for SSE frontend updates
 */

import pubSubService from '../services/pubsub.service.js';
import logger from '../middleware/logger.js';

/**
 * Progress stages with percent and messages
 */
export const PROGRESS_STAGES = {
    // Resume Analysis stages
    INIT: { percent: 0, message: 'Preparing to analyze your resume...' },
    DOWNLOADING: { percent: 10, message: 'Retrieving your resume file...' },
    EXTRACTING: { percent: 25, message: 'Reading resume content...' },
    PARSING: { percent: 40, message: 'Processing resume information...' },
    ANALYZING: { percent: 60, message: 'Analyzing your resume...' },
    SCORING: { percent: 80, message: 'Evaluating your resume...' },
    SAVING: { percent: 90, message: 'Saving your analysis...' },
    COMPLETE: { percent: 100, message: 'Analysis complete!' }
};

/**
 * Rewrite-specific progress stages with more granular messages
 */
export const REWRITE_PROGRESS_STAGES = {
    INIT: { percent: 0, message: 'Preparing to optimize your resume...' },
    PREPARING: { percent: 15, message: 'Reviewing current content...' },
    ANALYZING_ISSUES: { percent: 25, message: 'Identifying areas for improvement...' },
    OPTIMIZING: { percent: 40, message: 'Optimizing your resume content...' },
    ENHANCING_SECTIONS: { percent: 55, message: 'Enhancing resume sections...' },
    IMPROVING_ATS: { percent: 70, message: 'Improving readability and compatibility...' },
    SAVING: { percent: 85, message: 'Saving optimized content...' },
    APPLYING: { percent: 92, message: 'Finalizing changes...' },
    COMPLETE: { percent: 100, message: 'Optimization complete!' }
};

/**
 * Publish job update to Redis for SSE
 * @param {string} jobId - Job ID
 * @param {Object} data - Update data
 */
export async function publishJobUpdate(jobId, data) {
    try {
        await pubSubService.publishJobUpdate(jobId, {
            timestamp: Date.now(),
            ...data
        });
        
        logger.debug('[PROGRESS] Published update', { 
            jobId, 
            status: data.status,
            progress: data.progress 
        });
    } catch (error) {
        logger.error('[PROGRESS] Failed to publish update', { 
            jobId, 
            error: error.message 
        });
        // Don't throw - progress updates are non-critical
    }
}

/**
 * Safe execute with SSE progress updates
 * Wraps an async operation with progress tracking and error handling
 * 
 * @param {string} jobId - Job ID
 * @param {number} progressPercent - Progress percentage
 * @param {string} stepDescription - Step description for user
 * @param {Function} operation - Async operation to execute
 * @param {string} stage - Stage name for categorization
 * @returns {Promise<any>} Operation result
 */
export async function safeExecuteWithSSE(jobId, progressPercent, stepDescription, operation, stage) {
    try {
        logger.info('[PROGRESS] Starting step', { 
            jobId, 
            stage, 
            step: stepDescription,
            progress: progressPercent 
        });
        
        // Send progress update
        await publishJobUpdate(jobId, {
            progress: progressPercent,
            stage: stage,
            status: 'in_progress',
            message: stepDescription
        });
        
        const result = await operation();
        
        // Send success update for this step
        await publishJobUpdate(jobId, {
            progress: progressPercent,
            stage: stage,
            status: 'step_completed',
            message: stepDescription
        });
        
        logger.info('[PROGRESS] ✅ Step completed', { 
            jobId, 
            stage, 
            step: stepDescription 
        });
        
        return result;
        
    } catch (error) {
        logger.error('[PROGRESS] ❌ Step failed', { 
            jobId, 
            stage, 
            step: stepDescription,
            error: error.message 
        });
        
        // Send error update for this step
        await publishJobUpdate(jobId, {
            progress: progressPercent,
            stage: stage,
            status: 'step_failed',
            message: `Unable to complete: ${error.message}`,
            error: error.message
        });
        
        // Re-throw with enhanced error information
        const enhancedError = new Error(`${stepDescription}: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.step = stepDescription;
        enhancedError.stage = stage;
        throw enhancedError;
    }
}

/**
 * Execute operation with progress tracking
 * Convenience wrapper around safeExecuteWithSSE
 * 
 * @param {string} jobId - Job ID
 * @param {string} stageName - Stage name (key from PROGRESS_STAGES)
 * @param {Function} asyncFunction - Async operation to execute
 * @returns {Promise<any>} Operation result
 */
export async function executeWithProgress(jobId, stageName, asyncFunction) {
    const stage = PROGRESS_STAGES[stageName];
    
    if (!stage) {
        logger.warn('[PROGRESS] Unknown stage name', { stageName });
        return await asyncFunction();
    }
    
    return await safeExecuteWithSSE(
        jobId, 
        stage.percent, 
        stage.message, 
        asyncFunction, 
        stageName
    );
}

/**
 * Execute operation with rewrite-specific progress tracking
 * Uses REWRITE_PROGRESS_STAGES for more granular progress updates
 * 
 * @param {string} jobId - Job ID
 * @param {string} stageName - Stage name (key from REWRITE_PROGRESS_STAGES)
 * @param {Function} asyncFunction - Async operation to execute
 * @returns {Promise<any>} Operation result
 */
export async function executeWithRewriteProgress(jobId, stageName, asyncFunction) {
    const stage = REWRITE_PROGRESS_STAGES[stageName];
    
    if (!stage) {
        logger.warn('[PROGRESS] Unknown rewrite stage name', { stageName });
        return await asyncFunction();
    }
    
    return await safeExecuteWithSSE(
        jobId, 
        stage.percent, 
        stage.message, 
        asyncFunction, 
        stageName
    );
}
