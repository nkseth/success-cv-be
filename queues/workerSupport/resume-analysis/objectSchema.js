import { z } from "zod";

// Simplified schema for better AI generation success
const JobFit = ["MAYBE", "FIT", "UNFIT"];

// More flexible schema with many optional fields and defaults for resilient parsing
export const candidateSchemaSimplified = z.object({
  personal_info: z.object({
    name: z.string().default("").describe("Full name of the candidate. Required."),
    email: z.string().default("").describe("Email address. Extract from contact section. If not present, use empty string."),
    phone: z.string().default("").describe("Phone number with country code. If not present, use empty string."),
    address: z.string().default("").describe("Full address/location including city, state, country, zip. If not present, use empty string."),
    summary: z.string().default("").describe("Professional summary/objective from resume header. Extract the entire professional summary text. If not present, use empty string."),
    linkedin: z.string().default("").describe("LinkedIn profile URL. Extract from contact or social section. If not present, use empty string."),
    github: z.string().default("").describe("GitHub profile URL. Extract from contact or social section. If not present, use empty string."),
    website: z.string().default("").describe("Personal website or portfolio URL. If not present, use empty string."),
    portfolio: z.string().default("").describe("Portfolio URL if different from website. If not present, use empty string.")
  }),

  experiences: z.array(z.object({
    company: z.string().default("").describe("Company name. If not present, use empty string."),
    position: z.string().default("").describe("Position/job title. If not present, use empty string."),
    location: z.string().default("").describe("Location. If not present, use empty string."),
    website: z.string().default("").describe("Website. If not present, use empty string."),
    start_date: z.string().default("").describe("Start date in YYYY-MM-DD format. If not present, use empty string."),
    end_date: z.string().default("").describe("End date in YYYY-MM-DD format. Use 'Present' if currently working here. If not present, use empty string."),
    summary: z.string().default("").describe("BRIEF role overview sentence ONLY if resume has a separate paragraph description (not bullet points). Leave EMPTY if the experience section only has bullet points. NEVER put bullet point content here."),
    highlights: z.array(z.string()).default([]).describe("CRITICAL: Extract ALL bullet points, achievements, responsibilities, and accomplishments from this experience entry. EVERY single bullet point or listed item MUST be included here. Do NOT put any bullet point content in summary - ALL bullet content goes here. Each array item = one bullet point.")
  })).default([]).describe("Work experiences. Extract ALL experiences from the resume. If no experience, use empty array."),

  education: z.array(z.object({
    institution: z.string().default("").describe("Institution. If not present, use empty string."),
    area: z.string().default("").describe("Field of study. If not present, use empty string."),
    study_type: z.string().default("").describe("Degree type. If not present, use empty string."),
    location: z.string().default("").describe("Location. If not present, use empty string."),
    start_date: z.string().default("").describe("Start date. If not present, use empty string."),
    end_date: z.string().default("").describe("End date. If not present, use empty string."),
    gpa: z.string().default("").describe("GPA. If not present, use empty string."),
    honors: z.array(z.string()).default([]).describe("Honors and awards. If none, use empty array."),
    achievements: z.array(z.string()).default([]).describe("Achievements. If none, use empty array.")
  })).default([]).describe("Education. If no education, use empty array."),

  social: z.array(z.object({
    name: z.string().default("").describe("Platform name (e.g., 'LinkedIn', 'GitHub', 'Twitter', 'Portfolio', 'Personal Website', 'Behance', 'Dribbble'). If not present, use empty string."),
    url: z.string().default("").describe("Full URL to the profile. If not present, use empty string.")
  })).default([]).describe("ALL social profiles and links from the resume. Extract LinkedIn, GitHub, Twitter, personal websites, portfolio links, etc. If none found, use empty array."),

  certificates: z.array(z.object({
    name: z.string().default("").describe("Certificate name. If not present, use empty string."),
    authority: z.string().default("").describe("Authority. If not present, use empty string."),
    certification_id: z.string().default("").describe("ID. If not present, use empty string."),
    start_date: z.string().default("").describe("Start date. If not present, use empty string."),
    end_date: z.string().default("").describe("End date. If not present, use empty string.")
  })).default([]).describe("Certificates. If none, use empty array."),

  achievements: z.array(z.object({
    title: z.string().default("").describe("Achievement title. If not present, use empty string."),
    date: z.string().default("").describe("Date. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string.")
  })).default([]).describe("Achievements. If none, use empty array."),

  languages: z.array(z.object({
    name: z.string().default("").describe("Language name. If not present, use empty string."),
    level: z.string().default("").describe("Level. If not present, use empty string.")
  })).default([]).describe("Languages. If none, use empty array."),

  interests: z.array(z.object({
    name: z.string().default("").describe("Interest name. If not present, use empty string."),
    keywords: z.array(z.string()).default([]).describe("Keywords. If none, use empty array.")
  })).default([]).describe("Interests. If none, use empty array."),

  hobbies: z.array(z.object({
    name: z.string().default("").describe("Hobby name. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string."),
    tags: z.array(z.string()).describe("Tags. If none, use empty array.")
  })).default([]).describe("Hobbies. If none, use empty array."),

  // Structured skills - properly categorized for resume content
  skills: z.object({
    technical: z.array(z.string()).default([]).describe("Technical/hard skills - programming languages, frameworks, tools, databases, technologies, methodologies. Extract ALL technical skills mentioned in resume. If none, use empty array."),
    soft: z.array(z.string()).default([]).describe("Soft skills - leadership, communication, teamwork, problem-solving, time management, adaptability, etc. Extract ALL soft skills mentioned or implied. If none, use empty array."),
    tools: z.array(z.string()).default([]).describe("Tools and platforms - software tools, platforms, IDEs, DevOps tools, project management tools, etc. If none, use empty array."),
    industry: z.array(z.string()).default([]).describe("Industry-specific skills and domain knowledge. If none, use empty array.")
  }).default({ technical: [], soft: [], tools: [], industry: [] }).describe("Categorized skills extracted from resume. Extract ALL skills mentioned anywhere in the resume."),

  // Legacy other_skills field - kept for backwards compatibility
  other_skills: z.array(z.object({
    name: z.string().default("").describe("Skill name. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string."),
    tags: z.array(z.string()).default([]).describe("Tags categorizing the skill: 'technical', 'soft', 'tool', 'language', etc. If none, use empty array.")
  })).default([]).describe("Additional skills not captured in the structured skills object. If none, use empty array."),

  projects: z.array(z.object({
    name: z.string().default("").describe("Project name/title. If not present, use empty string."),
    description: z.string().default("").describe("Brief project description paragraph (NOT bullet points). If not present, use empty string."),
    technologies: z.array(z.string()).default([]).describe("ALL technologies, languages, frameworks, tools used in this project. Extract every technology mentioned. If none, use empty array."),
    link: z.string().default("").describe("Project link/URL (GitHub, live demo, etc.). If not present, use empty string."),
    highlights: z.array(z.string()).default([]).describe("ALL bullet points about this project - features, achievements, outcomes. Each bullet = one array item. If none, use empty array."),
    start_date: z.string().default("").describe("Project start date. If not present, use empty string."),
    end_date: z.string().default("").describe("Project end date. If not present, use empty string.")
  })).default([]).describe("ALL projects from the resume - personal projects, work projects, open source contributions. If none, use empty array."),

  awards: z.array(z.object({
    title: z.string().default("").describe("Award title. If not present, use empty string."),
    date: z.string().default("").describe("Date received. If not present, use empty string."),
    issuer: z.string().default("").describe("Issuing organization. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string.")
  })).default([]).describe("Awards. If none, use empty array."),

  publications: z.array(z.object({
    title: z.string().default("").describe("Publication title. If not present, use empty string."),
    publisher: z.string().default("").describe("Publisher. If not present, use empty string."),
    date: z.string().default("").describe("Publication date. If not present, use empty string."),
    link: z.string().default("").describe("Link to publication. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string.")
  })).default([]).describe("Publications. If none, use empty array."),

  volunteers: z.array(z.object({
    organization: z.string().default("").describe("Organization name. If not present, use empty string."),
    role: z.string().default("").describe("Role/position. If not present, use empty string."),
    start_date: z.string().default("").describe("Start date. If not present, use empty string."),
    end_date: z.string().default("").describe("End date. If not present, use empty string."),
    description: z.string().default("").describe("Description. If not present, use empty string."),
    highlights: z.array(z.string()).default([]).describe("Key highlights. If none, use empty array.")
  })).default([]).describe("Volunteer experience. If none, use empty array."),

  // Simplified personality assessment
  personality_job_fit: z.object({
    candidate_traits: z.object({
      realistic: z.boolean().default(false).describe("Realistic trait. If uncertain, use false."),
      investigative: z.boolean().default(false).describe("Investigative trait. If uncertain, use false."),
      artistic: z.boolean().default(false).describe("Artistic trait. If uncertain, use false."),
      social: z.boolean().default(false).describe("Social trait. If uncertain, use false."),
      enterprising: z.boolean().default(false).describe("Enterprising trait. If uncertain, use false."),
      conventional: z.boolean().default(false).describe("Conventional trait. If uncertain, use false.")
    }).describe("Candidate traits based on resume content."),
    
    intelligence_types: z.object({
      linguistic: z.boolean().default(false).describe("Linguistic intelligence. If uncertain, use false."),
      logical_mathematical: z.boolean().default(false).describe("Logical intelligence. If uncertain, use false."),
      musical: z.boolean().default(false).describe("Musical intelligence. If uncertain, use false."),
      bodily_kinesthetic: z.boolean().default(false).describe("Kinesthetic intelligence. If uncertain, use false."),
      spatial: z.boolean().default(false).describe("Spatial intelligence. If uncertain, use false."),
      interpersonal: z.boolean().default(false).describe("Interpersonal intelligence. If uncertain, use false."),
      intrapersonal: z.boolean().default(false).describe("Intrapersonal intelligence. If uncertain, use false."),
      naturalistic: z.boolean().default(false).describe("Naturalistic intelligence. If uncertain, use false.")
    }).describe("Intelligence types based on resume content."),
    
    personality_type: z.string().default("").describe("Personality type. If uncertain, use empty string."),
    secondary_alignment: z.string().default("").describe("Secondary alignment. If uncertain, use empty string."),
    personality_description: z.string().default("").describe("Personality description. If uncertain, use empty string."),
    tags: z.array(z.string()).default([]).describe("Personality tags. If none, use empty array.")
  }).describe("Personality assessment based on resume content."),

  // Simplified relevance scoring
  relevance: z.object({
    "Skills Relevance": z.number().min(0).max(100).default(50).describe("Skills score 0-100."),
    "Match": z.boolean().default(false).describe("Profile match. If uncertain, use false."),
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
    "Strengths": z.string().default("General resume strengths").describe("Strengths. If none, use default."),
    "Weaknesses": z.string().default("General areas for improvement").describe("Weaknesses. If none, use default."),
    "Description": z.string().default("Resume analysis summary").describe("Description. If none, use default.")
  }).describe("Relevance scoring and assessment."),

  JobFitScore: z.number().min(0).max(100).default(50).describe("Job fit score 0-100."),
  jobFitReason: z.string().default("Standard candidate profile").describe("Job fit reasoning. If none, use default."),

  // Resume Quality & Mistakes Analysis
  resume_quality: z.object({
    grammar_language_score: z.number().min(0).max(100).default(70).describe("Grammar & language quality score 0-100."),
    formatting_design_score: z.number().min(0).max(100).default(70).describe("Formatting & design score 0-100."),
    content_quality_score: z.number().min(0).max(100).default(70).describe("Content quality score 0-100."),
    ats_compatibility_score: z.number().min(0).max(100).default(70).describe("ATS compatibility score 0-100."),
    professional_branding_score: z.number().min(0).max(100).default(70).describe("Professional branding score 0-100."),
    completeness_score: z.number().min(0).max(100).default(70).describe("Completeness score 0-100."),
    overall_quality_score: z.number().min(0).max(100).default(70).describe("Overall resume quality score 0-100."),
    current_quality: z.number().min(0).max(100).default(70).describe("Current resume quality."),
    potential_after_fixes: z.number().min(0).max(100).default(80).describe("Potential quality after fixes."),
    improvement_points: z.number().min(0).max(100).default(10).describe("Expected improvement in points.")
  }).describe("Resume quality scoring separate from job fit."),

  // Critical Mistakes (Must Fix Immediately)
  critical_mistakes: z.array(z.object({
    category: z.string().default("General").describe("Mistake category (Grammar/Formatting/Content/ATS/etc.)."),
    section: z.string().default("Resume").describe("Resume section where mistake was found."),
    current_text: z.string().default("").describe("Current problematic text or formatting."),
    issue: z.string().default("No critical issues found").describe("Why this is problematic."),
    fix: z.string().default("").describe("Specific corrected version."),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM").describe("Priority level."),
    impact: z.string().default("").describe("Impact on hiring chances.")
  })).default([]).describe("Critical errors that must be fixed immediately. Provide 5-10 items if found."),

  // Major Issues (Significantly Hurt Chances)
  major_issues: z.array(z.object({
    category: z.string().default("General").describe("Issue category."),
    section: z.string().default("Resume").describe("Resume section."),
    current_text: z.string().default("").describe("Current text or formatting."),
    issue: z.string().default("").describe("Why this is problematic."),
    fix: z.string().default("").describe("Recommended fix."),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM").describe("Priority level."),
    impact: z.string().default("").describe("Impact description.")
  })).default([]).describe("Major issues that significantly reduce interview chances. Provide 5-15 items if found."),

  // Minor Improvements (Polish & Optimization)
  minor_improvements: z.array(z.object({
    category: z.string().default("General").describe("Improvement category."),
    section: z.string().default("Resume").describe("Resume section."),
    current_text: z.string().default("").describe("Current text."),
    suggestion: z.string().default("").describe("Improvement suggestion."),
    expected_benefit: z.string().default("").describe("Expected benefit.")
  })).default([]).describe("Minor improvements for polish. Provide 10-20 items if found."),

  // Optimization Opportunities (Competitive Edge)
  optimization_opportunities: z.array(z.object({
    category: z.string().default("General").describe("Opportunity category."),
    description: z.string().default("").describe("Enhancement description."),
    implementation: z.string().default("").describe("How to implement."),
    competitive_advantage: z.string().default("").describe("Competitive advantage gained.")
  })).default([]).describe("Enhancements to stand out. Provide 5-10 items if found."),

  // Actionable Improvement Plan
  improvement_plan: z.object({
    immediate_fixes: z.array(z.object({
      task: z.string().default("Review resume").describe("Task description."),
      estimated_time: z.string().default("30 minutes").describe("Estimated time to complete."),
      priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
    })).default([]).describe("Fixes for today (1 hour). Provide 3-5 tasks if applicable."),
    
    short_term_improvements: z.array(z.object({
      task: z.string().default("Enhance content").describe("Task description."),
      estimated_time: z.string().default("1 hour").describe("Estimated time to complete."),
      priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
    })).default([]).describe("Improvements for this week (3-5 hours). Provide 5-7 tasks if applicable."),
    
    medium_term_enhancements: z.array(z.object({
      task: z.string().default("Build portfolio").describe("Task description."),
      estimated_time: z.string().default("1 week").describe("Estimated time to complete."),
      priority: z.number().min(1).max(10).default(5).describe("Priority 1-10.")
    })).default([]).describe("Enhancements for this month (10+ hours). Provide 3-5 tasks if applicable."),
    
    long_term_positioning: z.array(z.object({
      goal: z.string().default("Career growth").describe("Long-term goal."),
      strategy: z.string().default("Continuous learning").describe("Strategy to achieve."),
      timeline: z.string().default("6-12 months").describe("Expected timeline.")
    })).default([]).describe("Long-term career positioning. Provide 3-5 goals if applicable.")
  }).describe("Step-by-step improvement roadmap."),

  // Impact Analysis
  impact_analysis: z.object({
    current_interview_rate: z.number().min(0).max(100).default(50).describe("Estimated current interview rate %."),
    after_critical_fixes: z.number().min(0).max(100).default(60).describe("Expected rate after critical fixes %."),
    after_all_improvements: z.number().min(0).max(100).default(75).describe("Expected rate after all improvements %."),
    recruiter_time_to_reject: z.string().default("2-3 minutes").describe("Estimated time before rejection."),
    current_ats_pass_rate: z.number().min(0).max(100).default(50).describe("Current ATS pass-through rate %."),
    optimized_ats_pass_rate: z.number().min(0).max(100).default(75).describe("Optimized ATS pass rate %."),
    competitive_ranking: z.string().default("Average").describe("Current ranking among similar candidates."),
    expected_ranking_improvement: z.string().default("Above Average").describe("Expected ranking after improvements.")
  }).describe("Quantified impact of identified mistakes and improvements.")
});
