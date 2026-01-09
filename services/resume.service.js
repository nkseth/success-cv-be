import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import resumeModel from "../models/resume.model.js";
import themeModel from "../models/theme.model.js";
import { addResumeRewriteJob } from "../queues/resume-rewrite.queue.js";
import { validateResumeData } from "../utils/resumeSchema.js";
import { getResumeContentRewritePrompt } from "../queues/workerSupport/resume-rewrite/prompt.js";
import { resumeContentOutputSchema } from "../queues/workerSupport/resume-rewrite/objectSchema.js";

// Lazy-load AI service to avoid circular dependencies
const getAiService = async () => {
    const { generateAiResponseObject } = await import('./aiService/index.js');
    return { generateAiResponseObject };
};

/**
 * Resume Service
 * 
 * Unified service handling all resume operations:
 * - Resume content management (CRUD, section updates)
 * - Rewrite orchestration (creating jobs, applying rewrites)
 * - Theme management (applying, customizing)
 * 
 * Flow:
 * 1. Analysis completes → createResumeFromAnalysis() creates initial content
 * 2. User can edit sections → updateSection() or updateSections()
 * 3. User requests rewrite → createRewrite() → worker processes → applyRewrite()
 * 4. User applies theme → applyTheme() → customize with updateThemeConfig()
 */

// ========== RESUME CONTENT OPERATIONS ==========

/**
 * Create resume content from completed analysis
 * Called by the analysis worker after AI processing
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} analysisData - Processed data from analysis
 * @returns {Promise<Object>} Created resume content
 */
export const createResumeFromAnalysis = async (userID, analysisID, analysisData) => {
    try {
        logger.info('[RESUME_SERVICE] Creating resume from analysis', {
            userID,
            analysisID
        });

        // Parse analysis data if string
        const parsed = typeof analysisData === 'string' 
            ? JSON.parse(analysisData) 
            : analysisData;

        // Extract and structure resume content
        const contentData = extractResumeContent(parsed);

        // Extract analysis report (issues, improvements, quality scores)
        const analysisReport = extractAnalysisReport(parsed);

        // Create resume content record with embedded analysis report
        const content = await resumeModel.createResumeContent(userID, analysisID, contentData, analysisReport);

        logger.info('[RESUME_SERVICE] ✅ Resume created from analysis', {
            contentID: content.id
        });

        return content;
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to create resume from analysis', {
            error: error.message,
            userID,
            analysisID
        });
        throw error;
    }
};

/**
 * Extract structured resume content from analysis data
 * Maps AI analysis output to our resume content structure
 * 
 * AI Schema returns:
 * - personal_info: { name, email, phone, address, summary }
 * - experiences: [{ company, position, location, website, start_date, end_date, summary, highlights }]
 * - education: [{ institution, area, study_type, location, start_date, end_date, gpa, honors, achievements }]
 * - social: [{ name, url }] - for linkedin, website, etc.
 * - certificates: [{ name, authority, certification_id, start_date, end_date }]
 * - achievements: [{ title, date, description }]
 * - languages: [{ name, level }]
 * - other_skills: [{ name, description, tags }]
 * - projects: [{ name, description, technologies, link, highlights }]
 * - awards: [{ title, date, issuer, description }]
 * - publications: [{ title, publisher, date, link, description }]
 * - volunteers: [{ organization, role, start_date, end_date, description, highlights }]
 * - hobbies, interests, etc.
 */
function extractResumeContent(analysisData) {
    logger.info('[RESUME_SERVICE] Extracting resume content from analysis data');
    logger.debug('[RESUME_SERVICE] Analysis data keys:', Object.keys(analysisData));
    // Extract social links for personal info
    const socialLinks = analysisData.social || [];
    const linkedinProfile = socialLinks.find(s => 
        s.name?.toLowerCase().includes('linkedin') || s.url?.toLowerCase().includes('linkedin')
    );
    const websiteProfile = socialLinks.find(s => 
        s.name?.toLowerCase().includes('website') || 
        s.name?.toLowerCase().includes('portfolio') ||
        (!s.url?.toLowerCase().includes('linkedin') && !s.url?.toLowerCase().includes('github'))
    );
    const githubProfile = socialLinks.find(s => 
        s.name?.toLowerCase().includes('github') || s.url?.toLowerCase().includes('github')
    );

    // Extract personal info - mapping AI schema fields
    const personalInfo = {
        fullName: analysisData.personal_info?.name || analysisData.name || '',
        email: analysisData.personal_info?.email || analysisData.email || '',
        phone: analysisData.personal_info?.phone || analysisData.phone || '',
        location: analysisData.personal_info?.address || analysisData.personal_info?.location || analysisData.location || '',
        linkedin: linkedinProfile?.url || analysisData.personal_info?.linkedin || '',
        website: websiteProfile?.url || analysisData.personal_info?.website || '',
        portfolio: analysisData.personal_info?.portfolio || '',
        github: githubProfile?.url || ''
    };

    // Extract summary - AI schema has it in personal_info.summary
    const summary = {
        text: analysisData.personal_info?.summary || analysisData.professional_summary || analysisData.summary || '',
        keywords: analysisData.keywords || []
    };

    // Extract experiences - mapping AI schema fields (highlights instead of achievements)
    const experience = (analysisData.experiences || analysisData.work_experience || []).map((exp, idx) => ({
        id: `exp_${idx + 1}`,
        company: exp.company || exp.organization || '',
        position: exp.position || exp.title || exp.role || '',
        location: exp.location || '',
        startDate: exp.start_date || exp.startDate || '',
        endDate: exp.end_date || exp.endDate || '',
        current: exp.current || exp.is_current || (exp.end_date === '' || exp.end_date?.toLowerCase() === 'present'),
        description: exp.summary || exp.description || '',
        achievements: exp.highlights || exp.achievements || exp.bullet_points || [],
        keywords: exp.keywords || [],
        website: exp.website || ''
    }));

    // Extract education - mapping AI schema fields (area instead of field, study_type instead of degree)
    const education = (analysisData.education || []).map((edu, idx) => ({
        id: `edu_${idx + 1}`,
        institution: edu.institution || edu.school || edu.university || '',
        degree: edu.study_type || edu.degree || '',
        field: edu.area || edu.field || edu.major || edu.specialization || '',
        location: edu.location || '',
        startDate: edu.start_date || edu.startDate || '',
        endDate: edu.end_date || edu.endDate || edu.graduation_date || '',
        gpa: edu.gpa || '',
        honors: edu.honors || [],
        achievements: edu.achievements || []
    }));

    // Extract skills from other_skills array and languages
    const otherSkills = analysisData.other_skills || [];
    const technicalSkills = otherSkills
        .filter(s => s.tags?.some(t => 
            ['technical', 'programming', 'software', 'technology', 'development'].includes(t.toLowerCase())
        ) || s.description?.toLowerCase().includes('technical'))
        .map(s => s.name);
    
    const softSkills = otherSkills
        .filter(s => s.tags?.some(t => 
            ['soft', 'communication', 'leadership', 'management', 'interpersonal'].includes(t.toLowerCase())
        ))
        .map(s => s.name);
    
    // If no categorization found, put all skills as technical
    const allSkillNames = otherSkills.map(s => s.name).filter(Boolean);
    
    // Extract languages from the languages array
    const languagesList = (analysisData.languages || []).map(l => 
        l.level ? `${l.name} (${l.level})` : l.name
    ).filter(Boolean);

    // Extract certifications
    const certifications = (analysisData.certificates || analysisData.certifications || []).map((c, idx) => ({
        id: `cert_${idx + 1}`,
        name: c.name || '',
        authority: c.authority || c.issuer || '',
        certificationId: c.certification_id || c.id || '',
        startDate: c.start_date || '',
        endDate: c.end_date || ''
    }));

    const skills = {
        technical: technicalSkills.length > 0 ? technicalSkills : allSkillNames,
        soft: softSkills.length > 0 ? softSkills : (analysisData.skills?.soft || []),
        languages: languagesList,
        tools: analysisData.skills?.tools || analysisData.tools || [],
        certifications: certifications
    };

    // Extract additional sections
    const additionalSections = [];

    // Projects
    if (analysisData.projects && analysisData.projects.length > 0) {
        additionalSections.push({
            id: 'projects',
            title: 'Projects',
            type: 'projects',
            content: analysisData.projects.map((proj, idx) => ({
                id: `proj_${idx + 1}`,
                name: proj.name || proj.title || '',
                description: proj.description || '',
                technologies: proj.technologies || proj.tech_stack || [],
                link: proj.link || proj.url || '',
                highlights: proj.highlights || [],
                startDate: proj.start_date || proj.startDate || '',
                endDate: proj.end_date || proj.endDate || ''
            }))
        });
    }

    // Achievements from AI schema
    if (analysisData.achievements && analysisData.achievements.length > 0) {
        additionalSections.push({
            id: 'achievements',
            title: 'Achievements',
            type: 'achievements',
            content: analysisData.achievements.map((ach, idx) => ({
                id: `ach_${idx + 1}`,
                title: ach.title || '',
                date: ach.date || '',
                description: ach.description || ''
            }))
        });
    }

    // Awards (if separate from achievements)
    if (analysisData.awards && analysisData.awards.length > 0) {
        additionalSections.push({
            id: 'awards',
            title: 'Awards',
            type: 'awards',
            content: analysisData.awards.map((award, idx) => ({
                id: `award_${idx + 1}`,
                title: award.title || '',
                date: award.date || '',
                issuer: award.issuer || '',
                description: award.description || ''
            }))
        });
    }

    // Publications
    if (analysisData.publications && analysisData.publications.length > 0) {
        additionalSections.push({
            id: 'publications',
            title: 'Publications',
            type: 'publications',
            content: analysisData.publications.map((pub, idx) => ({
                id: `pub_${idx + 1}`,
                title: pub.title || '',
                publisher: pub.publisher || '',
                date: pub.date || '',
                link: pub.link || '',
                description: pub.description || ''
            }))
        });
    }

    // Volunteers
    if (analysisData.volunteers && analysisData.volunteers.length > 0) {
        additionalSections.push({
            id: 'volunteers',
            title: 'Volunteer Experience',
            type: 'volunteers',
            content: analysisData.volunteers.map((vol, idx) => ({
                id: `vol_${idx + 1}`,
                organization: vol.organization || '',
                role: vol.role || '',
                startDate: vol.start_date || vol.startDate || '',
                endDate: vol.end_date || vol.endDate || '',
                description: vol.description || '',
                highlights: vol.highlights || []
            }))
        });
    }

    // Interests
    if (analysisData.interests && analysisData.interests.length > 0) {
        additionalSections.push({
            id: 'interests',
            title: 'Interests',
            type: 'interests',
            content: analysisData.interests.map((int, idx) => ({
                id: `int_${idx + 1}`,
                name: int.name || '',
                keywords: int.keywords || []
            }))
        });
    }

    // Hobbies
    if (analysisData.hobbies && analysisData.hobbies.length > 0) {
        additionalSections.push({
            id: 'hobbies',
            title: 'Hobbies',
            type: 'hobbies',
            content: analysisData.hobbies.map((hob, idx) => ({
                id: `hob_${idx + 1}`,
                name: hob.name || '',
                description: hob.description || '',
                tags: hob.tags || []
            }))
        });
    }

    // Extract scores
    const scores = {
        atsScore: analysisData.resume_quality?.ats_compatibility_score || 0,
        contentScore: analysisData.resume_quality?.content_quality_score || 0,
        formatScore: analysisData.resume_quality?.formatting_design_score || analysisData.resume_quality?.formatting_score || 0,
        overallScore: analysisData.relevance?.['Overall Score'] || 0,
        jobFitScore: analysisData.JobFitScore || 0,
        grammarScore: analysisData.resume_quality?.grammar_language_score || 0,
        professionalBrandingScore: analysisData.resume_quality?.professional_branding_score || 0,
        completenessScore: analysisData.resume_quality?.completeness_score || 0,
        qualityScore: analysisData.resume_quality?.overall_quality_score || 0
    };

    const result = {
        personalInfo,
        summary,
        experience,
        education,
        skills,
        additionalSections,
        scores
    };

    // Log the extracted structure for debugging
    logger.info('[RESUME_SERVICE] ✅ Resume content extracted', {
        hasPersonalInfo: !!personalInfo.fullName,
        experienceCount: experience.length,
        educationCount: education.length,
        hasTechnicalSkills: skills.technical.length > 0,
        hasSoftSkills: skills.soft.length > 0,
        hasLanguages: skills.languages.length > 0,
        hasCertifications: skills.certifications.length > 0,
        additionalSectionsCount: additionalSections.length,
        additionalSectionTypes: additionalSections.map(s => s.type).join(', ')
    });

    return result;
}

/**
 * Extract analysis report from AI analysis data
 * This contains issues, improvements, and quality scores for the resume
 * @param {Object} analysisData - Raw analysis data from AI
 * @returns {Object} Structured analysis report
 */
function extractAnalysisReport(analysisData) {
    logger.info('[RESUME_SERVICE] Extracting analysis report');
    
    const analysisReport = {
        // Critical mistakes that must be fixed
        criticalMistakes: (analysisData.critical_mistakes || []).map(mistake => ({
            issue: mistake.issue || mistake.mistake || mistake,
            impact: mistake.impact || 'High - may cause resume rejection',
            fixSuggestion: mistake.fix_suggestion || mistake.suggestion || mistake.fix || ''
        })),
        
        // Major issues that should be addressed
        majorIssues: (analysisData.major_issues || []).map(issue => ({
            issue: issue.issue || issue,
            impact: issue.impact || 'Medium - reduces resume effectiveness',
            fixSuggestion: issue.fix_suggestion || issue.suggestion || issue.fix || ''
        })),
        
        // Minor improvements for polish
        minorImprovements: (analysisData.minor_improvements || []).map(improvement => ({
            area: improvement.area || improvement.section || 'General',
            suggestion: improvement.suggestion || improvement.improvement || improvement
        })),
        
        // Optimization opportunities
        optimizationOpportunities: analysisData.optimization_opportunities || [],
        
        // Quality scores from analysis
        resumeQuality: {
            atsCompatibilityScore: analysisData.resume_quality?.ats_compatibility_score || 0,
            contentQualityScore: analysisData.resume_quality?.content_quality_score || 0,
            formattingScore: analysisData.resume_quality?.formatting_design_score || analysisData.resume_quality?.formatting_score || 0,
            grammarScore: analysisData.resume_quality?.grammar_language_score || 0,
            professionalBrandingScore: analysisData.resume_quality?.professional_branding_score || 0,
            completenessScore: analysisData.resume_quality?.completeness_score || 0,
            overallQualityScore: analysisData.resume_quality?.overall_quality_score || 0,
            improvementPoints: analysisData.resume_quality?.improvement_points || 0
        },
        
        // Relevance scores
        relevanceScores: {
            overallScore: analysisData.relevance?.['Overall Score'] || 0,
            skillsRelevance: analysisData.relevance?.['Skills Relevance'] || 0,
            workExperience: analysisData.relevance?.['Work Experience'] || 0,
            education: analysisData.relevance?.['Education'] || 0
        },
        
        // Job fit score
        jobFitScore: analysisData.JobFitScore || 0,
        
        // Summary counts for quick reference
        summary: {
            totalCritical: (analysisData.critical_mistakes || []).length,
            totalMajor: (analysisData.major_issues || []).length,
            totalMinor: (analysisData.minor_improvements || []).length,
            totalOptimizations: (analysisData.optimization_opportunities || []).length
        },
        
        // Version marker to track source
        version: 'initial',
        extractedAt: new Date().toISOString()
    };
    
    logger.info('[RESUME_SERVICE] ✅ Analysis report extracted', {
        criticalCount: analysisReport.summary.totalCritical,
        majorCount: analysisReport.summary.totalMajor,
        minorCount: analysisReport.summary.totalMinor,
        atsScore: analysisReport.resumeQuality.atsCompatibilityScore
    });
    
    return analysisReport;
}

/**
 * Get resume by ID with full details
 * Returns unified response with content, analysisReport, rewrites (each with their own analysis)
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Resume with theme info and analysis
 */
export const getResumeByID = async (contentID, userID) => {
    try {
        logger.info('[RESUME_SERVICE] Fetching resume', { contentID, userID });

        // Get resume content (now includes analysisReport)
        const content = await resumeModel.getResumeContentByID(contentID, userID);

        // Get applied theme if any
        const theme = await themeModel.getUserTheme(contentID, userID);

        // Get rewrites history (with no pagination to get all rewrites)
        const { rewrites } = await resumeModel.getRewritesByAnalysisID(content.analysisID, userID, {
            pagination: { limit: 100, offset: 0 } // Get all rewrites for history
        });

        return {
            content,
            // Provide analysisReport at top level for easy access
            // (it's also in content.analysisReport for completeness)
            analysisReport: content.analysisReport || null,
            theme: theme || null,
            // Include analysis report in each rewrite for version switching
            rewrites: rewrites.map(r => ({
                id: r.id,
                versionNumber: r.versionNumber,
                versionLabel: r.versionLabel,
                status: r.status,
                isActive: r.isActive,
                // Include scores and analysis for this specific rewrite version
                scores: r.rewrittenContent?.scores || null,
                analysisReport: r.analysisReport || null,
                improvements: r.improvements || null,
                createdAt: r.createdAt,
                completedAt: r.completedAt
            })),
            activeRewriteID: content.activeRewriteID
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch resume', {
            error: error.message,
            contentID
        });
        throw error;
    }
};

/**
 * Get resume by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Object|null>} Resume or null
 */
export const getResumeByAnalysisID = async (analysisID, userID) => {
    try {
        const content = await resumeModel.getResumeContentByAnalysisID(analysisID, userID);
        
        if (!content) {
            return null;
        }

        return getResumeByID(content.id, userID);
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch resume by analysis', {
            error: error.message,
            analysisID
        });
        throw error;
    }
};

/**
 * Get all resumes for a user
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, search, sort
 * @returns {Promise<Object>} Object with resumes array and totalCount
 */
export const getAllResumes = async (userID, options = {}) => {
    try {
        return await resumeModel.getAllResumeContents(userID, options);
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch resumes', {
            error: error.message,
            userID
        });
        throw error;
    }
};

/**
 * Update a single section
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {string} sectionName - Section to update
 * @param {Object} sectionData - New section data
 * @returns {Promise<Object>} Updated section info
 */
export const updateSection = async (contentID, userID, sectionName, sectionData) => {
    try {
        logger.info('[RESUME_SERVICE] Updating section', {
            contentID,
            sectionName
        });

        // Validate section data if applicable
        const validatedData = validateSectionData(sectionName, sectionData);

        const updated = await resumeModel.updateResumeSection(
            contentID,
            userID,
            sectionName,
            validatedData
        );

        logger.info('[RESUME_SERVICE] ✅ Section updated', {
            contentID,
            sectionName,
            newVersion: updated.version
        });

        return {
            sectionName,
            data: updated[sectionName],
            version: updated.version,
            updatedAt: updated.updatedAt
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to update section', {
            error: error.message,
            contentID,
            sectionName
        });
        throw error;
    }
};

/**
 * Update multiple sections at once
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} sectionsData - Object with section names as keys
 * @returns {Promise<Object>} Updated content
 */
export const updateSections = async (contentID, userID, sectionsData) => {
    try {
        logger.info('[RESUME_SERVICE] Updating multiple sections', {
            contentID,
            sections: Object.keys(sectionsData)
        });

        // Validate each section
        const validatedSections = {};
        for (const [sectionName, data] of Object.entries(sectionsData)) {
            validatedSections[sectionName] = validateSectionData(sectionName, data);
        }

        const updated = await resumeModel.updateMultipleSections(
            contentID,
            userID,
            validatedSections
        );

        logger.info('[RESUME_SERVICE] ✅ Sections updated', {
            contentID,
            newVersion: updated.version
        });

        return {
            sections: Object.keys(validatedSections),
            version: updated.version,
            updatedAt: updated.updatedAt
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to update sections', {
            error: error.message,
            contentID
        });
        throw error;
    }
};

/**
 * Validate section data based on section type
 */
function validateSectionData(sectionName, data) {
    // Basic validation - can be extended with more specific validation
    if (data === null || data === undefined) {
        throw new AppError(`Section data is required for ${sectionName}`, 400);
    }

    // Experience and education should be arrays
    if ((sectionName === 'experience' || sectionName === 'education') && !Array.isArray(data)) {
        throw new AppError(`${sectionName} must be an array`, 400);
    }

    // Personal info and skills should be objects
    if ((sectionName === 'personalInfo' || sectionName === 'skills') && typeof data !== 'object') {
        throw new AppError(`${sectionName} must be an object`, 400);
    }

    return data;
}

// ========== REWRITE OPERATIONS ==========

/**
 * Create a new rewrite job
 * Creates a rewrite based on the CURRENT resume content (which may have been edited)
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} Created rewrite with job info
 */
export const createRewrite = async (userID, analysisID, options = {}) => {
    try {
        logger.info('[RESUME_SERVICE] Creating rewrite', {
            userID,
            analysisID,
            options
        });

        // Get current resume content - this is what AI will optimize
        const content = await resumeModel.getResumeContentByAnalysisID(analysisID, userID);
        
        if (!content) {
            throw new AppError('Resume content not found for this analysis', 404);
        }

        // Get analysis data (raw text) for rewrite
        const analysisData = await resumeModel.getAnalysisDataForRewrite(analysisID, userID);

        // Build current content object for snapshot
        const currentContent = {
            personalInfo: content.personalInfo,
            summary: content.summary,
            experience: content.experience,
            education: content.education,
            skills: content.skills,
            additionalSections: content.additionalSections,
            currentScores: content.currentScores,
            version: content.version
        };

        // Create rewrite record with content snapshot
        const rewrite = await resumeModel.createRewrite(
            userID,
            analysisID,
            content.id,
            currentContent, // Pass current content for snapshot
            {
                versionLabel: options.versionLabel,
                optimizationSettings: {
                    targetATSScore: options.targetATSScore || 90,
                    focusAreas: options.focusAreas || ['all'],
                    optimizationLevel: options.optimizationLevel || 'comprehensive'
                }
            }
        );

        // Add job to queue with current content (not original analysis)
        const job = await addResumeRewriteJob({
            rewriteID: rewrite.id,
            analysisID,
            userID,
            resumeContentID: content.id,
            analysisData: analysisData.processedData,
            rawData: analysisData.rawData,
            currentContent, // AI will optimize from current state
            optimizationOptions: rewrite.optimizationSettings
        });

        // Update rewrite with job ID
        await resumeModel.updateRewrite(rewrite.id, { jobID: job.id });

        logger.info('[RESUME_SERVICE] ✅ Rewrite job created with content snapshot', {
            rewriteID: rewrite.id,
            jobID: job.id,
            contentVersion: content.version,
            versionNumber: rewrite.versionNumber
        });

        return {
            id: rewrite.id,
            jobId: job.id,
            versionNumber: rewrite.versionNumber,
            versionLabel: rewrite.versionLabel,
            status: 'pending',
            basedOnVersion: content.version,
            message: 'Rewrite job created and queued'
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to create rewrite', {
            error: error.message,
            userID,
            analysisID
        });
        throw error;
    }
};

/**
 * Get rewrite details with source snapshot
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Rewrite details
 */
export const getRewrite = async (rewriteID, userID) => {
    try {
        const rewrite = await resumeModel.getRewriteByID(rewriteID, userID);
        
        return {
            id: rewrite.id,
            status: rewrite.status,
            versionNumber: rewrite.versionNumber,
            versionLabel: rewrite.versionLabel,
            isActive: rewrite.isActive,
            wasModifiedAfterApply: rewrite.wasModifiedAfterApply,
            optimizationSettings: rewrite.optimizationSettings,
            improvements: rewrite.improvements,
            analysisReport: rewrite.analysisReport,
            rewrittenContent: rewrite.status === 'completed' ? rewrite.rewrittenContent : null,
            sourceContentSnapshot: rewrite.sourceContentSnapshot,
            createdAt: rewrite.createdAt,
            completedAt: rewrite.completedAt,
            appliedAt: rewrite.appliedAt
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch rewrite', {
            error: error.message,
            rewriteID
        });
        throw error;
    }
};

/**
 * Get all rewrites for an analysis with version status
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, sort
 * @returns {Promise<Object>} Object with rewrites array and totalCount
 */
export const getRewritesByAnalysis = async (analysisID, userID, options = {}) => {
    try {
        const { rewrites, totalCount } = await resumeModel.getRewritesByAnalysisID(analysisID, userID, options);
        
        const formattedRewrites = rewrites.map(r => ({
            id: r.id,
            status: r.status,
            versionNumber: r.versionNumber,
            versionLabel: r.versionLabel,
            isActive: r.isActive,
            wasModifiedAfterApply: r.wasModifiedAfterApply,
            improvements: r.improvements,
            analysisReport: r.analysisReport,
            scores: r.rewrittenContent?.scores || null,
            createdAt: r.createdAt,
            completedAt: r.completedAt,
            appliedAt: r.appliedAt
        }));

        return { rewrites: formattedRewrites, totalCount };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch rewrites', {
            error: error.message,
            analysisID
        });
        throw error;
    }
};

/**
 * Apply a completed rewrite to resume content
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Updated resume content
 */
export const applyRewrite = async (rewriteID, userID) => {
    try {
        logger.info('[RESUME_SERVICE] Applying rewrite', { rewriteID, userID });

        const updatedContent = await resumeModel.applyRewrite(rewriteID, userID);

        // Get the rewrite details for response
        const rewrite = await resumeModel.getRewriteByID(rewriteID, userID);

        logger.info('[RESUME_SERVICE] ✅ Rewrite applied', {
            rewriteID,
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            versionNumber: rewrite.versionNumber
        });

        return {
            contentID: updatedContent.id,
            version: updatedContent.version,
            rewrite: {
                id: rewrite.id,
                versionNumber: rewrite.versionNumber,
                versionLabel: rewrite.versionLabel,
                isActive: true
            },
            message: 'Rewrite applied successfully'
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to apply rewrite', {
            error: error.message,
            rewriteID
        });
        throw error;
    }
};

/**
 * Switch to a different rewrite version
 * Updates resume content with the selected version's content
 * @param {number} rewriteID - Target rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Switch result with updated content and version info
 */
export const switchRewriteVersion = async (rewriteID, userID) => {
    try {
        logger.info('[RESUME_SERVICE] Switching rewrite version', { rewriteID, userID });

        const result = await resumeModel.switchRewriteVersion(rewriteID, userID);

        logger.info('[RESUME_SERVICE] ✅ Rewrite version switched', {
            rewriteID,
            versionNumber: result.rewrite.versionNumber,
            contentVersion: result.content.version
        });

        return {
            content: {
                id: result.content.id,
                version: result.content.version,
                personalInfo: result.content.personalInfo,
                summary: result.content.summary,
                experience: result.content.experience,
                education: result.content.education,
                skills: result.content.skills,
                additionalSections: result.content.additionalSections,
                currentScores: result.content.currentScores,
                analysisReport: result.content.analysisReport
            },
            activeRewrite: result.rewrite,
            message: result.message
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to switch rewrite version', {
            error: error.message,
            rewriteID
        });
        throw error;
    }
};

/**
 * Get the currently active rewrite for a resume
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Object|null>} Active rewrite info or null
 */
export const getActiveRewrite = async (analysisID, userID) => {
    try {
        const activeRewrite = await resumeModel.getActiveRewrite(analysisID, userID);
        
        if (!activeRewrite) {
            return null;
        }

        return {
            id: activeRewrite.id,
            versionNumber: activeRewrite.versionNumber,
            versionLabel: activeRewrite.versionLabel,
            isActive: true,
            wasModifiedAfterApply: activeRewrite.wasModifiedAfterApply,
            appliedAt: activeRewrite.appliedAt,
            improvements: activeRewrite.improvements,
            analysisReport: activeRewrite.analysisReport
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to get active rewrite', {
            error: error.message,
            analysisID
        });
        throw error;
    }
};

/**
 * Clear active rewrite (revert to manual editing mode)
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Updated content
 */
export const clearActiveRewrite = async (analysisID, userID) => {
    try {
        logger.info('[RESUME_SERVICE] Clearing active rewrite', { analysisID, userID });

        const updatedContent = await resumeModel.clearActiveRewrite(analysisID, userID);

        logger.info('[RESUME_SERVICE] ✅ Active rewrite cleared', {
            contentID: updatedContent.id,
            newVersion: updatedContent.version
        });

        return {
            contentID: updatedContent.id,
            version: updatedContent.version,
            activeRewriteID: null,
            message: 'Reverted to manual editing mode'
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to clear active rewrite', {
            error: error.message,
            analysisID
        });
        throw error;
    }
};

/**
 * Compare two rewrite versions
 * @param {number} rewriteID1 - First rewrite ID
 * @param {number} rewriteID2 - Second rewrite ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Comparison data
 */
export const compareRewriteVersions = async (rewriteID1, rewriteID2, userID) => {
    try {
        const [rewrite1, rewrite2] = await Promise.all([
            resumeModel.getRewriteByID(rewriteID1, userID),
            resumeModel.getRewriteByID(rewriteID2, userID)
        ]);

        return {
            version1: {
                id: rewrite1.id,
                versionNumber: rewrite1.versionNumber,
                versionLabel: rewrite1.versionLabel,
                status: rewrite1.status,
                isActive: rewrite1.isActive,
                content: rewrite1.rewrittenContent,
                improvements: rewrite1.improvements,
                analysisReport: rewrite1.analysisReport,
                createdAt: rewrite1.createdAt
            },
            version2: {
                id: rewrite2.id,
                versionNumber: rewrite2.versionNumber,
                versionLabel: rewrite2.versionLabel,
                status: rewrite2.status,
                isActive: rewrite2.isActive,
                content: rewrite2.rewrittenContent,
                improvements: rewrite2.improvements,
                analysisReport: rewrite2.analysisReport,
                createdAt: rewrite2.createdAt
            }
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to compare rewrites', {
            error: error.message,
            rewriteID1,
            rewriteID2
        });
        throw error;
    }
};

// ========== THEME OPERATIONS ==========

/**
 * Get available themes
 * @param {Object} options - Options including pagination, filters, search, sort
 * @returns {Promise<Object>} Object with themes array and totalCount
 */
export const getThemes = async (options = {}) => {
    try {
        const { themes, totalCount } = await themeModel.getAllThemes(options);
        
        const formattedThemes = themes.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            category: t.category,
            thumbnailURL: t.thumbnailURL,
            previewURL: t.previewURL,
            isATSOptimized: t.isATSOptimized,
            usageCount: t.usageCount,
            config: t.config
        }));

        return { themes: formattedThemes, totalCount };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch themes', {
            error: error.message
        });
        throw error;
    }
};

/**
 * Get theme details
 * @param {number} themeID - Theme ID
 * @returns {Promise<Object>} Theme details
 */
export const getThemeDetails = async (themeID) => {
    try {
        const theme = await themeModel.getThemeByID(themeID);
        return theme;
    } catch (error) {
        throw error;
    }
};

/**
 * Apply theme to resume
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {number} themeID - Theme ID
 * @param {Object} customOverrides - Optional overrides
 * @returns {Promise<Object>} Applied theme info
 */
export const applyTheme = async (resumeContentID, userID, themeID, customOverrides = null) => {
    try {
        logger.info('[RESUME_SERVICE] Applying theme', {
            resumeContentID,
            themeID
        });

        const userTheme = await themeModel.applyTheme(
            userID,
            resumeContentID,
            themeID,
            customOverrides
        );

        // Get full theme config for the NEW theme
        const theme = await themeModel.getThemeByID(themeID);

        logger.info('[RESUME_SERVICE] ✅ Theme applied', {
            userThemeID: userTheme.id
        });

        return {
            id: userTheme.id,
            themeID,
            themeName: theme.name,
            themeSlug: theme.slug,
            themeCategory: theme.category,
            isATSOptimized: theme.isATSOptimized,
            // Return the new theme's base config
            themeConfig: theme.config,
            // Return merged config (new theme + any provided overrides)
            config: mergeThemeConfig(theme.config, userTheme.customOverrides),
            // Return user's customizations (will be null if theme was changed without overrides)
            customOverrides: userTheme.customOverrides,
            sectionVisibility: userTheme.sectionVisibility,
            sectionOrder: userTheme.sectionOrder,
            isDraft: userTheme.isDraft
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to apply theme', {
            error: error.message,
            resumeContentID,
            themeID
        });
        throw error;
    }
};

/**
 * Update theme customizations
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated theme info
 */
export const updateThemeConfig = async (resumeContentID, userID, updates) => {
    try {
        logger.info('[RESUME_SERVICE] Updating theme config', {
            resumeContentID
        });

        const updated = await themeModel.updateUserTheme(resumeContentID, userID, updates);

        // Get merged config
        let config = null;
        if (updated.themeID) {
            const theme = await themeModel.getThemeByID(updated.themeID);
            config = mergeThemeConfig(theme.config, updated.customOverrides);
        }

        return {
            id: updated.id,
            config,
            customOverrides: updated.customOverrides,
            sectionVisibility: updated.sectionVisibility,
            sectionOrder: updated.sectionOrder,
            isDraft: updated.isDraft
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to update theme config', {
            error: error.message,
            resumeContentID
        });
        throw error;
    }
};

/**
 * Get resume with applied theme for rendering
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Complete resume with theme for rendering
 */
export const getResumeForRender = async (resumeContentID, userID) => {
    try {
        const content = await resumeModel.getResumeContentByID(resumeContentID, userID);
        const userTheme = await themeModel.getUserTheme(resumeContentID, userID);

        let themeConfig = null;
        if (userTheme && userTheme.themeID) {
            themeConfig = mergeThemeConfig(userTheme.themeConfig, userTheme.customOverrides);
        }

        // Apply section visibility and order
        const sectionVisibility = userTheme?.sectionVisibility || {
            personalInfo: true,
            summary: true,
            experience: true,
            education: true,
            skills: true,
            additionalSections: true
        };

        const sectionOrder = userTheme?.sectionOrder || [
            'personalInfo',
            'summary',
            'experience',
            'education',
            'skills',
            'additionalSections'
        ];

        return {
            content: {
                personalInfo: sectionVisibility.personalInfo ? content.personalInfo : null,
                summary: sectionVisibility.summary ? content.summary : null,
                experience: sectionVisibility.experience ? content.experience : null,
                education: sectionVisibility.education ? content.education : null,
                skills: sectionVisibility.skills ? content.skills : null,
                additionalSections: sectionVisibility.additionalSections ? content.additionalSections : null
            },
            sectionOrder,
            theme: themeConfig,
            meta: {
                version: content.version,
                lastEditType: content.lastEditType,
                scores: content.currentScores,
                isDraft: userTheme?.isDraft ?? true
            }
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to get resume for render', {
            error: error.message,
            resumeContentID
        });
        throw error;
    }
};

/**
 * Publish resume (mark as not draft)
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Updated status
 */
export const publishResume = async (resumeContentID, userID) => {
    try {
        const updated = await themeModel.publishResume(resumeContentID, userID);
        
        return {
            id: updated.id,
            isDraft: false,
            publishedAt: updated.publishedAt
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Merge base theme config with user overrides
 */
function mergeThemeConfig(baseConfig, overrides) {
    if (!overrides) return baseConfig;
    if (!baseConfig) return overrides;

    // Deep merge
    const merged = { ...baseConfig };

    for (const key of Object.keys(overrides)) {
        if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
            merged[key] = {
                ...(baseConfig[key] || {}),
                ...overrides[key]
            };
        } else {
            merged[key] = overrides[key];
        }
    }

    return merged;
}

// ========== AI OPTIMIZATION OPERATIONS ==========

/**
 * Optimize resume content using AI
 * Called by the rewrite worker to generate optimized content
 * 
 * SIMPLIFIED APPROACH: Uses the issues/fixes from analysis to make
 * targeted optimizations instead of generating a complete new structure.
 * This is more reliable and preserves the original format.
 * 
 * @param {Object} currentContent - Current resume content from resumeContentTable
 * @param {Object} analysisData - Analysis data with issues and improvement plan
 * @param {Object} options - Optimization options (targetATSScore, etc.)
 * @returns {Promise<Object>} Optimized content ready for direct application
 */
export const optimizeResumeContent = async (currentContent, analysisData, options = {}) => {
    try {
        logger.info('[RESUME_SERVICE] Starting resume optimization', {
            hasCurrentContent: !!currentContent,
            hasAnalysisData: !!analysisData,
            criticalMistakes: analysisData?.critical_mistakes?.length || 0,
            majorIssues: analysisData?.major_issues?.length || 0,
            options
        });

        // Get AI service
        const aiService = await getAiService();

        // Build prompt - now uses issues from analysis to make targeted fixes
        const prompt = getResumeContentRewritePrompt(currentContent, analysisData, options);
        
        const systemPrompt = `You are an expert ATS resume optimizer. Apply the identified fixes to optimize the resume.

CRITICAL RULES:
1. Apply ALL identified fixes from the analysis
2. Use strong action verbs: Led, Architected, Spearheaded, Engineered, Optimized
3. Add quantifiable metrics where possible: percentages (%), dollar amounts ($), scale
4. Format achievements using STAR method (Situation, Task, Action, Result)
5. Preserve factual information (company names, dates, roles)
6. Target ATS Score: ${options.targetATSScore || 85}%

OUTPUT FORMAT:
- summary: { text: "optimized summary", keywords: ["keyword1", "keyword2"] }
- experience: array of { company, position, location, startDate, endDate, current, description, achievements: [] }
- skills: { technical: [], soft: [], tools: [], languages: [], certifications: [] }
- estimatedAtsScore: number (0-100)
- fixesSummary: "Brief description of improvements made"`;

        // Generate optimization using AI with the simplified schema
        const optimizedContent = await aiService.generateAiResponseObject({
            system: systemPrompt,
            content: prompt,
            schema: resumeContentOutputSchema,
            model: 'gpt-4o-mini',
            retries: 3
        });

        logger.info('[RESUME_SERVICE] Resume optimization completed', {
            hasSummary: !!optimizedContent?.summary,
            experienceCount: optimizedContent?.experience?.length || 0,
            hasSkills: !!optimizedContent?.skills,
            estimatedAtsScore: optimizedContent?.estimatedAtsScore,
            fixesSummary: optimizedContent?.fixesSummary
        });

        // Return content in a format ready for direct application
        return {
            content: {
                // Personal info is preserved from original (not modified by optimization)
                personalInfo: currentContent?.personalInfo || currentContent?.personal_info || null,
                summary: optimizedContent.summary || null,
                experience: optimizedContent.experience || [],
                // Education is preserved from original (minimal changes needed)
                education: currentContent?.education || [],
                skills: optimizedContent.skills || null,
                additionalSections: currentContent?.additionalSections || null
            },
            scores: {
                atsScore: optimizedContent.estimatedAtsScore || options.targetATSScore || 85,
                contentScore: 85,
                overallScore: optimizedContent.estimatedAtsScore || 85
            },
            metadata: {
                fixesSummary: optimizedContent.fixesSummary || 'Resume optimized for ATS compatibility',
                timestamp: new Date().toISOString(),
                target_ats_score: options.targetATSScore || 85
            }
        };

    } catch (error) {
        logger.error('[RESUME_SERVICE] Resume optimization failed', {
            error: error.message,
            stack: error.stack
        });
        throw new AppError(`Resume optimization failed: ${error.message}`, 500);
    }
};

export default {
    // Content operations
    createResumeFromAnalysis,
    getResumeByID,
    getResumeByAnalysisID,
    getAllResumes,
    updateSection,
    updateSections,
    // Rewrite operations
    createRewrite,
    getRewrite,
    getRewritesByAnalysis,
    applyRewrite,
    switchRewriteVersion,
    getActiveRewrite,
    clearActiveRewrite,
    compareRewriteVersions,
    // Theme operations
    getThemes,
    getThemeDetails,
    applyTheme,
    updateThemeConfig,
    getResumeForRender,
    publishResume,
    // AI optimization
    optimizeResumeContent
};
