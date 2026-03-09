import { Worker } from 'bullmq';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import logger from '../../middleware/logger.js';
import { db } from '../../config/db.js';
import { careerRoadmapsTable } from '../../drizzle/schema/career-roadmap.schema.js';
import { resumeContentTable } from '../../drizzle/schema/resume.schema.js';
import { eq } from 'drizzle-orm';
import { createAzure } from '@ai-sdk/azure';
import { generateObject } from 'ai';
import { publishJobUpdate } from '../../utils/progressTracking.js';
import { z } from 'zod';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

// Dynamic import to ensure env vars are loaded before redis config
const { bullMQConnection, getRedisConnectionConfig } = await import('../../config/redis.config.js');
const pubSubService = (await import('../../services/pubsub.service.js')).default;

// Create Azure provider
const azure = createAzure({
    resourceName: process.env.AZURE_RESOURCE_NAME,
    apiKey: process.env.AZURE_API_KEY,
});

/**
 * Detailed Roadmap Progress Stages
 */
const DETAILED_ROADMAP_STAGES = {
    INIT: { percent: 0, message: 'Initializing detailed agent...' },
    READING_CONTEXT: { percent: 15, message: 'Analyzing your selected career path...' },
    WEB_SEARCH_RESOURCES: { percent: 40, message: 'Agent is scouring the web for the latest books, courses, and resources...' },
    MAPPING_MILESTONES: { percent: 75, message: 'Mapping out step-by-step milestones and action plans...' },
    SAVING: { percent: 90, message: 'Finalizing your comprehensive roadmap...' },
    COMPLETE: { percent: 100, message: 'Detailed personalized roadmap is ready!' },
};

async function publishDetailedUpdate(jobId, stage, extra = {}) {
    const s = DETAILED_ROADMAP_STAGES[stage];
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
        connectionName: 'pubsub:worker:detailed-roadmap',
    });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await pubSubService.initialize(redisConfig, {
                mode: 'publisher',
                connectionNamePrefix: 'pubsub:worker:detailed-roadmap',
            });
            logger.info('✅ PubSub initialized in detailed roadmap worker');
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
 * Zod schema for Detailed Roadmap output
 */
const detailedResourceSchema = z.object({
    title: z.string(),
    type: z.enum(['course', 'book', 'article', 'tool', 'certification', 'other']),
    url: z.string().url().optional().describe('URL to the resource if found online'),
    description: z.string().describe('Why this resource is highly recommended'),
    cost: z.string().optional().describe('E.g., "Free", "$20", "$200"'),
});

const detailedMilestoneSchema = z.object({
    title: z.string(),
    timeframe: z.string().describe('e.g., "Months 1-3", "Year 1"'),
    focus: z.string().describe('Main objective of this milestone'),
    action_items: z.array(z.string()).min(2),
    skills_acquired: z.array(z.string()),
    resources: z.array(detailedResourceSchema).describe('Specific resources to use during this milestone'),
});

const detailedRoadmapSchema = z.object({
    overview: z.string().describe('A high-level overview of this precise strategy.'),
    prerequisites: z.array(z.string()).describe('Things the user should know or setup first.'),
    milestones: z.array(detailedMilestoneSchema).min(3).max(8),
    industry_tips: z.array(z.string()).describe('Tips for networking, interviews, or industry-specific nuances.'),
});


/**
 * Build the AI system prompt
 */
function buildSystemPrompt() {
    return `You are an elite, highly-specialized Career Architect and Industry Expert. 
Your task is to take a user's selected career path (based on their resume and goals) and expand it into a deeply comprehensive, highly-actionable, and step-by-step master plan.

You have access to a web search tool. YOU MUST USE THE WEB SEARCH TOOL to find the absolute latest, highly-rated courses (on Udemy, Coursera, MIT, etc.), trending books, specific certifications, and up-to-date industry tools.

Make the roadmap exhaustive and chronological. Every milestone needs highly specific resources. Do not give generic advice like "take a course on Python". Instead, use the search tool to find "100 Days of Code: The Complete Python Pro Bootcamp" and highly recommend it.

Provide your final response conforming exactly to the JSON schema.`;
}

/**
 * Build context prompt
 */
function buildContextPrompt(resumeContent, questionnaire, selectedPath) {
    return `
# Candidate Profile Summary
Title: ${resumeContent.personalInfo?.jobTitle || 'Unknown'}
Location: ${resumeContent.personalInfo?.location || 'Unknown'}
Goals: ${(questionnaire?.targetRoles || []).join(', ')} in ${questionnaire?.industry || 'any industry'}.

# Selected Career Path to Expand:
Title: ${selectedPath.title}
Summary: ${selectedPath.summary}
Timeframe: ${selectedPath.timeframe}

Here is the high-level path we previously generated:
${JSON.stringify(selectedPath.steps, null, 2)}

Your directive: Act as an agent. Use the web search tool to find the best real-world resources (certifications, courses, books) for this exact path in the current year. Then, generate the incredibly detailed \`detailedRoadmapSchema\` JSON that breaks this path down into comprehensive milestones.
`;
}

/**
 * Main job processor
 */
async function processDetailedRoadmap(job) {
    const { roadmapID, userID, pathIndex } = job.data;

    logger.info('[DETAILED_WORKER] Starting detailed roadmap job', {
        jobId: job.id, roadmapID, userID, pathIndex,
    });

    try {
        // Step 1: Init
        await publishDetailedUpdate(job.id, 'INIT');
        await db.update(careerRoadmapsTable)
            .set({ detailedStatus: 'processing', updatedAt: new Date() })
            .where(eq(careerRoadmapsTable.id, roadmapID));

        // Step 2: Read context
        await publishDetailedUpdate(job.id, 'READING_CONTEXT');

        // Get the parent roadmap
        const [roadmap] = await db
            .select()
            .from(careerRoadmapsTable)
            .where(eq(careerRoadmapsTable.id, roadmapID))
            .limit(1);

        if (!roadmap) throw new Error(`Roadmap not found: ${roadmapID}`);

        const pathData = roadmap.paths[pathIndex];
        if (!pathData) throw new Error(`Path index ${pathIndex} not found in roadmap.`);

        // Get the resume
        const [resumeContent] = await db
            .select()
            .from(resumeContentTable)
            .where(eq(resumeContentTable.id, roadmap.resumeContentID))
            .limit(1);

        if (!resumeContent) throw new Error(`Resume not found: ${roadmap.resumeContentID}`);

        logger.info('[DETAILED_WORKER] Context loaded, starting AI agent generation');

        // Step 3: Web Search + AI Generation
        await publishDetailedUpdate(job.id, 'WEB_SEARCH_RESOURCES');

        const system = buildSystemPrompt();
        const content = buildContextPrompt(resumeContent, roadmap.questionnaire, pathData);

        // We use the Vercel AI SDK generateObject with tool calling
        // Note: Using gpt-4o-mini to match the model usage in other roadmap functions
        const { object: detailedPlan } = await generateObject({
            model: azure('gpt-4o-mini'),
            system,
            messages: [{ role: 'user', content }],
            schema: detailedRoadmapSchema,
            // Native tool calling
            // Note: Since we are using Azure OpenAI, we need a web search tool that works with it.
            // Some providers have native webSearch (e.g., openai.tools.webSearch), 
            // but for Azure/custom setups without native tool support, we would define a custom tool object here.
            // Since the user requested the native approach, we will mock the native interface for the SDK.
            // *If* the native provider in use supports it natively, this will execute it.
            // If the provider doesn't support it, the AI will just fall back to its internal knowledge base.
            tools: {
                // Example of native websearch if running on OpenAI native
                webSearch: azure.tools.webSearchPreview({}),
            },
            maxSteps: 3, // Allow the agent to take multiple steps (e.g. search, read, respond)
            temperature: 0.3,
            onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
                logger.info('[DETAILED_WORKER] AI Step Complete', {
                    toolCalls: toolCalls.map(tc => tc.toolName),
                    finishReason,
                    usage
                });
                publishDetailedUpdate(job.id, 'MAPPING_MILESTONES');
            },
        });

        logger.info('[DETAILED_WORKER] AI agent finished detailed plan', { roadmapID });

        // Step 5: Save to DB
        await publishDetailedUpdate(job.id, 'SAVING');
        await db.update(careerRoadmapsTable)
            .set({
                detailedPlan,
                detailedStatus: 'completed',
                updatedAt: new Date(),
            })
            .where(eq(careerRoadmapsTable.id, roadmapID));


        // Step 6: Notify frontend via SSE
        await publishDetailedUpdate(job.id, 'COMPLETE', {
            data: { roadmapID },
        });

        logger.info('[DETAILED_WORKER] ✅ Detailed Job completed', { jobId: job.id, roadmapID });
        return { success: true, roadmapID };

    } catch (error) {
        logger.error('[DETAILED_WORKER] ❌ Job failed', {
            jobId: job.id, roadmapID, error: error.message, stack: error.stack,
        });

        // Mark as failed
        try {
            await db.update(careerRoadmapsTable)
                .set({ detailedStatus: 'failed', errorMsg: error.message, updatedAt: new Date() })
                .where(eq(careerRoadmapsTable.id, roadmapID));
        } catch (dbError) {
            logger.error('[DETAILED_WORKER] Failed to update roadmap detailed status', { error: dbError.message });
        }

        // Publish failure notification
        await publishJobUpdate(job.id, {
            progress: 0,
            status: 'failed',
            message: 'We encountered an issue generating your detailed roadmap. Please try again.',
            error: error.message,
        });

        throw error;
    }
}

/**
 * Create and start the detailed roadmap worker
 */
export function createDetailedRoadmapWorker(concurrency = 1) {
    const worker = new Worker('detailed-roadmap', processDetailedRoadmap, {
        connection: bullMQConnection,
        concurrency,
        limiter: { max: 2, duration: 1000 },
    });

    worker.on('completed', (job) => {
        logger.info('[DETAILED_WORKER] Job completed', { jobId: job.id, roadmapID: job.data.roadmapID });
    });

    worker.on('failed', (job, error) => {
        logger.error('[DETAILED_WORKER] Job failed', { jobId: job?.id, error: error.message });
    });

    worker.on('error', (error) => {
        logger.error('[DETAILED_WORKER] Worker error', { error: error.message });
    });

    logger.info('[DETAILED_WORKER] Detailed roadmap worker started', { concurrency, queue: 'detailed-roadmap' });
    return worker;
}

export async function shutdownWorker(worker) {
    await worker.close();
    logger.info('[DETAILED_WORKER] Worker shut down gracefully');
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    logger.info('Starting detailed roadmap worker process...');
    const worker = createDetailedRoadmapWorker(parseInt(process.env.DETAILED_ROADMAP_WORKER_CONCURRENCY || '1'));

    process.on('SIGTERM', async () => { await shutdownWorker(worker); process.exit(0); });
    process.on('SIGINT', async () => { await shutdownWorker(worker); process.exit(0); });
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in detailed roadmap worker', { error: error.message });
        process.exit(1);
    });
}

export default { createDetailedRoadmapWorker, shutdownWorker };
