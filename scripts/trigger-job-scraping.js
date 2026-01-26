/**
 * Manual Job Scraping Trigger
 * 
 * Manually triggers job scraping from external sources
 * Useful for testing and initial population of jobs database
 * 
 * Usage: node scripts/trigger-job-scraping.js [source]
 * 
 * Examples:
 *   node scripts/trigger-job-scraping.js                  # Scrape all sources
 *   node scripts/trigger-job-scraping.js remoteok         # Scrape RemoteOK only
 *   node scripts/trigger-job-scraping.js indeed           # Scrape Indeed only
 */

import { 
    addScrapeAllSourcesJob, 
    addScrapeSourceJob 
} from '../queues/job-scraping.queue.js';
import logger from '../middleware/logger.js';

const source = process.argv[2]?.toLowerCase();

async function triggerScraping() {
    console.log('\n🚀 Triggering Job Scraping\n');
    console.log('=' + '='.repeat(60) + '\n');

    try {
        let job;
        
        if (!source || source === 'all') {
            // Scrape all sources
            console.log('📋 Scraping jobs from ALL sources (RemoteOK + Indeed)...\n');
            
            job = await addScrapeAllSourcesJob({
                globalOptions: {
                    limit: 100 // Fetch up to 100 jobs from each source
                }
            });
            
            console.log('✅ Scraping job added to queue!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Sources: RemoteOK, Indeed`);
            
        } else if (source === 'remoteok') {
            // Scrape RemoteOK only
            console.log('📋 Scraping jobs from RemoteOK...\n');
            
            job = await addScrapeSourceJob({
                source: 'remoteok',
                options: {
                    limit: 100,
                    tags: [] // Empty = all jobs
                }
            });
            
            console.log('✅ RemoteOK scraping job added to queue!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Expected: ~100 remote jobs`);
            
        } else if (source === 'indeed') {
            // Scrape Indeed only
            console.log('📋 Scraping jobs from Indeed RSS...\n');
            
            job = await addScrapeSourceJob({
                source: 'indeed',
                options: {
                    query: 'software engineer',
                    location: 'United States',
                    limit: 50
                }
            });
            
            console.log('✅ Indeed scraping job added to queue!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Query: software engineer`);
            console.log(`   Location: United States`);
            
        } else {
            console.error(`❌ Unknown source: ${source}`);
            console.log('\nSupported sources:');
            console.log('  - all (default)');
            console.log('  - remoteok');
            console.log('  - indeed');
            process.exit(1);
        }

        console.log('\n⏱️  Processing...');
        console.log('   This may take 30-60 seconds depending on the source.');
        console.log('\n💡 To check progress:');
        console.log('   1. Check scraping logs in database:');
        console.log('      SELECT * FROM job_scraping_logs ORDER BY started_at DESC LIMIT 5;');
        console.log('\n   2. Check jobs count:');
        console.log('      SELECT COUNT(*) FROM jobs WHERE is_active = true;');
        console.log('\n   3. Or run the test script after ~1 minute:');
        console.log('      AUTH_TOKEN=your_token node scripts/test-job-system.js');

        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ Job scraping triggered successfully!');
        console.log('=' + '='.repeat(60) + '\n');

        // Wait a bit for worker to pick up the job
        console.log('⏳ Waiting 5 seconds for worker to start processing...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('✅ Worker should now be processing the job.');
        console.log('   Check logs or database to see results.\n');
        
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Failed to trigger job scraping:', error.message);
        console.error('\nMake sure:');
        console.error('  1. Redis is running (required for BullMQ)');
        console.error('  2. Database is connected');
        console.error('  3. Job scraping worker is running');
        console.error('\nError details:', error);
        process.exit(1);
    }
}

// Run
triggerScraping();
