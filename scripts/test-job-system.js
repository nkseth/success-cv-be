/**
 * Test Job System
 * Tests if the job browsing and matching system is working
 * 
 * Usage: AUTH_TOKEN=your_token node scripts/test-job-system.js
 */

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

if (!AUTH_TOKEN) {
    console.error('❌ Error: AUTH_TOKEN environment variable is required');
    console.log('Usage: AUTH_TOKEN=your_token node scripts/test-job-system.js');
    process.exit(1);
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function testJobSystem() {
    console.log('\n🧪 Testing Job System\n');
    console.log('=' + '='.repeat(60) + '\n');

    try {
        // Test 1: Browse all jobs
        console.log('📋 Test 1: Browsing all jobs...');
        const jobsResponse = await fetch(`${API_BASE_URL}/jobs?limit=10`, {
            method: 'GET',
            headers
        });

        if (!jobsResponse.ok) {
            const error = await jobsResponse.json();
            throw new Error(`Failed to fetch jobs: ${error.message || jobsResponse.statusText}`);
        }

        const jobsResult = await jobsResponse.json();
        console.log('✅ Jobs endpoint working');
        console.log(`   Total jobs found: ${jobsResult.pagination?.totalItems || 0}`);
        console.log(`   Jobs returned: ${jobsResult.data?.length || 0}`);

        if (jobsResult.data && jobsResult.data.length > 0) {
            console.log('\n📊 Sample jobs:');
            jobsResult.data.slice(0, 3).forEach((job, index) => {
                console.log(`\n   ${index + 1}. ${job.title}`);
                console.log(`      Company: ${job.company}`);
                console.log(`      Location: ${job.location} (${job.remoteType})`);
                console.log(`      Employment: ${job.employmentType}`);
                console.log(`      Experience: ${job.experienceLevel}`);
                if (job.salaryMin && job.salaryMax) {
                    console.log(`      Salary: $${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`);
                }
                console.log(`      Skills: ${job.skills?.slice(0, 3).join(', ') || 'N/A'}${job.skills?.length > 3 ? '...' : ''}`);
                console.log(`      Posted: ${new Date(job.postedDate).toLocaleDateString()}`);
            });
        } else {
            console.log('\n⚠️  No jobs found in database');
            console.log('   You may need to:');
            console.log('   1. Run job scraping worker');
            console.log('   2. Or manually insert sample jobs into the database');
        }

        // Test 2: Get specific job details (if jobs exist)
        if (jobsResult.data && jobsResult.data.length > 0) {
            const firstJobId = jobsResult.data[0].id;
            console.log(`\n📄 Test 2: Fetching job details for ID ${firstJobId}...`);
            
            const jobDetailResponse = await fetch(`${API_BASE_URL}/jobs/${firstJobId}`, {
                method: 'GET',
                headers
            });

            if (!jobDetailResponse.ok) {
                throw new Error('Failed to fetch job details');
            }

            const jobDetail = await jobDetailResponse.json();
            console.log('✅ Job details endpoint working');
            console.log(`   Job: ${jobDetail.data.title}`);
            console.log(`   Description length: ${jobDetail.data.description?.length || 0} chars`);
            console.log(`   Requirements: ${jobDetail.data.requirements?.length || 0} items`);
            console.log(`   Benefits: ${jobDetail.data.benefits?.length || 0} items`);
        }

        // Test 3: Test job filters
        console.log('\n🔍 Test 3: Testing job filters...');
        const filterResponse = await fetch(`${API_BASE_URL}/jobs?remoteType=remote&limit=5`, {
            method: 'GET',
            headers
        });

        if (!filterResponse.ok) {
            throw new Error('Failed to fetch filtered jobs');
        }

        const filterResult = await filterResponse.json();
        console.log('✅ Job filtering working');
        console.log(`   Remote jobs found: ${filterResult.data?.length || 0}`);

        // Test 4: Check user's job matches
        console.log('\n🎯 Test 4: Checking user job matches...');
        const matchesResponse = await fetch(`${API_BASE_URL}/job-matches?limit=5`, {
            method: 'GET',
            headers
        });

        if (!matchesResponse.ok) {
            const error = await matchesResponse.json();
            console.log('⚠️  Job matches endpoint error:', error.message);
            console.log('   This is normal if user has no analyzed resumes yet');
        } else {
            const matchesResult = await matchesResponse.json();
            console.log('✅ Job matches endpoint working');
            console.log(`   Total matches: ${matchesResult.pagination?.totalItems || 0}`);
            
            if (matchesResult.data && matchesResult.data.length > 0) {
                console.log('\n   Top matches:');
                matchesResult.data.slice(0, 3).forEach((match, index) => {
                    console.log(`\n   ${index + 1}. ${match.job.title} - ${match.matchScore}% match`);
                    console.log(`      Reason: ${match.matchReason}`);
                    console.log(`      Skills match: ${match.skillsMatch?.slice(0, 3).join(', ')}${match.skillsMatch?.length > 3 ? '...' : ''}`);
                    console.log(`      Status: ${match.status}`);
                });
            } else {
                console.log('   No job matches yet. Generate matches after resume analysis.');
            }
        }

        // Test 5: Check job preferences
        console.log('\n⚙️  Test 5: Checking user job preferences...');
        const preferencesResponse = await fetch(`${API_BASE_URL}/job-preferences`, {
            method: 'GET',
            headers
        });

        if (!preferencesResponse.ok) {
            console.log('⚠️  No job preferences set yet (this is normal for new users)');
        } else {
            const preferencesResult = await preferencesResponse.json();
            console.log('✅ Job preferences endpoint working');
            if (preferencesResult.data) {
                console.log(`   Preferred locations: ${preferencesResult.data.preferredLocations?.join(', ') || 'Not set'}`);
                console.log(`   Remote type: ${preferencesResult.data.preferredRemoteType?.join(', ') || 'Not set'}`);
                console.log(`   Employment types: ${preferencesResult.data.preferredEmploymentTypes?.join(', ') || 'Not set'}`);
                console.log(`   Min salary: ${preferencesResult.data.minSalary ? '$' + preferencesResult.data.minSalary.toLocaleString() : 'Not set'}`);
            }
        }

        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ Job System Test Completed Successfully!');
        console.log('=' + '='.repeat(60));

        // Summary
        console.log('\n📝 Summary:');
        console.log(`   ✅ Job browsing: Working`);
        console.log(`   ✅ Job filtering: Working`);
        console.log(`   ${jobsResult.data?.length > 0 ? '✅' : '⚠️ '} Jobs in database: ${jobsResult.pagination?.totalItems || 0}`);
        console.log(`   ℹ️  Job matches: Need analyzed resume to test`);
        console.log(`   ℹ️  Job preferences: Optional user settings`);

        if (!jobsResult.data || jobsResult.data.length === 0) {
            console.log('\n💡 Next Steps:');
            console.log('   1. Add sample jobs to database, or');
            console.log('   2. Run job scraping service to populate jobs');
            console.log('   3. Upload and analyze a resume');
            console.log('   4. Generate job matches with: POST /api/v1/job-matches/generate');
        }

        console.log('\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run the test
testJobSystem();
