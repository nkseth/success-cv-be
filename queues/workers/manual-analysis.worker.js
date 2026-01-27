import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

import { Worker } from 'bullmq';
import logger from '../../middleware/logger.js';

// Dynamic import to ensure env vars are loaded before redis config
const { bullMQConnection, getRedisConnectionConfig } = await import('../../config/redis.config.js');
const pubSubService = (await import('../../services/pubsub.service.js')).default;

// Debug: Log Redis configuration
logger.info('[MANUAL_ANALYSIS_WORKER] Starting with Redis config', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    clusterMode: process.env.REDIS_CLUSTER_MODE,
    hasPassword: !!process.env.REDIS_PASSWORD,
});

/**
 * Initialize PubSub service with retry logic
 */
async function initPubSubService(maxRetries = 3, delayMs = 2000) {
    const redisConfig = getRedisConnectionConfig({
        db: parseInt(process.env.REDIS_DB_CACHE) || 0,
        connectionName: 'pubsub:worker:manual-analysis'
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`[MANUAL_ANALYSIS_WORKER] Initializing PubSub service (attempt ${attempt}/${maxRetries})`);
            await pubSubService.initialize(redisConfig, {
                mode: 'publisher',
                connectionNamePrefix: 'pubsub:worker:manual-analysis'
            });
            logger.info('[MANUAL_ANALYSIS_WORKER] ✅ PubSub service initialized successfully');
            return true;
        } catch (error) {
            logger.error(`[MANUAL_ANALYSIS_WORKER] ❌ PubSub initialization failed (attempt ${attempt}/${maxRetries})`, { 
                error: error.message,
                stack: error.stack 
            });
            
            if (attempt < maxRetries) {
                logger.info(`[MANUAL_ANALYSIS_WORKER] Retrying PubSub initialization in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                logger.error('[MANUAL_ANALYSIS_WORKER] Failed to initialize PubSub after all retry attempts');
                throw new Error(`PubSub initialization failed after ${maxRetries} attempts: ${error.message}`);
            }
        }
    }
}

// Initialize PubSub service before starting worker
try {
    logger.info('[MANUAL_ANALYSIS_WORKER] 🚀 Starting worker initialization...');
    await initPubSubService(
        parseInt(process.env.PUBSUB_INIT_RETRIES || '3'),
        parseInt(process.env.PUBSUB_INIT_DELAY_MS || '2000')
    );
} catch (error) {
    logger.error('[MANUAL_ANALYSIS_WORKER] 🛑 Worker startup failed - PubSub initialization error', { 
        error: error.message,
        stack: error.stack 
    });
    logger.error('[MANUAL_ANALYSIS_WORKER] Worker cannot start without PubSub service. Exiting...');
    process.exit(1);
}

/**
 * Manual Resume Analysis Worker
 * Analyzes resumes that were created manually (blank resumes with user-entered content)
 * 
 * Unlike the regular analysis worker, this:
 * - Does NOT download or extract content from files
 * - Uses existing structured resume_content data
 * - Converts structured data to text for AI analysis
 * - Focuses on quality scoring and improvement recommendations
 * 
 * To run: node queues/workers/manual-analysis.worker.js
 */

// Import utilities
import { executeWithProgress, publishJobUpdate, PROGRESS_STAGES } from '../../utils/progressTracking.js';
import { resumeContentToText } from '../../utils/resumeSchema.js';
import { db } from '../../config/db.js';
import { 
    analysisTable, 
    processedAndRawDataTable,
    candidateAnalysisTable,
    candidateProcessedAndRawDataTable,
    resumeContentTable,
    candidateResumeContentTable
} from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { generateAiResponseObject } from '../../services/aiService/index.js';
import { candidateSchemaSimplified } from '../workerSupport/resume-analysis/objectSchema.js';
import { getManualResumeAnalysisPrompt } from '../workerSupport/manual-analysis/prompt.js';
import { isCandidate as checkIsCandidate } from '../../utils/dynamic-tables.js';
import { userTypeConstants } from '../../utils/constants.js';
import billingModel from '../../models/billing.model.js';

// Custom progress stages for manual analysis (no download/extract steps)
const MANUAL_ANALYSIS_STAGES = {
    INIT: { percent: 0, message: 'Initializing resume analysis...' },
    PREPARING: { percent: 15, message: 'Preparing resume content for analysis...' },
    ANALYZING: { percent: 40, message: 'AI is analyzing your resume...' },
    SCORING: { percent: 70, message: 'Calculating scores and identifying improvements...' },
    SAVING: { percent: 85, message: 'Saving analysis results...' },
    COMPLETE: { percent: 100, message: 'Resume analysis completed!' }
};

/**
 * Get tables for user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} Object with table references and flags
 */
function getTablesForUserType(userType) {
    const isCandidateUser = checkIsCandidate(userType);
    return {
        analysisTable: isCandidateUser ? candidateAnalysisTable : analysisTable,
        processedDataTable: isCandidateUser ? candidateProcessedAndRawDataTable : processedAndRawDataTable,
        resumeContentTable: isCandidateUser ? candidateResumeContentTable : resumeContentTable,
        entityIDColumn: isCandidateUser ? 'candidateID' : 'userID',
        isCandidate: isCandidateUser
    };
}

/**
 * Execute operation with custom progress stages
 */
async function executeWithManualProgress(jobId, stageName, asyncFunction) {
    const stage = MANUAL_ANALYSIS_STAGES[stageName];
    
    if (!stage) {
        logger.warn('[MANUAL_ANALYSIS] Unknown stage name', { stageName });
        return asyncFunction();
    }
    
    try {
        logger.info('[MANUAL_ANALYSIS] Starting step', { 
            jobId, 
            stage: stageName, 
            progress: stage.percent 
        });
        
        await publishJobUpdate(jobId, {
            progress: stage.percent,
            stage: stageName,
            status: 'in_progress',
            message: stage.message
        });
        
        const result = await asyncFunction();
        
        logger.info('[MANUAL_ANALYSIS] ✅ Step completed', { 
            jobId, 
            stage: stageName 
        });
        
        return result;
        
    } catch (error) {
        logger.error('[MANUAL_ANALYSIS] ❌ Step failed', { 
            jobId, 
            stage: stageName,
            error: error.message 
        });
        
        await publishJobUpdate(jobId, {
            progress: stage.percent,
            stage: stageName,
            status: 'step_failed',
            message: `${stage.message} - failed: ${error.message}`,
            error: error.message
        });
        
        throw error;
    }
}

/**
 * Process manual resume analysis job
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Analysis result
 */
async function processManualAnalysis(job) {
    const { 
        analysisID, 
        userID, 
        userType = userTypeConstants.USER,
        resumeContentID,
        documentID,
        creditTransactionID
    } = job.data;
    
    // Get appropriate tables based on userType
    const tables = getTablesForUserType(userType);
    
    logger.info('[MANUAL_ANALYSIS] Starting job', { 
        jobId: job.id,
        analysisID,
        userID,
        resumeContentID,
        documentID,
        userType,
        creditTransactionID
    });

    try {
        // Step 1: Initialize and update status
        await executeWithManualProgress(job.id, 'INIT', async () => {
            await db.update(tables.analysisTable)
                .set({
                    status: 'processing',
                    jobID: job.id,
                    updatedAt: new Date()
                })
                .where(eq(tables.analysisTable.id, analysisID));
                
            logger.info('[MANUAL_ANALYSIS] Analysis record updated to processing');
        });

        // Step 2: Fetch and prepare resume content
        let resumeContent;
        let resumeText;
        await executeWithManualProgress(job.id, 'PREPARING', async () => {
            logger.info('[MANUAL_ANALYSIS] Fetching resume content', { resumeContentID });
            
            // Fetch the resume content record
            const [contentRecord] = await db.select()
                .from(tables.resumeContentTable)
                .where(eq(tables.resumeContentTable.id, resumeContentID));
            
            if (!contentRecord) {
                throw new Error(`Resume content not found: ${resumeContentID}`);
            }
            
            // Structure the content for conversion
            resumeContent = {
                personalInfo: contentRecord.personalInfo || {},
                summary: contentRecord.summary || {},
                experience: contentRecord.experience || [],
                education: contentRecord.education || [],
                skills: contentRecord.skills || {},
                additionalSections: contentRecord.additionalSections || []
            };
            
            // Convert structured content to text for AI analysis
            resumeText = resumeContentToText(resumeContent);
            
            if (!resumeText || resumeText.trim().length === 0) {
                throw new Error('Resume content is empty - please add more details before analysis');
            }
            
            logger.info('[MANUAL_ANALYSIS] ✅ Resume content prepared', { 
                textLength: resumeText.length,
                hasExperience: resumeContent.experience?.length > 0,
                hasEducation: resumeContent.education?.length > 0,
                hasSkills: Object.keys(resumeContent.skills || {}).length > 0
            });
        });

        // Step 3: Analyze with AI
        let analysisResult;
        await executeWithManualProgress(job.id, 'ANALYZING', async () => {
            logger.info('[MANUAL_ANALYSIS] Analyzing resume content with AI');
            
            // Use AI to analyze resume
            analysisResult = await generateAiResponseObject({
                filePath: resumeText, // Use text content
                schema: candidateSchemaSimplified,
                system: getManualResumeAnalysisPrompt(),
                content: `Analyze this resume and identify all mistakes, issues, and improvement opportunities. This resume was created manually by the user, so focus on content quality, not extraction:\n\n${resumeText}`
            });
            
            logger.info('[MANUAL_ANALYSIS] ✅ AI analysis completed', {
                overallScore: analysisResult.relevance?.['Overall Score'] || 0,
                atsScore: analysisResult.resume_quality?.ats_compatibility_score || 0,
                criticalMistakes: analysisResult.critical_mistakes?.length || 0,
                majorIssues: analysisResult.major_issues?.length || 0,
                minorImprovements: analysisResult.minor_improvements?.length || 0
            });
        });

        // Step 4: Extract and calculate scores
        let scores;
        await executeWithManualProgress(job.id, 'SCORING', async () => {
            logger.info('[MANUAL_ANALYSIS] Extracting scores from AI analysis');
            
            scores = {
                overall_score: analysisResult.relevance?.['Overall Score'] || 0,
                job_fit_score: analysisResult.JobFitScore || 0,
                resume_quality_score: analysisResult.resume_quality?.overall_quality_score || 0,
                ats_score: analysisResult.resume_quality?.ats_compatibility_score || 0,
                content_score: analysisResult.resume_quality?.content_quality_score || 0,
                grammar_score: analysisResult.resume_quality?.grammar_language_score || 0,
                formatting_score: analysisResult.resume_quality?.formatting_design_score || 0,
                professional_branding_score: analysisResult.resume_quality?.professional_branding_score || 0,
                completeness_score: analysisResult.resume_quality?.completeness_score || 0,
                skills_score: analysisResult.relevance?.['Skills Relevance'] || 0,
                experience_score: analysisResult.relevance?.['Work Experience'] || 0,
                education_score: analysisResult.relevance?.['Education'] || 0
            };
            
            // Store scores in result for easy access
            analysisResult._scores = scores;
            
            logger.info('[MANUAL_ANALYSIS] ✅ Scores extracted', {
                overall: scores.overall_score,
                ats: scores.ats_score,
                content: scores.content_score
            });
        });

        // Step 5: Save results to database
        await executeWithManualProgress(job.id, 'SAVING', async () => {
            logger.info('[MANUAL_ANALYSIS] Saving results to database');
            
            // Check if processed data record already exists (for re-analysis)
            const [existingProcessedData] = await db.select()
                .from(tables.processedDataTable)
                .where(eq(tables.processedDataTable.analysisID, analysisID));
            
            const processedDataPayload = {
                rawData: resumeText, // Store the text representation
                processedData: JSON.stringify(analysisResult),
                meta: JSON.stringify({
                    scores: scores,
                    criticalMistakesCount: analysisResult.critical_mistakes?.length || 0,
                    majorIssuesCount: analysisResult.major_issues?.length || 0,
                    minorImprovementsCount: analysisResult.minor_improvements?.length || 0,
                    optimizationOpportunitiesCount: analysisResult.optimization_opportunities?.length || 0,
                    analysisType: 'manual'
                }),
                updatedAt: new Date()
            };
            
            let processedDataRecord;
            if (existingProcessedData) {
                // Update existing record
                [processedDataRecord] = await db.update(tables.processedDataTable)
                    .set(processedDataPayload)
                    .where(eq(tables.processedDataTable.id, existingProcessedData.id))
                    .returning();
                    
                logger.info('[MANUAL_ANALYSIS] Updated existing processed data record', {
                    processedDataID: processedDataRecord.id
                });
            } else {
                // Create new record
                [processedDataRecord] = await db.insert(tables.processedDataTable)
                    .values({
                        analysisID,
                        documentID,
                        ...processedDataPayload,
                        createdAt: new Date()
                    })
                    .returning();
                    
                logger.info('[MANUAL_ANALYSIS] Created new processed data record', {
                    processedDataID: processedDataRecord.id
                });
            }
            
            // Update resume_content with new scores and analysis summary
            const analysisSummary = {
                issuesCounts: {
                    critical: analysisResult.critical_mistakes?.length || 0,
                    major: analysisResult.major_issues?.length || 0,
                    minor: analysisResult.minor_improvements?.length || 0
                },
                improvementSummary: analysisResult.relevance?.Description || 'Analysis completed',
                scoreChange: null, // First analysis, no comparison
                version: 'analysis_v1',
                updatedAt: new Date().toISOString()
            };
            
            await db.update(tables.resumeContentTable)
                .set({
                    currentScores: {
                        atsScore: scores.ats_score,
                        contentScore: scores.content_score,
                        formatScore: scores.formatting_score,
                        overallScore: scores.overall_score,
                        jobFitScore: scores.job_fit_score,
                        skillsRelevanceScore: scores.skills_score,
                        experienceRelevanceScore: scores.experience_score,
                        educationRelevanceScore: scores.education_score,
                        grammarScore: scores.grammar_score,
                        professionalBrandingScore: scores.professional_branding_score,
                        completenessScore: scores.completeness_score
                    },
                    analysisSummary,
                    updatedAt: new Date()
                })
                .where(eq(tables.resumeContentTable.id, resumeContentID));
            
            // Update analysis status to completed
            await db.update(tables.analysisTable)
                .set({
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date(),
                    meta: JSON.stringify({
                        processedDataID: processedDataRecord.id,
                        scores: scores,
                        summary: {
                            overallScore: scores.overall_score,
                            atsScore: scores.ats_score,
                            contentScore: scores.content_score,
                            totalMistakes: (analysisResult.critical_mistakes?.length || 0) + (analysisResult.major_issues?.length || 0),
                            improvementPotential: analysisResult.resume_quality?.improvement_points || 0
                        },
                        analysisType: 'manual'
                    })
                })
                .where(eq(tables.analysisTable.id, analysisID));
            
            logger.info('[MANUAL_ANALYSIS] ✅ Results saved to database', {
                processedDataID: processedDataRecord.id,
                resumeContentID
            });
            
            // Confirm credit deduction (task completed successfully)
            if (creditTransactionID) {
                try {
                    await billingModel.confirmDeduction(creditTransactionID);
                    logger.info('[MANUAL_ANALYSIS] ✅ Credit deduction confirmed', { creditTransactionID });
                } catch (billingError) {
                    logger.error('[MANUAL_ANALYSIS] ⚠️ Failed to confirm credit deduction (non-critical)', {
                        error: billingError.message,
                        creditTransactionID
                    });
                    // Don't fail the job for billing issues
                }
            }
        });

        // Step 6: Complete
        await executeWithManualProgress(job.id, 'COMPLETE', async () => {
            await publishJobUpdate(job.id, {
                progress: 100,
                status: 'completed',
                message: 'Resume analysis completed successfully!',
                result: {
                    analysisID,
                    scores: {
                        overall: scores.overall_score,
                        ats: scores.ats_score,
                        content: scores.content_score,
                        jobFit: scores.job_fit_score
                    },
                    mistakes: {
                        critical: analysisResult.critical_mistakes?.length || 0,
                        major: analysisResult.major_issues?.length || 0,
                        minor: analysisResult.minor_improvements?.length || 0
                    },
                    improvementPotential: analysisResult.resume_quality?.improvement_points || 0,
                    hasImprovementPlan: !!(analysisResult.improvement_plan)
                }
            });
        });

        logger.info('[MANUAL_ANALYSIS] ✅ Job completed successfully', {
            jobId: job.id,
            analysisID,
            overallScore: scores.overall_score
        });

        // Trigger job matching after successful analysis (if enabled)
        try {
            const { JOB_MATCHING_ENABLED } = await import('../../config/featureFlags.js');

            if (JOB_MATCHING_ENABLED) {
                const { triggerMatchingAfterAnalysis } = await import('../job-matching.queue.js');
                await triggerMatchingAfterAnalysis(
                    userID,
                    analysisID,
                    userType,
                    true // auto-match enabled
                );
                logger.info('[MANUAL_ANALYSIS] 🎯 Job matching triggered', {
                    jobId: job.id,
                    analysisID,
                    userType
                });
            }
        } catch (matchError) {
            logger.error('[MANUAL_ANALYSIS] ⚠️ Job matching trigger failed (non-critical)', {
                jobId: job.id,
                analysisID,
                error: matchError.message
            });
            // Don't fail the job if matching fails
        }

        return {
            success: true,
            analysisID,
            scores,
            analysisResult
        };

    } catch (error) {
        logger.error('[MANUAL_ANALYSIS] ❌ Job failed', {
            jobId: job.id,
            analysisID,
            error: error.message,
            stack: error.stack,
            userType
        });

        // Update analysis status to failed
        try {
            await db.update(tables.analysisTable)
                .set({
                    status: 'failed',
                    updatedAt: new Date(),
                    meta: JSON.stringify({
                        error: error.message,
                        errorStack: error.stack,
                        analysisType: 'manual'
                    })
                })
                .where(eq(tables.analysisTable.id, analysisID));
        } catch (dbError) {
            logger.error('[MANUAL_ANALYSIS] Failed to update error status', { 
                error: dbError.message 
            });
        }

        // Refund credits since task failed
        if (creditTransactionID) {
            try {
                await billingModel.refundCredits(creditTransactionID, `Manual analysis failed: ${error.message}`);
                logger.info('[MANUAL_ANALYSIS] Credits refunded due to failure', { creditTransactionID });
            } catch (billingError) {
                logger.error('[MANUAL_ANALYSIS] Failed to refund credits', {
                    error: billingError.message,
                    creditTransactionID
                });
            }
        }

        // Publish error update
        await publishJobUpdate(job.id, {
            progress: 0,
            status: 'failed',
            message: `Resume analysis failed: ${error.message}`,
            error: error.message
        });

        throw error;
    }
}

/**
 * Create and start the worker
 */
export function createManualAnalysisWorker(concurrency = 5) {
    const worker = new Worker('manual-resume-analysis', processManualAnalysis, {
        connection: bullMQConnection,
        concurrency,
        limiter: {
            max: 10,
            duration: 1000,
        },
    });

    // Worker event listeners
    worker.on('completed', (job) => {
        logger.info('[MANUAL_ANALYSIS_WORKER] Job completed', { 
            jobId: job.id, 
            resumeContentID: job.data.resumeContentID 
        });
    });

    worker.on('failed', (job, error) => {
        logger.error('[MANUAL_ANALYSIS_WORKER] Job failed', { 
            jobId: job?.id, 
            resumeContentID: job?.data?.resumeContentID,
            error: error.message 
        });
    });

    worker.on('error', (error) => {
        logger.error('[MANUAL_ANALYSIS_WORKER] Error', { error: error.message });
    });

    worker.on('stalled', (jobId) => {
        logger.warn('[MANUAL_ANALYSIS_WORKER] Job stalled', { jobId });
    });

    worker.on('active', (job) => {
        logger.info('[MANUAL_ANALYSIS_WORKER] Job active', { 
            jobId: job.id, 
            resumeContentID: job.data.resumeContentID 
        });
    });

    logger.info('[MANUAL_ANALYSIS_WORKER] Manual analysis worker started', { 
        concurrency,
        queue: 'manual-resume-analysis' 
    });

    return worker;
}

/**
 * Graceful shutdown
 */
export async function shutdownWorker(worker) {
    try {
        logger.info('[MANUAL_ANALYSIS_WORKER] Shutting down worker...');
        await worker.close();
        logger.info('[MANUAL_ANALYSIS_WORKER] Worker shut down gracefully');
    } catch (error) {
        logger.error('[MANUAL_ANALYSIS_WORKER] Error shutting down worker', { error: error.message });
        throw error;
    }
}

// If this file is run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
    logger.info('[MANUAL_ANALYSIS_WORKER] Starting manual analysis worker process...');
    
    const worker = createManualAnalysisWorker(
        parseInt(process.env.WORKER_CONCURRENCY || '5')
    );

    // Graceful shutdown on signals
    process.on('SIGTERM', async () => {
        logger.info('[MANUAL_ANALYSIS_WORKER] SIGTERM received, shutting down worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('[MANUAL_ANALYSIS_WORKER] SIGINT received, shutting down worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('[MANUAL_ANALYSIS_WORKER] Uncaught exception', { error: error.message, stack: error.stack });
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('[MANUAL_ANALYSIS_WORKER] Unhandled rejection', { reason, promise });
        process.exit(1);
    });
}

export default {
    createManualAnalysisWorker,
    shutdownWorker,
};
