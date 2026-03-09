import { z } from "zod";

/**
 * Focused Scoring & Analysis Schema
 * 
 * This schema handles ONLY scoring, analysis, and improvement fields.
 * It does NOT include personal info, experiences, education, etc. (those come from parsing).
 * This is Step 2 of the multi-step analysis pipeline.
 */

export const scoringSchema = z.object({
    // Relevance scoring
    relevance: z.object({
        "Skills Relevance": z.number().min(0).max(100).default(50).describe("Skills score 0-100."),
        "Match": z.boolean().default(false).describe("Profile match."),
        "Work Experience": z.number().min(0).max(100).default(50).describe("Experience score 0-100."),
        "Education": z.number().min(0).max(100).default(50).describe("Education score 0-100."),
        "Achievements": z.number().min(0).max(100).default(50).describe("Achievements score 0-100."),
        "Career Progression": z.number().min(0).max(100).default(50).describe("Career score 0-100."),
        "Work History": z.number().min(0).max(100).default(50).describe("Work history score 0-100."),
        "Depth and Breadth": z.number().min(0).max(100).default(50).describe("Depth score 0-100."),
        "Quantifiable Metrics": z.number().min(0).max(100).default(50).describe("Metrics score 0-100."),
        "Qualifications": z.number().min(0).max(100).default(50).describe("Qualifications score 0-100."),
        "Involvement": z.number().min(0).max(100).default(50).describe("Involvement score 0-100."),
        "Keywords": z.number().min(0).max(100).default(50).describe("Keywords score 0-100."),
        "Overall Score": z.number().min(0).max(100).default(50).describe("Overall score 0-100."),
        "Strengths": z.string().default("General resume strengths").describe("Strengths text."),
        "Weaknesses": z.string().default("General areas for improvement").describe("Weaknesses text."),
        "Description": z.string().default("Resume analysis summary").describe("Full assessment description.")
    }).default({}).describe("Relevance scoring and assessment."),

    JobFitScore: z.number().min(0).max(100).default(50).describe("Job fit score 0-100."),
    jobFitReason: z.string().default("Standard candidate profile").describe("Job fit reasoning."),

    // Resume Quality
    resume_quality: z.object({
        grammar_language_score: z.number().min(0).max(100).default(70).describe("Grammar score 0-100."),
        formatting_design_score: z.number().min(0).max(100).default(70).describe("Formatting score 0-100."),
        content_quality_score: z.number().min(0).max(100).default(70).describe("Content quality score 0-100."),
        ats_compatibility_score: z.number().min(0).max(100).default(70).describe("ATS score 0-100."),
        professional_branding_score: z.number().min(0).max(100).default(70).describe("Branding score 0-100."),
        completeness_score: z.number().min(0).max(100).default(70).describe("Completeness score 0-100."),
        overall_quality_score: z.number().min(0).max(100).default(70).describe("Overall quality score 0-100."),
        current_quality: z.number().min(0).max(100).default(70).describe("Current quality."),
        potential_after_fixes: z.number().min(0).max(100).default(80).describe("Potential after fixes."),
        improvement_points: z.number().min(0).max(100).default(10).describe("Expected improvement.")
    }).default({}).describe("Resume quality scores."),

    // Weak Bullet Rewrites
    weak_bullet_rewrites: z.array(z.object({
        experience_company: z.string().default("").describe("Company name."),
        original_bullet: z.string().default("").describe("Original weak bullet text."),
        problem: z.string().default("").describe("What's wrong."),
        rewritten_bullet: z.string().default("").describe("Improved version."),
        improvement_reason: z.string().default("").describe("Why the rewrite is better.")
    })).default([]).describe("5-10 weakest bullet points with rewrites."),

    // Missing Skills
    missing_skills_analysis: z.object({
        inferred_target_role: z.string().default("").describe("Inferred target role."),
        skills_they_have: z.array(z.string()).default([]).describe("Skills matching target."),
        critical_missing_skills: z.array(z.string()).default([]).describe("Must-have missing skills."),
        nice_to_have_missing: z.array(z.string()).default([]).describe("Nice-to-have missing skills."),
        hidden_skills: z.array(z.string()).default([]).describe("Skills in experience but not skills section."),
        outdated_skills: z.array(z.string()).default([]).describe("Outdated skills."),
        skill_gap_severity: z.enum(["MINOR", "MODERATE", "SIGNIFICANT", "CRITICAL"]).default("MODERATE").describe("Gap severity."),
        recommendations: z.array(z.string()).default([]).describe("Actions to close gap.")
    }).default({}).describe("Skills gap analysis."),

    // ATS Keyword Analysis
    ats_keyword_analysis: z.object({
        ats_score: z.number().min(0).max(100).default(50).describe("ATS score 0-100."),
        keywords_found: z.array(z.string()).default([]).describe("Keywords present."),
        keywords_missing: z.array(z.string()).default([]).describe("Keywords missing."),
        keyword_stuffing: z.array(z.string()).default([]).describe("Overused keywords."),
        ats_parsing_issues: z.array(z.string()).default([]).describe("Parsing issues."),
        ats_recommendations: z.array(z.string()).default([]).describe("ATS fixes.")
    }).default({}).describe("ATS keyword analysis."),

    // First Impression
    first_impression: z.object({
        would_pass_6_second_test: z.boolean().default(false).describe("Would recruiter continue reading?"),
        value_proposition_clear: z.boolean().default(false).describe("Is value proposition clear?"),
        biggest_first_impression_issue: z.string().default("").describe("#1 issue."),
        what_recruiter_sees_first: z.string().default("").describe("What stands out first."),
        what_should_stand_out: z.string().default("").describe("What should stand out."),
        first_impression_score: z.number().min(0).max(100).default(50).describe("First impression score.")
    }).default({}).describe("6-second test analysis."),

    // Critical Mistakes
    critical_mistakes: z.array(z.object({
        category: z.string().default("General").describe("Category."),
        section: z.string().default("Resume").describe("Section."),
        current_text: z.string().default("").describe("Current text."),
        issue: z.string().default("").describe("Why problematic."),
        fix: z.string().default("").describe("Fix."),
        priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM").describe("Priority."),
        impact: z.string().default("").describe("Impact.")
    })).default([]).describe("Critical errors. 5-10 items."),

    // Major Issues
    major_issues: z.array(z.object({
        category: z.string().default("General").describe("Category."),
        section: z.string().default("Resume").describe("Section."),
        current_text: z.string().default("").describe("Current text."),
        issue: z.string().default("").describe("Why problematic."),
        fix: z.string().default("").describe("Fix."),
        priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM").describe("Priority."),
        impact: z.string().default("").describe("Impact.")
    })).default([]).describe("Major issues. 5-15 items."),

    // Minor Improvements
    minor_improvements: z.array(z.object({
        category: z.string().default("General").describe("Category."),
        section: z.string().default("Resume").describe("Section."),
        current_text: z.string().default("").describe("Current text."),
        suggestion: z.string().default("").describe("Suggestion."),
        expected_benefit: z.string().default("").describe("Benefit.")
    })).default([]).describe("Minor improvements. 10-20 items."),

    // Optimization Opportunities
    optimization_opportunities: z.array(z.object({
        category: z.string().default("General").describe("Category."),
        description: z.string().default("").describe("Description."),
        implementation: z.string().default("").describe("How to implement."),
        competitive_advantage: z.string().default("").describe("Advantage.")
    })).default([]).describe("Optimization opportunities. 5-10 items."),

    // Improvement Plan
    improvement_plan: z.object({
        immediate_fixes: z.array(z.object({
            task: z.string().default("Review resume").describe("Task."),
            estimated_time: z.string().default("30 minutes").describe("Time estimate."),
            priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
        })).default([]).describe("Today's fixes."),
        short_term_improvements: z.array(z.object({
            task: z.string().default("Enhance content").describe("Task."),
            estimated_time: z.string().default("1 hour").describe("Time estimate."),
            priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
        })).default([]).describe("This week's improvements."),
        medium_term_enhancements: z.array(z.object({
            task: z.string().default("Build portfolio").describe("Task."),
            estimated_time: z.string().default("1 week").describe("Time estimate."),
            priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
        })).default([]).describe("This month's enhancements."),
        long_term_positioning: z.array(z.object({
            goal: z.string().default("Career growth").describe("Goal."),
            strategy: z.string().default("Continuous learning").describe("Strategy."),
            timeline: z.string().default("6-12 months").describe("Timeline.")
        })).default([]).describe("Long-term goals.")
    }).default({}).describe("Improvement roadmap."),

    // Impact Analysis
    impact_analysis: z.object({
        current_interview_rate: z.number().min(0).max(100).default(50).describe("Current interview rate %."),
        after_critical_fixes: z.number().min(0).max(100).default(60).describe("Rate after fixes %."),
        after_all_improvements: z.number().min(0).max(100).default(75).describe("Rate after all improvements %."),
        recruiter_time_to_reject: z.string().default("2-3 minutes").describe("Time before rejection."),
        current_ats_pass_rate: z.number().min(0).max(100).default(50).describe("Current ATS pass %."),
        optimized_ats_pass_rate: z.number().min(0).max(100).default(75).describe("Optimized ATS pass %."),
        competitive_ranking: z.string().default("Average").describe("Current ranking."),
        expected_ranking_improvement: z.string().default("Above Average").describe("Expected ranking.")
    }).default({}).describe("Impact analysis."),

    // Personality Assessment
    personality_job_fit: z.object({
        candidate_traits: z.object({
            realistic: z.boolean().default(false),
            investigative: z.boolean().default(false),
            artistic: z.boolean().default(false),
            social: z.boolean().default(false),
            enterprising: z.boolean().default(false),
            conventional: z.boolean().default(false)
        }).default({
            realistic: false, investigative: false, artistic: false,
            social: false, enterprising: false, conventional: false
        }).describe("RIASEC traits."),
        intelligence_types: z.object({
            linguistic: z.boolean().default(false),
            logical_mathematical: z.boolean().default(false),
            musical: z.boolean().default(false),
            bodily_kinesthetic: z.boolean().default(false),
            spatial: z.boolean().default(false),
            interpersonal: z.boolean().default(false),
            intrapersonal: z.boolean().default(false),
            naturalistic: z.boolean().default(false)
        }).default({
            linguistic: false, logical_mathematical: false, musical: false,
            bodily_kinesthetic: false, spatial: false, interpersonal: false,
            intrapersonal: false, naturalistic: false
        }).describe("Gardner's MI."),
        personality_type: z.string().default("").describe("Personality type."),
        secondary_alignment: z.string().default("").describe("Secondary alignment."),
        personality_description: z.string().default("").describe("Personality description."),
        tags: z.array(z.string()).default([]).describe("Tags.")
    }).default({}).describe("Personality assessment.")
});

export default { scoringSchema };
