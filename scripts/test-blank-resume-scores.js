/**
 * Test script to verify blank resume scores are properly set to 0
 * Tests both creation and retrieval to ensure scores persist correctly
 * 
 * Usage: AUTH_TOKEN=your_token node scripts/test-blank-resume-scores.js
 */

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

if (!AUTH_TOKEN) {
    console.error('❌ Error: AUTH_TOKEN environment variable is required');
    console.log('Usage: AUTH_TOKEN=your_token node scripts/test-blank-resume-scores.js');
    process.exit(1);
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function testBlankResumeScores() {
    console.log('\n🧪 Testing Blank Resume Score Initialization\n');
    console.log('=' + '='.repeat(60) + '\n');

    try {
        // Step 1: Create blank resume
        console.log('📝 Step 1: Creating blank resume...');
        const createResponse = await fetch(`${API_BASE_URL}/resumes/blank`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Score Test Resume - ' + Date.now()
            })
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            throw new Error(`Failed to create blank resume: ${error.message}`);
        }

        const createResult = await createResponse.json();
        console.log('✅ Blank resume created');
        console.log(`   Resume ID: ${createResult.data.id}`);
        
        // Check scores in create response
        console.log('\n📊 Scores in CREATE response:');
        if (createResult.data.currentScores) {
            const scores = createResult.data.currentScores;
            console.log(`   atsScore: ${scores.atsScore}`);
            console.log(`   contentScore: ${scores.contentScore}`);
            console.log(`   formatScore: ${scores.formatScore}`);
            console.log(`   overallScore: ${scores.overallScore} ${scores.overallScore === 0 ? '✅' : '❌ WRONG!'}`);
            console.log(`   jobFitScore: ${scores.jobFitScore}`);
            console.log(`   skillsRelevanceScore: ${scores.skillsRelevanceScore}`);
            console.log(`   experienceRelevanceScore: ${scores.experienceRelevanceScore}`);
            console.log(`   educationRelevanceScore: ${scores.educationRelevanceScore}`);
            console.log(`   grammarScore: ${scores.grammarScore}`);
            console.log(`   professionalBrandingScore: ${scores.professionalBrandingScore}`);
            console.log(`   completenessScore: ${scores.completenessScore}`);
            
            // Verify all scores are 0
            const allZero = Object.values(scores).every(score => score === 0);
            if (allZero) {
                console.log('\n✅ CREATE: All scores correctly set to 0');
            } else {
                console.log('\n❌ CREATE: Some scores are NOT 0!');
                const nonZeroScores = Object.entries(scores).filter(([k, v]) => v !== 0);
                console.log('   Non-zero scores:', nonZeroScores);
            }
        } else {
            console.log('❌ No currentScores field in create response!');
        }

        // Step 2: Fetch the resume using GET /resumes/:id
        console.log('\n📥 Step 2: Fetching resume by ID...');
        const getResponse = await fetch(`${API_BASE_URL}/resumes/${createResult.data.id}`, {
            method: 'GET',
            headers
        });

        if (!getResponse.ok) {
            const error = await getResponse.json();
            throw new Error(`Failed to fetch resume: ${error.message}`);
        }

        const getResult = await getResponse.json();
        console.log('✅ Resume fetched successfully');

        // Check scores in GET response
        console.log('\n📊 Scores in GET response:');
        if (getResult.data.content?.currentScores) {
            const scores = getResult.data.content.currentScores;
            console.log(`   atsScore: ${scores.atsScore}`);
            console.log(`   contentScore: ${scores.contentScore}`);
            console.log(`   formatScore: ${scores.formatScore}`);
            console.log(`   overallScore: ${scores.overallScore} ${scores.overallScore === 0 ? '✅' : '❌ WRONG! Expected 0 but got ' + scores.overallScore}`);
            console.log(`   jobFitScore: ${scores.jobFitScore}`);
            console.log(`   skillsRelevanceScore: ${scores.skillsRelevanceScore}`);
            console.log(`   experienceRelevanceScore: ${scores.experienceRelevanceScore}`);
            console.log(`   educationRelevanceScore: ${scores.educationRelevanceScore}`);
            console.log(`   grammarScore: ${scores.grammarScore}`);
            console.log(`   professionalBrandingScore: ${scores.professionalBrandingScore}`);
            console.log(`   completenessScore: ${scores.completenessScore}`);
            
            // Verify all scores are 0
            const allZero = Object.values(scores).every(score => score === 0);
            if (allZero) {
                console.log('\n✅ GET: All scores correctly set to 0');
            } else {
                console.log('\n❌ GET: Some scores are NOT 0!');
                const nonZeroScores = Object.entries(scores).filter(([k, v]) => v !== 0);
                console.log('   Non-zero scores:', nonZeroScores);
                
                // This is the bug - investigate why scores are not 0
                console.log('\n🔍 Debug Info:');
                console.log('   Resume ID:', createResult.data.id);
                console.log('   Analysis ID:', getResult.data.content.analysisID);
                console.log('   Document ID:', getResult.data.content.documentID);
            }
        } else {
            console.log('❌ No currentScores field in GET response!');
            console.log('   Full content structure:', JSON.stringify(getResult.data.content, null, 2).substring(0, 500));
        }

        // Step 3: Check for any sections with content
        console.log('\n📋 Step 3: Checking resume sections...');
        const sections = ['personalInfo', 'summary', 'experience', 'education', 'skills'];
        let hasContent = false;
        
        for (const section of sections) {
            const sectionData = getResult.data.content[section];
            const isEmpty = Array.isArray(sectionData) 
                ? sectionData.length === 0 
                : Object.keys(sectionData || {}).length === 0;
            
            console.log(`   ${section}: ${isEmpty ? 'empty ✅' : 'HAS CONTENT ⚠️'}`);
            if (!isEmpty) {
                hasContent = true;
                console.log(`      Content: ${JSON.stringify(sectionData).substring(0, 100)}...`);
            }
        }

        if (!hasContent) {
            console.log('\n✅ All sections are empty as expected');
        } else {
            console.log('\n⚠️ Some sections have content - this might be affecting scores');
        }

        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ Test completed successfully');
        console.log('=' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run the test
testBlankResumeScores();
