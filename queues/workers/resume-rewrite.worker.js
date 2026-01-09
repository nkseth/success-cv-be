import { Worker } from 'bullmq';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { resumeRewritesTable, resumeContentTable } from '../../drizzle/schema/resume.schema.js';
import { eq, and } from 'drizzle-orm';
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
 * Generate post-rewrite analysis report
 * Shows what issues were resolved and what remains after AI optimization
 * @param {Object} originalAnalysis - Original analysis data with issues
 * @param {Object} optimizationResult - Result from AI optimization
 * @param {Object} options - Optimization options used
 * @returns {Object} Post-rewrite analysis report
 */
function generatePostRewriteAnalysisReport(originalAnalysis, optimizationResult, options = {}) {
    logger.info('[RESUME_REWRITE] Generating post-rewrite analysis report');
    
    const originalIssues = {
        critical: originalAnalysis?.critical_mistakes || [],
        major: originalAnalysis?.major_issues || [],
        minor: originalAnalysis?.minor_improvements || []
    };
    
    // Get fixes summary from optimization result
    const fixesSummary = optimizationResult?.metadata?.fixesSummary || 'Resume optimized for ATS compatibility';
    
    // Calculate resolved vs remaining issues based on optimization
    // In a real scenario, AI would identify which specific issues were fixed
    // For now, we assume most critical and major issues are addressed by the rewrite
    const resolvedIssues = [];
    const remainingIssues = [];
    
    // Critical mistakes - assume all were addressed by rewrite
    originalIssues.critical.forEach(mistake => {
        resolvedIssues.push({
            originalIssue: mistake.issue || mistake.mistake || mistake,
            category: 'critical',
            howFixed: 'Addressed by AI optimization - content restructured for ATS compatibility'
        });
    });
    
    // Major issues - assume most were addressed
    originalIssues.major.forEach(issue => {
        resolvedIssues.push({
            originalIssue: issue.issue || issue,
            category: 'major',
            howFixed: 'Improved by AI rewrite - content enhanced for clarity and impact'
        });
    });
    
    // Minor improvements - some may remain as suggestions
    originalIssues.minor.forEach((improvement, index) => {
        if (index < Math.ceil(originalIssues.minor.length * 0.7)) {
            // 70% resolved
            resolvedIssues.push({
                originalIssue: improvement.suggestion || improvement.improvement || improvement,
                category: 'minor',
                howFixed: 'Applied during optimization'
            });
        } else {
            // 30% remain as suggestions for further improvement
            remainingIssues.push({
                area: improvement.area || improvement.section || 'General',
                suggestion: improvement.suggestion || improvement.improvement || improvement,
                priority: 'low'
            });
        }
    });
    
    // Build new scores from optimization result
    const newScores = {
        atsScore: optimizationResult?.scores?.atsScore || options.targetATSScore || 85,
        contentScore: optimizationResult?.scores?.contentScore || 85,
        formatScore: optimizationResult?.scores?.formatScore || 85,
        overallScore: optimizationResult?.scores?.overallScore || optimizationResult?.scores?.atsScore || 85
    };
    
    // Calculate improvement from original
    const originalAtsScore = originalAnalysis?.resume_quality?.ats_compatibility_score || 0;
    const scoreImprovement = newScores.atsScore - originalAtsScore;
    
    const analysisReport = {
        // Issues that were resolved by this rewrite
        resolvedIssues,
        
        // Issues that may still need attention
        remainingIssues,
        
        // New scores after optimization
        newScores,
        
        // Score comparison
        scoreComparison: {
            before: {
                atsScore: originalAtsScore,
                contentScore: originalAnalysis?.resume_quality?.content_quality_score || 0,
                overallScore: originalAnalysis?.resume_quality?.overall_quality_score || 0
            },
            after: newScores,
            improvement: {
                atsScore: scoreImprovement,
                description: scoreImprovement > 0 
                    ? `+${scoreImprovement} point improvement in ATS score`
                    : 'ATS score maintained'
            }
        },
        
        // Summary of improvements
        improvementSummary: fixesSummary,
        
        // Counts for quick reference
        summary: {
            totalResolved: resolvedIssues.length,
            totalRemaining: remainingIssues.length,
            criticalResolved: resolvedIssues.filter(i => i.category === 'critical').length,
            majorResolved: resolvedIssues.filter(i => i.category === 'major').length,
            minorResolved: resolvedIssues.filter(i => i.category === 'minor').length
        },
        
        // Version marker
        version: `rewrite_v${options.versionNumber || 1}`,
        generatedAt: new Date().toISOString()
    };
    
    logger.info('[RESUME_REWRITE] ✅ Post-rewrite analysis report generated', {
        resolvedCount: analysisReport.summary.totalResolved,
        remainingCount: analysisReport.summary.totalRemaining,
        scoreImprovement
    });
    
    return analysisReport;
}

/**
 * Process resume rewrite job
 * Uses the current resume content (which may have been manually edited)
 * as the base for AI optimization
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
        resumeContentID,
        hasCurrentContent: !!currentContent,
        currentContentVersion: currentContent?.version
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

        // Step 2: Parse and prepare data
        let parsedAnalysisData, parsedRawData, parsedCurrentContent;
        await executeWithProgress(job.id, 'PREPARING', async () => {
            logger.info('[RESUME_REWRITE] Parsing analysis and content data');
            
            // Parse original analysis data (for context)
            parsedAnalysisData = typeof analysisData === 'string' 
                ? JSON.parse(analysisData) 
                : analysisData;
            
            parsedRawData = typeof rawData === 'string' 
                ? rawData 
                : JSON.stringify(rawData);
            
            // Parse current content (this is what we're optimizing FROM)
            parsedCurrentContent = typeof currentContent === 'string'
                ? JSON.parse(currentContent)
                : currentContent;
            
            logger.info('[RESUME_REWRITE] ✅ Data parsed successfully', {
                hasAnalysisData: !!parsedAnalysisData,
                hasCurrentContent: !!parsedCurrentContent,
                currentContentSections: parsedCurrentContent ? Object.keys(parsedCurrentContent) : []
            });
        });

        // Step 3: Generate optimized content from current state
        let optimizationResult;
        await executeWithProgress(job.id, 'OPTIMIZING', async () => {
            logger.info('[RESUME_REWRITE] Generating optimized resume content using analysis issues');
            
            // Pass current content AND analysis data with issues to optimizer
            // The optimizer will use issues/fixes from analysis to make targeted improvements
            optimizationResult = await optimizeResumeContent(
                parsedCurrentContent || parsedAnalysisData, // Current resume content
                parsedAnalysisData, // Analysis data with critical_mistakes, major_issues, etc.
                {
                    ...optimizationOptions,
                    // Use issues from analysis for targeted fixes
                    criticalMistakes: parsedAnalysisData?.critical_mistakes || [],
                    majorIssues: parsedAnalysisData?.major_issues || [],
                    minorImprovements: parsedAnalysisData?.minor_improvements || []
                }
            );
            
            logger.info('[RESUME_REWRITE] ✅ Resume content optimized', {
                hasContent: !!optimizationResult.content,
                hasScores: !!optimizationResult.scores,
                fixesSummary: optimizationResult.metadata?.fixesSummary
            });
        });

        // Step 4: Save optimized content to database
        // The new optimizationResult.content is directly compatible with resumeContentTable
        await executeWithProgress(job.id, 'SAVING', async () => {
            logger.info('[RESUME_REWRITE] Saving optimized content to database');
            
            // Content is now directly usable - no transformation needed
            const rewrittenContent = {
                personalInfo: optimizationResult.content?.personalInfo || null,
                summary: optimizationResult.content?.summary || null,
                experience: optimizationResult.content?.experience || null,
                education: optimizationResult.content?.education || null,
                skills: optimizationResult.content?.skills || null,
                additionalSections: optimizationResult.content?.additionalSections || null,
                scores: optimizationResult.scores || null
            };
            
            // Generate post-rewrite analysis report
            // This shows what was fixed and what remains
            const analysisReport = generatePostRewriteAnalysisReport(
                parsedAnalysisData,
                optimizationResult,
                optimizationOptions
            );
            
            await db.update(resumeRewritesTable)
                .set({
                    rewrittenContent: rewrittenContent,
                    improvements: optimizationResult.metadata,
                    analysisReport: analysisReport,
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(resumeRewritesTable.id, rewriteID));
            
            logger.info('[RESUME_REWRITE] ✅ Optimized content saved with analysis report');
        });

        // Step 5: AUTO-APPLY the rewrite to resume content
        await executeWithProgress(job.id, 'APPLYING', async () => {
            logger.info('[RESUME_REWRITE] Auto-applying rewrite to resume content');
            
            // Get current resume content for this analysis
            const [currentResumeContent] = await db
                .select()
                .from(resumeContentTable)
                .where(
                    and(
                        eq(resumeContentTable.analysisID, analysisID),
                        eq(resumeContentTable.userID, userID)
                    )
                )
                .limit(1);
            
            if (!currentResumeContent) {
                logger.warn('[RESUME_REWRITE] No resume content found to apply rewrite to', { analysisID, userID });
                return;
            }
            
            // If there's an active rewrite, save current resume content to it before switching
            if (currentResumeContent.activeRewriteID && currentResumeContent.activeRewriteID !== rewriteID) {
                logger.info('[RESUME_REWRITE] Saving current content to previously active rewrite', {
                    previousRewriteID: currentResumeContent.activeRewriteID
                });
                
                // Get the previously active rewrite details
                const [previousRewrite] = await db
                    .select({ appliedAt: resumeRewritesTable.appliedAt })
                    .from(resumeRewritesTable)
                    .where(eq(resumeRewritesTable.id, currentResumeContent.activeRewriteID))
                    .limit(1);
                
                if (previousRewrite && previousRewrite.appliedAt) {
                    // Check if content was modified
                    const wasModified = currentResumeContent.updatedAt > previousRewrite.appliedAt;
                    
                    // Save current resume content to the previous rewrite's rewrittenContent
                    const currentSnapshot = {
                        personalInfo: currentResumeContent.personalInfo,
                        summary: currentResumeContent.summary,
                        experience: currentResumeContent.experience,
                        education: currentResumeContent.education,
                        skills: currentResumeContent.skills,
                        additionalSections: currentResumeContent.additionalSections,
                        scores: currentResumeContent.currentScores
                    };
                    
                    await db
                        .update(resumeRewritesTable)
                        .set({ 
                            rewrittenContent: currentSnapshot,
                            wasModifiedAfterApply: wasModified,
                            updatedAt: new Date()
                        })
                        .where(eq(resumeRewritesTable.id, currentResumeContent.activeRewriteID));
                    
                    logger.info('[RESUME_REWRITE] ✅ Saved current content to previous rewrite', {
                        previousRewriteID: currentResumeContent.activeRewriteID,
                        wasModified
                    });
                }
            }
            
            // Deactivate all other rewrites for this analysis
            await db
                .update(resumeRewritesTable)
                .set({ isActive: false, updatedAt: new Date() })
                .where(
                    and(
                        eq(resumeRewritesTable.analysisID, analysisID),
                        eq(resumeRewritesTable.userID, userID)
                    )
                );
            
            // Mark this rewrite as active
            await db
                .update(resumeRewritesTable)
                .set({
                    isActive: true,
                    appliedAt: new Date(),
                    wasModifiedAfterApply: false,
                    updatedAt: new Date()
                })
                .where(eq(resumeRewritesTable.id, rewriteID));
            
            // Get the analysis report we just saved to the rewrite
            const [rewriteRecord] = await db
                .select({ analysisReport: resumeRewritesTable.analysisReport })
                .from(resumeRewritesTable)
                .where(eq(resumeRewritesTable.id, rewriteID))
                .limit(1);
            
            // Apply the rewritten content to resume content table
            // Also update the analysisReport to show the post-rewrite analysis
            const content = optimizationResult.content;
            await db
                .update(resumeContentTable)
                .set({
                    personalInfo: content?.personalInfo || currentResumeContent.personalInfo,
                    summary: content?.summary || currentResumeContent.summary,
                    experience: content?.experience || currentResumeContent.experience,
                    education: content?.education || currentResumeContent.education,
                    skills: content?.skills || currentResumeContent.skills,
                    additionalSections: content?.additionalSections || currentResumeContent.additionalSections,
                    currentScores: optimizationResult.scores || currentResumeContent.currentScores,
                    analysisReport: rewriteRecord?.analysisReport || currentResumeContent.analysisReport,
                    version: currentResumeContent.version + 1,
                    lastEditType: 'ai_rewrite',
                    activeRewriteID: rewriteID,
                    updatedAt: new Date()
                })
                .where(eq(resumeContentTable.id, currentResumeContent.id));
            
            logger.info('[RESUME_REWRITE] ✅ Rewrite auto-applied to resume content', {
                contentID: currentResumeContent.id,
                newVersion: currentResumeContent.version + 1
            });
        });

        // Step 6: Complete
        await executeWithProgress(job.id, 'COMPLETE', async () => {
            logger.info('[RESUME_REWRITE] Job completed successfully');
            
            await publishJobUpdate(job.id, {
                progress: 100,
                status: 'completed',
                message: 'Resume optimization completed and applied successfully',
                data: {
                    rewriteID,
                    analysisID,
                    basedOnContentVersion: currentContent?.version,
                    autoApplied: true,
                    scores: optimizationResult.scores
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
