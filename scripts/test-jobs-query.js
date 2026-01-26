import { db } from '../config/db.js';
import { jobsTable } from '../drizzle/schema.js';
import { eq, count } from 'drizzle-orm';

async function testJobs() {
    try {
        const activeCount = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.isActive, true));
        const totalCount = await db.select({ count: count() }).from(jobsTable);
        const sample = await db.select({ 
            id: jobsTable.id, 
            title: jobsTable.title, 
            isActive: jobsTable.isActive,
            remoteType: jobsTable.remoteType,
            employmentType: jobsTable.employmentType,
            experienceLevel: jobsTable.experienceLevel
        }).from(jobsTable).limit(5);

        console.log('\n📊 Jobs Table Check:');
        console.log('====================');
        console.log('Active jobs:', activeCount[0].count);
        console.log('Total jobs:', totalCount[0].count);
        console.log('\nSample jobs:');
        sample.forEach((job, i) => {
            console.log(`\n${i+1}. ${job.title}`);
            console.log(`   ID: ${job.id}`);
            console.log(`   isActive: ${job.isActive}`);
            console.log(`   remoteType: ${job.remoteType}`);
            console.log(`   employmentType: ${job.employmentType}`);
            console.log(`   experienceLevel: ${job.experienceLevel}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testJobs();
