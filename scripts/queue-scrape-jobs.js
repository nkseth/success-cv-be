/**
 * Trigger Job Scraping Queue
 * 
 * Adds a job to the BullMQ queue to scrape and save jobs from external sources
 * The worker will process the job asynchronously
 * 
 * Usage: node scripts/queue-scrape-jobs.js [source]
 * 
 * Examples:
 *   node scripts/queue-scrape-jobs.js                     # Queue all sources
 *   node scripts/queue-scrape-jobs.js remoteok            # Queue RemoteOK only
 *   node scripts/queue-scrape-jobs.js indeed              # Queue Indeed only
 */

import { 
    addScrapeAllSourcesJob, 
    addScrapeSourceJob 
} from '../queues/job-scraping.queue.js';

const source = process.argv[2]?.toLowerCase();

async function queueJobScraping() {
    console.log('\n🚀 Queueing Job Scraping Task\n');
    console.log('=' + '='.repeat(60) + '\n');

    try {
        let job;
        
        if (!source || source === 'all') {
            // Queue scraping for all sources
            console.log('📋 Adding job to queue: Scrape ALL sources\n');
            
            job = await addScrapeAllSourcesJob({
                globalOptions: {
                    limit: 100
                }
            });
            
            console.log('✅ Job added to queue successfully!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Type: Scrape all sources (RemoteOK + Indeed)`);
            console.log(`   Status: ${job.state || 'queued'}`);
            
        } else if (source === 'remoteok') {
            // Queue RemoteOK scraping
            console.log('📋 Adding job to queue: Scrape RemoteOK\n');
            
            job = await addScrapeSourceJob({
                source: 'remoteok',
                options: {
                    limit: 100
                }
            });
            
            console.log('✅ Job added to queue successfully!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Type: Scrape RemoteOK`);
            console.log(`   Status: ${job.state || 'queued'}`);
            
        } else if (source === 'indeed') {
            // Queue Indeed scraping
            console.log('📋 Adding job to queue: Scrape Indeed\n');
            
            job = await addScrapeSourceJob({
                source: 'indeed',
                options: {
                    query: 'software engineer',
                    location: 'United States',
                    limit: 50
                }
            });
            
            console.log('✅ Job added to queue successfully!');
            console.log(`   Job ID: ${job.id}`);
            console.log(`   Type: Scrape Indeed RSS`);
            console.log(`   Status: ${job.state || 'queued'}`);
            
        } else {
            console.error(`❌ Unknown source: ${source}`);
            console.log('\nSupported sources:');
            console.log('  - all (default) - Queue scraping for all sources');
            console.log('  - remoteok - Queue RemoteOK scraping');
            console.log('  - indeed - Queue Indeed scraping');
            process.exit(1);
        }

        console.log('\n⚙️  Worker Processing:');
        console.log('   The job scraping worker will pick up this job and:');
        console.log('   1. Fetch jobs from external source(s)');
        console.log('   2. Normalize and validate job data');
        console.log('   3. Deduplicate by external_id + source');
        console.log('   4. Save to database (insert new / update existing)');
        console.log('   5. Log results to job_scraping_logs table');

        console.log('\n⏱️  Expected Duration:');
        console.log('   - RemoteOK: ~10-20 seconds');
        console.log('   - Indeed: ~15-30 seconds');
        console.log('   - Both: ~30-60 seconds');

        console.log('\n💡 Check Job Status:');
        console.log(`   1. Query job_scraping_logs table:`);
        console.log(`      SELECT * FROM job_scraping_logs ORDER BY started_at DESC LIMIT 5;`);
        console.log('\n   2. Check jobs count:');
        console.log('      SELECT source, COUNT(*) as count FROM jobs WHERE is_active = true GROUP BY source;');
        console.log('\n   3. Or wait ~1 minute and run:');
        console.log('      AUTH_TOKEN=your_token node scripts/test-job-system.js');

        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ Job scraping queued successfully!');
        console.log('   The worker will process this shortly...');
        console.log('=' + '='.repeat(60) + '\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Failed to queue job scraping:', error.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('   1. Is Redis running?');
        console.error('      brew services list | grep redis');
        console.error('      redis-cli ping  # Should return "PONG"');
        console.error('\n   2. Is the database connected?');
        console.error('      Check DATABASE_URL in .env');
        console.error('\n   3. Is the job-scraping worker running?');
        console.error('      pm2 list | grep job-scraping-worker');
        console.error('      Or: npm run worker:job-scraping');
        console.error('\nError details:', error.stack);
        process.exit(1);
    }
}

// Run
queueJobScraping();
