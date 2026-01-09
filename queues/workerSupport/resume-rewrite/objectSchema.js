import { z } from 'zod';

/**
 * Resume Rewrite Object Schemas
 * Zod schemas for AI-generated resume optimization output
 * 
 * SIMPLIFIED APPROACH: Instead of generating a complete resume structure,
 * we apply targeted fixes based on analysis issues. This is more reliable
 * and matches the existing content format.
 */

// ========== SIMPLIFIED FIX-BASED SCHEMA ==========

/**
 * Section Fix Schema
 * Represents a fix applied to a specific section
 */
export const sectionFixSchema = z.object({
    section: z.string().describe('Section name that was fixed (summary, experience, skills, education)'),
    originalText: z.string().describe('Original text that was fixed'),
    fixedText: z.string().describe('The corrected/optimized text'),
    reason: z.string().describe('Brief reason for the fix')
}).describe('A single fix applied to the resume');

/**
 * Optimized Summary Schema
 * Simple structure matching resumeContentTable.summary
 */
export const optimizedSummarySchema = z.object({
    text: z.string().describe('The optimized professional summary (3-4 impactful sentences)'),
    keywords: z.array(z.string()).describe('ATS keywords naturally included')
}).describe('Optimized professional summary');

/**
 * Optimized Experience Entry Schema
 * Matches the structure in resumeContentTable.experience
 */
export const optimizedExperienceSchema = z.object({
    company: z.string().describe('Company name'),
    position: z.string().describe('Job title'),
    location: z.string().nullable().optional().describe('Job location'),
    startDate: z.string().nullable().optional().describe('Start date'),
    endDate: z.string().nullable().optional().describe('End date or Present'),
    current: z.boolean().optional().describe('Is current position'),
    description: z.string().nullable().optional().describe('Role description'),
    achievements: z.array(z.string()).describe('Achievement bullets with STAR format and metrics')
}).describe('Optimized work experience entry');

/**
 * Optimized Skills Schema
 * Matches the structure in resumeContentTable.skills
 */
export const optimizedSkillsSchema = z.object({
    technical: z.array(z.string()).describe('Technical skills'),
    soft: z.array(z.string()).describe('Soft skills'),
    tools: z.array(z.string()).optional().describe('Tools and platforms'),
    languages: z.array(z.string()).optional().describe('Spoken languages'),
    certifications: z.array(z.string()).optional().describe('Certifications')
}).describe('Optimized skills section');

/**
 * Resume Optimization Result Schema
 * This is the main schema - simpler and focused on direct content
 */
export const resumeOptimizationResultSchema = z.object({
    summary: optimizedSummarySchema.describe('Optimized professional summary'),
    experience: z.array(optimizedExperienceSchema).describe('Optimized work experiences with enhanced achievements'),
    skills: optimizedSkillsSchema.describe('Optimized and categorized skills'),
    estimatedAtsScore: z.number().min(0).max(100).describe('Estimated ATS score after optimization (0-100)'),
    fixesSummary: z.string().describe('Brief summary of key improvements made')
}).describe('Optimized resume content ready for direct application');

// Export the main schema for use in the service
export { resumeOptimizationResultSchema as resumeContentOutputSchema };

// ========== LEGACY SCHEMAS (kept for backwards compatibility) ==========

/**
 * Personal Info Schema - matches resumeContentTable.personalInfo
 */
export const personalInfoContentSchema = z.object({
    fullName: z.string().describe('Full name of the candidate'),
    email: z.string().optional().describe('Email address'),
    phone: z.string().optional().describe('Phone number'),
    location: z.string().optional().describe('City, State or Location'),
    linkedin: z.string().optional().describe('LinkedIn profile URL'),
    website: z.string().optional().describe('Personal website or portfolio URL'),
    github: z.string().optional().describe('GitHub profile URL'),
    title: z.string().optional().describe('Professional title/headline')
}).describe('Personal information section');

/**
 * Summary Schema - matches resumeContentTable.summary
 */
export const summaryContentSchema = z.object({
    text: z.string().describe('The professional summary text (3-4 impactful sentences with ATS keywords)'),
    keywords: z.array(z.string()).optional().describe('ATS keywords included in the summary')
}).describe('Professional summary section');

/**
 * Experience Entry Schema - matches resumeContentTable.experience array items
 */
export const experienceEntrySchema = z.object({
    id: z.string().optional().describe('Unique identifier for this experience'),
    company: z.string().describe('Company name'),
    position: z.string().describe('Job title'),
    location: z.string().optional().describe('Job location'),
    startDate: z.string().optional().describe('Start date (e.g., "Jan 2020" or "2020-01")'),
    endDate: z.string().optional().describe('End date or "Present" for current role'),
    current: z.boolean().optional().describe('Whether this is the current position'),
    description: z.string().optional().describe('Brief role description'),
    achievements: z.array(z.string()).describe('3-5 achievement bullets using STAR format with quantifiable metrics'),
    keywords: z.array(z.string()).optional().describe('ATS keywords for this role')
}).describe('Work experience entry');

/**
 * Education Entry Schema - matches resumeContentTable.education array items
 */
export const educationEntrySchema = z.object({
    id: z.string().optional().describe('Unique identifier for this education'),
    institution: z.string().describe('School/University name'),
    degree: z.string().describe('Degree type (e.g., "Bachelor of Science")'),
    field: z.string().describe('Field of study'),
    location: z.string().optional().describe('Institution location'),
    startDate: z.string().optional().describe('Start date'),
    endDate: z.string().optional().describe('Graduation date'),
    gpa: z.string().optional().describe('GPA if notable (3.5+)'),
    honors: z.array(z.string()).optional().describe('Academic honors and distinctions'),
    achievements: z.array(z.string()).optional().describe('Notable academic achievements')
}).describe('Education entry');

/**
 * Skills Schema - matches resumeContentTable.skills
 */
export const skillsContentSchema = z.object({
    technical: z.array(z.string()).describe('Technical skills (programming languages, frameworks, tools)'),
    soft: z.array(z.string()).describe('Soft skills (leadership, communication, problem-solving)'),
    tools: z.array(z.string()).optional().describe('Tools and platforms'),
    languages: z.array(z.string()).optional().describe('Spoken languages with proficiency'),
    certifications: z.array(z.string()).optional().describe('Professional certifications')
}).describe('Skills organized by category');

// ========== LEGACY OPTIMIZATION SCHEMAS (for backwards compatibility) ==========

/**
 * Professional Summary Optimization Schema (LEGACY)
 */
export const professionalSummarySchema = z.object({
    optimized_summary: z.string().describe('The optimized professional summary text (3-4 sentences)'),
    keywords_included: z.array(z.string()).describe('List of ATS keywords naturally incorporated'),
    improvements_made: z.array(z.string()).describe('Specific improvements made to the original summary'),
    character_count: z.number().optional().describe('Character count of the summary'),
    readability_score: z.number().optional().describe('Readability score (optional)')
});

/**
 * Work Experience Optimization Schema
 */
export const workExperienceSchema = z.object({
    optimized_experiences: z.array(z.object({
        position: z.string().describe('Job title'),
        company: z.string().describe('Company name'),
        duration: z.string().optional().describe('Duration of employment'),
        location: z.string().optional().describe('Job location'),
        optimized_description: z.string().describe('Optimized job description/summary'),
        key_achievements: z.array(z.string()).describe('3-5 achievement bullets in STAR format'),
        keywords_added: z.array(z.string()).describe('ATS keywords incorporated'),
        metrics_highlighted: z.array(z.string()).optional().describe('Quantifiable metrics used'),
        improvements_made: z.array(z.string()).describe('List of specific improvements')
    })).describe('Array of optimized work experience entries'),
    overall_improvements: z.array(z.string()).describe('Overall improvements across all experiences'),
    ats_optimization_notes: z.array(z.string()).optional().describe('ATS-specific optimization notes')
});

/**
 * Skills Section Optimization Schema
 */
export const skillsSchema = z.object({
    categorized_skills: z.object({
        technical_skills: z.array(z.string()).describe('Technical skills (programming, frameworks, tools)'),
        soft_skills: z.array(z.string()).describe('Soft skills (leadership, communication)'),
        tools_platforms: z.array(z.string()).describe('Tools and platforms'),
        certifications: z.array(z.string()).optional().describe('Certifications and credentials'),
        industry_knowledge: z.array(z.string()).optional().describe('Industry-specific knowledge')
    }).describe('Skills organized by category'),
    skills_added: z.array(z.object({
        skill: z.string(),
        justification: z.string()
    })).describe('Skills added based on experience analysis'),
    skills_removed: z.array(z.object({
        skill: z.string(),
        reason: z.string()
    })).describe('Skills removed (outdated or irrelevant)'),
    skills_rephrased: z.array(z.object({
        original: z.string(),
        improved: z.string(),
        reason: z.string()
    })).optional().describe('Skills rephrased for better ATS matching'),
    recommendations: z.array(z.string()).describe('Additional recommendations for skills section'),
    ats_keyword_density: z.number().optional().describe('Keyword density score')
});

/**
 * Education Section Optimization Schema
 */
export const educationSchema = z.object({
    optimized_education: z.array(z.object({
        degree: z.string().describe('Degree name (full form)'),
        field: z.string().describe('Field of study'),
        institution: z.string().describe('Institution name'),
        location: z.string().optional().describe('Institution location'),
        graduation_date: z.string().describe('Graduation date or expected'),
        gpa: z.string().optional().describe('GPA (if > 3.5 or recent grad)'),
        honors: z.array(z.string()).optional().describe('Academic honors and achievements'),
        relevant_coursework: z.array(z.string()).optional().describe('Relevant coursework'),
        thesis_project: z.string().optional().describe('Thesis or capstone project')
    })).describe('Optimized education entries'),
    formatting_tips: z.array(z.string()).describe('Formatting recommendations'),
    gpa_strategy: z.string().optional().describe('Whether and how to include GPA'),
    recommendations: z.array(z.string()).describe('Additional recommendations')
});

/**
 * ATS Keywords Schema
 */
export const atsKeywordsSchema = z.object({
    primary_keywords: z.array(z.string()).describe('15-20 high-priority ATS keywords'),
    secondary_keywords: z.array(z.string()).describe('20-30 supporting keywords'),
    action_verbs: z.array(z.string()).describe('15-20 strong action verbs'),
    industry_terms: z.array(z.string()).describe('10-15 industry-specific terms'),
    tools_technologies: z.array(z.string()).describe('10-15 tools and technologies'),
    soft_skills_keywords: z.array(z.string()).describe('10-12 soft skills keywords'),
    placement_strategy: z.object({
        summary: z.array(z.string()).describe('Keywords for professional summary'),
        experience: z.array(z.string()).describe('Keywords for experience section'),
        skills: z.array(z.string()).describe('Keywords for skills section'),
        frequency_guide: z.string().describe('How often to use each keyword category')
    }).describe('Strategic placement recommendations'),
    synonym_alternatives: z.array(z.object({
        keyword: z.string(),
        synonyms: z.array(z.string())
    })).optional().describe('Synonym alternatives for variety'),
    terms_to_avoid: z.array(z.string()).optional().describe('Overused or generic terms to avoid')
});

/**
 * Formatting Recommendations Schema
 */
export const formattingRecommendationsSchema = z.object({
    layout_structure: z.object({
        recommended_layout: z.string().describe('Single-column, multi-column, or hybrid'),
        section_order: z.array(z.string()).describe('Recommended section ordering'),
        header_footer_usage: z.string().describe('Guidelines for headers/footers'),
        white_space_tips: z.array(z.string()).describe('White space and visual hierarchy tips')
    }).describe('Layout and structure recommendations'),
    typography: z.object({
        recommended_fonts: z.array(z.string()).describe('ATS-safe font recommendations'),
        font_sizes: z.object({
            body: z.string(),
            headings: z.string(),
            name: z.string()
        }).describe('Font size recommendations'),
        formatting_usage: z.array(z.string()).describe('When to use bold, italic, underline')
    }).describe('Typography recommendations'),
    section_headers: z.object({
        recommended_headers: z.array(z.string()).describe('ATS-recognized section header names'),
        headers_to_avoid: z.array(z.string()).optional().describe('Creative headers that confuse ATS'),
        consistency_tips: z.array(z.string()).describe('Consistency recommendations')
    }).describe('Section header recommendations'),
    bullet_points: z.object({
        recommended_style: z.string().describe('Bullet point style recommendation'),
        spacing_guidelines: z.array(z.string()).describe('Spacing and indentation'),
        nested_lists_warning: z.string().optional().describe('Warning about nested lists')
    }).describe('Bullet point and list recommendations'),
    file_format: z.object({
        recommended_format: z.string().describe('PDF or DOCX recommendation'),
        format_rationale: z.string().describe('Reasoning for format recommendation'),
        text_selectability: z.string().describe('Ensuring text is selectable'),
        image_warnings: z.array(z.string()).describe('Warnings about images and graphics')
    }).describe('File format guidance'),
    ats_pitfalls: z.array(z.object({
        pitfall: z.string(),
        why_problematic: z.string(),
        alternative: z.string()
    })).describe('Common ATS pitfalls to avoid'),
    length_recommendations: z.object({
        ideal_page_count: z.string().describe('1-page or 2-page recommendation'),
        content_density: z.string().describe('How much content per page'),
        rationale: z.string().describe('Reasoning based on experience level')
    }).describe('Resume length recommendations'),
    ats_compatibility_checklist: z.array(z.string()).describe('Final ATS compatibility checklist')
});

/**
 * Complete Resume Optimization Result Schema
 * This is the main schema that encompasses all optimization sections
 */
export const completeResumeOptimizationSchema = z.object({
    professional_summary: professionalSummarySchema.optional(),
    work_experience: workExperienceSchema.optional(),
    skills: skillsSchema.optional(),
    education: educationSchema.optional(),
    ats_keywords: atsKeywordsSchema.optional(),
    formatting_recommendations: formattingRecommendationsSchema,
    overall_improvements: z.object({
        critical_fixes: z.number().describe('Number of critical issues fixed'),
        major_fixes: z.number().describe('Number of major improvements'),
        minor_fixes: z.number().describe('Number of minor enhancements'),
        estimated_score_improvement: z.object({
            current: z.object({
                overall: z.number(),
                ats: z.number(),
                jobFit: z.number()
            }),
            projected: z.object({
                overall: z.number(),
                ats: z.number(),
                jobFit: z.number()
            }),
            delta: z.object({
                overall: z.number(),
                ats: z.number(),
                jobFit: z.number()
            })
        }).describe('Score improvement estimates')
    }).describe('Summary of overall improvements'),
    metadata: z.object({
        optimization_level: z.string().describe('basic, moderate, or comprehensive'),
        timestamp: z.string().describe('ISO timestamp of optimization'),
        sections_optimized: z.array(z.string()).describe('List of sections optimized'),
        target_ats_score: z.number().describe('Target ATS score requested')
    }).describe('Metadata about the optimization')
});

/**
 * Simplified schema for individual section optimization
 * Used when optimizing sections one at a time
 */
export const sectionOptimizationSchema = z.object({
    section_name: z.string().describe('Name of the section being optimized'),
    optimized_content: z.any().describe('The optimized content for this section'),
    improvements_made: z.array(z.string()).describe('List of improvements'),
    keywords_added: z.array(z.string()).describe('ATS keywords added'),
    recommendations: z.array(z.string()).describe('Additional recommendations')
});

export default {
    // New content-compatible schemas (recommended for direct apply)
    optimizedSummarySchema,
    optimizedExperienceSchema,
    optimizedSkillsSchema,
    resumeOptimizationResultSchema,
    resumeContentOutputSchema: resumeOptimizationResultSchema, // Alias for backwards compatibility
    // Legacy schemas
    personalInfoContentSchema,
    summaryContentSchema,
    experienceEntrySchema,
    educationEntrySchema,
    skillsContentSchema,
    professionalSummarySchema,
    workExperienceSchema,
    skillsSchema,
    educationSchema,
    atsKeywordsSchema,
    formattingRecommendationsSchema,
    completeResumeOptimizationSchema,
    sectionOptimizationSchema
};
