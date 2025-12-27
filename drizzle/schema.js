// Main schema export file - imports all tables from different modules
// This is the single entry point for all database schemas

// Authentication & user tables
export {
    usersTable,
    profilesTable,
    candidatesTable,
    forgotPasswordTokenTable,
    verifyTable
} from './schema/auth.js';

// Organisation tables
export {
    organisationsTable,
    orgMembersTable,
    inviteTable
} from './schema/organisation.js';

// Document & analysis tables
export {
    userDocumentTable,
    analysisTable,
    processedAndRawDataTable,
    candidateDocumentTable,
    candidateAnalysisTable,
    candidateProcessedAndRawDataTable
} from './schema/analytics-rewrite-schema.js';

// Resume system tables (content + rewrites + themes)
export {
    // User resume tables
    resumeContentTable,
    resumeRewritesTable,
    resumeThemesTable,
    userResumeThemeTable,
    // Candidate resume tables (B2B)
    candidateResumeContentTable,
    candidateResumeRewritesTable,
    candidateResumeThemeTable
} from './schema/resume.schema.js';