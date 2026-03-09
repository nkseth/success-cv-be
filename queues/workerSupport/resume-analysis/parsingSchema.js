import { z } from "zod";

/**
 * Focused Parsing Schema
 * 
 * This schema handles ONLY structured data extraction from the resume.
 * It does NOT include scoring, analysis, mistakes, or personality fields.
 * This is Step 1 of the multi-step analysis pipeline.
 * 
 * Much smaller than the combined schema (~120 fields vs ~340), 
 * which significantly improves AI output reliability.
 */

export const parsingSchema = z.object({
    detected_language: z.string().default("en").describe("ISO 639-1 language code detected from resume content (e.g., 'en', 'es'). Required."),

    personal_info: z.object({
        name: z.string().default("").describe("Full name of the candidate. Required."),
        email: z.string().default("").describe("Email address. If not present, use empty string."),
        phone: z.string().default("").describe("Phone number with country code. Normalize: +[code][number]. If not present, use empty string."),
        address: z.string().default("").describe("Full address/location. If not present, use empty string."),
        summary: z.string().default("").describe("Professional summary/objective from resume. If not present, use empty string."),
        linkedin: z.string().default("").describe("LinkedIn URL. If not present, use empty string."),
        github: z.string().default("").describe("GitHub URL. If not present, use empty string."),
        website: z.string().default("").describe("Personal website URL. If not present, use empty string."),
        portfolio: z.string().default("").describe("Portfolio URL. If not present, use empty string.")
    }),

    experiences: z.array(z.object({
        company: z.string().default("").describe("Company name."),
        position: z.string().default("").describe("Position/job title."),
        location: z.string().default("").describe("Location."),
        website: z.string().default("").describe("Company website."),
        start_date: z.string().default("").describe("Start date in YYYY-MM-DD format."),
        end_date: z.string().default("").describe("End date in YYYY-MM-DD or 'Present'."),
        summary: z.string().default("").describe("ONLY paragraph description. Leave EMPTY if content is bullet points."),
        highlights: z.array(z.string()).default([]).describe("ALL bullet points from this experience. EVERY bullet = one array item. Do NOT skip any.")
    })).default([]).describe("ALL work experiences from the resume."),

    education: z.array(z.object({
        institution: z.string().default("").describe("Institution name."),
        area: z.string().default("").describe("Field of study."),
        study_type: z.string().default("").describe("Degree type."),
        location: z.string().default("").describe("Location."),
        start_date: z.string().default("").describe("Start date."),
        end_date: z.string().default("").describe("End date."),
        gpa: z.string().default("").describe("GPA if present."),
        honors: z.array(z.string()).default([]).describe("Honors and awards."),
        achievements: z.array(z.string()).default([]).describe("Academic achievements.")
    })).default([]).describe("ALL education entries."),

    social: z.array(z.object({
        name: z.string().default("").describe("Platform name (LinkedIn, GitHub, Twitter, etc.)"),
        url: z.string().default("").describe("Full URL.")
    })).default([]).describe("ALL social profiles and links."),

    certificates: z.array(z.object({
        name: z.string().default("").describe("Certificate name."),
        authority: z.string().default("").describe("Issuing authority."),
        certification_id: z.string().default("").describe("ID."),
        start_date: z.string().default("").describe("Start date."),
        end_date: z.string().default("").describe("End date.")
    })).default([]).describe("Certificates."),

    achievements: z.array(z.object({
        title: z.string().default("").describe("Achievement title."),
        date: z.string().default("").describe("Date."),
        description: z.string().default("").describe("Description.")
    })).default([]).describe("Achievements."),

    languages: z.array(z.object({
        name: z.string().default("").describe("Language name (spoken language)."),
        level: z.string().default("").describe("Proficiency level.")
    })).default([]).describe("Spoken languages."),

    interests: z.array(z.object({
        name: z.string().default("").describe("Interest name."),
        keywords: z.array(z.string()).default([]).describe("Keywords.")
    })).default([]).describe("Interests."),

    hobbies: z.array(z.object({
        name: z.string().default("").describe("Hobby name."),
        description: z.string().default("").describe("Description."),
        tags: z.array(z.string()).default([]).describe("Tags.")
    })).default([]).describe("Hobbies."),

    skills: z.object({
        technical: z.array(z.string()).default([]).describe("Technical/hard skills — languages, frameworks, databases, tech, methodologies."),
        soft: z.array(z.string()).default([]).describe("Soft skills — leadership, communication, teamwork, etc."),
        tools: z.array(z.string()).default([]).describe("Tools and platforms — Git, Docker, JIRA, etc."),
        industry: z.array(z.string()).default([]).describe("Industry-specific knowledge.")
    }).default({ technical: [], soft: [], tools: [], industry: [] }).describe("Categorized skills from ALL parts of the resume."),

    other_skills: z.array(z.object({
        name: z.string().default("").describe("Skill name."),
        description: z.string().default("").describe("Description."),
        tags: z.array(z.string()).default([]).describe("Tags.")
    })).default([]).describe("Additional skills."),

    projects: z.array(z.object({
        name: z.string().default("").describe("Project name."),
        description: z.string().default("").describe("Brief description (not bullet points)."),
        technologies: z.array(z.string()).default([]).describe("Technologies used."),
        link: z.string().default("").describe("Project link/URL."),
        highlights: z.array(z.string()).default([]).describe("Project bullet points."),
        start_date: z.string().default("").describe("Start date."),
        end_date: z.string().default("").describe("End date.")
    })).default([]).describe("ALL projects."),

    awards: z.array(z.object({
        title: z.string().default("").describe("Award title."),
        date: z.string().default("").describe("Date."),
        issuer: z.string().default("").describe("Issuing organization."),
        description: z.string().default("").describe("Description.")
    })).default([]).describe("Awards."),

    publications: z.array(z.object({
        title: z.string().default("").describe("Publication title."),
        publisher: z.string().default("").describe("Publisher."),
        date: z.string().default("").describe("Date."),
        link: z.string().default("").describe("Link."),
        description: z.string().default("").describe("Description.")
    })).default([]).describe("Publications."),

    volunteers: z.array(z.object({
        organization: z.string().default("").describe("Organization name."),
        role: z.string().default("").describe("Role."),
        start_date: z.string().default("").describe("Start date."),
        end_date: z.string().default("").describe("End date."),
        description: z.string().default("").describe("Description."),
        highlights: z.array(z.string()).default([]).describe("Highlights.")
    })).default([]).describe("Volunteer experience.")
});

export default { parsingSchema };
