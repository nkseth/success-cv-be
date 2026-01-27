import logger from "../middleware/logger.js";
import { AppError } from "../middleware/error.js";
import resumeModel from "../models/resume.model.js";
import themeModel from "../models/theme.model.js";
import { addResumeRewriteJob } from "../queues/resume-rewrite.queue.js";
import { validateResumeData } from "../utils/resumeSchema.js";
import { getUserDrivenOptimizationPrompt, getUserDrivenSystemPrompt } from "../queues/workerSupport/resume-rewrite/prompt.js";
import { resumeContentOutputSchema } from "../queues/workerSupport/resume-rewrite/objectSchema.js";
import { userTypeConstants } from "../utils/constants.js";
import { validateOptimizationPrompt, getExamplePrompts } from "../utils/prompt-validator.js";

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
 * All functions accept an optional userType parameter to support both
 * regular users and candidates (B2B flow).
 * 
 * Flow:
 * 1. Analysis completes → createResumeFromAnalysis() creates initial content
 * 2. User can edit sections → updateSection() or updateSections()
 * 3. User requests rewrite → createRewrite() → worker processes → applyRewrite()
 * 4. User applies theme → applyTheme() → customize with updateThemeConfig()
 */

// ========== RESUME CONTENT OPERATIONS ==========

/**
 * Create a blank resume from scratch
 * Creates document, analysis (completed status), and empty resume content
 * @param {number} userID - User ID
 * @param {string} name - Resume name
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Created resume with empty sections
 */
export const createBlankResume = async (userID, name, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Creating blank resume', {
            userID,
            name,
            userType
        });

        // Create blank document
        const document = await resumeModel.createBlankDocument(userID, name, userType);

        // Create blank analysis (completed status since nothing to analyze)
        const analysis = await resumeModel.createBlankAnalysis(userID, document.id, userType);

        // Create resume content with empty sections
        const blankContent = getBlankResumeContent();
        const content = await resumeModel.createResumeContent(
            userID,
            analysis.id,
            blankContent,
            null, // No analysis summary for blank resumes
            userType
        );

        // Apply default theme
        let defaultTheme = null;
        try {
            defaultTheme = await themeModel.getDefaultTheme();
            if (defaultTheme) {
                await themeModel.applyTheme(userID, content.id, defaultTheme.id, null, userType);
                logger.info('[RESUME_SERVICE] ✅ Default theme applied', {
                    contentID: content.id,
                    themeID: defaultTheme.id
                });
            }
        } catch (themeError) {
            logger.error('[RESUME_SERVICE] Failed to apply default theme', {
                error: themeError.message,
                contentID: content.id
            });
        }

        // Format response to match API spec
        const response = {
            id: content.id,
            userID: content.userID || content.candidateID,
            analysisID: content.analysisID,
            documentID: document.id,
            themeID: defaultTheme?.id || 1,
            name: document.title,
            description: null,
            customConfig: null,
            isLocked: false,
            isDraft: true,
            publishedAt: null,
            createdAt: content.createdAt,
            updatedAt: content.updatedAt,
            deletedAt: null,
            // Include scores explicitly set to 0 for blank resumes
            currentScores: content.currentScores || {
                atsScore: 0,
                contentScore: 0,
                formatScore: 0,
                overallScore: 0,
                jobFitScore: 0,
                skillsRelevanceScore: 0,
                experienceRelevanceScore: 0,
                educationRelevanceScore: 0,
                grammarScore: 0,
                professionalBrandingScore: 0,
                completenessScore: 0
            },
            sections: [
                {
                    sectionName: 'personal_info',
                    content: content.personalInfo || {},
                    isVisible: true,
                    displayOrder: 1
                },
                {
                    sectionName: 'summary',
                    content: content.summary || {},
                    isVisible: true,
                    displayOrder: 2
                },
                {
                    sectionName: 'experience',
                    content: content.experience || [],
                    isVisible: true,
                    displayOrder: 3
                },
                {
                    sectionName: 'education',
                    content: content.education || [],
                    isVisible: true,
                    displayOrder: 4
                },
                {
                    sectionName: 'skills',
                    content: content.skills || {},
                    isVisible: true,
                    displayOrder: 5
                }
            ]
        };

        logger.info('[RESUME_SERVICE] ✅ Blank resume created', {
            contentID: content.id,
            documentID: document.id,
            analysisID: analysis.id,
            userType
        });

        return response;
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to create blank resume', {
            error: error.message,
            userID,
            name,
            userType
        });
        throw error;
    }
};

/**
 * Get blank resume content structure
 * Returns empty sections matching the expected schema
 */
function getBlankResumeContent() {
    return {
        personalInfo: {},
        summary: {},
        experience: [],
        education: [],
        skills: {},
        additionalSections: [],
        scores: {
            // All scores start at 0 for blank resumes
            atsScore: 0,
            contentScore: 0,
            formatScore: 0,
            overallScore: 0,
            jobFitScore: 0,
            skillsRelevanceScore: 0,
            experienceRelevanceScore: 0,
            educationRelevanceScore: 0,
            grammarScore: 0,
            professionalBrandingScore: 0,
            completenessScore: 0
        }
    };
}

/**
 * Create resume content from completed analysis
 * Called by the analysis worker after AI processing
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} analysisData - Processed data from analysis
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Created resume content
 */
export const createResumeFromAnalysis = async (userID, analysisID, analysisData, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Creating resume from analysis', {
            userID,
            analysisID,
            userType
        });

        // Parse analysis data if string
        const parsed = typeof analysisData === 'string' 
            ? JSON.parse(analysisData) 
            : analysisData;

        // Extract and structure resume content
        const contentData = extractResumeContent(parsed);

        // Extract lightweight analysis summary (counts and initial version marker)
        const analysisSummary = extractAnalysisSummary(parsed);

        // Create resume content record with lightweight analysis summary
        const content = await resumeModel.createResumeContent(userID, analysisID, contentData, analysisSummary, userType);

        // Apply default theme automatically so user gets a properly themed resume
        try {
            const defaultTheme = await themeModel.getDefaultTheme();
            if (defaultTheme) {
                await themeModel.applyTheme(userID, content.id, defaultTheme.id, null, userType);
                logger.info('[RESUME_SERVICE] ✅ Default theme applied', {
                    contentID: content.id,
                    themeID: defaultTheme.id,
                    themeName: defaultTheme.name
                });
            } else {
                logger.warn('[RESUME_SERVICE] No default theme available, resume created without theme');
            }
        } catch (themeError) {
            // Log but don't fail - theme is optional
            logger.error('[RESUME_SERVICE] Failed to apply default theme', {
                error: themeError.message,
                contentID: content.id
            });
        }

        logger.info('[RESUME_SERVICE] ✅ Resume created from analysis', {
            contentID: content.id,
            userType
        });

        return content;
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to create resume from analysis', {
            error: error.message,
            userID,
            analysisID,
            userType
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
    // Priority: direct personal_info fields > social array extraction > fallback fields
    const personalInfo = {
        fullName: analysisData.personal_info?.name || analysisData.name || '',
        email: analysisData.personal_info?.email || analysisData.email || '',
        phone: analysisData.personal_info?.phone || analysisData.phone || '',
        location: analysisData.personal_info?.address || analysisData.personal_info?.location || analysisData.location || '',
        linkedin: analysisData.personal_info?.linkedin || linkedinProfile?.url || '',
        website: analysisData.personal_info?.website || websiteProfile?.url || '',
        portfolio: analysisData.personal_info?.portfolio || '',
        github: analysisData.personal_info?.github || githubProfile?.url || ''
    };

    // Extract summary - AI schema has it in personal_info.summary
    const summary = {
        text: analysisData.personal_info?.summary || analysisData.professional_summary || analysisData.summary || '',
        keywords: analysisData.keywords || []
    };

    // Extract experiences - mapping AI schema fields
    // Convert summary and highlights into HTML description format with achievements
    const experience = (analysisData.experiences || analysisData.work_experience || []).map((exp, idx) => {
        // Build HTML description from summary and highlights/achievements
        const summaryText = exp.summary || exp.description || '';
        const highlights = exp.highlights || exp.achievements || exp.bullet_points || [];
        
        let description = '';
        
        // Add summary paragraph if present (and not just whitespace)
        if (summaryText && summaryText.trim()) {
            description += `<p>${summaryText.trim()}</p>`;
        }
        
        // Add highlights/achievements as bullet list
        // This ensures achievements are always included in the description as HTML
        if (highlights && highlights.length > 0) {
            const validHighlights = highlights.filter(h => h && h.trim());
            if (validHighlights.length > 0) {
                description += '<ul>';
                validHighlights.forEach(highlight => {
                    description += `<li>${highlight.trim()}</li>`;
                });
                description += '</ul>';
            }
        }
        
        // If no description was built, use empty string
        if (!description) {
            description = '';
        }
        
        return {
            id: `exp_${idx + 1}`,
            company: exp.company || exp.organization || '',
            position: exp.position || exp.title || exp.role || '',
            location: exp.location || '',
            startDate: exp.start_date || exp.startDate || '',
            endDate: exp.end_date || exp.endDate || '',
            current: exp.current || exp.is_current || (exp.end_date === '' || exp.end_date?.toLowerCase() === 'present'),
            description: description,
            // Keep achievements empty since content is now in description HTML
            achievements: [],
            keywords: exp.keywords || [],
            website: exp.website || ''
        };
    });

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

    // Extract skills - prioritize structured skills field, fall back to other_skills
    // The AI now provides a structured skills object with technical, soft, tools, industry arrays
    const structuredSkills = analysisData.skills || {};
    const otherSkills = analysisData.other_skills || [];
    
    // Extract from structured skills field first (new format)
    let technicalSkills = [];
    let softSkills = [];
    let toolSkills = [];
    
    // Check if we have the new structured skills format
    if (structuredSkills.technical && Array.isArray(structuredSkills.technical)) {
        technicalSkills = structuredSkills.technical.filter(Boolean);
    }
    if (structuredSkills.soft && Array.isArray(structuredSkills.soft)) {
        softSkills = structuredSkills.soft.filter(Boolean);
    }
    if (structuredSkills.tools && Array.isArray(structuredSkills.tools)) {
        toolSkills = structuredSkills.tools.filter(Boolean);
    }
    
    // If structured skills are empty, fall back to other_skills array (legacy format)
    if (technicalSkills.length === 0 && softSkills.length === 0 && otherSkills.length > 0) {
        logger.info('[RESUME_SERVICE] Using legacy other_skills extraction');
        
        // Try to categorize based on tags
        const technicalFromTags = otherSkills
            .filter(s => s.tags?.some(t => 
                ['technical', 'programming', 'software', 'technology', 'development', 'tool', 'framework', 'database', 'language', 'hard'].includes(t.toLowerCase())
            ) || s.description?.toLowerCase().includes('technical'))
            .map(s => s.name)
            .filter(Boolean);
        
        const softFromTags = otherSkills
            .filter(s => s.tags?.some(t => 
                ['soft', 'communication', 'leadership', 'management', 'interpersonal', 'teamwork', 'problem-solving'].includes(t.toLowerCase())
            ) || s.description?.toLowerCase().includes('soft skill'))
            .map(s => s.name)
            .filter(Boolean);
        
        const toolsFromTags = otherSkills
            .filter(s => s.tags?.some(t => 
                ['tool', 'platform', 'ide', 'devops'].includes(t.toLowerCase())
            ))
            .map(s => s.name)
            .filter(Boolean);
        
        // If tag-based categorization didn't work, put all as technical
        const allSkillNames = otherSkills.map(s => s.name).filter(Boolean);
        
        technicalSkills = technicalFromTags.length > 0 ? technicalFromTags : allSkillNames;
        softSkills = softFromTags;
        toolSkills = toolsFromTags;
    }
    
    // Also include industry skills in technical if present
    if (structuredSkills.industry && Array.isArray(structuredSkills.industry)) {
        technicalSkills = [...new Set([...technicalSkills, ...structuredSkills.industry.filter(Boolean)])];
    }
    
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
        technical: technicalSkills,
        soft: softSkills,
        languages: languagesList,
        tools: toolSkills,
        certifications: certifications
    };
    
    logger.info('[RESUME_SERVICE] Skills extraction complete', {
        technicalCount: skills.technical.length,
        softCount: skills.soft.length,
        toolsCount: skills.tools.length,
        languagesCount: skills.languages.length,
        certificationsCount: skills.certifications.length,
        usedStructuredFormat: !!(structuredSkills.technical?.length || structuredSkills.soft?.length)
    });

    // Extract additional sections
    const additionalSections = [];

    // Projects
    if (analysisData.projects && analysisData.projects.length > 0) {
        additionalSections.push({
            id: 'projects',
            title: 'Projects',
            type: 'projects',
            content: analysisData.projects.map((proj, idx) => {
                // Build HTML description from description and highlights
                const descText = proj.description || '';
                const highlights = proj.highlights || [];
                
                let description = '';
                if (descText) {
                    description += `<p>${descText}</p>`;
                }
                if (highlights && highlights.length > 0) {
                    description += '<ul>';
                    highlights.forEach(h => {
                        if (h && h.trim()) {
                            description += `<li>${h}</li>`;
                        }
                    });
                    description += '</ul>';
                }
                
                return {
                    id: `proj_${idx + 1}`,
                    name: proj.name || proj.title || '',
                    description: description,
                    technologies: proj.technologies || proj.tech_stack || [],
                    link: proj.link || proj.url || '',
                    highlights: [],
                    startDate: proj.start_date || proj.startDate || '',
                    endDate: proj.end_date || proj.endDate || ''
                };
            })
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
            content: analysisData.volunteers.map((vol, idx) => {
                // Build HTML description from description and highlights
                const descText = vol.description || '';
                const highlights = vol.highlights || [];
                
                let description = '';
                if (descText) {
                    description += `<p>${descText}</p>`;
                }
                if (highlights && highlights.length > 0) {
                    description += '<ul>';
                    highlights.forEach(h => {
                        if (h && h.trim()) {
                            description += `<li>${h}</li>`;
                        }
                    });
                    description += '</ul>';
                }
                
                return {
                    id: `vol_${idx + 1}`,
                    organization: vol.organization || '',
                    role: vol.role || '',
                    startDate: vol.start_date || vol.startDate || '',
                    endDate: vol.end_date || vol.endDate || '',
                    description: description,
                    highlights: []
                };
            })
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

    // Extract scores - comprehensive score structure for consistent display
    const scores = {
        // Core ATS & Quality Scores
        atsScore: analysisData.resume_quality?.ats_compatibility_score || 0,
        contentScore: analysisData.resume_quality?.content_quality_score || 0,
        formatScore: analysisData.resume_quality?.formatting_design_score || analysisData.resume_quality?.formatting_score || 0,
        overallScore: analysisData.relevance?.['Overall Score'] || analysisData.resume_quality?.overall_quality_score || 0,
        
        // Job Fit & Relevance Scores
        jobFitScore: analysisData.JobFitScore || 0,
        skillsRelevanceScore: analysisData.relevance?.['Skills Relevance'] || 0,
        experienceRelevanceScore: analysisData.relevance?.['Work Experience'] || 0,
        educationRelevanceScore: analysisData.relevance?.['Education'] || 0,
        
        // Additional Quality Scores
        grammarScore: analysisData.resume_quality?.grammar_language_score || 0,
        professionalBrandingScore: analysisData.resume_quality?.professional_branding_score || 0,
        completenessScore: analysisData.resume_quality?.completeness_score || 0
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
 * Extract lightweight analysis summary from AI analysis data
 * Only contains counts and version marker - full analysis is fetched via analysisID
 * @param {Object} analysisData - Raw analysis data from AI
 * @returns {Object} Lightweight analysis summary
 */
function extractAnalysisSummary(analysisData) {
    logger.info('[RESUME_SERVICE] Extracting lightweight analysis summary');
    
    const criticalCount = (analysisData.critical_mistakes || []).length;
    const majorCount = (analysisData.major_issues || []).length;
    const minorCount = (analysisData.minor_improvements || []).length;
    
    const analysisSummary = {
        // Issue counts by severity
        issuesCounts: {
            critical: criticalCount,
            major: majorCount,
            minor: minorCount
        },
        
        // Initial summary message
        improvementSummary: criticalCount > 0 
            ? `Found ${criticalCount} critical issue(s), ${majorCount} major issue(s), and ${minorCount} minor improvement(s)`
            : majorCount > 0
                ? `Found ${majorCount} major issue(s) and ${minorCount} minor improvement(s)`
                : minorCount > 0
                    ? `Found ${minorCount} minor improvement(s)`
                    : 'No significant issues found',
        
        // No score change for initial analysis
        scoreChange: null,
        
        // Version marker
        version: 'initial',
        updatedAt: new Date().toISOString()
    };
    
    logger.info('[RESUME_SERVICE] ✅ Analysis summary extracted', {
        criticalCount,
        majorCount,
        minorCount
    });
    
    return analysisSummary;
}

/**
 * Get resume by ID with full details
 * Returns unified response with content, analysisSummary, rewrites (each with their own summary)
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Resume with theme info and analysis summary
 */
export const getResumeByID = async (contentID, userID, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Fetching resume', { contentID, userID, userType });

        // Get resume content (now includes analysisSummary)
        const content = await resumeModel.getResumeContentByID(contentID, userID, userType);

        // Get applied theme if any
        const theme = await themeModel.getUserTheme(contentID, userID, userType);

        // Get rewrites history (with no pagination to get all rewrites)
        const { rewrites } = await resumeModel.getRewritesByAnalysisID(content.analysisID, userID, {
            pagination: { limit: 100, offset: 0 }, // Get all rewrites for history
            userType
        });

        // Normalize scores from content.currentScores for consistent structure
        const normalizedContentScores = content.currentScores ? {
            atsScore: content.currentScores.atsScore || 0,
            contentScore: content.currentScores.contentScore || 0,
            formatScore: content.currentScores.formatScore || 0,
            overallScore: content.currentScores.overallScore || 0,
            jobFitScore: content.currentScores.jobFitScore || 0,
            skillsRelevanceScore: content.currentScores.skillsRelevanceScore || 0,
            experienceRelevanceScore: content.currentScores.experienceRelevanceScore || 0,
            educationRelevanceScore: content.currentScores.educationRelevanceScore || 0,
            grammarScore: content.currentScores.grammarScore || 0,
            professionalBrandingScore: content.currentScores.professionalBrandingScore || 0,
            completenessScore: content.currentScores.completenessScore || 0
        } : null;

        return {
            content: {
                ...content,
                // Override currentScores with normalized structure
                currentScores: normalizedContentScores
            },
            // Provide analysisSummary at top level for easy access
            // (it's also in content.analysisSummary for completeness)
            analysisSummary: content.analysisSummary || null,
            theme: theme || null,
            // Include rewriteSummary in each rewrite for version switching
            rewrites: rewrites.map(r => {
                // Normalize rewrite scores to match content structure
                const rewriteScores = r.rewrittenContent?.scores || r.rewriteSummary?.scoreComparison?.after || null;
                const normalizedRewriteScores = rewriteScores ? {
                    atsScore: rewriteScores.atsScore || 0,
                    contentScore: rewriteScores.contentScore || 0,
                    formatScore: rewriteScores.formatScore || 0,
                    overallScore: rewriteScores.overallScore || 0,
                    jobFitScore: rewriteScores.jobFitScore || 0,
                    skillsRelevanceScore: rewriteScores.skillsRelevanceScore || 0,
                    experienceRelevanceScore: rewriteScores.experienceRelevanceScore || 0,
                    educationRelevanceScore: rewriteScores.educationRelevanceScore || 0,
                    grammarScore: rewriteScores.grammarScore || 0,
                    professionalBrandingScore: rewriteScores.professionalBrandingScore || 0,
                    completenessScore: rewriteScores.completenessScore || 0
                } : null;

                return {
                    id: r.id,
                    versionNumber: r.versionNumber,
                    versionLabel: r.versionLabel,
                    status: r.status,
                    isActive: r.isActive,
                    // Include normalized scores for this specific rewrite version
                    scores: normalizedRewriteScores,
                    rewriteSummary: r.rewriteSummary || null,
                    improvements: r.improvements || null,
                    createdAt: r.createdAt,
                    completedAt: r.completedAt
                };
            }),
            activeRewriteID: content.activeRewriteID
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch resume', {
            error: error.message,
            contentID,
            userType
        });
        throw error;
    }
};

/**
 * Get resume by analysis ID
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object|null>} Resume or null
 */
export const getResumeByAnalysisID = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const content = await resumeModel.getResumeContentByAnalysisID(analysisID, userID, userType);
        
        if (!content) {
            return null;
        }

        return getResumeByID(content.id, userID, userType);
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch resume by analysis', {
            error: error.message,
            analysisID,
            userType
        });
        throw error;
    }
};

/**
 * Get all resumes for a user
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, search, sort, userType
 * @returns {Promise<Object>} Object with resumes array and totalCount
 */
export const getAllResumes = async (userID, options = {}) => {
    try {
        const { userType = userTypeConstants.USER, ...otherOptions } = options;
        return await resumeModel.getAllResumeContents(userID, { ...otherOptions, userType });
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated section info
 */
export const updateSection = async (contentID, userID, sectionName, sectionData, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Updating section', {
            contentID,
            sectionName,
            userType
        });

        // Validate section data if applicable
        const validatedData = validateSectionData(sectionName, sectionData);

        const updated = await resumeModel.updateResumeSection(
            contentID,
            userID,
            sectionName,
            validatedData,
            userType
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
            sectionName,
            userType
        });
        throw error;
    }
};

/**
 * Update multiple sections at once
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} sectionsData - Object with section names as keys
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated content
 */
export const updateSections = async (contentID, userID, sectionsData, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Updating multiple sections', {
            contentID,
            sections: Object.keys(sectionsData),
            userType
        });

        // Validate each section
        const validatedSections = {};
        for (const [sectionName, data] of Object.entries(sectionsData)) {
            validatedSections[sectionName] = validateSectionData(sectionName, data);
        }

        const updated = await resumeModel.updateMultipleSections(
            contentID,
            userID,
            validatedSections,
            userType
        );

        logger.info('[RESUME_SERVICE] ✅ Sections updated', {
            contentID,
            newVersion: updated.version,
            userType
        });

        return {
            sections: Object.keys(validatedSections),
            version: updated.version,
            updatedAt: updated.updatedAt
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to update sections', {
            error: error.message,
            contentID,
            userType
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
 * Create a new rewrite job based on USER'S optimization prompt
 * 
 * NEW APPROACH: User provides a prompt describing their optimization goal
 * (e.g., "Optimize for a Senior Developer role at a tech startup")
 * We validate the prompt and use it to guide the AI optimization.
 * 
 * If no prompt is provided, defaults to general ATS optimization.
 * Each rewrite works on the CURRENT resume content (which may have been edited or rewritten before).
 * 
 * @param {number} userID - User ID
 * @param {number} analysisID - Analysis ID
 * @param {Object} options - Options including userPrompt and userType
 * @param {string} options.userPrompt - OPTIONAL: User's optimization goal (defaults to ATS optimization)
 * @param {string} options.userType - 'user' | 'candidate'
 * @param {number} options.targetATSScore - Target ATS score (default: 90)
 * @param {string} options.versionLabel - Optional label for this version
 * @returns {Promise<Object>} Created rewrite with job info
 */
export const createRewrite = async (userID, analysisID, options = {}) => {
    try {
        const { 
            userType = userTypeConstants.USER, 
            userPrompt,
            targetATSScore = 90,
            versionLabel,
            creditTransactionID,
            ...otherOptions 
        } = options;
        
        // Default prompt if none provided - general ATS optimization
        const DEFAULT_PROMPT = 'Optimize my resume for the best possible ATS score. Improve content clarity, use strong action verbs, and ensure professional formatting.';
        
        // Use provided prompt or default to ATS optimization
        const effectivePrompt = (userPrompt && typeof userPrompt === 'string' && userPrompt.trim().length > 0)
            ? userPrompt.trim()
            : DEFAULT_PROMPT;
        
        const isDefaultPrompt = effectivePrompt === DEFAULT_PROMPT;
        
        logger.info('[RESUME_SERVICE] Creating rewrite', {
            userID,
            analysisID,
            hasUserPrompt: !!userPrompt,
            usingDefaultPrompt: isDefaultPrompt,
            promptPreview: effectivePrompt.substring(0, 50),
            userType
        });

        // Only validate if user provided a custom prompt
        let sanitizedPrompt = effectivePrompt;
        if (!isDefaultPrompt) {
            const { isValid, sanitizedPrompt: validated, error } = validateOptimizationPrompt(effectivePrompt, {
                throwOnInvalid: false
            });

            if (!isValid) {
                throw new AppError(error || 'Invalid optimization prompt', 400);
            }
            sanitizedPrompt = validated;
        }

        // Get current resume content - this is what AI will optimize
        // IMPORTANT: Always fetches the CURRENT state (may have been rewritten before)
        const content = await resumeModel.getResumeContentByAnalysisID(analysisID, userID, userType);
        
        if (!content) {
            throw new AppError('Resume content not found for this analysis', 404);
        }

        // Build current content object for snapshot
        // This captures the current state BEFORE this rewrite
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

        // Create optimization settings with user prompt
        const optimizationSettings = {
            userPrompt: sanitizedPrompt,
            isDefaultPrompt: isDefaultPrompt,
            targetATSScore: targetATSScore,
            optimizationLevel: isDefaultPrompt ? 'ats-focused' : 'user-driven'
        };

        // Create rewrite record with content snapshot
        const rewrite = await resumeModel.createRewrite(
            userID,
            analysisID,
            content.id,
            currentContent, // Pass current content for snapshot
            {
                versionLabel: versionLabel || (isDefaultPrompt 
                    ? 'ATS Optimized' 
                    : `Optimized: ${sanitizedPrompt.substring(0, 50)}${sanitizedPrompt.length > 50 ? '...' : ''}`),
                optimizationSettings
            },
            userType
        );

        // Add job to queue with current content and user prompt
        // Each rewrite works on CURRENT content - enabling multiple rewrites
        const job = await addResumeRewriteJob({
            rewriteID: rewrite.id,
            analysisID,
            userID,
            resumeContentID: content.id,
            currentContent,  // Current state - may already be rewritten
            userPrompt: sanitizedPrompt,
            isDefaultPrompt: isDefaultPrompt,
            optimizationOptions: optimizationSettings,
            userType,
            creditTransactionID  // Pass credit transaction for confirmation/refund
        });

        // Update rewrite with job ID
        await resumeModel.updateRewrite(rewrite.id, { jobID: job.id }, userType);

        logger.info('[RESUME_SERVICE] ✅ Rewrite job created', {
            rewriteID: rewrite.id,
            jobID: job.id,
            contentVersion: content.version,
            versionNumber: rewrite.versionNumber,
            isDefaultPrompt,
            promptPreview: sanitizedPrompt.substring(0, 50),
            userType
        });

        return {
            id: rewrite.id,
            jobId: job.id,
            versionNumber: rewrite.versionNumber,
            versionLabel: rewrite.versionLabel,
            status: 'pending',
            basedOnVersion: content.version,
            isDefaultOptimization: isDefaultPrompt,
            message: isDefaultPrompt 
                ? 'ATS optimization job created and queued' 
                : 'Rewrite job created and queued'
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Rewrite details
 */
export const getRewrite = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        const rewrite = await resumeModel.getRewriteByID(rewriteID, userID, userType);
        
        return {
            id: rewrite.id,
            status: rewrite.status,
            versionNumber: rewrite.versionNumber,
            versionLabel: rewrite.versionLabel,
            isActive: rewrite.isActive,
            wasModifiedAfterApply: rewrite.wasModifiedAfterApply,
            optimizationSettings: rewrite.optimizationSettings,
            improvements: rewrite.improvements,
            rewriteSummary: rewrite.rewriteSummary,
            rewrittenContent: rewrite.status === 'completed' ? rewrite.rewrittenContent : null,
            theme: rewrite.theme,
            createdAt: rewrite.createdAt,
            completedAt: rewrite.completedAt,
            appliedAt: rewrite.appliedAt
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch rewrite', {
            error: error.message,
            rewriteID,
            userType
        });
        throw error;
    }
};

/**
 * Get all rewrites for an analysis with version status
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, sort, userType
 * @returns {Promise<Object>} Object with rewrites array and totalCount
 */
export const getRewritesByAnalysis = async (analysisID, userID, options = {}) => {
    try {
        const { userType = userTypeConstants.USER, ...otherOptions } = options;
        const { rewrites, totalCount } = await resumeModel.getRewritesByAnalysisID(analysisID, userID, { ...otherOptions, userType });
        
        const formattedRewrites = rewrites.map(r => ({
            id: r.id,
            resumeId: r.resumeContentID,
            analysisId: r.analysisID,
            status: r.status,
            versionNumber: r.versionNumber,
            versionLabel: r.versionLabel,
            isActive: r.isActive,
            wasModifiedAfterApply: r.wasModifiedAfterApply,
            improvements: r.improvements,
            rewriteSummary: r.rewriteSummary,
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
 * Get all rewrites for a user across all resumes/analyses
 * @param {number} userID - User ID
 * @param {Object} options - Options including pagination, filters, sort, userType
 * @returns {Promise<Object>} Object with rewrites array and totalCount
 */
export const getUserRewrites = async (userID, options = {}) => {
    try {
        const { userType = userTypeConstants.USER, ...otherOptions } = options;
        const { rewrites, totalCount } = await resumeModel.getRewritesByUserID(userID, { ...otherOptions, userType });

        const formattedRewrites = rewrites.map(r => ({
            id: r.id,
            resumeId: r.resumeContentID,
            analysisId: r.analysisID,
            status: r.status,
            versionNumber: r.versionNumber,
            versionLabel: r.versionLabel,
            isActive: r.isActive,
            wasModifiedAfterApply: r.wasModifiedAfterApply,
            improvements: r.improvements,
            rewriteSummary: r.rewriteSummary,
            scores: r.rewrittenContent?.scores || null,
            createdAt: r.createdAt,
            completedAt: r.completedAt,
            appliedAt: r.appliedAt
        }));

        return { rewrites: formattedRewrites, totalCount };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to fetch user rewrites', {
            error: error.message,
            userID
        });
        throw error;
    }
};

/**
 * Apply a completed rewrite to resume content
 * @param {number} rewriteID - Rewrite ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated resume content
 */
export const applyRewrite = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Applying rewrite', { rewriteID, userID, userType });

        const updatedContent = await resumeModel.applyRewrite(rewriteID, userID, userType);

        // Get the rewrite details for response (includes theme)
        const rewrite = await resumeModel.getRewriteByID(rewriteID, userID, userType);
        
        // Get the current theme after restoration
        const { getUserTheme } = await import('../models/theme.model.js');
        const currentTheme = await getUserTheme(updatedContent.id, userID, userType);

        logger.info('[RESUME_SERVICE] ✅ Rewrite applied', {
            rewriteID,
            contentID: updatedContent.id,
            newVersion: updatedContent.version,
            versionNumber: rewrite.versionNumber,
            themeRestored: !!currentTheme
        });

        return {
            contentID: updatedContent.id,
            version: updatedContent.version,
            rewrite: {
                id: rewrite.id,
                versionNumber: rewrite.versionNumber,
                versionLabel: rewrite.versionLabel,
                isActive: true,
                theme: rewrite.theme
            },
            theme: currentTheme,
            message: 'Rewrite applied successfully'
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to apply rewrite', {
            error: error.message,
            rewriteID,
            userType
        });
        throw error;
    }
};

/**
 * Switch to a different rewrite version
 * Updates resume content with the selected version's content
 * @param {number} rewriteID - Target rewrite ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Switch result with updated content and version info
 */
export const switchRewriteVersion = async (rewriteID, userID, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Switching rewrite version', { rewriteID, userID, userType });

        const result = await resumeModel.switchRewriteVersion(rewriteID, userID, userType);

        logger.info('[RESUME_SERVICE] ✅ Rewrite version switched', {
            rewriteID,
            versionNumber: result.rewrite.versionNumber,
            contentVersion: result.content.version,
            themeRestored: !!result.theme
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
                analysisSummary: result.content.analysisSummary
            },
            activeRewrite: result.rewrite,
            theme: result.theme,
            message: result.message
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to switch rewrite version', {
            error: error.message,
            rewriteID,
            userType
        });
        throw error;
    }
};

/**
 * Get the currently active rewrite for a resume
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object|null>} Active rewrite info or null
 */
export const getActiveRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        const activeRewrite = await resumeModel.getActiveRewrite(analysisID, userID, userType);
        
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
            rewriteSummary: activeRewrite.rewriteSummary
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to get active rewrite', {
            error: error.message,
            analysisID,
            userType
        });
        throw error;
    }
};

/**
 * Clear active rewrite (revert to manual editing mode)
 * @param {number} analysisID - Analysis ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated content
 */
export const clearActiveRewrite = async (analysisID, userID, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Clearing active rewrite', { analysisID, userID, userType });

        const updatedContent = await resumeModel.clearActiveRewrite(analysisID, userID, userType);

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
            analysisID,
            userType
        });
        throw error;
    }
};

/**
 * Compare two rewrite versions
 * @param {number} rewriteID1 - First rewrite ID
 * @param {number} rewriteID2 - Second rewrite ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Comparison data
 */
export const compareRewriteVersions = async (rewriteID1, rewriteID2, userID, userType = userTypeConstants.USER) => {
    try {
        const [rewrite1, rewrite2] = await Promise.all([
            resumeModel.getRewriteByID(rewriteID1, userID, userType),
            resumeModel.getRewriteByID(rewriteID2, userID, userType)
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
                rewriteSummary: rewrite1.rewriteSummary,
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
                rewriteSummary: rewrite2.rewriteSummary,
                createdAt: rewrite2.createdAt
            }
        };
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to compare rewrites', {
            error: error.message,
            rewriteID1,
            rewriteID2,
            userType
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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Applied theme info
 */
export const applyTheme = async (resumeContentID, userID, themeID, customOverrides = null, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Applying theme', {
            resumeContentID,
            themeID,
            userType
        });

        const userTheme = await themeModel.applyTheme(
            userID,
            resumeContentID,
            themeID,
            customOverrides,
            userType
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
            themeID,
            userType
        });
        throw error;
    }
};

/**
 * Update theme customizations
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {Object} updates - Updates to apply
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated theme info
 */
export const updateThemeConfig = async (resumeContentID, userID, updates, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Updating theme config', {
            resumeContentID,
            userType
        });

        const updated = await themeModel.updateUserTheme(resumeContentID, userID, updates, userType);

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
            resumeContentID,
            userType
        });
        throw error;
    }
};

/**
 * Get resume with applied theme for rendering
 * @param {number} resumeContentID - Resume content ID
 * @param {number} userID - User ID
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Complete resume with theme for rendering
 */
export const getResumeForRender = async (resumeContentID, userID, userType = userTypeConstants.USER) => {
    try {
        const content = await resumeModel.getResumeContentByID(resumeContentID, userID, userType);
        const userTheme = await themeModel.getUserTheme(resumeContentID, userID, userType);

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
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated status
 */
export const publishResume = async (resumeContentID, userID, userType = userTypeConstants.USER) => {
    try {
        const updated = await themeModel.publishResume(resumeContentID, userID, userType);
        
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
 * Optimize resume content using AI based on USER'S prompt
 * Called by the rewrite worker to generate optimized content
 * 
 * NEW USER-DRIVEN APPROACH: 
 * - User provides their optimization goal (role, industry, focus)
 * - AI optimizes the resume directly based on that goal
 * - No dependency on analysis issues - works with current content
 * 
 * @param {Object} currentContent - Current resume content from resumeContentTable
 * @param {string} userPrompt - User's optimization goal/prompt
 * @param {Object} options - Optimization options (targetATSScore, etc.)
 * @returns {Promise<Object>} Optimized content ready for direct application
 */
export const optimizeResumeContent = async (currentContent, userPrompt, options = {}) => {
    try {
        logger.info('[RESUME_SERVICE] Starting user-driven resume optimization', {
            hasCurrentContent: !!currentContent,
            userPrompt: userPrompt?.substring(0, 50),
            targetATSScore: options.targetATSScore,
            options
        });

        // Validate inputs
        if (!currentContent) {
            throw new AppError('Current resume content is required for optimization', 400);
        }

        if (!userPrompt || typeof userPrompt !== 'string') {
            throw new AppError('User optimization prompt is required', 400);
        }

        // Get AI service
        const aiService = await getAiService();

        // Build prompt using the new user-driven approach
        const prompt = getUserDrivenOptimizationPrompt(currentContent, userPrompt, options);
        
        // Get the user-driven system prompt with enhanced preservation rules
        const systemPrompt = `${getUserDrivenSystemPrompt()}

⚠️ CRITICAL DATA PRESERVATION RULES:
1. DATES: Copy startDate, endDate, and current fields EXACTLY as provided - character-for-character
2. COMPANIES: Copy company names, locations EXACTLY - do not change spelling or formatting
3. EXPERIENCE COUNT: Return EXACTLY ${(currentContent?.experience || []).length} experience entries - no more, no less
4. EXPERIENCE IDS: Each experience has an ID field - preserve these EXACTLY as provided
5. FACTUAL INFO: All achievements, projects, and responsibilities in the original MUST be included in the rewrite
6. NO FABRICATION: Do not invent new achievements, metrics, or facts - only reword existing ones

EXPERIENCE DESCRIPTION FORMAT:
- The description field MUST contain HTML bullet points: <ul><li>Achievement 1</li><li>Achievement 2</li></ul>
- Convert ALL existing bullets/achievements from the original into HTML list items
- Always format experience descriptions as bullet points for better readability
- Each bullet should ONLY reword existing achievements from the original description
- Use 3-8 bullet points per experience based on how many exist in the original
- The achievements array should be EMPTY - put all content in description as HTML bullets
- NEVER drop or omit information from the original - ALL points must be included

OUTPUT FORMAT:
- summary: { text: "rewritten summary tailored to user's goal", keywords: [] } (keywords should always be empty array)
- experience: array of { id, company, position, location, startDate, endDate, current, description (HTML with bullets), achievements: [], keywords: [] }
  - id, company, location: MUST BE COPIED EXACTLY FROM INPUT
  - startDate, endDate, current: MUST BE COPIED EXACTLY FROM INPUT - NO CHANGES ALLOWED
  - description: HTML formatted with ALL original bullet points enhanced
- skills: { technical: [], soft: [], tools: [], languages: [], certifications: [] }
- estimatedAtsScore: number (0-100) - your estimate after optimization
- fixesSummary: "Brief description of how resume was optimized for user's goal"

⛔ FORBIDDEN ACTIONS:
- Adding extra experience entries beyond what was provided
- Changing any dates (startDate, endDate)  
- Changing current field from false to true or vice versa
- Inventing new achievements, metrics, or facts
- Adding content that wasn't in the original resume
- Omitting or dropping bullet points/achievements from the original
- Reducing the number of experience entries`;

        // Generate optimization using AI with the simplified schema
        const optimizedContent = await aiService.generateAiResponseObject({
            system: systemPrompt,
            content: prompt,
            schema: resumeContentOutputSchema,
            model: 'gpt-4o-mini',
            retries: 3
        });

        logger.info('[RESUME_SERVICE] User-driven optimization completed', {
            hasSummary: !!optimizedContent?.summary,
            experienceCount: optimizedContent?.experience?.length || 0,
            hasSkills: !!optimizedContent?.skills,
            estimatedAtsScore: optimizedContent?.estimatedAtsScore,
            fixesSummary: optimizedContent?.fixesSummary,
            userPrompt: userPrompt.substring(0, 50)
        });

        // Get original experiences from current content (for ID preservation)
        const originalExperiences = currentContent?.experience || [];
        
        // Post-process experience to ensure critical fields are preserved
        // This is a safety net - ALWAYS use original dates and factual data
        // Only allow AI to change: description, position (enhancement), keywords
        const mergedExperience = (optimizedContent.experience || []).slice(0, originalExperiences.length).map((exp, idx) => {
            const originalExp = originalExperiences[idx] || {};
            
            // Ensure we don't lose description content - use AI's enhanced version, or fall back to original
            let finalDescription = exp.description;
            if (!finalDescription || finalDescription.trim() === '' || finalDescription === '<ul></ul>') {
                // AI returned empty description - keep original
                finalDescription = originalExp.description || '';
                logger.warn('[RESUME_SERVICE] AI returned empty description for experience, keeping original', {
                    idx,
                    company: originalExp.company
                });
            }
            
            return {
                // ALWAYS preserve these fields from original - never use AI values
                id: originalExp.id || exp.id || `exp_${idx + 1}`,
                company: originalExp.company || exp.company,
                location: originalExp.location !== undefined ? originalExp.location : exp.location,
                startDate: originalExp.startDate, // ALWAYS use original - never change dates
                endDate: originalExp.endDate,     // ALWAYS use original - never change dates
                current: originalExp.current,     // ALWAYS use original - never change current status
                website: originalExp.website || exp.website,
                // Allow AI to enhance these fields
                position: exp.position || originalExp.position,
                description: finalDescription,
                achievements: exp.achievements || [],
                keywords: exp.keywords || []
            };
        });

        // Ensure we don't have more experiences than original (AI should not add extras)
        if (optimizedContent.experience?.length > originalExperiences.length) {
            logger.warn('[RESUME_SERVICE] AI returned more experiences than original, trimming to original count', {
                originalCount: originalExperiences.length,
                aiReturnedCount: optimizedContent.experience.length
            });
        }

        logger.info('[RESUME_SERVICE] Experience fields preserved from original', {
            originalCount: originalExperiences.length,
            optimizedCount: mergedExperience.length,
            preservedIds: mergedExperience.map(e => e.id)
        });

        // Get original scores from current content (no longer from analysis)
        const originalScores = currentContent?.currentScores || {};

        const estimatedAtsScore = optimizedContent.estimatedAtsScore || options.targetATSScore || 85;
        
        // Return content in a format ready for direct application
        // CRITICAL: Always preserve original content if AI returns null/empty
        const originalSkills = currentContent?.skills || {};
        const optimizedSkills = optimizedContent.skills || {};
        
        // Merge skills - preserve original if AI didn't return anything
        const mergedSkills = {
            technical: optimizedSkills.technical?.length > 0 ? optimizedSkills.technical : (originalSkills.technical || []),
            soft: optimizedSkills.soft?.length > 0 ? optimizedSkills.soft : (originalSkills.soft || []),
            tools: optimizedSkills.tools?.length > 0 ? optimizedSkills.tools : (originalSkills.tools || []),
            languages: optimizedSkills.languages?.length > 0 ? optimizedSkills.languages : (originalSkills.languages || []),
            certifications: originalSkills.certifications || [] // Always preserve certifications from original
        };
        
        logger.info('[RESUME_SERVICE] Skills merge completed', {
            technicalCount: mergedSkills.technical.length,
            softCount: mergedSkills.soft.length,
            toolsCount: mergedSkills.tools.length,
            languagesCount: mergedSkills.languages.length,
            certificationsPreserved: mergedSkills.certifications.length
        });
        
        return {
            content: {
                // Personal info is preserved from original (not modified by optimization)
                personalInfo: currentContent?.personalInfo || currentContent?.personal_info || null,
                // Ensure keywords are always empty in rewrites
                summary: optimizedContent.summary ? { ...optimizedContent.summary, keywords: [] } : (currentContent?.summary || null),
                // Use merged experience with preserved IDs
                experience: mergedExperience,
                // Education is preserved from original (minimal changes needed)
                education: currentContent?.education || [],
                // Use merged skills that preserve original if AI returned empty
                skills: mergedSkills,
                // Additional sections always preserved from original
                additionalSections: currentContent?.additionalSections || null
            },
            // Scores - AI estimates the new ATS score based on optimization
            scores: {
                // Core ATS & Quality Scores (improved by rewrite)
                atsScore: estimatedAtsScore,
                contentScore: Math.min(95, (originalScores.contentScore || 70) + 15),
                formatScore: Math.min(95, (originalScores.formatScore || 70) + 10),
                overallScore: estimatedAtsScore,
                
                // Preserved or estimated scores
                jobFitScore: originalScores.jobFitScore || 0,
                skillsRelevanceScore: originalScores.skillsRelevanceScore || 0,
                experienceRelevanceScore: originalScores.experienceRelevanceScore || 0,
                educationRelevanceScore: originalScores.educationRelevanceScore || 0,
                
                // Additional Quality Scores (improved by rewrite)
                grammarScore: Math.min(95, (originalScores.grammarScore || 70) + 10),
                professionalBrandingScore: Math.min(95, (originalScores.professionalBrandingScore || 70) + 10),
                completenessScore: originalScores.completenessScore || 0
            },
            metadata: {
                userPrompt: userPrompt,
                fixesSummary: optimizedContent.fixesSummary || `Resume optimized for: ${userPrompt.substring(0, 100)}`,
                timestamp: new Date().toISOString(),
                targetATSScore: options.targetATSScore || 85
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

/**
 * Get example optimization prompts for users
 * @returns {Array<string>} Example prompts
 */
export const getOptimizationExamples = () => {
    return getExamplePrompts();
};

/**
 * Update document title
 * @param {number} contentID - Resume content ID
 * @param {number} userID - User ID
 * @param {string} title - New document title
 * @param {string} userType - 'user' | 'candidate'
 * @returns {Promise<Object>} Updated document info
 */
export const updateTitle = async (contentID, userID, title, userType = userTypeConstants.USER) => {
    try {
        logger.info('[RESUME_SERVICE] Updating document title', {
            contentID,
            title,
            userType
        });

        const updated = await resumeModel.updateDocumentTitle(
            contentID,
            userID,
            title,
            userType
        );

        logger.info('[RESUME_SERVICE] ✅ Document title updated', {
            documentID: updated.id,
            newTitle: updated.title
        });

        return updated;
    } catch (error) {
        logger.error('[RESUME_SERVICE] Failed to update document title', {
            error: error.message,
            contentID,
            userType
        });
        throw error;
    }
};

export default {
    // Content operations
    createResumeFromAnalysis,
    createBlankResume,
    getResumeByID,
    getResumeByAnalysisID,
    getAllResumes,
    updateSection,
    updateSections,
    updateTitle,
    // Rewrite operations
    createRewrite,
    getRewrite,
    getRewritesByAnalysis,
    getUserRewrites,
    applyRewrite,
    switchRewriteVersion,
    getActiveRewrite,
    clearActiveRewrite,
    compareRewriteVersions,
    getOptimizationExamples,
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
