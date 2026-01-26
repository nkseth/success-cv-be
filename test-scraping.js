import dotenv from 'dotenv';
dotenv.config();

import { scrapeJobsFromSource } from './services/jobBoards/index.js';
import logger from './middleware/logger.js';

/**
 * Test script to manually scrape jobs from a single source
 * Usage: node test-scraping.js [source]
 * Example: node test-scraping.js remoteok
 */

const source = process.argv[2] || 'remoteok';
const limit = parseInt(process.argv[3]) || 20;

console.log('\n=================================');
console.log('🧪 Testing Job Scraping');
console.log('=================================');
console.log(`Source: ${source}`);
console.log(`Limit: ${limit}`);
console.log('=================================\n');

async function testScraping() {
    try {
        console.log(`⏳ Scraping jobs from ${source}...`);
        const startTime = Date.now();
        
        const result = await scrapeJobsFromSource(source, { 
            limit,
            skipCache: true // Force fresh scrape for testing
        });
        
        const duration = Date.now() - startTime;
        
        console.log('\n✅ Scraping completed successfully!');
        console.log('=================================');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Jobs found: ${result.jobs.length}`);
        console.log(`📦 From cache: ${result.fromCache ? 'Yes' : 'No'}`);
        
        if (result.stats) {
            console.log('\n📈 Statistics:');
            console.log(JSON.stringify(result.stats, null, 2));
        }
        
        if (result.jobs.length > 0) {
            console.log('\n📋 Sample Job (first result):');
            const sampleJob = result.jobs[0];
            console.log({
                externalId: sampleJob.externalId,
                title: sampleJob.title,
                company: sampleJob.company,
                location: sampleJob.location,
                remoteType: sampleJob.remoteType,
                employmentType: sampleJob.employmentType,
                url: sampleJob.url,
                postedDate: sampleJob.postedDate
            });
        }
        
        console.log('\n=================================');
        console.log('✅ Test completed successfully!');
        console.log('=================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Scraping failed!');
        console.error('=================================');
        console.error('Error:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        console.error('=================================\n');
        
        process.exit(1);
    }
}

testScraping();
