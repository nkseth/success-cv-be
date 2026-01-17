/**
 * Dynamic Table Selector Utility
 * 
 * Provides helper functions to select the appropriate database tables based on user type.
 * This eliminates the need for separate routes for users and candidates.
 * 
 * User types:
 * - 'user': Regular users (uses users-related tables)
 * - 'candidate': Candidates in B2B flow (uses candidate-related tables)
 * - 'admin': Admin users (uses admin tables where applicable)
 * 
 * Usage:
 * 1. In controllers, import and use with req.type from authentication middleware
 * 2. The middleware sets req.type based on JWT token type
 */

import { userTypeConstants } from "./constants.js";

// Import all user tables
import {
    usersTable,
    userDocumentTable,
    analysisTable,
    processedAndRawDataTable,
    resumeContentTable,
    resumeRewritesTable,
    userResumeThemeTable,
    resumeThemesTable,
} from "../drizzle/schema.js";

// Import all candidate tables
import {
    candidatesTable,
    candidateDocumentTable,
    candidateAnalysisTable,
    candidateProcessedAndRawDataTable,
    candidateResumeContentTable,
    candidateResumeRewritesTable,
    candidateResumeThemeTable,
} from "../drizzle/schema.js";

/**
 * Get the appropriate user/entity table based on user type
 * @param {string} userType - 'user' | 'candidate' 
 * @returns {Object} The user or candidate table
 */
export const getUserTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidatesTable;
    }
    return usersTable;
};

/**
 * Get the appropriate document table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The document table
 */
export const getDocumentTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateDocumentTable;
    }
    return userDocumentTable;
};

/**
 * Get the appropriate analysis table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The analysis table
 */
export const getAnalysisTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateAnalysisTable;
    }
    return analysisTable;
};

/**
 * Get the appropriate processed data table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The processed data table
 */
export const getProcessedDataTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateProcessedAndRawDataTable;
    }
    return processedAndRawDataTable;
};

/**
 * Get the appropriate resume content table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The resume content table
 */
export const getResumeContentTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateResumeContentTable;
    }
    return resumeContentTable;
};

/**
 * Get the appropriate resume rewrites table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The resume rewrites table
 */
export const getResumeRewritesTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateResumeRewritesTable;
    }
    return resumeRewritesTable;
};

/**
 * Get the appropriate user theme table based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} The user theme table
 */
export const getUserThemeTable = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return candidateResumeThemeTable;
    }
    return userResumeThemeTable;
};

/**
 * Get the user ID column name based on user type
 * @param {string} userType - 'user' | 'candidate'
 * @returns {string} The column name ('userID' or 'candidateID')
 */
export const getUserIDColumnName = (userType) => {
    if (userType === userTypeConstants.CANDIDATE) {
        return 'candidateID';
    }
    return 'userID';
};

/**
 * Get all relevant tables for a user type
 * Returns an object with all tables needed for resume operations
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Object} Object containing all relevant tables
 */
export const getDynamicTables = (userType) => {
    const isCandidate = userType === userTypeConstants.CANDIDATE;
    
    return {
        // Entity table
        entityTable: isCandidate ? candidatesTable : usersTable,
        
        // Document & Analysis tables
        documentTable: isCandidate ? candidateDocumentTable : userDocumentTable,
        analysisTable: isCandidate ? candidateAnalysisTable : analysisTable,
        processedDataTable: isCandidate ? candidateProcessedAndRawDataTable : processedAndRawDataTable,
        
        // Resume tables
        resumeContentTable: isCandidate ? candidateResumeContentTable : resumeContentTable,
        resumeRewritesTable: isCandidate ? candidateResumeRewritesTable : resumeRewritesTable,
        userThemeTable: isCandidate ? candidateResumeThemeTable : userResumeThemeTable,
        
        // Shared theme table (same for both)
        themesTable: resumeThemesTable,
        
        // Column names
        entityIDColumn: isCandidate ? 'candidateID' : 'userID',
        
        // Meta info
        isCandidate,
        userType
    };
};

/**
 * Check if the user type is a candidate
 * @param {string} userType - 'user' | 'candidate'
 * @returns {boolean} True if candidate
 */
export const isCandidate = (userType) => {
    return userType === userTypeConstants.CANDIDATE;
};

/**
 * Check if the user type is a regular user
 * @param {string} userType - 'user' | 'candidate'
 * @returns {boolean} True if regular user
 */
export const isUser = (userType) => {
    return userType === userTypeConstants.USER;
};

export default {
    getUserTable,
    getDocumentTable,
    getAnalysisTable,
    getProcessedDataTable,
    getResumeContentTable,
    getResumeRewritesTable,
    getUserThemeTable,
    getUserIDColumnName,
    getDynamicTables,
    isCandidate,
    isUser
};
