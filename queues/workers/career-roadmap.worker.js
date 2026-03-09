import { Worker } from 'bullmq';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { careerRoadmapsTable } from '../../drizzle/schema/career-roadmap.schema.js';
import { resumeContentTable } from '../../drizzle/schema/resume.schema.js';
import { eq } from 'drizzle-orm';
import { generateAiResponseObject } from '../../services/aiService/index.js';
import { publishJobUpdate } from '../../utils/progressTracking.js';
import billingModel from '../../models/billing.model.js';
import { z } from 'zod';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

// Dynamic import to ensure env vars are loaded before redis config
const { bullMQConnection, getRedisConnectionConfig } = await import('../../config/redis.config.js');
const pubSubService = (await import('../../services/pubsub.service.js')).default;

/**
 * Career Roadmap Progress Stages
 */
const ROADMAP_STAGES = {
    INIT: { percent: 0, message: 'Preparing your career roadmap...' },
    READING: { percent: 20, message: 'Reviewing your resume content...' },
    GENERATING: { percent: 45, message: 'Generating personalised career paths...' },
    REFINING: { percent: 75, message: 'Refining roadmap details...' },
    SAVING: { percent: 90, message: 'Saving your career roadmap...' },
    COMPLETE: { percent: 100, message: 'Your career roadmap is ready!' },
};

async function publishRoadmapUpdate(jobId, stage, extra = {}) {
    const s = ROADMAP_STAGES[stage];
    await publishJobUpdate(jobId, {
        progress: s.percent,
        status: stage === 'COMPLETE' ? 'completed' : 'in_progress',
        message: s.message,
        ...extra,
    });
}

/**
 * Initialize PubSub service with retry logic
 */
async function initPubSubService(maxRetries = 3, delayMs = 2000) {
    const redisConfig = getRedisConnectionConfig({
        db: parseInt(process.env.REDIS_DB_CACHE) || 0,
        connectionName: 'pubsub:worker:career-roadmap',
    });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await pubSubService.initialize(redisConfig, {
                mode: 'publisher',
                connectionNamePrefix: 'pubsub:worker:career-roadmap',
            });
            logger.info('✅ PubSub initialized in career roadmap worker');
            return;
        } catch (error) {
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, delayMs * attempt));
            } else throw error;
        }
    }
}

await initPubSubService();

/**
 * Zod schema for AI response (career paths)
 */
const careerPathStepSchema = z.object({
    order: z.number(),
    title: z.string(),
    duration: z.string(),
    actions: z.array(z.string()).default([]),
    skills_to_build: z.array(z.string()).default([]),
    resources: z.array(z.string()).default([]),
});

const careerPathSchema = z.object({
    title: z.string(),
    summary: z.string(),
    timeframe: z.string(),
    confidence: z.number().min(0).max(100).default(75),
    steps: z.array(careerPathStepSchema).default([]),
    gap_analysis: z.object({
        strengths_leveraged: z.array(z.string()).default([]),
        gaps_to_fill: z.array(z.string()).default([]),
    }).default({}),
    salary_range: z.object({
        min: z.string().optional(),
        max: z.string().optional(),
        currency: z.string().default('USD'),
    }).optional(),
});

const roadmapResponseSchema = z.object({
    paths: z.array(careerPathSchema).min(1).max(4),
});

/**
 * Build the AI system prompt
 */
function buildSystemPrompt() {
    return `You are a senior career coach and strategist with 20+ years of experience helping professionals navigate career transitions and growth. Your role is to analyse a person's resume and their career goals, then generate concrete, actionable career roadmaps.

Your roadmaps must be:
- Realistic and grounded in the user's ACTUAL experience (do not invent skills they don't have)
- Specific with concrete steps, durations, and resources
- Varied — offer meaningfully different paths (e.g., IC track vs management, industry switch, entrepreneurial)
- Honest about skill gaps without being discouraging
- Practical — every step must be achievable within the given timeframe

Return exactly 2-4 distinct career paths. Each path should be genuinely different in direction or approach.`;
}

/**
 * Build the user-facing content prompt from resume + questionnaire
 */
function buildContentPrompt(resumeContent, questionnaire) {
    const { personalInfo, summary, experience, education, skills } = resumeContent;

    // Format experience
    const expText = (experience || []).map(e =>
        `- ${e.title || 'Role'} at ${e.company || 'Company'} (${e.startDate || '?'} – ${e.endDate || 'Present'}): ${e.description || ''}`
    ).join('\n') || 'No experience provided';

    // Format skills
    const skillsText = skills
        ? [
            ...(skills.technical || []),
            ...(skills.required || []),
            ...(skills.soft || []),
        ].join(', ')
        : 'Not specified';

    // Format education
    const eduText = (education || []).map(e =>
        `- ${e.degree || 'Degree'} in ${e.field || 'Field'} from ${e.institution || 'Institution'} (${e.graduationYear || '?'})`
    ).join('\n') || 'Not specified';

    return `# Candidate Resume

## Personal Info
Name: ${personalInfo?.fullName || 'Not provided'}
Current Title: ${personalInfo?.jobTitle || 'Not provided'}
Location: ${personalInfo?.location || 'Not provided'}

## Professional Summary
${summary?.text || 'No summary provided'}

## Work Experience
${expText}

## Education
${eduText}

## Skills
${skillsText}

---

# Career Goals (Questionnaire)

Target Role(s): ${(questionnaire?.targetRoles || []).join(', ') || 'Not specified'}
Target Industry: ${questionnaire?.industry || 'Open'}
Ideal Timeframe: ${questionnaire?.timeframe || '2-3 years'}
Top Priorities: ${(questionnaire?.priorities || []).join(', ') || 'Not specified'}
Constraints: ${questionnaire?.constraints || 'None mentioned'}

---

Based on this candidate's ACTUAL experience and their stated goals, generate 2-4 realistic and distinct career roadmaps. Each path should have clear milestones with specific actions and timelines.`;
}

/**
 * Main job processor
 */
async function processCareerRoadmap(job) {
    const { roadmapID, userID, resumeContentID, questionnaire, creditTransactionID } = job.data;

    logger.info('[ROADMAP_WORKER] Starting career roadmap job', {
        jobId: job.id, roadmapID, userID, resumeContentID,
    });

    try {
        // Step 1: Init
        await publishRoadmapUpdate(job.id, 'INIT');
        await db.update(careerRoadmapsTable)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(careerRoadmapsTable.id, roadmapID));

        // Step 2: Read resume content
        await publishRoadmapUpdate(job.id, 'READING');
        const [resumeContent] = await db
            .select()
            .from(resumeContentTable)
            .where(eq(resumeContentTable.id, resumeContentID))
            .limit(1);

        if (!resumeContent) {
            throw new Error(`Resume content not found: ${resumeContentID}`);
        }

        logger.info('[ROADMAP_WORKER] Resume content loaded', {
            resumeContentID,
            hasPersonalInfo: !!resumeContent.personalInfo,
            experienceCount: (resumeContent.experience || []).length,
        });

        // Step 3: Generate with AI
        await publishRoadmapUpdate(job.id, 'GENERATING');
        const system = buildSystemPrompt();
        const content = buildContentPrompt(resumeContent, questionnaire);

        const aiResult = await generateAiResponseObject({
            system,
            content: [{ role: 'user', content }],
            schema: roadmapResponseSchema,
            model: 'gpt-4o-mini',
            retries: 3,
        });

        logger.info('[ROADMAP_WORKER] AI generated paths', {
            pathCount: aiResult.paths?.length,
            roadmapID,
        });

        // Step 4: Refine / validate
        await publishRoadmapUpdate(job.id, 'REFINING');
        const paths = aiResult.paths || [];

        // Step 5: Save to DB
        await publishRoadmapUpdate(job.id, 'SAVING');
        await db.update(careerRoadmapsTable)
            .set({
                paths,
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(careerRoadmapsTable.id, roadmapID));

        // Confirm credit deduction
        if (creditTransactionID) {
            try {
                await billingModel.confirmDeduction(creditTransactionID);
                logger.info('[ROADMAP_WORKER] Credits confirmed', { creditTransactionID });
            } catch (billingError) {
                logger.error('[ROADMAP_WORKER] Failed to confirm credits (non-critical)', {
                    error: billingError.message,
                });
            }
        }

        // Step 6: Notify frontend via SSE
        await publishRoadmapUpdate(job.id, 'COMPLETE', {
            data: { roadmapID, pathCount: paths.length },
        });

        logger.info('[ROADMAP_WORKER] ✅ Job completed', { jobId: job.id, roadmapID });
        return { success: true, roadmapID, pathCount: paths.length };

    } catch (error) {
        logger.error('[ROADMAP_WORKER] ❌ Job failed', {
            jobId: job.id, roadmapID, error: error.message, stack: error.stack,
        });

        // Mark as failed
        try {
            await db.update(careerRoadmapsTable)
                .set({ status: 'failed', errorMsg: error.message, updatedAt: new Date() })
                .where(eq(careerRoadmapsTable.id, roadmapID));
        } catch (dbError) {
            logger.error('[ROADMAP_WORKER] Failed to update roadmap status', { error: dbError.message });
        }

        // Refund credits
        if (creditTransactionID) {
            try {
                await billingModel.refundCredits(creditTransactionID, `Roadmap failed: ${error.message}`);
                logger.info('[ROADMAP_WORKER] Credits refunded', { creditTransactionID });
            } catch (billingError) {
                logger.error('[ROADMAP_WORKER] Failed to refund credits', { error: billingError.message });
            }
        }

        // Publish failure notification
        await publishJobUpdate(job.id, {
            progress: 0,
            status: 'failed',
            message: 'We encountered an issue generating your career roadmap. Please try again.',
            error: error.message,
        });

        throw error;
    }
}

/**
 * Create and start the career roadmap worker
 */
export function createCareerRoadmapWorker(concurrency = 2) {
    const worker = new Worker('career-roadmap', processCareerRoadmap, {
        connection: bullMQConnection,
        concurrency,
        limiter: { max: 5, duration: 1000 },
    });

    worker.on('completed', (job) => {
        logger.info('[ROADMAP_WORKER] Job completed', { jobId: job.id, roadmapID: job.data.roadmapID });
    });

    worker.on('failed', (job, error) => {
        logger.error('[ROADMAP_WORKER] Job failed', { jobId: job?.id, error: error.message });
    });

    worker.on('error', (error) => {
        logger.error('[ROADMAP_WORKER] Worker error', { error: error.message });
    });

    worker.on('stalled', (jobId) => {
        logger.warn('[ROADMAP_WORKER] Job stalled', { jobId });
    });

    logger.info('[ROADMAP_WORKER] Career roadmap worker started', { concurrency, queue: 'career-roadmap' });
    return worker;
}

export async function shutdownWorker(worker) {
    await worker.close();
    logger.info('[ROADMAP_WORKER] Worker shut down gracefully');
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    logger.info('Starting career roadmap worker process...');
    const worker = createCareerRoadmapWorker(parseInt(process.env.ROADMAP_WORKER_CONCURRENCY || '2'));

    process.on('SIGTERM', async () => { await shutdownWorker(worker); process.exit(0); });
    process.on('SIGINT', async () => { await shutdownWorker(worker); process.exit(0); });
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in roadmap worker', { error: error.message });
        process.exit(1);
    });
}

export default { createCareerRoadmapWorker, shutdownWorker };
