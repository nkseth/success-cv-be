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
const { bullMQConnection, getRedisConnectionConfig } = await import('../../config/redis.config.js');
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
    const redisConfig = getRedisConnectionConfig({
        db: parseInt(process.env.REDIS_DB_CACHE) || 0,
        connectionName: 'pubsub:worker:resume-rewrite'
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Initializing PubSub service in rewrite worker (attempt ${attempt}/${maxRetries})`, redisConfig);
            await pubSubService.initialize(redisConfig, {
                mode: 'publisher',
                connectionNamePrefix: 'pubsub:worker:resume-rewrite'
            });
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
 * Format skills object for display in job-aware prompt
 * @param {Object} skills - Skills object
 * @returns {string} Formatted skills string
 */
function formatSkills(skills) {
    if (!skills || typeof skills !== 'object') return 'Not specified';
    
    const sections = [];
    if (skills.required && skills.required.length > 0) {
        sections.push(`Required: ${skills.required.join(', ')}`);
    }
    if (skills.technical && skills.technical.length > 0) {
        sections.push(`Technical: ${skills.technical.join(', ')}`);
    }
    if (skills.preferred && skills.preferred.length > 0) {
        sections.push(`Preferred: ${skills.preferred.join(', ')}`);
    }
    if (skills.soft && skills.soft.length > 0) {
        sections.push(`Soft Skills: ${skills.soft.join(', ')}`);
    }
    
    return sections.length > 0 ? sections.join('\n') : 'Not specified';
}

/**
 * Generate lightweight post-rewrite summary for user-driven optimization
 * Shows what was improved based on user's goal
 * @param {Object} currentContent - Original content before optimization
 * @param {Object} optimizationResult - Result from AI optimization
 * @param {string} userPrompt - User's optimization goal
 * @param {Object} options - Optimization options used
 * @returns {Object} Lightweight rewrite summary
 */
function generateRewriteSummary(currentContent, optimizationResult, userPrompt, options = {}) {
    logger.info('[RESUME_REWRITE] Generating post-rewrite summary');
    
    // Get summary from optimization result
    const fixesSummary = optimizationResult?.metadata?.fixesSummary || 
        `Resume optimized for: ${userPrompt?.substring(0, 100) || 'ATS compatibility'}`;
    
    // Get scores from current content (before) and optimization result (after)
    const beforeScores = currentContent?.currentScores || {};
    const afterScores = optimizationResult?.scores || {};
    
    const scoreImprovement = (afterScores.atsScore || 85) - (beforeScores.atsScore || 60);
    
    const rewriteSummary = {
        // User's original goal
        userPrompt: userPrompt,
        
        // Summary of what was improved
        improvementSummary: fixesSummary,
        
        // Score comparison - lightweight before/after for display
        scoreComparison: {
            before: {
                atsScore: beforeScores.atsScore || 60,
                contentScore: beforeScores.contentScore || 60,
                overallScore: beforeScores.overallScore || 60
            },
            after: {
                atsScore: afterScores.atsScore || 85,
                contentScore: afterScores.contentScore || 85,
                overallScore: afterScores.overallScore || 85
            },
            improvement: {
                atsScore: scoreImprovement,
                description: scoreImprovement > 0 
                    ? `+${scoreImprovement} point improvement in ATS score`
                    : 'Resume optimized for your goal'
            }
        },
        
        // Optimization type marker
        optimizationType: 'user-driven',
        targetATSScore: options.targetATSScore || 90,
        
        // Version marker
        version: `rewrite_v${options.versionNumber || 1}`,
        generatedAt: new Date().toISOString()
    };
    
    logger.info('[RESUME_REWRITE] ✅ Post-rewrite summary generated', {
        userPrompt: userPrompt?.substring(0, 50),
        scoreImprovement,
        estimatedAtsScore: afterScores.atsScore
    });
    
    return rewriteSummary;
}

/**
 * Process resume rewrite job
 * NEW USER-DRIVEN APPROACH: Uses user's prompt to optimize resume
 * No longer dependent on analysis issues
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Rewrite result
 */
async function processResumeRewrite(job) {
    const { 
        rewriteID, 
        analysisID, 
        userID, 
        resumeContentID,
        currentContent,
        userPrompt,  // NEW: User's optimization goal
        optimizationOptions,
        targetJobID,  // NEW: Job-aware rewrite
        sourceResumeID,  // NEW: Source resume for job-aware rewrite
        jobMetadata,  // NEW: Job details for context
        userType = userTypeConstants.USER
    } = job.data;
    
    // Get appropriate tables based on userType
    const tables = getTablesForUserType(userType);
    const entityIDField = tables.isCandidate ? 'candidateID' : 'userID';
    
    // Detect if this is a job-aware rewrite
    const isJobAwareRewrite = !!(targetJobID && jobMetadata);
    
    logger.info('[RESUME_REWRITE] Starting user-driven rewrite job', { 
        jobId: job.id,
        rewriteID,
        analysisID,
        userID,
        resumeContentID,
        hasCurrentContent: !!currentContent,
        hasUserPrompt: !!userPrompt,
        isJobAwareRewrite,
        targetJobID,
        jobTitle: jobMetadata?.title,
        userPromptPreview: userPrompt?.substring(0, 50),
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
        let parsedCurrentContent;
        await executeWithRewriteProgress(job.id, 'PREPARING', async () => {
            logger.info('[RESUME_REWRITE] Parsing content data');
            
            // Parse current content (this is what we're optimizing FROM)
            parsedCurrentContent = typeof currentContent === 'string'
                ? JSON.parse(currentContent)
                : currentContent;
            
            logger.info('[RESUME_REWRITE] ✅ Data parsed successfully', {
                hasCurrentContent: !!parsedCurrentContent,
                currentContentSections: parsedCurrentContent ? Object.keys(parsedCurrentContent) : [],
                userPrompt: userPrompt?.substring(0, 50)
            });
        });

        // Step 2.5: Validate user prompt (safety check)
        await executeWithRewriteProgress(job.id, 'ANALYZING_ISSUES', async () => {
            logger.info('[RESUME_REWRITE] Validating optimization request', {
                userPrompt: userPrompt?.substring(0, 100),
                isJobAwareRewrite
            });
            
            if (!userPrompt && !isJobAwareRewrite) {
                throw new Error('User optimization prompt is required for standard rewrites');
            }
        });

        // Step 3: Generate optimized content based on user's goal or job requirements
        let optimizationResult;
        let effectivePrompt = userPrompt;
        
        // For job-aware rewrites, build enhanced prompt with job context
        if (isJobAwareRewrite) {
            const jobContext = `
IMPORTANT: This resume is being tailored for a specific job posting. Optimize it to match these requirements:

**Target Job:**
- Title: ${jobMetadata.title}
- Company: ${jobMetadata.company}
- Experience Level: ${jobMetadata.experienceLevel || 'Not specified'}
- Education Required: ${jobMetadata.educationLevel || 'Not specified'}

**Required Skills:**
${formatSkills(jobMetadata.skillsRequired)}

**Job Description:**
${jobMetadata.description || 'No description provided'}

**Optimization Instructions:**
1. Incorporate relevant skills from the job requirements naturally throughout the resume
2. Align experience descriptions to match the job's experience level and requirements
3. Highlight achievements that demonstrate capabilities needed for this role
4. Use keywords from the job description while maintaining authenticity
5. Ensure the resume shows clear fit for this specific position
6. Maintain ATS optimization while tailoring for this job

${userPrompt || 'Tailor this resume to maximize match with the target job requirements.'}
`.trim();
            
            effectivePrompt = jobContext;
            
            logger.info('[RESUME_REWRITE] Job-aware rewrite prompt prepared', {
                jobTitle: jobMetadata.title,
                company: jobMetadata.company,
                skillsCount: Object.values(jobMetadata.skillsRequired || {}).flat().length
            });
        }
        
        // Start optimization
        await executeWithRewriteProgress(job.id, 'OPTIMIZING', async () => {
            logger.info('[RESUME_REWRITE] Starting AI optimization', {
                isJobAwareRewrite,
                effectivePrompt: effectivePrompt?.substring(0, 100)
            });
        });
        
        // Run the actual optimization
        optimizationResult = await optimizeResumeContent(
            parsedCurrentContent,
            effectivePrompt,  // Use job-aware prompt if applicable
            {
                targetATSScore: optimizationOptions?.targetATSScore || 90,
                isJobAwareRewrite,
                targetJobID
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
            
            // Generate lightweight rewrite summary (user-driven approach)
            const rewriteSummary = generateRewriteSummary(
                parsedCurrentContent,
                optimizationResult,
                effectivePrompt,  // Use effective prompt (includes job context if applicable)
                optimizationOptions
            );
            
            // Prepare update data
            const updateData = {
                rewrittenContent: rewrittenContent,
                improvements: optimizationResult.metadata,
                rewriteSummary: rewriteSummary,
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date()
            };
            
            // Add job-aware fields if applicable
            if (targetJobID) {
                updateData.targetJobID = targetJobID;
            }
            if (sourceResumeID) {
                updateData.sourceResumeID = sourceResumeID;
            }
            
            await db.update(tables.rewritesTable)
                .set(updateData)
                .where(eq(tables.rewritesTable.id, rewriteID));
            
            logger.info('[RESUME_REWRITE] ✅ Optimized content saved with rewrite summary', {
                isJobAwareRewrite,
                targetJobID,
                sourceResumeID
            });
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
                    
                    // Get current theme to save with the previous rewrite
                    const { getUserTheme } = await import('../../models/theme.model.js');
                    let currentThemeSnapshot = null;
                    try {
                        const currentTheme = await getUserTheme(currentResumeContent.id, userID, userType);
                        if (currentTheme) {
                            currentThemeSnapshot = {
                                themeID: currentTheme.themeID,
                                themeName: currentTheme.themeName,
                                themeSlug: currentTheme.themeSlug,
                                themeCategory: currentTheme.themeCategory,
                                themeConfig: currentTheme.themeConfig,
                                customOverrides: currentTheme.customOverrides,
                                sectionVisibility: currentTheme.sectionVisibility,
                                sectionOrder: currentTheme.sectionOrder,
                                isATSOptimized: currentTheme.isATSOptimized
                            };
                        }
                    } catch (themeError) {
                        logger.warn('[RESUME_REWRITE] Could not fetch theme for previous rewrite snapshot', { 
                            error: themeError.message 
                        });
                    }
                    
                    // Save current resume content to the previous rewrite
                    // Includes: sections, scores, analysisSummary, AND theme
                    const currentSnapshot = {
                        personalInfo: currentResumeContent.personalInfo,
                        summary: currentResumeContent.summary,
                        experience: currentResumeContent.experience,
                        education: currentResumeContent.education,
                        skills: currentResumeContent.skills,
                        additionalSections: currentResumeContent.additionalSections,
                        scores: currentResumeContent.currentScores,
                        theme: currentThemeSnapshot
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
                    
                    logger.info('[RESUME_REWRITE] ✅ Saved current content, scores, analysisSummary, and theme to previous rewrite', {
                        previousRewriteID: currentResumeContent.activeRewriteID,
                        wasModified,
                        hasScores: !!currentResumeContent.currentScores,
                        hasAnalysisSummary: !!currentAnalysisSummary,
                        hasTheme: !!currentThemeSnapshot
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
                .select({ 
                    rewriteSummary: tables.rewritesTable.rewriteSummary,
                    sourceContentSnapshot: tables.rewritesTable.sourceContentSnapshot 
                })
                .from(tables.rewritesTable)
                .where(eq(tables.rewritesTable.id, rewriteID))
                .limit(1);
            
            // Apply the rewritten content to resume content table
            // Also update the analysisSummary to show the post-rewrite summary
            // CRITICAL: Validate content before applying to prevent data loss
            const content = optimizationResult.content;
            
            // Validate that we're not replacing with empty/null values
            const finalPersonalInfo = content?.personalInfo || currentResumeContent.personalInfo;
            const finalSummary = content?.summary || currentResumeContent.summary;
            const finalExperience = (content?.experience && content.experience.length > 0) 
                ? content.experience 
                : currentResumeContent.experience;
            const finalEducation = content?.education || currentResumeContent.education;
            const finalSkills = content?.skills || currentResumeContent.skills;
            const finalAdditionalSections = content?.additionalSections || currentResumeContent.additionalSections;
            
            // Log what's being applied to catch any data loss
            logger.info('[RESUME_REWRITE] Applying content with validation', {
                hasPersonalInfo: !!finalPersonalInfo?.fullName,
                hasSummary: !!finalSummary?.text,
                experienceCount: finalExperience?.length || 0,
                educationCount: finalEducation?.length || 0,
                hasSkills: !!(finalSkills?.technical?.length || finalSkills?.soft?.length),
                additionalSectionsCount: finalAdditionalSections?.length || 0
            });
            
            await db
                .update(tables.contentTable)
                .set({
                    personalInfo: finalPersonalInfo,
                    summary: finalSummary,
                    experience: finalExperience,
                    education: finalEducation,
                    skills: finalSkills,
                    additionalSections: finalAdditionalSections,
                    currentScores: optimizationResult.scores || currentResumeContent.currentScores,
                    analysisSummary: rewriteRecord?.rewriteSummary || currentResumeContent.analysisSummary,
                    version: currentResumeContent.version + 1,
                    lastEditType: 'ai_rewrite',
                    activeRewriteID: rewriteID,
                    updatedAt: new Date()
                })
                .where(eq(tables.contentTable.id, currentResumeContent.id));
            
            // Restore theme from source snapshot if available
            if (rewriteRecord?.sourceContentSnapshot) {
                const snapshot = typeof rewriteRecord.sourceContentSnapshot === 'string'
                    ? JSON.parse(rewriteRecord.sourceContentSnapshot)
                    : rewriteRecord.sourceContentSnapshot;
                
                if (snapshot.theme && snapshot.theme.themeID) {
                    const { restoreThemeFromSnapshot } = await import('../../models/theme.model.js');
                    await restoreThemeFromSnapshot(userID, currentResumeContent.id, snapshot.theme, userType);
                    logger.info('[RESUME_REWRITE] ✅ Theme restored from source snapshot', {
                        themeID: snapshot.theme.themeID,
                        themeName: snapshot.theme.themeName
                    });
                }
            }
            
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
