/**
 * Script to run database seeds
 */
import { seedTemplates } from './drizzle/seeds/resume-templates.seed.js';
import logger from './middleware/logger.js';

async function runSeeds() {
    try {
        logger.info('Starting database seeding...');
        
        // Seed templates
        const result = await seedTemplates();
        
        logger.info(`Seeding completed successfully! Templates seeded: ${result.count}`);
        process.exit(0);
    } catch (error) {
        logger.error('Seeding failed:', error);
        process.exit(1);
    }
}

runSeeds();
