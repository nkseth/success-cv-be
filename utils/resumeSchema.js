/**
 * Resume Data Schema
 * Defines the structure for parsed resume data
 */

/**
 * Validate and structure resume data
 * @param {Object} data - Raw resume data
 * @returns {Object} Validated resume data
 */
export function validateResumeData(data) {
    const resume = {
        personal_info: {
            name: data.personal_info?.name || null,
            email: data.personal_info?.email || null,
            phone: data.personal_info?.phone || null,
            location: data.personal_info?.location || null,
            linkedin: data.personal_info?.linkedin || null,
            portfolio: data.personal_info?.portfolio || null
        },
        
        summary: data.summary || data.career_summary?.summary || null,
        
        experience: (data.experiences || data.experience || []).map(exp => ({
            position: exp.position || exp.title || null,
            company: exp.company || null,
            duration: exp.duration || null,
            startDate: exp.startDate || exp.start_date || null,
            endDate: exp.endDate || exp.end_date || null,
            description: exp.description || exp.responsibilities || null,
            achievements: exp.achievements || []
        })),
        
        education: (data.education || []).map(edu => ({
            degree: edu.degree || null,
            field: edu.field || edu.field_of_study || null,
            institution: edu.institution || edu.school || null,
            year: edu.year || edu.graduation_year || null,
            gpa: edu.gpa || null
        })),
        
        skills: Array.isArray(data.skills) ? data.skills : [],
        
        certifications: (data.certifications || []).map(cert => ({
            name: cert.name || cert.title || null,
            issuer: cert.issuer || cert.organization || null,
            date: cert.date || cert.issue_date || null,
            expiryDate: cert.expiryDate || cert.expiry_date || null
        })),
        
        languages: (data.languages || []).map(lang => ({
            language: lang.language || lang.name || null,
            proficiency: lang.proficiency || lang.level || null
        })),
        
        projects: (data.projects || []).map(proj => ({
            name: proj.name || proj.title || null,
            description: proj.description || null,
            technologies: proj.technologies || [],
            url: proj.url || proj.link || null
        })),
        
        // Scoring and analysis
        ats_score: data.ats_score || data.atsScore || 0,
        job_fit_score: data.job_fit_score || data.jobFitScore || 0,
        completeness_score: data.completeness_score || data.completenessScore || 0,
        
        // Metadata
        total_experience_years: data.total_experience_years || 
                               data.career_summary?.total_work_experience_years || 
                               calculateExperienceYears(data.experiences || []),
        
        current_position: data.experiences?.[0]?.position || null,
        current_company: data.experiences?.[0]?.company || null,
        
        // Analysis insights
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        suggestions: data.suggestions || [],
        
        // Risk assessment
        risk_status: data.risk_status || data.riskStatus || 'UNKNOWN',
        risk_reason: data.risk_reason || data.riskReason || null
    };
    
    return resume;
}

/**
 * Calculate total years of experience from experience array
 * @param {Array} experiences - Array of experience objects
 * @returns {number} Total years of experience
 */
function calculateExperienceYears(experiences) {
    if (!Array.isArray(experiences) || experiences.length === 0) {
        return 0;
    }
    
    // Simple calculation: count entries (each assumed to be ~2 years on average)
    // For more accurate calculation, you'd parse dates
    return experiences.length * 2;
}

/**
 * Validate if data looks like a resume
 * @param {Object} data - Parsed data
 * @returns {boolean} True if it appears to be a resume
 */
export function isValidResume(data) {
    const hasPersonalInfo = data.personal_info?.name || data.personal_info?.email;
    const hasExperience = Array.isArray(data.experiences) && data.experiences.length > 0;
    const hasEducation = Array.isArray(data.education) && data.education.length > 0;
    const hasSkills = Array.isArray(data.skills) && data.skills.length > 0;
    
    // Resume should have at least personal info and one of: experience, education, or skills
    return hasPersonalInfo && (hasExperience || hasEducation || hasSkills);
}

/**
 * Validate email from resume
 * @param {Object} resumeData - Resume data
 * @returns {string|null} Validated email or null
 */
export function extractEmail(resumeData) {
    const email = resumeData.personal_info?.email;
    
    if (!email || typeof email !== 'string') {
        return null;
    }
    
    const trimmedEmail = email.trim();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
        return null;
    }
    
    return trimmedEmail;
}

/**
 * Validate if resume content has sufficient details for analysis
 * Used for manual/blank resumes before triggering AI analysis
 * 
 * @param {Object} resumeContent - Resume content object with sections
 * @returns {Object} { isValid: boolean, missingFields: string[], message: string }
 */
export function validateResumeForAnalysis(resumeContent) {
    const missingFields = [];
    const warnings = [];
    
    // Check personalInfo section
    const personalInfo = resumeContent.personalInfo || resumeContent.personal_info || {};
    const hasName = personalInfo.fullName?.trim() || personalInfo.name?.trim();
    const hasEmail = personalInfo.email?.trim();
    
    if (!hasName && !hasEmail) {
        missingFields.push('Personal Info: Please add your name or email address');
    } else {
        if (!hasName) {
            warnings.push('Consider adding your full name to personal info');
        }
        if (!hasEmail) {
            warnings.push('Consider adding your email address to personal info');
        }
    }
    
    // Check for at least one substantive section
    const experience = resumeContent.experience || [];
    const education = resumeContent.education || [];
    const skills = resumeContent.skills || {};
    
    // Check experience section - need at least one entry with company AND position
    const hasValidExperience = Array.isArray(experience) && experience.some(exp => 
        (exp.company?.trim() || exp.organisation?.trim()) && 
        (exp.position?.trim() || exp.title?.trim() || exp.role?.trim())
    );
    
    // Check education section - need at least one entry with institution AND degree/field
    const hasValidEducation = Array.isArray(education) && education.some(edu =>
        (edu.institution?.trim() || edu.school?.trim()) &&
        (edu.degree?.trim() || edu.field?.trim() || edu.area?.trim())
    );
    
    // Check skills section - need at least some skills
    const technicalSkills = skills.technical || [];
    const softSkills = skills.soft || [];
    const toolsSkills = skills.tools || [];
    const allSkills = [...technicalSkills, ...softSkills, ...toolsSkills];
    const hasValidSkills = allSkills.length >= 3; // At least 3 skills
    
    // Must have at least one substantive section
    if (!hasValidExperience && !hasValidEducation && !hasValidSkills) {
        missingFields.push('Content: Please add at least one of the following:');
        missingFields.push('  • Work Experience (with company and position)');
        missingFields.push('  • Education (with institution and degree/field)');
        missingFields.push('  • Skills (at least 3 skills)');
    }
    
    // Build response
    const isValid = missingFields.length === 0;
    
    let message;
    if (isValid) {
        message = 'Resume has sufficient content for analysis';
    } else {
        message = 'Please add more details to your resume before analysis:\n' + missingFields.join('\n');
    }
    
    return {
        isValid,
        missingFields,
        warnings,
        message,
        // Include details for frontend display
        details: {
            hasPersonalInfo: hasName || hasEmail,
            hasName: !!hasName,
            hasEmail: !!hasEmail,
            hasExperience: hasValidExperience,
            experienceCount: experience.length,
            hasEducation: hasValidEducation,
            educationCount: education.length,
            hasSkills: hasValidSkills,
            skillsCount: allSkills.length
        }
    };
}

/**
 * Convert structured resume content to text format for AI analysis
 * Used when analyzing manually-created resumes (no file to extract from)
 * 
 * @param {Object} resumeContent - Structured resume content
 * @returns {string} Text representation of the resume
 */
export function resumeContentToText(resumeContent) {
    const sections = [];
    
    // Personal Info
    const personalInfo = resumeContent.personalInfo || resumeContent.personal_info || {};
    if (Object.keys(personalInfo).length > 0) {
        const personalLines = [];
        if (personalInfo.fullName || personalInfo.name) {
            personalLines.push(personalInfo.fullName || personalInfo.name);
        }
        if (personalInfo.email) personalLines.push(`Email: ${personalInfo.email}`);
        if (personalInfo.phone) personalLines.push(`Phone: ${personalInfo.phone}`);
        if (personalInfo.location) personalLines.push(`Location: ${personalInfo.location}`);
        if (personalInfo.linkedin) personalLines.push(`LinkedIn: ${personalInfo.linkedin}`);
        if (personalInfo.github) personalLines.push(`GitHub: ${personalInfo.github}`);
        if (personalInfo.website || personalInfo.portfolio) {
            personalLines.push(`Website: ${personalInfo.website || personalInfo.portfolio}`);
        }
        
        if (personalLines.length > 0) {
            sections.push('CONTACT INFORMATION\n' + personalLines.join('\n'));
        }
    }
    
    // Summary
    const summary = resumeContent.summary || {};
    if (summary.text?.trim()) {
        sections.push('PROFESSIONAL SUMMARY\n' + summary.text);
    }
    
    // Experience
    const experience = resumeContent.experience || [];
    if (experience.length > 0) {
        const expLines = experience.map(exp => {
            const lines = [];
            const title = exp.position || exp.title || exp.role || 'Position';
            const company = exp.company || exp.organisation || 'Company';
            lines.push(`${title} at ${company}`);
            
            if (exp.location) lines.push(`Location: ${exp.location}`);
            
            const startDate = exp.startDate || exp.start_date || '';
            const endDate = exp.current ? 'Present' : (exp.endDate || exp.end_date || '');
            if (startDate || endDate) {
                lines.push(`Duration: ${startDate} - ${endDate}`);
            }
            
            if (exp.description?.trim()) {
                lines.push(exp.description);
            }
            
            if (exp.achievements?.length > 0) {
                lines.push('Achievements:');
                exp.achievements.forEach(a => lines.push(`• ${a}`));
            }
            
            if (exp.highlights?.length > 0) {
                lines.push('Highlights:');
                exp.highlights.forEach(h => lines.push(`• ${h}`));
            }
            
            return lines.join('\n');
        });
        
        sections.push('WORK EXPERIENCE\n' + expLines.join('\n\n'));
    }
    
    // Education
    const education = resumeContent.education || [];
    if (education.length > 0) {
        const eduLines = education.map(edu => {
            const lines = [];
            const degree = edu.degree || '';
            const field = edu.field || edu.area || '';
            const institution = edu.institution || edu.school || '';
            
            if (degree || field) {
                lines.push(`${degree}${degree && field ? ' in ' : ''}${field}`);
            }
            if (institution) lines.push(institution);
            if (edu.location) lines.push(`Location: ${edu.location}`);
            
            const startDate = edu.startDate || edu.start_date || '';
            const endDate = edu.endDate || edu.end_date || '';
            if (startDate || endDate) {
                lines.push(`Duration: ${startDate} - ${endDate}`);
            }
            
            if (edu.gpa) lines.push(`GPA: ${edu.gpa}`);
            
            if (edu.honors?.length > 0) {
                lines.push('Honors: ' + edu.honors.join(', '));
            }
            
            if (edu.achievements?.length > 0) {
                edu.achievements.forEach(a => lines.push(`• ${a}`));
            }
            
            return lines.join('\n');
        });
        
        sections.push('EDUCATION\n' + eduLines.join('\n\n'));
    }
    
    // Skills
    const skills = resumeContent.skills || {};
    const skillLines = [];
    
    if (skills.technical?.length > 0) {
        skillLines.push('Technical Skills: ' + skills.technical.join(', '));
    }
    if (skills.soft?.length > 0) {
        skillLines.push('Soft Skills: ' + skills.soft.join(', '));
    }
    if (skills.tools?.length > 0) {
        skillLines.push('Tools: ' + skills.tools.join(', '));
    }
    if (skills.languages?.length > 0) {
        const langStrings = skills.languages.map(l => 
            typeof l === 'string' ? l : `${l.name || l.language} (${l.proficiency || l.level || 'Fluent'})`
        );
        skillLines.push('Languages: ' + langStrings.join(', '));
    }
    if (skills.certifications?.length > 0) {
        const certStrings = skills.certifications.map(c => 
            typeof c === 'string' ? c : `${c.name} (${c.authority || c.issuer || 'Certified'})`
        );
        skillLines.push('Certifications: ' + certStrings.join(', '));
    }
    
    if (skillLines.length > 0) {
        sections.push('SKILLS\n' + skillLines.join('\n'));
    }
    
    // Additional Sections (projects, awards, publications, etc.)
    const additionalSections = resumeContent.additionalSections || [];
    for (const section of additionalSections) {
        if (!section.type || !section.items?.length) continue;
        
        const sectionTitle = section.type.toUpperCase().replace('_', ' ');
        const itemLines = section.items.map(item => {
            if (typeof item === 'string') return `• ${item}`;
            
            const lines = [];
            if (item.title || item.name) lines.push(item.title || item.name);
            if (item.description) lines.push(item.description);
            if (item.highlights?.length > 0) {
                item.highlights.forEach(h => lines.push(`• ${h}`));
            }
            return lines.join('\n');
        });
        
        sections.push(`${sectionTitle}\n` + itemLines.join('\n\n'));
    }
    
    return sections.join('\n\n---\n\n');
}

export default {
    validateResumeData,
    isValidResume,
    extractEmail,
    validateResumeForAnalysis,
    resumeContentToText
};
