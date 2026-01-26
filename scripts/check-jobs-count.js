import { db } from '../config/db.js';
import { jobsTable } from '../drizzle/schema.js';
import { sql } from 'drizzle-orm';

async function checkJobsCount() {
    try {
        // Get total job counts by source
        const jobCounts = await db
            .select({
                source: jobsTable.source,
                totalJobs: sql`COUNT(*)::int`,
                activeJobs: sql`COUNT(CASE WHEN ${jobsTable.isActive} = true THEN 1 END)::int`
            })
            .from(jobsTable)
            .groupBy(jobsTable.source);

        console.log('\n📊 Jobs Database Summary:');
        console.log('========================\n');

        if (jobCounts.length === 0) {
            console.log('❌ No jobs found in database');
        } else {
            jobCounts.forEach(row => {
                console.log(`Source: ${row.source}`);
                console.log(`  Total Jobs: ${row.totalJobs}`);
                console.log(`  Active Jobs: ${row.activeJobs}`);
                console.log('');
            });

            const totalAll = jobCounts.reduce((sum, row) => sum + row.totalJobs, 0);
            const activeAll = jobCounts.reduce((sum, row) => sum + row.activeJobs, 0);
            console.log(`TOTAL: ${activeAll} active / ${totalAll} total jobs`);
        }

        // Get some sample jobs
        console.log('\n📝 Sample Jobs (first 3):');
        console.log('=========================\n');
        
        const sampleJobs = await db
            .select({
                id: jobsTable.id,
                title: jobsTable.title,
                company: jobsTable.company,
                source: jobsTable.source,
                externalId: jobsTable.externalId,
                isActive: jobsTable.isActive
            })
            .from(jobsTable)
            .where(sql`${jobsTable.isActive} = true`)
            .limit(3);

        if (sampleJobs.length > 0) {
            sampleJobs.forEach((job, idx) => {
                console.log(`${idx + 1}. ${job.title}`);
                console.log(`   Company: ${job.company}`);
                console.log(`   Source: ${job.source} (ID: ${job.externalId})`);
                console.log('');
            });
        } else {
            console.log('No active jobs to display');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error checking jobs:', error);
        process.exit(1);
    }
}

checkJobsCount();
