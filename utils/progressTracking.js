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
    INIT: { percent: 0, message: 'Initializing resume analysis...' },
    DOWNLOADING: { percent: 10, message: 'Downloading resume file...' },
    EXTRACTING: { percent: 25, message: 'Extracting text from resume...' },
    PARSING: { percent: 40, message: 'Parsing resume content...' },
    ANALYZING: { percent: 60, message: 'Analyzing resume with AI...' },
    SCORING: { percent: 80, message: 'Calculating scores...' },
    SAVING: { percent: 90, message: 'Saving results to database...' },
    COMPLETE: { percent: 100, message: 'Resume analysis completed!' },
    
    // Resume Rewrite stages
    PREPARING: { percent: 20, message: 'Preparing analysis data for optimization...' },
    OPTIMIZING: { percent: 60, message: 'Optimizing resume content with AI...' }
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
            message: `${stepDescription} - completed`
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
            message: `${stepDescription} - failed: ${error.message}`,
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
