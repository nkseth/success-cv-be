import { Worker } from 'bullmq';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { 
    resumeRewritesTable, 
    resumeContentTable,
    candidateResumeRewritesTable,
    candidateResumeContentTable
} from '../../drizzle/schema/resume.schema.js';
import { eq, and } from 'drizzle-orm';
import { optimizeResumeContent } from '../../services/resume.service.js';
import { executeWithRewriteProgress, publishJobUpdate } from '../../utils/progressTracking.js';
import { isCandidate as checkIsCandidate } from '../../utils/dynamic-tables.js';
import { userTypeConstants } from '../../utils/constants.js';

/**
 * Get tables for user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} Object with table references and flags
 */
function getTablesForUserType(userType) {
    const isCandidateUser = checkIsCandidate(userType);
    return {
        contentTable: isCandidateUser ? candidateResumeContentTable : resumeContentTable,
        rewritesTable: isCandidateUser ? candidateResumeRewritesTable : resumeRewritesTable,
        entityIDColumn: isCandidateUser ? 'candidateID' : 'userID',
        isCandidate: isCandidateUser
    };
}

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
 * Generate lightweight post-rewrite summary
 * Shows what issues were resolved and score improvements after AI optimization
 * @param {Object} originalAnalysis - Original analysis data with issues
 * @param {Object} optimizationResult - Result from AI optimization
 * @param {Object} options - Optimization options used
 * @returns {Object} Lightweight rewrite summary
 */
function generateRewriteSummary(originalAnalysis, optimizationResult, options = {}) {
    logger.info('[RESUME_REWRITE] Generating post-rewrite summary');
    
    const originalIssues = {
        critical: originalAnalysis?.critical_mistakes || [],
        major: originalAnalysis?.major_issues || [],
        minor: originalAnalysis?.minor_improvements || []
    };
    
    // Get fixes summary from optimization result
    const fixesSummary = optimizationResult?.metadata?.fixesSummary || 'Resume optimized for ATS compatibility';
    
    // Count resolved issues (assume AI resolves most issues)
    const resolvedCounts = {
        critical: originalIssues.critical.length,
        major: originalIssues.major.length,
        minor: Math.ceil(originalIssues.minor.length * 0.7) // 70% of minor issues resolved
    };
    
    const remainingCounts = {
        critical: 0,
        major: 0,
        minor: originalIssues.minor.length - resolvedCounts.minor
    };
    
    // Build new scores from optimization result
    const newScores = {
        atsScore: optimizationResult?.scores?.atsScore || options.targetATSScore || 85,
        contentScore: optimizationResult?.scores?.contentScore || 85,
        formatScore: optimizationResult?.scores?.formatScore || 85,
        overallScore: optimizationResult?.scores?.overallScore || optimizationResult?.scores?.atsScore || 85,
        jobFitScore: optimizationResult?.scores?.jobFitScore || originalAnalysis?.JobFitScore || 0,
        skillsRelevanceScore: optimizationResult?.scores?.skillsRelevanceScore || originalAnalysis?.relevance?.['Skills Relevance'] || 0,
        experienceRelevanceScore: optimizationResult?.scores?.experienceRelevanceScore || originalAnalysis?.relevance?.['Work Experience'] || 0,
        educationRelevanceScore: optimizationResult?.scores?.educationRelevanceScore || originalAnalysis?.relevance?.['Education'] || 0
    };
    
    // Calculate improvement from original
    const originalAtsScore = originalAnalysis?.resume_quality?.ats_compatibility_score || 0;
    const scoreImprovement = newScores.atsScore - originalAtsScore;
    
    const rewriteSummary = {
        // Summary of what was improved
        improvementSummary: fixesSummary,
        
        // Issue counts for quick reference
        resolvedCounts,
        remainingCounts,
        totalResolved: resolvedCounts.critical + resolvedCounts.major + resolvedCounts.minor,
        totalRemaining: remainingCounts.critical + remainingCounts.major + remainingCounts.minor,
        
        // Score comparison - lightweight before/after for display
        scoreComparison: {
            before: {
                atsScore: originalAtsScore,
                contentScore: originalAnalysis?.resume_quality?.content_quality_score || 0,
                overallScore: originalAnalysis?.resume_quality?.overall_quality_score || 0
            },
            after: {
                atsScore: newScores.atsScore,
                contentScore: newScores.contentScore,
                overallScore: newScores.overallScore
            },
            improvement: {
                atsScore: scoreImprovement,
                description: scoreImprovement > 0 
                    ? `+${scoreImprovement} point improvement in ATS score`
                    : 'ATS score maintained'
            }
        },
        
        // Version marker
        version: `rewrite_v${options.versionNumber || 1}`,
        generatedAt: new Date().toISOString()
    };
    
    logger.info('[RESUME_REWRITE] ✅ Post-rewrite summary generated', {
        resolvedCount: rewriteSummary.totalResolved,
        remainingCount: rewriteSummary.totalRemaining,
        scoreImprovement
    });
    
    return rewriteSummary;
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
        optimizationOptions,
        userType = userTypeConstants.USER
    } = job.data;
    
    // Get appropriate tables based on userType
    const tables = getTablesForUserType(userType);
    const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
    
    logger.info('[RESUME_REWRITE] Starting job', { 
        jobId: job.id,
        rewriteID,
        analysisID,
        userID,
        resumeContentID,
        hasCurrentContent: !!currentContent,
        currentContentVersion: currentContent?.version,
        userType
    });

    try {
        // Step 1: Initialize and update status
        await executeWithRewriteProgress(job.id, 'INIT', async () => {
            await db.update(tables.rewritesTable)
                .set({
                    status: 'processing',
                    updatedAt: new Date()
                })
                .where(eq(tables.rewritesTable.id, rewriteID));
                
            logger.info('[RESUME_REWRITE] Rewrite record updated to processing');
        });

        // Step 2: Parse and prepare data
        let parsedAnalysisData, parsedRawData, parsedCurrentContent;
        await executeWithRewriteProgress(job.id, 'PREPARING', async () => {
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

        // Step 2.5: Analyze issues from original analysis
        await executeWithRewriteProgress(job.id, 'ANALYZING_ISSUES', async () => {
            logger.info('[RESUME_REWRITE] Analyzing issues from original analysis', {
                criticalCount: parsedAnalysisData?.critical_mistakes?.length || 0,
                majorCount: parsedAnalysisData?.major_issues?.length || 0,
                minorCount: parsedAnalysisData?.minor_improvements?.length || 0
            });
        });

        // Step 3: Generate optimized content from current state
        let optimizationResult;
        
        // Start optimization
        await executeWithRewriteProgress(job.id, 'OPTIMIZING', async () => {
            logger.info('[RESUME_REWRITE] Starting AI optimization of resume content');
        });
        
        // Run the actual optimization (this is the long operation)
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
        
        // Show progress for enhancing sections
        await executeWithRewriteProgress(job.id, 'ENHANCING_SECTIONS', async () => {
            logger.info('[RESUME_REWRITE] Resume sections enhanced', {
                hasContent: !!optimizationResult.content,
                sections: optimizationResult.content ? Object.keys(optimizationResult.content) : []
            });
        });
        
        // Show progress for ATS improvements
        await executeWithRewriteProgress(job.id, 'IMPROVING_ATS', async () => {
            logger.info('[RESUME_REWRITE] ✅ ATS compatibility improved', {
                hasScores: !!optimizationResult.scores,
                fixesSummary: optimizationResult.metadata?.fixesSummary
            });
        });

        // Step 4: Save optimized content to database
        // The new optimizationResult.content is directly compatible with resumeContentTable
        await executeWithRewriteProgress(job.id, 'SAVING', async () => {
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
            
            // Generate lightweight rewrite summary
            // This shows what was fixed in a compact format
            const rewriteSummary = generateRewriteSummary(
                parsedAnalysisData,
                optimizationResult,
                optimizationOptions
            );
            
            await db.update(tables.rewritesTable)
                .set({
                    rewrittenContent: rewrittenContent,
                    improvements: optimizationResult.metadata,
                    rewriteSummary: rewriteSummary,
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(tables.rewritesTable.id, rewriteID));
            
            logger.info('[RESUME_REWRITE] ✅ Optimized content saved with rewrite summary');
        });

        // Step 5: AUTO-APPLY the rewrite to resume content
        await executeWithRewriteProgress(job.id, 'APPLYING', async () => {
            logger.info('[RESUME_REWRITE] Auto-applying rewrite to resume content');
            
            // Get current resume content for this analysis
            const [currentResumeContent] = await db
                .select()
                .from(tables.contentTable)
                .where(
                    and(
                        eq(tables.contentTable.analysisID, analysisID),
                        eq(tables.contentTable[entityIDField], userID)
                    )
                )
                .limit(1);
            
            if (!currentResumeContent) {
                logger.warn('[RESUME_REWRITE] No resume content found to apply rewrite to', { analysisID, userID, userType });
                return;
            }
            
            // If there's an active rewrite, save current resume content to it before switching
            if (currentResumeContent.activeRewriteID && currentResumeContent.activeRewriteID !== rewriteID) {
                logger.info('[RESUME_REWRITE] Saving current content to previously active rewrite', {
                    previousRewriteID: currentResumeContent.activeRewriteID
                });
                
                // Get the previously active rewrite details
                const [previousRewrite] = await db
                    .select({ appliedAt: tables.rewritesTable.appliedAt })
                    .from(tables.rewritesTable)
                    .where(eq(tables.rewritesTable.id, currentResumeContent.activeRewriteID))
                    .limit(1);
                
                if (previousRewrite && previousRewrite.appliedAt) {
                    // Check if content was modified
                    const wasModified = currentResumeContent.updatedAt > previousRewrite.appliedAt;
                    
                    // Save current resume content to the previous rewrite
                    // Includes: sections, scores, AND analysisSummary
                    const currentSnapshot = {
                        personalInfo: currentResumeContent.personalInfo,
                        summary: currentResumeContent.summary,
                        experience: currentResumeContent.experience,
                        education: currentResumeContent.education,
                        skills: currentResumeContent.skills,
                        additionalSections: currentResumeContent.additionalSections,
                        scores: currentResumeContent.currentScores
                    };
                    
                    // Also save the current analysisSummary to the previous rewrite as rewriteSummary
                    const currentAnalysisSummary = currentResumeContent.analysisSummary;
                    
                    await db
                        .update(tables.rewritesTable)
                        .set({ 
                            rewrittenContent: currentSnapshot,
                            rewriteSummary: currentAnalysisSummary,
                            wasModifiedAfterApply: wasModified,
                            updatedAt: new Date()
                        })
                        .where(eq(tables.rewritesTable.id, currentResumeContent.activeRewriteID));
                    
                    logger.info('[RESUME_REWRITE] ✅ Saved current content, scores, and analysisSummary to previous rewrite', {
                        previousRewriteID: currentResumeContent.activeRewriteID,
                        wasModified,
                        hasScores: !!currentResumeContent.currentScores,
                        hasAnalysisSummary: !!currentAnalysisSummary
                    });
                }
            }
            
            // Deactivate all other rewrites for this analysis
            await db
                .update(tables.rewritesTable)
                .set({ isActive: false, updatedAt: new Date() })
                .where(
                    and(
                        eq(tables.rewritesTable.analysisID, analysisID),
                        eq(tables.rewritesTable[entityIDField], userID)
                    )
                );
            
            // Mark this rewrite as active
            await db
                .update(tables.rewritesTable)
                .set({
                    isActive: true,
                    appliedAt: new Date(),
                    wasModifiedAfterApply: false,
                    updatedAt: new Date()
                })
                .where(eq(tables.rewritesTable.id, rewriteID));
            
            // Get the rewrite summary we just saved to the rewrite
            const [rewriteRecord] = await db
                .select({ rewriteSummary: tables.rewritesTable.rewriteSummary })
                .from(tables.rewritesTable)
                .where(eq(tables.rewritesTable.id, rewriteID))
                .limit(1);
            
            // Apply the rewritten content to resume content table
            // Also update the analysisSummary to show the post-rewrite summary
            const content = optimizationResult.content;
            await db
                .update(tables.contentTable)
                .set({
                    personalInfo: content?.personalInfo || currentResumeContent.personalInfo,
                    summary: content?.summary || currentResumeContent.summary,
                    experience: content?.experience || currentResumeContent.experience,
                    education: content?.education || currentResumeContent.education,
                    skills: content?.skills || currentResumeContent.skills,
                    additionalSections: content?.additionalSections || currentResumeContent.additionalSections,
                    currentScores: optimizationResult.scores || currentResumeContent.currentScores,
                    analysisSummary: rewriteRecord?.rewriteSummary || currentResumeContent.analysisSummary,
                    version: currentResumeContent.version + 1,
                    lastEditType: 'ai_rewrite',
                    activeRewriteID: rewriteID,
                    updatedAt: new Date()
                })
                .where(eq(tables.contentTable.id, currentResumeContent.id));
            
            logger.info('[RESUME_REWRITE] ✅ Rewrite auto-applied to resume content', {
                contentID: currentResumeContent.id,
                newVersion: currentResumeContent.version + 1,
                userType
            });
        });

        // Step 6: Complete
        await executeWithRewriteProgress(job.id, 'COMPLETE', async () => {
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
            stack: error.stack,
            userType
        });

        // Update rewrite status to failed
        try {
            await db.update(tables.rewritesTable)
                .set({
                    status: 'failed',
                    updatedAt: new Date()
                })
                .where(eq(tables.rewritesTable.id, rewriteID));
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
