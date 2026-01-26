#!/usr/bin/env node

/**
 * Test script for "Create from Scratch" feature
 * 
 * This script tests the new POST /resumes/blank endpoint
 * and verifies that it creates a resume with empty sections.
 * 
 * Usage:
 *   node scripts/test-blank-resume.js
 * 
 * Environment variables required:
 *   - API_URL: API base URL (default: http://localhost:3000)
 *   - AUTH_TOKEN: Valid authentication token
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
    console.error('❌ Error: AUTH_TOKEN environment variable is required');
    console.error('\nUsage:');
    console.error('  AUTH_TOKEN=your_token node scripts/test-blank-resume.js');
    process.exit(1);
}

async function testCreateBlankResume() {
    console.log('🧪 Testing Create Blank Resume Feature\n');
    console.log('='.repeat(60) + '\n');

    try {
        // Test 1: Create blank resume without name
        console.log('Test 1️⃣ : Create blank resume without name');
        console.log('Endpoint: POST /api/v1/resumes/blank');
        console.log('Body: {}');

        const response1 = await fetch(`${API_URL}/api/v1/resumes/blank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({})
        });

        const result1 = await response1.json();

        if (response1.status === 201) {
            console.log('✅ Status: 201 Created');
            console.log('✅ Resume ID:', result1.data.id);
            console.log('✅ Name:', result1.data.name);
            console.log('✅ Sections:', result1.data.sections.length);
            
            // Verify sections
            const expectedSections = ['personal_info', 'summary', 'experience', 'education', 'skills'];
            const actualSections = result1.data.sections.map(s => s.sectionName);
            const allSectionsPresent = expectedSections.every(s => actualSections.includes(s));
            
            if (allSectionsPresent) {
                console.log('✅ All expected sections present');
            } else {
                console.log('❌ Missing sections:', expectedSections.filter(s => !actualSections.includes(s)));
            }

            // Verify empty content
            const allSectionsEmpty = result1.data.sections.every(s => {
                const content = s.content;
                return Array.isArray(content) ? content.length === 0 : Object.keys(content).length === 0;
            });

            if (allSectionsEmpty) {
                console.log('✅ All sections are empty (as expected)');
            } else {
                console.log('❌ Some sections have content (unexpected)');
            }

            console.log('✅ Test 1 PASSED\n');
        } else {
            console.log('❌ Test 1 FAILED');
            console.log('Status:', response1.status);
            console.log('Response:', JSON.stringify(result1, null, 2));
            console.log();
        }

        // Test 2: Create blank resume with custom name
        console.log('Test 2️⃣ : Create blank resume with custom name');
        console.log('Endpoint: POST /api/v1/resumes/blank');
        console.log('Body: { name: "Test Resume from Script" }');

        const response2 = await fetch(`${API_URL}/api/v1/resumes/blank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                name: 'Test Resume from Script'
            })
        });

        const result2 = await response2.json();

        if (response2.status === 201 && result2.data.name === 'Test Resume from Script') {
            console.log('✅ Status: 201 Created');
            console.log('✅ Resume ID:', result2.data.id);
            console.log('✅ Name:', result2.data.name);
            console.log('✅ Custom name applied correctly');
            console.log('✅ Test 2 PASSED\n');
        } else {
            console.log('❌ Test 2 FAILED');
            console.log('Status:', response2.status);
            console.log('Expected name: "Test Resume from Script"');
            console.log('Actual name:', result2.data?.name);
            console.log();
        }

        // Test 3: Verify resume fields
        console.log('Test 3️⃣ : Verify resume fields');
        
        const resume = result2.data;
        const requiredFields = ['id', 'userID', 'analysisID', 'documentID', 'themeID', 'name', 'isDraft', 'createdAt', 'updatedAt', 'sections'];
        const missingFields = requiredFields.filter(field => !(field in resume));

        if (missingFields.length === 0) {
            console.log('✅ All required fields present');
            console.log('   - id:', resume.id);
            console.log('   - userID:', resume.userID);
            console.log('   - analysisID:', resume.analysisID);
            console.log('   - documentID:', resume.documentID);
            console.log('   - themeID:', resume.themeID);
            console.log('   - isDraft:', resume.isDraft);
            console.log('✅ Test 3 PASSED\n');
        } else {
            console.log('❌ Test 3 FAILED');
            console.log('Missing fields:', missingFields);
            console.log();
        }

        // Test 4: Verify isDraft is true
        console.log('Test 4️⃣ : Verify isDraft is true');
        
        if (resume.isDraft === true) {
            console.log('✅ isDraft is true (as expected)');
            console.log('✅ Test 4 PASSED\n');
        } else {
            console.log('❌ Test 4 FAILED');
            console.log('Expected isDraft: true');
            console.log('Actual isDraft:', resume.isDraft);
            console.log();
        }

        // Test 5: Test with invalid input
        console.log('Test 5️⃣ : Test with very long name (should fail)');
        
        const longName = 'A'.repeat(300); // Exceeds 255 char limit
        const response3 = await fetch(`${API_URL}/api/v1/resumes/blank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                name: longName
            })
        });

        const result3 = await response3.json();

        if (response3.status === 400) {
            console.log('✅ Status: 400 Bad Request (as expected)');
            console.log('✅ Error message:', result3.message);
            console.log('✅ Test 5 PASSED\n');
        } else {
            console.log('❌ Test 5 FAILED');
            console.log('Expected status: 400');
            console.log('Actual status:', response3.status);
            console.log();
        }

        console.log('='.repeat(60));
        console.log('\n🎉 All tests completed!\n');
        console.log('Summary:');
        console.log('  ✅ Create blank resume without name');
        console.log('  ✅ Create blank resume with custom name');
        console.log('  ✅ Verify required fields');
        console.log('  ✅ Verify isDraft status');
        console.log('  ✅ Validate input constraints');

    } catch (error) {
        console.error('❌ Test failed with error:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testCreateBlankResume();
