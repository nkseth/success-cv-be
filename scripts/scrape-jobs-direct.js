/**
 * Direct Job Scraping (No Queue)
 * 
 * Scrapes jobs directly from external sources and saves to database
 * Bypasses the BullMQ queue system for simplicity
 * 
 * Usage: node scripts/scrape-jobs-direct.js [source]
 * 
 * Examples:
 *   node scripts/scrape-jobs-direct.js                    # Scrape all sources
 *   node scripts/scrape-jobs-direct.js remoteok           # RemoteOK only
 *   node scripts/scrape-jobs-direct.js indeed             # Indeed only
 */

import jobBoardsService from '../services/jobBoards/index.js';
import { db } from '../config/db.js';
import { jobsTable } from '../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import logger from '../middleware/logger.js';

const source = process.argv[2]?.toLowerCase();

/**
 * Upsert jobs into database with deduplication
 */
async function saveJobsToDatabase(scrapedJobs, sourceName) {
    let jobsNew = 0;
    let jobsUpdated = 0;
    let errors = 0;

    console.log(`\n💾 Saving ${scrapedJobs.length} jobs to database...`);

    for (const job of scrapedJobs) {
        try {
            // Check if job already exists (by external_id + source)
            const existing = await db
                .select()
                .from(jobsTable)
                .where(
                    and(
                        eq(jobsTable.externalId, job.externalId),
                        eq(jobsTable.source, job.source)
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                // Update existing job
                await db
                    .update(jobsTable)
                    .set({
                        ...job,
                        isActive: true,
                        lastScrapedAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(eq(jobsTable.id, existing[0].id));
                
                jobsUpdated++;
            } else {
                // Insert new job
                await db.insert(jobsTable).values({
                    ...job,
                    isActive: true,
                    lastScrapedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                
                jobsNew++;
            }
        } catch (error) {
            errors++;
            console.error(`   ❌ Failed to save job: ${job.title} - ${error.message}`);
        }
    }

    return { jobsNew, jobsUpdated, errors };
}

/**
 * Scrape and save jobs from a source
 */
async function scrapeAndSave(sourceName, options = {}) {
    console.log(`\n🔍 Scraping ${sourceName.toUpperCase()}...`);
    
    try {
        const startTime = Date.now();
        
        // Scrape jobs from source
        const result = await jobBoardsService.scrapeJobsFromSource(sourceName, options);
        const scrapedJobs = result.jobs;
        
        console.log(`✅ Scraped ${scrapedJobs.length} jobs from ${sourceName}`);
        
        if (scrapedJobs.length === 0) {
            console.log('   ⚠️  No jobs found');
            return { jobsNew: 0, jobsUpdated: 0, errors: 0 };
        }

        // Save to database
        const stats = await saveJobsToDatabase(scrapedJobs, sourceName);
        
        const duration = Date.now() - startTime;
        
        console.log(`\n📊 ${sourceName.toUpperCase()} Results:`);
        console.log(`   ✅ New jobs: ${stats.jobsNew}`);
        console.log(`   🔄 Updated jobs: ${stats.jobsUpdated}`);
        if (stats.errors > 0) {
            console.log(`   ❌ Errors: ${stats.errors}`);
        }
        console.log(`   ⏱️  Duration: ${duration}ms`);
        
        return stats;
        
    } catch (error) {
        console.error(`\n❌ Failed to scrape ${sourceName}:`, error.message);
        return { jobsNew: 0, jobsUpdated: 0, errors: 1 };
    }
}

/**
 * Main scraping function
 */
async function scrapeJobs() {
    console.log('\n🚀 Direct Job Scraping (No Queue)\n');
    console.log('=' + '='.repeat(60) + '\n');

    try {
        let totalNew = 0;
        let totalUpdated = 0;
        let totalErrors = 0;

        if (!source || source === 'all') {
            // Scrape all sources
            console.log('📋 Scraping ALL sources...\n');
            
            // RemoteOK
            const remoteokStats = await scrapeAndSave('remoteok', {
                limit: 100
            });
            totalNew += remoteokStats.jobsNew;
            totalUpdated += remoteokStats.jobsUpdated;
            totalErrors += remoteokStats.errors;
            
            // Indeed
            const indeedStats = await scrapeAndSave('indeed', {
                query: 'software engineer',
                location: 'United States',
                limit: 50
            });
            totalNew += indeedStats.jobsNew;
            totalUpdated += indeedStats.jobsUpdated;
            totalErrors += indeedStats.errors;
            
        } else if (source === 'remoteok') {
            // RemoteOK only
            const stats = await scrapeAndSave('remoteok', { limit: 100 });
            totalNew = stats.jobsNew;
            totalUpdated = stats.jobsUpdated;
            totalErrors = stats.errors;
            
        } else if (source === 'indeed') {
            // Indeed only
            const stats = await scrapeAndSave('indeed', {
                query: 'software engineer',
                location: 'United States',
                limit: 50
            });
            totalNew = stats.jobsNew;
            totalUpdated = stats.jobsUpdated;
            totalErrors = stats.errors;
            
        } else {
            console.error(`❌ Unknown source: ${source}`);
            console.log('\nSupported sources:');
            console.log('  - all (scrape all sources)');
            console.log('  - remoteok');
            console.log('  - indeed');
            process.exit(1);
        }

        // Final summary
        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ Scraping Complete!\n');
        console.log('📊 Total Results:');
        console.log(`   🆕 New jobs added: ${totalNew}`);
        console.log(`   🔄 Jobs updated: ${totalUpdated}`);
        if (totalErrors > 0) {
            console.log(`   ❌ Errors: ${totalErrors}`);
        }
        console.log(`   💾 Total jobs in DB: ${totalNew + totalUpdated}`);
        
        console.log('\n💡 Next Steps:');
        console.log('   1. Test the API:');
        console.log('      AUTH_TOKEN=your_token node scripts/test-job-system.js');
        console.log('\n   2. Check database:');
        console.log('      SELECT COUNT(*) FROM jobs WHERE is_active = true;');
        console.log('=' + '='.repeat(60) + '\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Scraping failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run
scrapeJobs();
