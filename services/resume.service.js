import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import resumeModel from "../models/resume.model.js";
import themeModel from "../models/theme.model.js";
import { addResumeRewriteJob } from "../queues/resume-rewrite.queue.js";
import { validateResumeData } from "../utils/resumeSchema.js";
import { getCompleteResumePrompt } from "../queues/workerSupport/resume-rewrite/prompt.js";
import { completeResumeOptimizationSchema } from "../queues/workerSupport/resume-rewrite/objectSchema.js";

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

        // Create resume content record
        const content = await resumeModel.createResumeContent(userID, analysisID, contentData);

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
 * Get resume by ID with full details
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @returns {Promise<Object>} Resume with theme info
 */
export const getResumeByID = async (contentID, userID) => {
    try {
        logger.info('[RESUME_SERVICE] Fetching resume', { contentID, userID });

        // Get resume content
        const content = await resumeModel.getResumeContentByID(contentID, userID);

        // Get applied theme if any
        const theme = await themeModel.getUserTheme(contentID, userID);

        // Get rewrites history
        const rewrites = await resumeModel.getRewritesByAnalysisID(content.analysisID, userID);

        return {
            content,
            theme: theme || null,
            rewrites: rewrites.map(r => ({
                id: r.id,
                versionNumber: r.versionNumber,
                versionLabel: r.versionLabel,
                status: r.status,
                isActive: r.isActive,
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
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of resumes
 */
export const getAllResumes = async (userID, filters = {}) => {
    try {
        return await resumeModel.getAllResumeContents(userID, filters);
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

        // Get resume content
        const content = await resumeModel.getResumeContentByAnalysisID(analysisID, userID);
        
        if (!content) {
            throw new AppError('Resume content not found for this analysis', 404);
        }

        // Get analysis data for rewrite
        const analysisData = await resumeModel.getAnalysisDataForRewrite(analysisID, userID);

        // Create rewrite record
        const rewrite = await resumeModel.createRewrite(
            userID,
            analysisID,
            content.id,
            {
                versionLabel: options.versionLabel,
                optimizationSettings: {
                    targetATSScore: options.targetATSScore || 90,
                    focusAreas: options.focusAreas || ['all'],
                    optimizationLevel: options.optimizationLevel || 'comprehensive'
                }
            }
        );

        // Add job to queue
        const job = await addResumeRewriteJob({
            rewriteID: rewrite.id,
            analysisID,
            userID,
            resumeContentID: content.id,
            analysisData: analysisData.processedData,
            rawData: analysisData.rawData,
            currentContent: {
                personalInfo: content.personalInfo,
                summary: content.summary,
                experience: content.experience,
                education: content.education,
                skills: content.skills,
                additionalSections: content.additionalSections
            },
            optimizationOptions: rewrite.optimizationSettings
        });

        // Update rewrite with job ID
        await resumeModel.updateRewrite(rewrite.id, { jobID: job.id });

        logger.info('[RESUME_SERVICE] ✅ Rewrite job created', {
            rewriteID: rewrite.id,
            jobID: job.id
        });

        return {
            id: rewrite.id,
            jobId: job.id,
            versionNumber: rewrite.versionNumber,
            versionLabel: rewrite.versionLabel,
            status: 'pending',
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
 * Get rewrite details
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
            optimizationSettings: rewrite.optimizationSettings,
            improvements: rewrite.improvements,
            rewrittenContent: rewrite.status === 'completed' ? rewrite.rewrittenContent : null,
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
 * Get all rewrites for an analysis
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @returns {Promise<Array>} List of rewrites
 */
export const getRewritesByAnalysis = async (analysisID, userID) => {
    try {
        const rewrites = await resumeModel.getRewritesByAnalysisID(analysisID, userID);
        
        return rewrites.map(r => ({
            id: r.id,
            status: r.status,
            versionNumber: r.versionNumber,
            versionLabel: r.versionLabel,
            isActive: r.isActive,
            improvements: r.improvements,
            createdAt: r.createdAt,
            completedAt: r.completedAt
        }));
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

        logger.info('[RESUME_SERVICE] ✅ Rewrite applied', {
            rewriteID,
            contentID: updatedContent.id,
            newVersion: updatedContent.version
        });

        return {
            contentID: updatedContent.id,
            version: updatedContent.version,
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

// ========== THEME OPERATIONS ==========

/**
 * Get available themes
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of themes
 */
export const getThemes = async (filters = {}) => {
    try {
        const themes = await themeModel.getAllThemes(filters);
        
        return themes.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            category: t.category,
            thumbnailURL: t.thumbnailURL,
            previewURL: t.previewURL,
            isATSOptimized: t.isATSOptimized,
            usageCount: t.usageCount
        }));
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

        // Get full theme config
        const theme = await themeModel.getThemeByID(themeID);

        logger.info('[RESUME_SERVICE] ✅ Theme applied', {
            userThemeID: userTheme.id
        });

        return {
            id: userTheme.id,
            themeID,
            themeName: theme.name,
            config: mergeThemeConfig(theme.config, userTheme.customOverrides),
            customOverrides: userTheme.customOverrides,
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
 * @param {Object} analysisData - Parsed analysis/processed data
 * @param {Object} rawData - Original raw extracted data
 * @param {Object} options - Optimization options (targetATSScore, focusSections, etc.)
 * @returns {Promise<Object>} Optimization results
 */
export const optimizeResumeContent = async (analysisData, rawData, options = {}) => {
    try {
        logger.info('[RESUME_SERVICE] Starting resume optimization', {
            hasAnalysisData: !!analysisData,
            hasRawData: !!rawData,
            options
        });

        // Get AI service
        const aiService = await getAiService();

        // Build prompt for AI
        const prompt = getCompleteResumePrompt(analysisData, rawData, options);
        const systemPrompt = `You are an expert resume writer and ATS optimization specialist. 
Your task is to optimize resume content for maximum ATS score and recruiter appeal.
Focus on:
- Strong action verbs and quantifiable achievements
- Strategic keyword placement
- STAR method for experience descriptions
- Industry-standard formatting recommendations
Target ATS Score: ${options.targetATSScore || 90}`;

        // Generate optimization using AI
        const optimizationResult = await aiService.generateAiResponseObject({
            system: systemPrompt,
            content: prompt,
            schema: completeResumeOptimizationSchema,
            model: 'gpt-4o-mini',
            retries: 3
        });

        logger.info('[RESUME_SERVICE] Resume optimization completed', {
            sectionsOptimized: optimizationResult?.metadata?.sections_optimized?.length || 0,
            criticalFixes: optimizationResult?.overall_improvements?.critical_fixes || 0
        });

        // Structure the response
        return {
            optimizations: {
                personalInfo: optimizationResult.personal_info || null,
                professionalSummary: optimizationResult.professional_summary || null,
                workExperience: optimizationResult.work_experience || null,
                education: optimizationResult.education || null,
                skills: optimizationResult.skills || null,
                atsKeywords: optimizationResult.ats_keywords || null,
                formattingRecommendations: optimizationResult.formatting_recommendations || null,
                additionalSections: null
            },
            improvements: optimizationResult.overall_improvements || {
                critical_fixes: 0,
                major_fixes: 0,
                minor_fixes: 0,
                estimated_score_improvement: {
                    atsScore: options.targetATSScore || 90,
                    overallScore: 85
                }
            },
            metadata: optimizationResult.metadata || {
                optimization_level: options.level || 'comprehensive',
                timestamp: new Date().toISOString(),
                sections_optimized: [],
                target_ats_score: options.targetATSScore || 90
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
