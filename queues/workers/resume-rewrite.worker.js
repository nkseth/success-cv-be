import { Worker } from 'bullmq';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { resumeRewritesTable } from '../../drizzle/schema/resume.schema.js';
import { eq } from 'drizzle-orm';
import { optimizeResumeContent } from '../../services/resume.service.js';
import { executeWithProgress, publishJobUpdate } from '../../utils/progressTracking.js';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

// Dynamic import to ensure env vars are loaded before redis config
const { bullMQConnection } = await import('../../config/redis.config.js');
const pubSubService = (await import('../../services/pubsub.service.js')).default;

// Debug: Log Redis configuration
logger.info('Rewrite Worker starting with Redis config', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    clusterMode: process.env.REDIS_CLUSTER_MODE,
    hasPassword: !!process.env.REDIS_PASSWORD
});

/**
 * Initialize PubSub service with retry logic
 */
async function initPubSubService(maxRetries = 3, delayMs = 2000) {
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB_CACHE) || 0,
        tls: process.env.REDIS_TLS === 'true'
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Initializing PubSub service in rewrite worker (attempt ${attempt}/${maxRetries})`, redisConfig);
            await pubSubService.initialize(redisConfig);
            logger.info('✅ PubSub service initialized successfully in rewrite worker');
            return true;
        } catch (error) {
            logger.error(`❌ PubSub initialization failed (attempt ${attempt}/${maxRetries})`, { 
                error: error.message,
                stack: error.stack 
            });
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
            } else {
                throw error;
            }
        }
    }
}

// Initialize PubSub service before starting worker
try {
    logger.info('🚀 Starting rewrite worker initialization...');
    await initPubSubService(
        parseInt(process.env.PUBSUB_INIT_RETRIES || '3'),
        parseInt(process.env.PUBSUB_INIT_DELAY_MS || '2000')
    );
} catch (error) {
    logger.error('🛑 Rewrite worker startup failed - PubSub initialization error', { 
        error: error.message,
        stack: error.stack 
    });
    logger.error('Worker cannot start without PubSub service. Exiting...');
    process.exit(1);
}

/**
 * Process resume rewrite job
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Rewrite result
 */
async function processResumeRewrite(job) {
    const { 
        rewriteID, 
        analysisID, 
        userID, 
        resumeContentID,
        analysisData,
        rawData,
        currentContent,
        optimizationOptions 
    } = job.data;
    
    logger.info('[RESUME_REWRITE] Starting job', { 
        jobId: job.id,
        rewriteID,
        analysisID,
        userID,
        resumeContentID
    });

    try {
        // Step 1: Initialize and update status
        await executeWithProgress(job.id, 'INIT', async () => {
            await db.update(resumeRewritesTable)
                .set({
                    status: 'processing',
                    updatedAt: new Date()
                })
                .where(eq(resumeRewritesTable.id, rewriteID));
                
            logger.info('[RESUME_REWRITE] Rewrite record updated to processing');
        });

        // Step 2: Parse analysis and raw data
        let parsedAnalysisData, parsedRawData;
        await executeWithProgress(job.id, 'PREPARING', async () => {
            logger.info('[RESUME_REWRITE] Parsing analysis and raw data');
            
            parsedAnalysisData = typeof analysisData === 'string' 
                ? JSON.parse(analysisData) 
                : analysisData;
            
            parsedRawData = typeof rawData === 'string' 
                ? rawData 
                : JSON.stringify(rawData);
            
            logger.info('[RESUME_REWRITE] ✅ Data parsed successfully');
        });

        // Step 3: Generate optimized content
        let optimizationResult;
        await executeWithProgress(job.id, 'OPTIMIZING', async () => {
            logger.info('[RESUME_REWRITE] Generating optimized resume content');
            
            optimizationResult = await optimizeResumeContent(
                parsedAnalysisData,
                parsedRawData,
                optimizationOptions || {}
            );
            
            logger.info('[RESUME_REWRITE] ✅ Resume content optimized', {
                sectionsOptimized: Object.keys(optimizationResult.optimizations || {}).length
            });
        });

        // Step 4: Save optimized content to database
        await executeWithProgress(job.id, 'SAVING', async () => {
            logger.info('[RESUME_REWRITE] Saving optimized content to database');
            
            // Structure the rewritten content for the new schema
            const rewrittenContent = {
                personalInfo: optimizationResult.optimizations?.personalInfo || null,
                summary: optimizationResult.optimizations?.professionalSummary || null,
                experience: optimizationResult.optimizations?.workExperience || null,
                education: optimizationResult.optimizations?.education || null,
                skills: optimizationResult.optimizations?.skills || null,
                additionalSections: optimizationResult.optimizations?.additionalSections || null,
                atsKeywords: optimizationResult.optimizations?.atsKeywords || null,
                formattingRecommendations: optimizationResult.optimizations?.formattingRecommendations || null,
                scores: {
                    estimatedATSScore: optimizationResult.improvements?.estimated_score_improvement?.atsScore || 0,
                    estimatedOverallScore: optimizationResult.improvements?.estimated_score_improvement?.overallScore || 0
                }
            };
            
            await db.update(resumeRewritesTable)
                .set({
                    rewrittenContent: rewrittenContent,
                    improvements: optimizationResult.improvements,
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(resumeRewritesTable.id, rewriteID));
            
            logger.info('[RESUME_REWRITE] ✅ Optimized content saved');
        });

        // Step 5: Complete
        await executeWithProgress(job.id, 'COMPLETE', async () => {
            logger.info('[RESUME_REWRITE] Job completed successfully');
            
            await publishJobUpdate(job.id, {
                progress: 100,
                status: 'completed',
                message: 'Resume optimization completed successfully',
                data: {
                    rewriteID,
                    analysisID,
                    improvementSummary: optimizationResult.improvements
                }
            });
        });

        logger.info('[RESUME_REWRITE] ✅ Job completed successfully', {
            jobId: job.id,
            rewriteID
        });

        return {
            success: true,
            rewriteID,
            optimizationResult
        };

    } catch (error) {
        logger.error('[RESUME_REWRITE] ❌ Job failed', {
            jobId: job.id,
            rewriteID,
            error: error.message,
            stack: error.stack
        });

        // Update rewrite status to failed
        try {
            await db.update(resumeRewritesTable)
                .set({
                    status: 'failed',
                    updatedAt: new Date()
                })
                .where(eq(resumeRewritesTable.id, rewriteID));
        } catch (dbError) {
            logger.error('[RESUME_REWRITE] Failed to update rewrite status', {
                error: dbError.message
            });
        }

        // Publish error update
        await publishJobUpdate(job.id, {
            progress: 0,
            status: 'failed',
            message: `Resume optimization failed: ${error.message}`,
            error: error.message
        });

        throw error;
    }
}

/**
 * Create and start the rewrite worker
 */
export function createResumeRewriteWorker(concurrency = 3) {
    const worker = new Worker('resume-rewrite', processResumeRewrite, {
        connection: bullMQConnection,
        concurrency, // Number of jobs to process in parallel
        limiter: {
            max: 5, // Max 5 jobs
            duration: 1000, // per 1 second
        },
    });

    // Worker event listeners
    worker.on('completed', (job) => {
        logger.info('Rewrite Worker: Job completed', { 
            jobId: job.id, 
            rewriteID: job.data.rewriteID 
        });
    });

    worker.on('failed', (job, error) => {
        logger.error('Rewrite Worker: Job failed', { 
            jobId: job?.id, 
            rewriteID: job?.data?.rewriteID,
            error: error.message 
        });
    });

    worker.on('error', (error) => {
        logger.error('Rewrite Worker: Error', { error: error.message });
    });

    worker.on('stalled', (jobId) => {
        logger.warn('Rewrite Worker: Job stalled', { jobId });
    });

    worker.on('active', (job) => {
        logger.info('Rewrite Worker: Job active', { 
            jobId: job.id, 
            rewriteID: job.data.rewriteID 
        });
    });

    logger.info('Resume rewrite worker started', { 
        concurrency,
        queue: 'resume-rewrite' 
    });

    return worker;
}

/**
 * Graceful shutdown
 */
export async function shutdownWorker(worker) {
    try {
        logger.info('Shutting down rewrite worker...');
        await worker.close();
        logger.info('Rewrite worker shut down gracefully');
    } catch (error) {
        logger.error('Error shutting down rewrite worker', { error: error.message });
        throw error;
    }
}

// If this file is run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
    logger.info('Starting resume rewrite worker process...');
    
    const worker = createResumeRewriteWorker(
        parseInt(process.env.REWRITE_WORKER_CONCURRENCY || '3')
    );

    // Graceful shutdown on signals
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down rewrite worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down rewrite worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in rewrite worker', { 
            error: error.message, 
            stack: error.stack 
        });
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection in rewrite worker', { reason, promise });
        process.exit(1);
    });
}

export default {
    createResumeRewriteWorker,
    shutdownWorker,
};
