/**
 * Seed Sample Jobs
 * Adds sample job listings to the database for testing
 * 
 * Usage: node drizzle/seeds/sample-jobs.seed.js
 */

import { db } from '../../config/db.js';
import { jobsTable } from '../schema/jobs.schema.js';
import logger from '../../middleware/logger.js';

const sampleJobs = [
    {
        externalId: 'MANUAL-SEED-001',
        title: 'Senior Full Stack Developer',
        company: 'TechCorp Inc',
        location: 'San Francisco, CA',
        remoteType: 'hybrid',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 140000,
        salaryMax: 180000,
        description: 'We are looking for an experienced Full Stack Developer to join our team. You will work on cutting-edge web applications using React, Node.js, and PostgreSQL.',
        requirements: [
            '5+ years of experience in full stack development',
            'Strong proficiency in React and Node.js',
            'Experience with PostgreSQL or similar databases',
            'Knowledge of RESTful APIs and microservices',
            'Excellent problem-solving skills'
        ],
        skillsRequired: ['React', 'Node.js', 'PostgreSQL', 'JavaScript', 'TypeScript', 'REST API', 'Git'],
        benefits: ['Health insurance', '401k matching', 'Remote work flexibility', 'Professional development budget'],
        applyUrl: 'https://example.com/apply/senior-fullstack',
        companyWebsite: 'https://techcorp.example.com',
        postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree in Computer Science or related field"
    },
    {
        externalId: 'MANUAL-SEED-002',
        title: 'Frontend Developer',
        company: 'Digital Solutions LLC',
        location: 'Remote',
        remoteType: 'remote',
        employmentType: 'full-time',
        experienceLevel: 'mid',
        salaryMin: 90000,
        salaryMax: 120000,
        description: 'Join our team as a Frontend Developer and help build beautiful, responsive web applications. We use modern frameworks and tools.',
        requirements: [
            '3+ years of frontend development experience',
            'Expertise in React or Vue.js',
            'Strong CSS and HTML skills',
            'Experience with responsive design',
            'Understanding of web performance optimization'
        ],
        skillsRequired: ['React', 'JavaScript', 'CSS', 'HTML', 'Redux', 'Webpack', 'Git'],
        benefits: ['Fully remote', 'Flexible hours', 'Health insurance', 'Learning stipend'],
        applyUrl: 'https://example.com/apply/frontend-dev',
        companyWebsite: 'https://digitalsolutions.example.com',
        postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree or equivalent experience"
    },
    {externalId: 'MANUAL-SEED-003',
        
        title: 'Backend Engineer - Node.js',
        company: 'CloudTech Systems',
        location: 'Austin, TX',
        remoteType: 'onsite',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 130000,
        salaryMax: 170000,
        description: 'We need a skilled Backend Engineer to design and implement scalable microservices. You will work with Node.js, Docker, and Kubernetes.',
        requirements: [
            '5+ years of backend development experience',
            'Strong Node.js and Express.js skills',
            'Experience with Docker and Kubernetes',
            'Knowledge of microservices architecture',
            'Database design and optimization experience'
        ],
        skillsRequired: ['Node.js', 'Express.js', 'Docker', 'Kubernetes', 'MongoDB', 'Redis', 'AWS', 'Microservices'],
        benefits: ['Competitive salary', 'Stock options', 'Health benefits', 'Gym membership'],
        applyUrl: 'https://example.com/apply/backend-engineer',
        companyWebsite: 'https://cloudtech.example.com',
        postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        expiresAt: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's or Master's degree in Computer Science"
    },
    {externalId: 'MANUAL-SEED-004',
        
        title: 'Junior Software Developer',
        company: 'StartupXYZ',
        location: 'New York, NY',
        remoteType: 'hybrid',
        employmentType: 'full-time',
        experienceLevel: 'entry',
        salaryMin: 70000,
        salaryMax: 90000,
        description: 'Great opportunity for a junior developer to learn and grow. You will work on both frontend and backend projects with mentorship from senior developers.',
        requirements: [
            '1-2 years of programming experience',
            'Knowledge of JavaScript and/or Python',
            'Basic understanding of web development',
            'Willingness to learn new technologies',
            'Good communication skills'
        ],
        skillsRequired: ['JavaScript', 'Python', 'HTML', 'CSS', 'Git', 'SQL'],
        benefits: ['Mentorship program', 'Health insurance', 'Learning budget', 'Startup equity'],
        applyUrl: 'https://example.com/apply/junior-dev',
        companyWebsite: 'https://startupxyz.example.com',
        postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree or coding bootcamp graduate"
    },
    {externalId: 'MANUAL-SEED-005',
        
        title: 'DevOps Engineer',
        company: 'Infrastructure Pro',
        location: 'Seattle, WA',
        remoteType: 'remote',
        employmentType: 'full-time',
        experienceLevel: 'mid',
        salaryMin: 110000,
        salaryMax: 145000,
        description: 'We are seeking a DevOps Engineer to manage our cloud infrastructure and CI/CD pipelines. Experience with AWS and Terraform is required.',
        requirements: [
            '3+ years of DevOps experience',
            'Strong AWS knowledge',
            'Experience with Terraform or similar IaC tools',
            'CI/CD pipeline management',
            'Scripting skills (Bash, Python)'
        ],
        skillsRequired: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'Jenkins', 'Python', 'Bash', 'CI/CD'],
        benefits: ['Remote work', 'Health insurance', 'Unlimited PTO', 'Conference budget'],
        applyUrl: 'https://example.com/apply/devops',
        companyWebsite: 'https://infrastructurepro.example.com',
        postedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        expiresAt: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree in Computer Science or related field"
    },externalId: 'MANUAL-SEED-006',
        
    {
        title: 'React Native Developer',
        company: 'Mobile First Inc',
        location: 'Boston, MA',
        remoteType: 'hybrid',
        employmentType: 'contract',
        experienceLevel: 'mid',
        salaryMin: 100000,
        salaryMax: 130000,
        description: 'Contract position for an experienced React Native developer to build cross-platform mobile applications. 6-month contract with possibility of extension.',
        requirements: [
            '3+ years of React Native experience',
            'Published apps on App Store and Play Store',
            'Understanding of mobile UI/UX best practices',
            'Experience with native modules',
            'Strong JavaScript skills'
        ],
        skillsRequired: ['React Native', 'JavaScript', 'TypeScript', 'iOS', 'Android', 'Redux', 'Git'],
        benefits: ['Competitive hourly rate', 'Flexible schedule', 'Work from home option'],
        applyUrl: 'https://example.com/apply/react-native',
        companyWebsite: 'https://mobilefirst.example.com',
        postedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        expiresAt: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree or equivalent experience"
    },externalId: 'MANUAL-SEED-007',
        
    {
        title: 'Data Engineer',
        company: 'Analytics Corp',
        location: 'Chicago, IL',
        remoteType: 'onsite',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 135000,
        salaryMax: 165000,
        description: 'Looking for a Data Engineer to build and maintain our data pipelines and warehouses. You will work with large-scale data processing systems.',
        requirements: [
            '5+ years of data engineering experience',
            'Strong SQL and Python skills',
            'Experience with Spark or similar frameworks',
            'Data warehouse design experience',
            'ETL pipeline development'
        ],
        skillsRequired: ['Python', 'SQL', 'Apache Spark', 'Airflow', 'Snowflake', 'AWS', 'ETL', 'Data Modeling'],
        benefits: ['Competitive salary', 'Bonuses', 'Health benefits', 'Retirement plan'],
        applyUrl: 'https://example.com/apply/data-engineer',
        companyWebsite: 'https://analyticscorp.example.com',
        postedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        externalId: 'MANUAL-SEED-008',
        educationLevel: "Bachelor's or Master's degree in Computer Science, Engineering, or related field"
    },
    {
        title: 'UI/UX Designer & Frontend Developer',
        company: 'Design Studio',
        location: 'Los Angeles, CA',
        remoteType: 'remote',
        employmentType: 'part-time',
        experienceLevel: 'mid',
        salaryMin: 60000,
        salaryMax: 80000,
        description: 'Part-time position combining UI/UX design with frontend development. Perfect for someone who loves both design and code.',
        requirements: [
            '3+ years of UI/UX design experience',
            '2+ years of frontend development',
            'Proficiency in Figma or similar tools',
            'HTML, CSS, JavaScript skills',
            'Portfolio required'
        ],
        skillsRequired: ['UI/UX Design', 'Figma', 'HTML', 'CSS', 'JavaScript', 'React', 'Responsive Design'],
        benefits: ['Flexible hours', 'Remote work', 'Creative freedom', 'Portfolio projects'],
        applyUrl: 'https://example.com/apply/uiux-dev',
        companyWebsite: 'https://designstudio.example.com',
        postedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        isActive: true,
        source: 'manual_seed',
        educationLevel: "Bachelor's degree in Design or related field"
    }
];

async function seedJobs() {
    try {
        console.log('\n🌱 Starting job seed process...\n');

        // Check if jobs already exist
        const existingJobs = await db.select().from(jobsTable).where(eq(jobsTable.source, 'manual_seed'));
        
        if (existingJobs.length > 0) {
            console.log(`⚠️  Found ${existingJobs.length} existing seed jobs`);
            console.log('   Skipping seed to avoid duplicates');
            console.log('   To re-seed, delete existing jobs first\n');
            return;
        }

        console.log(`📝 Inserting ${sampleJobs.length} sample jobs...\n`);

        const insertedJobs = await db.insert(jobsTable).values(sampleJobs).returning();

        console.log(`✅ Successfully inserted ${insertedJobs.length} jobs!\n`);
        console.log('Sample jobs:');
        insertedJobs.forEach((job, index) => {
            console.log(`   ${index + 1}. ${job.title} at ${job.company}`);
            console.log(`      Location: ${job.location} (${job.remoteType})`);
            console.log(`      Salary: $${job.salaryMin?.toLocaleString()} - $${job.salaryMax?.toLocaleString()}`);
            console.log(`      ID: ${job.id}\n`);
        });

        console.log('✅ Job seeding complete!');
        console.log('\nYou can now test the job system with:');
        console.log('   AUTH_TOKEN=your_token node scripts/test-job-system.js\n');

    } catch (error) {
        console.error('❌ Failed to seed jobs:', error);
        logger.error('Job seed error', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        process.exit(0);
    }
}

// Import eq for the where clause
import { eq } from 'drizzle-orm';

// Run the seed
seedJobs();
