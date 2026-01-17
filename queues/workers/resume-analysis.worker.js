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
const { bullMQConnection } = await import('../../config/redis.config.js');
const pubSubService = (await import('../../services/pubsub.service.js')).default;

// Debug: Log Redis configuration
logger.info('Worker starting with Redis config', {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    clusterMode: process.env.REDIS_CLUSTER_MODE,
    hasPassword: !!process.env.REDIS_PASSWORD,
    actualConnection: bullMQConnection
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
            logger.info(`Initializing PubSub service in worker (attempt ${attempt}/${maxRetries})`, redisConfig);
            await pubSubService.initialize(redisConfig);
            logger.info('✅ PubSub service initialized successfully in worker');
            return true;
        } catch (error) {
            logger.error(`❌ PubSub initialization failed (attempt ${attempt}/${maxRetries})`, { 
                error: error.message,
                stack: error.stack 
            });
            
            if (attempt < maxRetries) {
                logger.info(`Retrying PubSub initialization in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                logger.error('Failed to initialize PubSub after all retry attempts');
                throw new Error(`PubSub initialization failed after ${maxRetries} attempts: ${error.message}`);
            }
        }
    }
}

// Initialize PubSub service before starting worker
try {
    logger.info('🚀 Starting worker initialization...');
    await initPubSubService(
        parseInt(process.env.PUBSUB_INIT_RETRIES || '3'),
        parseInt(process.env.PUBSUB_INIT_DELAY_MS || '2000')
    );
} catch (error) {
    logger.error('🛑 Worker startup failed - PubSub initialization error', { 
        error: error.message,
        stack: error.stack 
    });
    logger.error('Worker cannot start without PubSub service. Exiting...');
    process.exit(1);
}

/**
 * Resume Analysis Worker
 * This file should be run on a separate server/process dedicated to processing jobs
 * 
 * To run: node queues/workers/resume-analysis.worker.js
 * Or set NODE_ENV=worker and start the server
 */

// Import utilities
import { extractFileContent } from '../../utils/fileExtraction.js';
import { executeWithProgress, publishJobUpdate } from '../../utils/progressTracking.js';
import { validateResumeData, isValidResume, extractEmail } from '../../utils/resumeSchema.js';
import { db } from '../../config/db.js';
import { 
    analysisTable, 
    userDocumentTable, 
    processedAndRawDataTable,
    candidateAnalysisTable,
    candidateDocumentTable,
    candidateProcessedAndRawDataTable
} from '../../drizzle/schema/analytics-rewrite-schema.js';
import { eq } from 'drizzle-orm';
import { generateAiResponseObject } from '../../services/aiService/index.js';
import { candidateSchemaSimplified } from '../workerSupport/resume-analysis/objectSchema.js';
import { getResumeAnalysisPrompt } from '../workerSupport/resume-analysis/prompt.js';
import { getFileAccessUrl } from '../../services/Integraion/uploadImage.js';
import resumeService from '../../services/resume.service.js';
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
        analysisTable: isCandidateUser ? candidateAnalysisTable : analysisTable,
        documentTable: isCandidateUser ? candidateDocumentTable : userDocumentTable,
        processedDataTable: isCandidateUser ? candidateProcessedAndRawDataTable : processedAndRawDataTable,
        entityIDColumn: isCandidateUser ? 'candidateID' : 'userID',
        isCandidate: isCandidateUser
    };
}

/**
 * Process resume analysis job
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Analysis result
 */
async function processResumeAnalysis(job) {
    const { analysisID, userID, resumeId, documentData, meta, userType = userTypeConstants.USER } = job.data;
    const { title, fileURL } = documentData || {};
    
    // Get appropriate tables based on userType
    const tables = getTablesForUserType(userType);
    
    logger.info('[RESUME_ANALYSIS] Starting job', { 
        jobId: job.id,
        analysisID,
        userID,
        resumeId,
        fileURL,
        userType
    });

    try {
        // Step 1: Initialize and update status
        await executeWithProgress(job.id, 'INIT', async () => {
            await db.update(tables.analysisTable)
                .set({
                    status: 'processing',
                    updatedAt: new Date()
                })
                .where(eq(tables.analysisTable.id, analysisID));
                
            logger.info('[RESUME_ANALYSIS] Analysis record updated to processing');
        });

        // Step 2: Generate SAS token URL for file access
        let accessUrl;
        await executeWithProgress(job.id, 'DOWNLOADING', async () => {
            logger.info('[RESUME_ANALYSIS] Generating access URL for file:', fileURL);
            
            // Extract container and blob name from the fileURL
            // Format: https://{account}.blob.core.windows.net/{container}/{blobName}
            const urlParts = new URL(fileURL);
            const pathParts = urlParts.pathname.split('/').filter(Boolean);
            
            if (pathParts.length < 2) {
                throw new Error(`Invalid file URL format: ${fileURL}`);
            }
            
            const containerName = pathParts[0];
            const blobName = pathParts.slice(1).join('/');
            
            logger.info('[RESUME_ANALYSIS] File details:', { containerName, blobName });
            
            // Generate SAS token URL with read permissions (60 minute expiry)
            accessUrl = await getFileAccessUrl(containerName, blobName, 60);
            
            logger.info('[RESUME_ANALYSIS] ✅ Generated access URL (expires in 60 minutes)');
        });

        // Step 3: Extract text content from file
        let fileContent;
        fileContent = await executeWithProgress(job.id, 'EXTRACTING', async () => {
            logger.info('[RESUME_ANALYSIS] Extracting content from file using access URL');
            const content = await extractFileContent(accessUrl);
            
            if (!content || content.trim().length === 0) {
                throw new Error('Extracted content is empty - file may be corrupted or unsupported');
            }
            
            logger.info('[RESUME_ANALYSIS] ✅ Extracted', content.length, 'characters');
            return content;
        });

        // Step 4: Parse resume content using AI
        const parsedData = await executeWithProgress(job.id, 'PARSING', async () => {
            logger.info('[RESUME_ANALYSIS] Parsing resume content with AI');
            
            // Use AI to parse and analyze resume
            const result = await generateAiResponseObject({
                filePath: fileContent, // Use extracted text content
                schema: candidateSchemaSimplified,
                system: getResumeAnalysisPrompt(),
                content: `Analyze this resume and identify all mistakes, issues, and improvement opportunities:\n\n${fileContent}`
            });
            
            logger.info('[RESUME_ANALYSIS] AI parsing completed:', {
                hasPersonalInfo: !!result.personal_info,
                experienceCount: result.experiences?.length || 0,
                educationCount: result.education?.length || 0,
                criticalMistakes: result.critical_mistakes?.length || 0,
                majorIssues: result.major_issues?.length || 0,
                overallScore: result.relevance?.['Overall Score'] || 0
            });
            
            return result;
        });

        // Step 5: Validate resume data
        let resumeData;
        await executeWithProgress(job.id, 'ANALYZING', async () => {
            logger.info('[RESUME_ANALYSIS] Validating AI-parsed resume data');
            
            // The AI already validated and structured the data
            resumeData = parsedData;
            
            // Additional validation checks
            if (!parsedData.personal_info?.email) {
                logger.warn('[RESUME_ANALYSIS] No email found in resume');
            }
            
            if (!parsedData.experiences || parsedData.experiences.length === 0) {
                logger.warn('[RESUME_ANALYSIS] No work experience found in resume');
            }
            
            logger.info('[RESUME_ANALYSIS] ✅ Resume data validated successfully');
        });

        // Step 6: Extract scores from AI analysis
        await executeWithProgress(job.id, 'SCORING', async () => {
            logger.info('[RESUME_ANALYSIS] Extracting scores from AI analysis');
            
            // AI already calculated all scores in the schema
            const scores = {
                overall_score: resumeData.relevance?.['Overall Score'] || 0,
                job_fit_score: resumeData.JobFitScore || 0,
                resume_quality_score: resumeData.resume_quality?.overall_quality_score || 0,
                ats_score: resumeData.resume_quality?.ats_compatibility_score || 0,
                skills_score: resumeData.relevance?.['Skills Relevance'] || 0,
                experience_score: resumeData.relevance?.['Work Experience'] || 0,
                education_score: resumeData.relevance?.['Education'] || 0
            };
            
            logger.info('[RESUME_ANALYSIS] Scores extracted:', {
                overall: scores.overall_score,
                jobFit: scores.job_fit_score,
                resumeQuality: scores.resume_quality_score,
                ats: scores.ats_score,
                criticalMistakes: resumeData.critical_mistakes?.length || 0,
                majorIssues: resumeData.major_issues?.length || 0
            });
            
            // Store scores for easy access
            resumeData._scores = scores;
        });

        // Step 7: Save results to database
        await executeWithProgress(job.id, 'SAVING', async () => {
            logger.info('[RESUME_ANALYSIS] Saving results to database');
            
            const scores = resumeData._scores || {};
            
            // Update document title with candidate name from parsed data
            const candidateName = resumeData.personal_info?.name || 'Unknown Candidate';
            const timestamp = new Date().toISOString().split('T')[0];
            const updatedTitle = `${candidateName} - Resume Analysis - ${timestamp}`;
            
            await db.update(tables.documentTable)
                .set({
                    title: updatedTitle,
                    updatedAt: new Date()
                })
                .where(eq(tables.documentTable.id, resumeId));
            
            logger.info('[RESUME_ANALYSIS] Updated document title:', updatedTitle);
            
            // Save processed data to processedAndRawDataTable
            const [processedDataRecord] = await db.insert(tables.processedDataTable)
                .values({
                    analysisID,
                    documentID: resumeId,
                    rawData: fileContent, // Original extracted text
                    processedData: JSON.stringify(resumeData), // AI-processed structured data with mistakes analysis
                    meta: JSON.stringify({
                        scores: scores,
                        criticalMistakesCount: resumeData.critical_mistakes?.length || 0,
                        majorIssuesCount: resumeData.major_issues?.length || 0,
                        minorImprovementsCount: resumeData.minor_improvements?.length || 0,
                        optimizationOpportunitiesCount: resumeData.optimization_opportunities?.length || 0
                    })
                })
                .returning();
            
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
                            jobFitScore: scores.job_fit_score,
                            resumeQualityScore: scores.resume_quality_score,
                            atsScore: scores.ats_score,
                            totalMistakes: (resumeData.critical_mistakes?.length || 0) + (resumeData.major_issues?.length || 0),
                            improvementPotential: resumeData.resume_quality?.improvement_points || 0
                        }
                    })
                })
                .where(eq(tables.analysisTable.id, analysisID));
            
            logger.info('[RESUME_ANALYSIS] ✅ Results saved to database', {
                processedDataID: processedDataRecord.id
            });

            // Create unified resume content from analysis data
            try {
                logger.info('[RESUME_ANALYSIS] Creating resume content from analysis data');
                logger.debug('[RESUME_ANALYSIS] Analysis data structure:', {
                    hasPersonalInfo: !!resumeData.personal_info,
                    hasExperiences: !!resumeData.experiences,
                    experienceCount: resumeData.experiences?.length || 0,
                    hasEducation: !!resumeData.education,
                    educationCount: resumeData.education?.length || 0,
                    hasProjects: !!resumeData.projects,
                    projectsCount: resumeData.projects?.length || 0,
                    hasAwards: !!resumeData.awards,
                    awardsCount: resumeData.awards?.length || 0,
                    hasPublications: !!resumeData.publications,
                    publicationsCount: resumeData.publications?.length || 0,
                    hasVolunteers: !!resumeData.volunteers,
                    volunteersCount: resumeData.volunteers?.length || 0,
                    hasCertificates: !!resumeData.certificates,
                    certificatesCount: resumeData.certificates?.length || 0,
                    hasAchievements: !!resumeData.achievements,
                    achievementsCount: resumeData.achievements?.length || 0,
                    hasInterests: !!resumeData.interests,
                    interestsCount: resumeData.interests?.length || 0,
                    hasHobbies: !!resumeData.hobbies,
                    hobbiesCount: resumeData.hobbies?.length || 0,
                    hasOtherSkills: !!resumeData.other_skills,
                    otherSkillsCount: resumeData.other_skills?.length || 0,
                    hasLanguages: !!resumeData.languages,
                    languagesCount: resumeData.languages?.length || 0
                });
                
                const resumeContent = await resumeService.createResumeFromAnalysis(
                    userID,
                    analysisID,
                    resumeData,
                    userType
                );
                logger.info('[RESUME_ANALYSIS] ✅ Resume content created', {
                    resumeContentID: resumeContent.id,
                    userType
                });
            } catch (resumeError) {
                // Log but don't fail the job - resume content can be created later
                logger.error('[RESUME_ANALYSIS] Failed to create resume content', {
                    error: resumeError.message,
                    stack: resumeError.stack
                });
            }
        });

        // Step 8: Complete
        await executeWithProgress(job.id, 'COMPLETE', async () => {
            const scores = resumeData._scores || {};
            
            await publishJobUpdate(job.id, {
                progress: 100,
                status: 'completed',
                message: 'Resume analysis completed successfully!',
                result: {
                    analysisID,
                    scores: {
                        overall: scores.overall_score,
                        jobFit: scores.job_fit_score,
                        resumeQuality: scores.resume_quality_score,
                        ats: scores.ats_score
                    },
                    mistakes: {
                        critical: resumeData.critical_mistakes?.length || 0,
                        major: resumeData.major_issues?.length || 0,
                        minor: resumeData.minor_improvements?.length || 0
                    },
                    improvementPotential: resumeData.resume_quality?.improvement_points || 0,
                    hasImprovementPlan: !!(resumeData.improvement_plan)
                }
            });
        });

        logger.info('[RESUME_ANALYSIS] ✅ Job completed successfully', {
            jobId: job.id,
            analysisID
        });

        return {
            success: true,
            analysisID,
            resumeData
        };

    } catch (error) {
        logger.error('[RESUME_ANALYSIS] ❌ Job failed', {
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
                        errorStack: error.stack
                    })
                })
                .where(eq(tables.analysisTable.id, analysisID));
        } catch (dbError) {
            logger.error('[RESUME_ANALYSIS] Failed to update error status', { 
                error: dbError.message 
            });
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
export function createResumeAnalysisWorker(concurrency = 5) {
    const worker = new Worker('resume-analysis', processResumeAnalysis, {
        connection: bullMQConnection,
        concurrency, // Number of jobs to process in parallel
        limiter: {
            max: 10, // Max 10 jobs
            duration: 1000, // per 1 second
        },
    });

    // Worker event listeners
    worker.on('completed', (job) => {
        logger.info('Worker: Job completed', { 
            jobId: job.id, 
            resumeId: job.data.resumeId 
        });
    });

    worker.on('failed', (job, error) => {
        logger.error('Worker: Job failed', { 
            jobId: job?.id, 
            resumeId: job?.data?.resumeId,
            error: error.message 
        });
    });

    worker.on('error', (error) => {
        logger.error('Worker: Error', { error: error.message });
    });

    worker.on('stalled', (jobId) => {
        logger.warn('Worker: Job stalled', { jobId });
    });

    worker.on('active', (job) => {
        logger.info('Worker: Job active', { 
            jobId: job.id, 
            resumeId: job.data.resumeId 
        });
    });

    logger.info('Resume analysis worker started', { 
        concurrency,
        queue: 'resume-analysis' 
    });

    return worker;
}

/**
 * Graceful shutdown
 */
export async function shutdownWorker(worker) {
    try {
        logger.info('Shutting down worker...');
        await worker.close();
        logger.info('Worker shut down gracefully');
    } catch (error) {
        logger.error('Error shutting down worker', { error: error.message });
        throw error;
    }
}

// If this file is run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
    logger.info('Starting resume analysis worker process...');
    
    const worker = createResumeAnalysisWorker(
        parseInt(process.env.WORKER_CONCURRENCY || '5')
    );

    // Graceful shutdown on signals
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down worker...');
        await shutdownWorker(worker);
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in worker', { error: error.message, stack: error.stack });
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection in worker', { reason, promise });
        process.exit(1);
    });
}

export default {
    createResumeAnalysisWorker,
    shutdownWorker,
};
