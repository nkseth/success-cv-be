import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { FormData, File } from 'formdata-node';
import fetch from 'node-fetch';

import { detectLanguage } from '../utils/languageDetection.js';
import { getParsingPrompt } from '../queues/workerSupport/resume-analysis/parsingPrompt.js';
import { parsingSchema } from '../queues/workerSupport/resume-analysis/parsingSchema.js';
import { getScoringPrompt } from '../queues/workerSupport/resume-analysis/scoringPrompt.js';
import { scoringSchema } from '../queues/workerSupport/resume-analysis/scoringSchema.js';
import { generateAiResponseObject } from '../services/aiService/index.js';

async function extractLocalFileContent(filePath) {
    console.log(`[TEST] Extracting text from ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const formData = new FormData();
    const file = new File([fileBuffer], filename, { type: 'application/pdf' });
    formData.append('files', file);
    formData.append('strategy', 'fast');

    const parserUrl = process.env.RESUME_PARSER_URL;
    const apiKey = process.env.UNSTRUCTURED_API_KEY;

    if (!parserUrl || !apiKey) {
        throw new Error('Missing parser API keys in .env');
    }

    const response = await fetch(parserUrl, {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json',
            'unstructured-api-key': apiKey
        }
    });

    if (!response.ok) {
        throw new Error(`Parser API failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    return result.map(element => element.text).join('\n');
}

async function runTest(filePath) {
    try {
        console.log(`\n===========================================`);
        console.log(`TESTING: ${path.basename(filePath)}`);
        console.log(`===========================================\n`);

        // 1. Extract text
        const textContent = await extractLocalFileContent(filePath);
        console.log(`[TEST] ✅ Extracted ${textContent.length} characters of text.\n`);

        // 2. Detect Language
        const languageInfo = detectLanguage(textContent);
        console.log(`[TEST] 🌍 Detected Language: ${languageInfo.languageName} (${languageInfo.language}) - Confidence: ${languageInfo.confidence}\n`);

        // 3. Step 1: Parse
        console.log(`[TEST] 🤖 Starting Step 1: AI Parsing...`);
        const parsedData = await generateAiResponseObject({
            schema: parsingSchema,
            system: getParsingPrompt(languageInfo),
            content: `Extract all structured data from this resume. The resume is in ${languageInfo.languageName}.\n\n${textContent}`,
            model: 'gpt-4o-mini'
        });

        console.log(`[TEST] ✅ Parsing complete.`);
        console.log(`   - Name: ${parsedData.personal_info?.name}`);
        console.log(`   - Email: ${parsedData.personal_info?.email}`);
        console.log(`   - Experiences parsed: ${parsedData.experiences?.length || 0}`);
        const bulletsCount = (parsedData.experiences || []).reduce((acc, exp) => acc + (exp.highlights?.length || 0), 0);
        console.log(`   - Total experience bullets: ${bulletsCount}`);
        console.log(`   - Skills parsed: ${Object.keys(parsedData.skills || {}).map(k => parsedData.skills[k].length).reduce((a, b) => a + b, 0)}`);
        console.log(`   - Detected Language in Schema: ${parsedData.detected_language}\n`);

        // 4. Step 2: Score
        console.log(`[TEST] 🤖 Starting Step 2: AI Scoring & Analysis...`);

        const parsedSummary = {
            personal_info: parsedData.personal_info,
            experiences: (parsedData.experiences || []).map(exp => ({
                company: exp.company,
                position: exp.position,
                start_date: exp.start_date,
                end_date: exp.end_date,
                highlights: exp.highlights,
                summary: exp.summary
            })),
            education: parsedData.education,
            skills: parsedData.skills,
            projects: parsedData.projects,
            languages: parsedData.languages
        };

        const analysisData = await generateAiResponseObject({
            schema: scoringSchema,
            system: getScoringPrompt(languageInfo),
            content: `Analyze and score this parsed resume data. Provide detailed scoring, mistake analysis, and improvement recommendations.\n\nParsed Resume Data:\n${JSON.stringify(parsedSummary)}`,
            model: 'gpt-4o-mini'
        });

        console.log(`[TEST] ✅ Scoring & Analysis complete.`);
        console.log(`   - Overall Score: ${analysisData.relevance?.['Overall Score']}`);
        console.log(`   - ATS Content Score: ${analysisData.resume_quality?.ats_compatibility_score}`);
        console.log(`   - Critical Mistakes: ${analysisData.critical_mistakes?.length || 0}`);
        console.log(`   - Job Fit Score: ${analysisData.JobFitScore}`);
        if (analysisData.critical_mistakes?.length > 0) {
            console.log(`   - Top Mistake: ${analysisData.critical_mistakes[0].issue}`);
        }

        console.log(`\n✅ TEST PASSED FOR ${path.basename(filePath)}\n`);

    } catch (error) {
        console.error(`\n❌ TEST FAILED FOR ${path.basename(filePath)}`);
        console.error(error);
    }
}

async function main() {
    console.log("Starting Multi-Language Resume Tests...");
    const englishResume = path.join(process.cwd(), 'sample/Resume_Abhay_Verma.pdf');
    const spanishResume = path.join(process.cwd(), 'sample/CVJuanCarlosRamírezMartínez.pdf');

    await runTest(englishResume);
    await runTest(spanishResume);

    console.log("\nAll tests finished.");
    process.exit(0);
}

main();
