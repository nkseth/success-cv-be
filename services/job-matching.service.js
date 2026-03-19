import logger from '../middleware/logger.js';
import { getJobByID, getJobs, bulkCreateJobMatches, deleteJobMatchesForUser, getUserJobPreferences } from '../models/job.model.js';
import { db } from '../config/db.js';
import { analysisTable, candidateAnalysisTable, processedAndRawDataTable, candidateProcessedAndRawDataTable, jobMatchesTable } from '../drizzle/schema.js';
import { and, eq } from 'drizzle-orm';

/**
 * Job Matching Service
 * 
 * Matches jobs against user's resume analysis using weighted scoring:
 * - Skills matching: 40%
 * - Experience matching: 30%
 * - Education matching: 20%
 * - Location matching: 10%
 */

// Scoring weights
const WEIGHTS = {
    SKILLS: 0.4,
    EXPERIENCE: 0.3,
    EDUCATION: 0.2,
    LOCATION: 0.1
};

/**
 * Match jobs for a user based on their resume analysis
 * 
 * @param {number} userId - User ID
 * @param {number} analysisId - Resume analysis ID
 * @param {string} userType - 'user' or 'candidate'
 * @param {Object} options - Matching options
 * @param {number} options.minScore - Minimum match score threshold (default: 50)
 * @param {number} options.maxResults - Maximum number of matches to return (default: 50)
 * @param {boolean} options.replaceExisting - Delete existing matches before creating new ones (default: true)
 * @returns {Promise<Array>} Array of job matches
 */
export async function matchJobsForUser(userId, analysisId, userType = 'user', options = {}) {
    const {
        minScore = 50,
        maxResults = 50,
        replaceExisting = true
    } = options;

    logger.info('Starting job matching for user', { 
        userId, 
        analysisId, 
        userType, 
        minScore,
        maxResults
    });

    try {
        // 1. Get resume analysis data
        const analysis = await getResumeAnalysisData(analysisId, userType);
        
        if (!analysis || !analysis.processedData) {
            throw new Error('Resume analysis not found or incomplete');
        }

        const resumeData = analysis.processedData;

        // 1.5. Get user preferences (if any)
        let userPreferences = null;
        try {
            userPreferences = await getUserJobPreferences(userId, userType);
            logger.info('User preferences retrieved', {
                userId,
                hasPreferences: !!userPreferences,
                preferredLocations: userPreferences?.preferredLocations?.length || 0,
                preferredTitles: userPreferences?.preferredTitles?.length || 0
            });
        } catch (error) {
            logger.warn('Could not retrieve user preferences, continuing without them', {
                userId,
                error: error.message
            });
        }

        // 2. Get active jobs with preference filters
        const jobQueryOptions = {
            limit: 1000,
            sortBy: 'postedDate',
            sortOrder: 'desc'
        };

        // Apply preference filters if available
        if (userPreferences) {
            if (userPreferences.remotePreference && userPreferences.remotePreference !== 'no_preference') {
                jobQueryOptions.remoteType = userPreferences.remotePreference;
            }
            if (userPreferences.minSalary) {
                jobQueryOptions.minSalary = userPreferences.minSalary;
            }
            // Note: location and title filtering done in scoring to allow partial matches
        }

        const { data: jobs } = await getJobs(jobQueryOptions);

        // 2.5. Fetch existing matches if we are not replacing
        const existingMatchJobIds = replaceExisting
            ? new Set()
            : await getExistingMatchJobIds(userId, analysisId, userType);

        logger.info('Fetched jobs for matching', { 
            jobCount: jobs.length,
            userId,
            analysisId,
            appliedFilters: Object.keys(jobQueryOptions).filter(k => !['limit', 'sortBy', 'sortOrder'].includes(k))
        });

        // 3. Calculate match scores for each job with preference boosting
        const matches = [];
        for (const job of jobs) {
            if (existingMatchJobIds.has(job.id)) {
                continue;
            }
            const matchScore = calculateJobMatch(resumeData, job, userPreferences);
            
            // Only include jobs above minimum score
            if (matchScore.matchScore >= minScore) {
                matches.push({
                    [userType === 'candidate' ? 'candidateID' : 'userID']: userId,
                    [userType === 'candidate' ? 'candidateAnalysisID' : 'analysisID']: analysisId,
                    userType,
                    jobID: job.id,
                    ...matchScore
                });
            }
        }

        // 4. Sort by match score (highest first)
        matches.sort((a, b) => b.matchScore - a.matchScore);

        // 5. Limit results
        const topMatches = matches.slice(0, maxResults);

        logger.info('Job matching completed', {
            userId,
            analysisId,
            totalJobs: jobs.length,
            matchesAboveThreshold: matches.length,
            topMatchesReturned: topMatches.length,
            averageScore: matches.length > 0 
                ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
                : 0
        });

        // 6. Delete existing matches if requested
        if (replaceExisting && topMatches.length > 0) {
            await deleteJobMatchesForUser(userId, userType, analysisId);
            logger.info('Existing matches deleted', { userId, analysisId });
        }

        // 7. Bulk insert new matches
        if (topMatches.length > 0) {
            const createdMatches = await bulkCreateJobMatches(topMatches);
            logger.info('Job matches created', { 
                userId, 
                analysisId,
                count: createdMatches.length 
            });
            return createdMatches;
        }

        return [];

    } catch (error) {
        logger.error('Job matching failed', {
            userId,
            analysisId,
            userType,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Calculate match score between resume and job
 * 
 * @param {Object} resumeData - Processed resume data from analysis
 * @param {Object} job - Job object
 * @param {Object} userPreferences - Optional user preferences for boosting
 * @returns {Object} Match scores and reasons
 */
function calculateJobMatch(resumeData, job, userPreferences = null) {
    // Calculate individual component scores
    const skillScore = calculateSkillMatch(resumeData.skills, job.skillsRequired);
    const experienceScore = calculateExperienceMatch(
        resumeData.experiences,
        job.yearsExperienceMin,
        job.yearsExperienceMax,
        job.title,
        job.experienceLevel
    );
    const educationScore = calculateEducationMatch(
        resumeData.education,
        job.educationLevel
    );
    const locationMatch = calculateLocationMatch(
        resumeData.personal_info,
        job.location,
        job.remoteType
    );

    // Weighted overall score
    let matchScore = Math.round(
        skillScore * WEIGHTS.SKILLS +
        experienceScore * WEIGHTS.EXPERIENCE +
        educationScore * WEIGHTS.EDUCATION +
        locationMatch.score * WEIGHTS.LOCATION
    );

    // Apply preference boosting
    if (userPreferences) {
        const preferenceBoost = calculatePreferenceBoost(job, userPreferences);
        matchScore = Math.min(100, matchScore + preferenceBoost);
        
        if (preferenceBoost > 0) {
            logger.debug('Preference boost applied', {
                jobId: job.id,
                jobTitle: job.title,
                boost: preferenceBoost,
                originalScore: matchScore - preferenceBoost,
                finalScore: matchScore
            });
        }
    }

    // Build match reasons
    const matchReasons = buildMatchReasons(
        resumeData,
        job,
        skillScore,
        experienceScore,
        educationScore,
        locationMatch,
        userPreferences
    );

    const mismatchReasons = buildMismatchReasons(
        resumeData,
        job,
        skillScore,
        experienceScore,
        educationScore,
        locationMatch
    );

    return {
        matchScore,
        skillMatchScore: skillScore,
        experienceMatchScore: experienceScore,
        educationMatchScore: educationScore,
        locationMatch: locationMatch.isMatch,
        matchReasons,
        mismatchReasons
    };
}

/**
 * Calculate skill matching score
 */
function calculateSkillMatch(resumeSkills, jobSkills) {
    if (!jobSkills || (!jobSkills.required && !jobSkills.technical)) {
        return 75; // Default score if no job skills specified
    }

    // Flatten all resume skills
    const allResumeSkills = [
        ...(resumeSkills?.technical || []),
        ...(resumeSkills?.soft || []),
        ...(resumeSkills?.tools || []),
        ...(resumeSkills?.industry || [])
    ].map(s => s.toLowerCase());

    // Flatten all job skills
    const requiredSkills = [
        ...(jobSkills.required || []),
        ...(jobSkills.technical || [])
    ].map(s => s.toLowerCase());

    const preferredSkills = (jobSkills.preferred || []).map(s => s.toLowerCase());

    if (requiredSkills.length === 0) {
        return 75; // Default if no required skills
    }

    // Count matches
    let requiredMatches = 0;
    let preferredMatches = 0;

    for (const skill of allResumeSkills) {
        // Fuzzy matching for skills
        if (requiredSkills.some(req => 
            skill.includes(req) || req.includes(skill) || levenshteinDistance(skill, req) <= 2
        )) {
            requiredMatches++;
        }
        if (preferredSkills.some(pref => 
            skill.includes(pref) || pref.includes(skill) || levenshteinDistance(skill, pref) <= 2
        )) {
            preferredMatches++;
        }
    }

    // Calculate score
    const requiredScore = (requiredMatches / requiredSkills.length) * 80; // Up to 80 points for required
    const preferredScore = preferredSkills.length > 0
        ? (preferredMatches / preferredSkills.length) * 20 // Up to 20 points for preferred
        : 20; // Bonus if no preferred skills specified

    return Math.min(100, Math.round(requiredScore + preferredScore));
}

/**
 * Calculate experience matching score
 */
function calculateExperienceMatch(experiences, minYears, maxYears, jobTitle, jobLevel) {
    if (!experiences || experiences.length === 0) {
        return 30; // Low score if no experience
    }

    // Calculate total years of experience
    let totalYears = 0;
    for (const exp of experiences) {
        const start = exp.startDate ? new Date(exp.startDate) : new Date();
        const end = exp.endDate ? new Date(exp.endDate) : new Date();
        const years = (end - start) / (1000 * 60 * 60 * 24 * 365);
        totalYears += Math.max(0, years);
    }

    // Score based on years requirement
    let yearsScore = 50;
    if (minYears && totalYears < minYears) {
        yearsScore = Math.max(20, (totalYears / minYears) * 50);
    } else if (maxYears && totalYears > maxYears) {
        yearsScore = Math.max(60, 100 - ((totalYears - maxYears) * 5)); // Slight penalty for overqualified
    } else if (minYears && totalYears >= minYears) {
        yearsScore = 100;
    }

    // Score based on title/role relevance
    let titleScore = 50;
    if (jobTitle) {
        const jobTitleLower = jobTitle.toLowerCase();
        const hasRelevantTitle = experiences.some(exp => {
            const expTitle = (exp.position || '').toLowerCase();
            return expTitle.includes(jobTitleLower) || 
                   jobTitleLower.includes(expTitle) ||
                   levenshteinDistance(expTitle, jobTitleLower) <= 5;
        });
        titleScore = hasRelevantTitle ? 100 : 40;
    }

    // Combine scores
    return Math.round((yearsScore * 0.6) + (titleScore * 0.4));
}

/**
 * Calculate education matching score
 */
function calculateEducationMatch(education, requiredLevel) {
    if (!education || education.length === 0) {
        return requiredLevel ? 40 : 70; // Lower if education required
    }

    if (!requiredLevel) {
        return 80; // Good score if no requirement
    }

    const educationLevels = {
        'phd': 5,
        'doctorate': 5,
        'master': 4,
        'msc': 4,
        'mba': 4,
        'bachelor': 3,
        'bsc': 3,
        'ba': 3,
        'associate': 2,
        'diploma': 1
    };

    const requiredLevelNum = educationLevels[requiredLevel.toLowerCase()] || 3;
    
    // Get highest education level
    let highestLevel = 0;
    for (const edu of education) {
        const degree = (edu.degree || '').toLowerCase();
        for (const [key, value] of Object.entries(educationLevels)) {
            if (degree.includes(key)) {
                highestLevel = Math.max(highestLevel, value);
            }
        }
    }

    if (highestLevel >= requiredLevelNum) {
        return 100;
    } else if (highestLevel === requiredLevelNum - 1) {
        return 70; // Close match
    } else {
        return 40; // Below requirement
    }
}

/**
 * Calculate location matching
 */
function calculateLocationMatch(personalInfo, jobLocation, remoteType) {
    const userLocation = (personalInfo?.location || '').toLowerCase();
    const jobLoc = (jobLocation || '').toLowerCase();

    // Remote jobs match everyone
    if (remoteType === 'remote' || jobLoc.includes('remote')) {
        return { isMatch: true, score: 100 };
    }

    // Hybrid jobs get high score
    if (remoteType === 'hybrid') {
        return { isMatch: true, score: 90 };
    }

    // Check location similarity
    if (!userLocation || !jobLoc) {
        return { isMatch: false, score: 50 }; // Neutral if no info
    }

    // Extract city/state for comparison
    const userCity = userLocation.split(',')[0].trim();
    const jobCity = jobLoc.split(',')[0].trim();

    if (userCity === jobCity || userLocation.includes(jobCity) || jobLoc.includes(userCity)) {
        return { isMatch: true, score: 100 };
    }

    return { isMatch: false, score: 30 }; // Different locations
}

/**
 * Calculate preference boost score
 * Boosts jobs that match user preferences (up to +10 points)
 */
function calculatePreferenceBoost(job, userPreferences) {
    if (!userPreferences) return 0;

    let boost = 0;

    // Boost for preferred titles (max +5)
    if (userPreferences.preferredTitles && userPreferences.preferredTitles.length > 0) {
        const jobTitleLower = job.title.toLowerCase();
        const matchesPreferredTitle = userPreferences.preferredTitles.some(prefTitle =>
            jobTitleLower.includes(prefTitle.toLowerCase()) || 
            prefTitle.toLowerCase().includes(jobTitleLower)
        );
        if (matchesPreferredTitle) {
            boost += 5;
        }
    }

    // Boost for preferred locations (max +3)
    if (userPreferences.preferredLocations && userPreferences.preferredLocations.length > 0) {
        const jobLocationLower = (job.location || '').toLowerCase();
        const matchesPreferredLocation = userPreferences.preferredLocations.some(prefLoc =>
            jobLocationLower.includes(prefLoc.toLowerCase()) || 
            prefLoc.toLowerCase().includes(jobLocationLower)
        );
        if (matchesPreferredLocation) {
            boost += 3;
        }
    }

    // Boost for remote preference match (max +2)
    if (userPreferences.remotePreference && job.remoteType === userPreferences.remotePreference) {
        boost += 2;
    }

    return boost;
}

/**
 * Build match reasons array
 */
function buildMatchReasons(resumeData, job, skillScore, expScore, eduScore, locationMatch, userPreferences = null) {
    const reasons = {
        matchedSkills: [],
        strengthAreas: [],
        fitReason: ''
    };

    // Skill matches
    const allResumeSkills = [
        ...(resumeData.skills?.technical || []),
        ...(resumeData.skills?.tools || [])
    ];
    const jobSkills = [
        ...(job.skillsRequired?.required || []),
        ...(job.skillsRequired?.technical || [])
    ];

    reasons.matchedSkills = allResumeSkills.filter(skill =>
        jobSkills.some(req => 
            skill.toLowerCase().includes(req.toLowerCase()) || 
            req.toLowerCase().includes(skill.toLowerCase())
        )
    );

    // Strength areas
    if (skillScore >= 80) reasons.strengthAreas.push('Strong skill match');
    if (expScore >= 80) reasons.strengthAreas.push('Relevant experience');
    if (eduScore >= 80) reasons.strengthAreas.push('Education requirement met');
    if (locationMatch.isMatch) reasons.strengthAreas.push('Location compatible');

    // Add preference match indicators
    if (userPreferences) {
        if (userPreferences.preferredTitles?.some(title => 
            job.title.toLowerCase().includes(title.toLowerCase())
        )) {
            reasons.strengthAreas.push('Matches preferred job title');
        }
        if (userPreferences.preferredLocations?.some(loc => 
            (job.location || '').toLowerCase().includes(loc.toLowerCase())
        )) {
            reasons.strengthAreas.push('Matches preferred location');
        }
    }

    // Overall fit reason
    const overallScore = Math.round(
        skillScore * WEIGHTS.SKILLS +
        expScore * WEIGHTS.EXPERIENCE +
        eduScore * WEIGHTS.EDUCATION +
        locationMatch.score * WEIGHTS.LOCATION
    );

    if (overallScore >= 80) {
        reasons.fitReason = 'Excellent match - strong alignment across all areas';
    } else if (overallScore >= 70) {
        reasons.fitReason = 'Good match - meets most job requirements';
    } else if (overallScore >= 60) {
        reasons.fitReason = 'Fair match - some areas align well';
    } else {
        reasons.fitReason = 'Potential match - consider applying with emphasis on strengths';
    }

    return reasons;
}

/**
 * Build mismatch reasons array
 */
function buildMismatchReasons(resumeData, job, skillScore, expScore, eduScore, locationMatch) {
    const reasons = {
        missingSkills: [],
        improvementAreas: []
    };

    // Missing skills
    const allResumeSkills = [
        ...(resumeData.skills?.technical || []),
        ...(resumeData.skills?.tools || [])
    ].map(s => s.toLowerCase());
    
    const jobSkills = [
        ...(job.skillsRequired?.required || []),
        ...(job.skillsRequired?.technical || [])
    ];

    reasons.missingSkills = jobSkills.filter(skill =>
        !allResumeSkills.some(resumeSkill => 
            resumeSkill.includes(skill.toLowerCase()) || 
            skill.toLowerCase().includes(resumeSkill)
        )
    );

    // Improvement areas
    if (skillScore < 70) reasons.improvementAreas.push('Skills gap - consider upskilling in key areas');
    if (expScore < 70) reasons.improvementAreas.push('Experience level may not fully align');
    if (eduScore < 70) reasons.improvementAreas.push('Education requirement may not be met');
    if (!locationMatch.isMatch && locationMatch.score < 50) {
        reasons.improvementAreas.push('Location mismatch - relocation may be required');
    }

    return reasons;
}

/**
 * Get resume analysis data
 */
async function getResumeAnalysisData(analysisId, userType) {
    const isCandidate = userType === 'candidate';
    const analysisTableToUse = isCandidate ? candidateAnalysisTable : analysisTable;
    const processedDataTableToUse = isCandidate ? candidateProcessedAndRawDataTable : processedAndRawDataTable;

    const [analysis] = await db.select({
        analysis: analysisTableToUse,
        processedData: processedDataTableToUse
    })
        .from(analysisTableToUse)
        .leftJoin(
            processedDataTableToUse,
            eq(analysisTableToUse.id, processedDataTableToUse.analysisID)
        )
        .where(eq(analysisTableToUse.id, analysisId))
        .limit(1);

    if (!analysis) return null;

    let processedData = analysis.processedData?.processedData || {};
    if (typeof processedData === 'string') {
        try {
            processedData = JSON.parse(processedData);
        } catch (error) {
            logger.warn('Failed to parse processed resume data, using empty object', {
                analysisId,
                error: error.message
            });
            processedData = {};
        }
    }

    return {
        ...analysis.analysis,
        processedData
    };
}

async function getExistingMatchJobIds(userId, analysisId, userType) {
    if (!analysisId) return new Set();

    const isCandidate = userType === 'candidate';
    const conditions = [
        eq(jobMatchesTable.userType, userType),
        isCandidate ? eq(jobMatchesTable.candidateID, userId) : eq(jobMatchesTable.userID, userId),
        isCandidate
            ? eq(jobMatchesTable.candidateAnalysisID, analysisId)
            : eq(jobMatchesTable.analysisID, analysisId)
    ];

    const rows = await db
        .select({ jobID: jobMatchesTable.jobID })
        .from(jobMatchesTable)
        .where(and(...conditions));

    return new Set(rows.map(row => row.jobID));
}

/**
 * Simple Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[len1][len2];
}

export default {
    matchJobsForUser,
    calculateJobMatch
};
