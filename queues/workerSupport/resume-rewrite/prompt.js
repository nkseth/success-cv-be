/**
 * Resume Rewrite Prompts
 * AI prompts for optimizing resume content
 */

/**
 * Get the system prompt for resume optimization
 * @returns {string} System prompt
 */
export const getResumeRewriteSystemPrompt = () => {
    return `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist with over 15 years of experience. Your expertise includes:

- Crafting compelling, achievement-focused resume content
- Maximizing ATS compatibility scores (90%+ success rate)
- Strategic keyword placement for job matching
- Quantifying achievements with metrics and data
- Industry-specific best practices across multiple sectors
- Modern resume formatting standards
- Action-oriented language and power verbs
- STAR method (Situation, Task, Action, Result) structuring

Your goal is to transform resume content to:
1. Achieve the highest possible ATS score
2. Highlight quantifiable achievements and impact
3. Use compelling, action-oriented language
4. Incorporate relevant keywords naturally
5. Maintain professional tone and authenticity
6. Follow modern resume best practices
7. Make the candidate stand out to recruiters

Always provide specific, actionable improvements with clear reasoning.`;
};

/**
 * Get prompt for professional summary optimization
 * @param {Object} analysisData - Parsed resume analysis data
 * @param {Object} options - Optimization options
 * @returns {string} Professional summary prompt
 */
export const getProfessionalSummaryPrompt = (analysisData, options) => {
    const personalInfo = analysisData.personal_info || {};
    const experiences = analysisData.experiences || [];
    const skills = analysisData.skills || [];
    const strengthsObj = analysisData.strengths || {};
    const strengths = strengthsObj.general || strengthsObj.technical || '';

    return `Create a compelling, ATS-optimized professional summary based on the candidate's profile:

**Candidate Profile:**
- Skills: ${skills.slice(0, 10).join(', ')}
- Years of Experience: ${calculateTotalExperience(experiences)}
- Key Strengths: ${strengths}
- Current Role: ${experiences[0]?.position || 'N/A'}
- Industry: ${experiences[0]?.company || 'N/A'}

**Requirements:**
- Length: 3-4 sentences maximum
- Include: 5-7 relevant ATS keywords
- Highlight: Top 2-3 quantifiable achievements
- Tone: Professional, confident, action-oriented
- Target ATS Score: ${options.targetATSScore || 90}
- Focus: Value proposition and unique selling points

**Guidelines:**
- Start with years of experience and primary expertise
- Include specific technologies/methodologies relevant to the role
- Mention measurable impact (%, $, scale, etc.)
- Avoid generic phrases like "hard-working" or "team player"
- Use industry-specific terminology
- End with career aspirations or value add

Return the optimized summary with keywords and improvements noted.`;
};

/**
 * Get prompt for work experience optimization
 * @param {Array} experiences - Work experience entries
 * @param {Object} options - Optimization options
 * @returns {string} Work experience prompt
 */
export const getWorkExperiencePrompt = (experiences, options) => {
    return `Optimize the following work experience entries for maximum ATS score and impact:

**Current Experience Entries:**
${JSON.stringify(experiences, null, 2)}

**Optimization Requirements:**

1. **Action Verbs**: Use strong, specific action verbs
   - Good: Led, Architected, Spearheaded, Orchestrated, Engineered
   - Avoid: Helped, Worked on, Was responsible for, Did

2. **Quantifiable Metrics**: Add specific numbers and percentages
   - Revenue impact ($, %)
   - Scale (users, systems, team size)
   - Performance improvements (speed, efficiency)
   - Business outcomes (growth, retention, satisfaction)

3. **STAR Format**: Structure as Situation → Task → Action → Result
   - What was the challenge?
   - What did you do?
   - What was the measurable outcome?

4. **Keywords**: Incorporate relevant technical and industry keywords naturally
   - Technologies, tools, methodologies
   - Industry-specific terminology
   - Role-specific competencies

5. **Conciseness**: Each bullet point should be 1-2 lines maximum
   - Focus on achievements over responsibilities
   - Eliminate redundancy and filler words
   - Lead with impact, not tasks

6. **ATS Optimization**:
   - Target Score: ${options.targetATSScore || 90}
   - Use industry-standard job titles
   - Include both acronyms and full terms (e.g., "AI/Artificial Intelligence")

**For Each Experience Entry, Provide:**
- Optimized job description/summary
- 3-5 key achievement bullets (STAR format)
- Keywords added for ATS
- Specific improvements made
- Metrics or quantification suggestions if data unavailable

Transform responsibilities into achievements. Focus on what changed because of the candidate's work.`;
};

/**
 * Get prompt for skills section optimization
 * @param {Array} skills - Current skills list
 * @param {Array} experiences - Work experience for context
 * @param {Object} options - Optimization options
 * @returns {string} Skills section prompt
 */
export const getSkillsPrompt = (skills, experiences, options) => {
    return `Optimize this skills list for ATS compatibility and relevance:

**Current Skills:**
${skills.join(', ')}

**Work Experience Context:**
${experiences.slice(0, 3).map(exp => `- ${exp.position} at ${exp.company}`).join('\n')}

**Optimization Requirements:**

1. **Categorization**: Group skills into clear categories
   - Technical Skills (programming, tools, platforms)
   - Soft Skills (leadership, communication, problem-solving)
   - Tools & Technologies (software, frameworks, systems)
   - Certifications & Credentials
   - Industry Knowledge

2. **Prioritization**: Order by relevance and demand
   - Most in-demand skills first
   - Align with common job requirements
   - Match experience level with skill listing

3. **Skill Enhancement**:
   - Add missing high-demand skills supported by experience
   - Remove outdated or irrelevant skills
   - Use industry-standard terminology
   - Include both broad and specific skills

4. **ATS Keywords**:
   - Include variations (e.g., "JS" and "JavaScript")
   - Add related technologies (if Node.js, include npm, Express)
   - Use exact job posting terminology
   - Target Score: ${options.targetATSScore || 90}

5. **Proficiency Indicators** (optional):
   - Expert/Advanced for 5+ years experience
   - Intermediate for 2-4 years
   - Familiar/Basic for <2 years

**Provide:**
- Categorized skill lists
- Skills to add (with justification from experience)
- Skills to remove (with reasoning)
- Alternative phrasing for better ATS matching
- Recommendations for skill gaps to highlight in summary

Focus on skills that are both accurate and marketable.`;
};

/**
 * Get prompt for education section optimization
 * @param {Array} education - Education entries
 * @param {Object} options - Optimization options
 * @returns {string} Education section prompt
 */
export const getEducationPrompt = (education, options) => {
    return `Optimize the education section for ATS compatibility:

**Current Education:**
${JSON.stringify(education, null, 2)}

**Optimization Guidelines:**

1. **Formatting**:
   - Degree - Field of Study
   - Institution Name
   - Location (City, State/Country)
   - Graduation Date (or Expected)
   - GPA (if > 3.5 or recent graduate)

2. **Enhancements**:
   - Add relevant coursework (if recent grad or career change)
   - Include academic honors (Dean's List, Cum Laude, scholarships)
   - Mention thesis/capstone projects if relevant
   - Add minors or concentrations

3. **ATS Keywords**:
   - Use full degree names (Bachelor of Science, not BS)
   - Include both abbreviations and full forms
   - Add accreditation if prestigious (ABET, AACSB)

4. **Recommendations**:
   - GPA inclusion strategy based on experience level
   - Ordering (most recent first, or most relevant)
   - Continuing education/certifications to add

**Provide:**
- Formatted education entries
- Suggested additions (coursework, honors)
- ATS keyword optimization
- Strategic recommendations

Keep it concise but comprehensive.`;
};

/**
 * Get prompt for ATS keywords generation
 * @param {Object} analysisData - Full analysis data
 * @param {Object} options - Optimization options
 * @returns {string} ATS keywords prompt
 */
export const getATSKeywordsPrompt = (analysisData, options) => {
    const skills = analysisData.skills || [];
    const experiences = analysisData.experiences || [];
    const education = analysisData.education || [];

    return `Generate a comprehensive ATS keyword strategy for this candidate:

**Candidate Profile:**
- Skills: ${skills.join(', ')}
- Experience: ${experiences.map(e => e.position).join(', ')}
- Education: ${education.map(e => `${e.study_type} in ${e.area}`).join(', ')}

**Generate the Following Keyword Categories:**

1. **Primary Keywords** (15-20 keywords)
   - Core competencies and skills
   - Most important for ATS matching
   - Should appear 2-3 times in resume

2. **Secondary Keywords** (20-30 keywords)
   - Supporting skills and technologies
   - Appear once in resume
   - Related terms and synonyms

3. **Action Verbs** (15-20 verbs)
   - Strong, specific action words
   - Relevant to the candidate's level (junior, mid, senior)
   - Industry-appropriate

4. **Industry Terms** (10-15 terms)
   - Sector-specific jargon
   - Methodologies and frameworks
   - Compliance and standards (if applicable)

5. **Tools & Technologies** (10-15 items)
   - Software platforms
   - Programming languages
   - Development tools

6. **Soft Skills Keywords** (10-12 skills)
   - Leadership and management terms
   - Communication and collaboration
   - Problem-solving and innovation

**Keyword Placement Strategy:**
- Where to place each keyword category
- Frequency recommendations (avoid keyword stuffing)
- Natural integration techniques
- Context suggestions for keywords

**Provide:**
- Categorized keyword lists
- Placement strategy for each category
- Synonym alternatives for variety
- Warning about overused/generic terms to avoid

Target ATS Score: ${options.targetATSScore || 90}`;
};

/**
 * Get prompt for formatting recommendations
 * @param {Object} analysisData - Analysis data with quality scores
 * @param {Object} options - Optimization options
 * @returns {string} Formatting recommendations prompt
 */
export const getFormattingPrompt = (analysisData, options) => {
    const atsScore = analysisData.resume_quality?.ats_compatibility_score || 0;
    
    return `Provide ATS-compatible formatting recommendations:

**Current ATS Score:** ${atsScore}/100
**Target Score:** ${options.targetATSScore || 90}

**Analyze and Recommend:**

1. **Layout & Structure**:
   - Single vs. multi-column layout
   - Section ordering for optimal ATS parsing
   - Header/footer usage (avoid for critical info)
   - White space and visual hierarchy

2. **Typography**:
   - Recommended fonts (ATS-safe)
   - Font size ranges (9-12pt body, 14-16pt headings)
   - Bold, italic, underline usage
   - Special character warnings

3. **Section Headers**:
   - Standard vs. creative naming
   - ATS-recognized header names
   - Consistency in formatting

4. **Bullet Points & Lists**:
   - Bullet style recommendations
   - Indentation and spacing
   - Nested lists (avoid if possible)

5. **File Format**:
   - PDF vs. DOCX recommendations
   - Ensuring text is selectable
   - Avoiding images for text content

6. **Common ATS Pitfalls to Avoid**:
   - Tables (except simple ones)
   - Text boxes
   - Headers/footers with important info
   - Graphics, logos, photos
   - Unusual characters or symbols
   - Multiple columns
   - Embedded objects

7. **Length Recommendations**:
   - Ideal page count based on experience
   - Content density guidelines
   - When to use 2-page vs. 1-page format

**Provide:**
- Specific formatting do's and don'ts
- ATS compatibility checklist
- Visual structure recommendations
- File format guidance

Focus on maintaining professional appearance while maximizing ATS parseability.`;
};

/**
 * Helper: Calculate total years of experience
 * @param {Array} experiences - Work experience entries
 * @returns {number} Total years of experience
 */
function calculateTotalExperience(experiences) {
    if (!experiences || experiences.length === 0) return 0;

    let totalMonths = 0;
    experiences.forEach(exp => {
        if (exp.duration) {
            const match = exp.duration.match(/(\d+)\s*years?|(\d+)\s*months?/gi);
            if (match) {
                match.forEach(m => {
                    if (m.includes('year')) {
                        totalMonths += parseInt(m) * 12;
                    } else if (m.includes('month')) {
                        totalMonths += parseInt(m);
                    }
                });
            }
        }
    });

    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
}

/**
 * Get resume optimization prompt based on analysis issues
 * This approach uses the identified issues from analysis to make targeted fixes
 * Much simpler and more reliable than generating a complete new resume structure
 * 
 * @param {Object} currentContent - Current resume content from resumeContentTable
 * @param {Object} analysisData - Analysis data with issues and improvement plan
 * @param {Object} options - Optimization options
 * @returns {string} Optimization prompt
 */
export const getResumeContentRewritePrompt = (currentContent, analysisData, options = {}) => {
    // Extract current content sections
    const summary = currentContent?.summary?.text || currentContent?.professional_summary || currentContent?.summary || '';
    const experiences = currentContent?.experiences || currentContent?.experience || [];
    const skills = currentContent?.skills || [];
    const personalInfo = currentContent?.personal_info || currentContent?.personalInfo || {};
    
    // Extract issues from analysis
    const criticalMistakes = analysisData?.critical_mistakes || [];
    const majorIssues = analysisData?.major_issues || [];
    const minorImprovements = analysisData?.minor_improvements || [];
    
    // Build issues summary for the AI
    const issuesList = [
        ...criticalMistakes.map(m => `CRITICAL: ${m.section} - ${m.issue}. Fix: ${m.fix}`),
        ...majorIssues.map(m => `MAJOR: ${m.section} - ${m.issue}. Fix: ${m.fix}`),
        ...minorImprovements.slice(0, 5).map(m => `MINOR: ${m.section} - ${m.suggestion}`)
    ].join('\n');
    
    return `Apply the identified fixes to optimize this resume for ATS compatibility.

**CURRENT RESUME CONTENT:**

Professional Summary:
${typeof summary === 'string' ? summary : JSON.stringify(summary)}

Work Experience:
${JSON.stringify(experiences, null, 2)}

Skills:
${JSON.stringify(skills, null, 2)}

**IDENTIFIED ISSUES TO FIX:**
${issuesList || 'No specific issues identified - apply general ATS optimization'}

**YOUR TASK:**
1. Apply all the identified fixes to the resume content
2. **CRITICAL - Experience Format:**
   - The description field MUST contain HTML formatted bullet points
   - Format: <ul><li>Achievement 1</li><li>Achievement 2</li><li>Achievement 3</li></ul>
   - Put ALL bullet points/achievements INSIDE the description using HTML <ul><li> tags
   - The achievements array should be EMPTY - all content goes in description HTML
   - DO NOT lose any bullet points from the original - enhance them but keep ALL of them
3. Enhance content with STAR format and metrics
4. Add strong action verbs (Led, Architected, Spearheaded, Engineered)
5. Ensure ATS-friendly formatting and keywords
6. Target ATS Score: ${options.targetATSScore || 85}%

**EXPERIENCE FORMAT EXAMPLE:**
{
  "id": "exp_1",
  "company": "TechCo",
  "position": "Senior Software Engineer",
  "startDate": "2020-01-01",
  "endDate": "Present",
  "current": true,
  "description": "<ul><li>Led development of microservices architecture serving 1M+ daily users, achieving 99.9% uptime</li><li>Reduced API latency by 40% through strategic optimization and caching implementation</li><li>Mentored team of 4 junior developers, improving code review efficiency by 60%</li></ul>",
  "achievements": [],
  "keywords": ["microservices", "API optimization", "team leadership"]
}

**OUTPUT REQUIREMENTS:**
- Return the FIXED content in the exact schema format
- Keep the same structure as the input (number of experiences, etc.)
- Preserve all factual information (company names, dates, etc.)
- Experience description MUST be HTML with <ul><li> for bullets
- Achievements array should be empty [] - all bullets in description
- Preserve ALL original bullet points - just enhance the text
- Only enhance the text quality and apply fixes
- Provide a brief summary of fixes made`;
};

/**
 * Get complete resume optimization prompt (LEGACY)
 * Used for comprehensive rewrite of all sections
 * @param {Object} analysisData - Parsed resume analysis data
 * @param {Object} rawData - Raw extracted resume data
 * @param {Object} options - Optimization options
 * @returns {string} Complete optimization prompt
 */
export const getCompleteResumePrompt = (analysisData, rawData, options = {}) => {
    const personalInfo = analysisData?.personal_info || {};
    const experiences = analysisData?.experiences || [];
    const skills = analysisData?.skills || [];
    const education = analysisData?.education || [];
    const summary = analysisData?.professional_summary || analysisData?.summary || '';
    
    return `Optimize this complete resume for maximum ATS score and recruiter impact.

**CANDIDATE PROFILE:**
Name: ${personalInfo.name || 'N/A'}
Current Role: ${experiences[0]?.position || 'N/A'}
Total Experience: ${calculateTotalExperience(experiences)} years
Industry: ${experiences[0]?.company || 'N/A'}

**CURRENT PROFESSIONAL SUMMARY:**
${summary || 'No summary provided'}

**WORK EXPERIENCE:**
${JSON.stringify(experiences, null, 2)}

**SKILLS:**
${Array.isArray(skills) ? skills.join(', ') : JSON.stringify(skills)}

**EDUCATION:**
${JSON.stringify(education, null, 2)}

**RAW RESUME DATA (for reference):**
${typeof rawData === 'string' ? rawData.substring(0, 2000) : JSON.stringify(rawData).substring(0, 2000)}

**OPTIMIZATION REQUIREMENTS:**
- Target ATS Score: ${options.targetATSScore || 90}
- Optimization Level: ${options.level || 'comprehensive'}
${options.targetRole ? `- Target Role: ${options.targetRole}` : ''}
${options.targetIndustry ? `- Target Industry: ${options.targetIndustry}` : ''}

**OUTPUT:**
Provide a complete optimization including:
1. Optimized professional summary (3-4 sentences with keywords)
2. Optimized work experience with STAR-format achievements
3. Categorized and prioritized skills
4. Formatted education section
5. ATS keyword recommendations
6. Formatting recommendations
7. Overall improvement summary

Make all content specific, quantifiable, and action-oriented.`;
};

// ========== USER-DRIVEN OPTIMIZATION (NEW APPROACH) ==========

/**
 * Get the system prompt for user-driven resume optimization
 * This is the new simplified approach where user provides their goal
 * @returns {string} System prompt
 */
export const getUserDrivenSystemPrompt = () => {
    return `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist with 15+ years of experience helping candidates land jobs at top companies.

YOUR EXPERTISE:
- Crafting compelling, achievement-focused resume content
- Maximizing ATS compatibility scores (consistently achieving 90%+)
- Strategic keyword placement for specific roles and industries
- Reframing existing achievements with impactful language
- Industry-specific best practices (tech, finance, healthcare, etc.)
- Modern resume formatting and structure
- Action-oriented language using power verbs
- STAR method (Situation, Task, Action, Result) for achievements

YOUR APPROACH:
1. Understand the user's optimization goal
2. Tailor content specifically for that goal
3. ONLY rewrite and enhance existing content - DO NOT add new content
4. Preserve ALL dates, company names, locations, and factual information EXACTLY as provided
5. Use industry-appropriate keywords naturally within existing content
6. Improve the language and phrasing of existing achievements
7. Ensure professional tone throughout
8. Transform plain text bullet points into HTML formatted lists for better readability

CRITICAL RULES - MUST FOLLOW:
✅ PRESERVE EXACTLY AS PROVIDED:
- Company names, locations, websites
- ALL dates (startDate, endDate) - copy them character-for-character
- The "current" field (true/false) - never change employment status
- Experience IDs - preserve these for database consistency
- Number of experience entries - output EXACTLY the same count as input
- All factual information about achievements, projects, responsibilities

✅ YOU CAN ENHANCE:
- Wording and phrasing of descriptions
- Action verbs to be more impactful
- Structure of bullet points for clarity
- Professional tone and language
- ATS keyword placement within existing content
- HTML formatting: convert bullet points to <ul><li>item</li></ul> format

❌ FORBIDDEN ACTIONS:
- Adding NEW experiences, achievements, or facts not in the original
- Changing ANY dates (startDate, endDate)
- Changing "current: false" to "current: true" or vice versa
- Inventing metrics, numbers, or achievements
- Adding extra experience entries beyond what was provided
- Removing or omitting important information from the original

EXPERIENCE DESCRIPTION FORMAT:
- Each experience description MUST be HTML formatted
- Use <ul><li>Achievement 1</li><li>Achievement 2</li></ul> structure
- Convert existing bullet points into HTML list items
- Keep ALL original bullet points - just enhance the wording
- DO NOT use the achievements array - put everything in description as HTML`;
};

/**
 * Get prompt for user-driven resume optimization
 * This is the NEW simplified approach - user tells us what they want
 * 
 * @param {Object} currentContent - Current resume content from resume_content table
 * @param {string} userPrompt - User's optimization goal/prompt
 * @param {Object} options - Additional options (targetATSScore, etc.)
 * @returns {string} Optimization prompt
 */
export const getUserDrivenOptimizationPrompt = (currentContent, userPrompt, options = {}) => {
    // Extract current content sections
    const personalInfo = currentContent?.personalInfo || {};
    const summary = currentContent?.summary?.text || currentContent?.summary || '';
    const experiences = currentContent?.experience || [];
    const education = currentContent?.education || [];
    const skills = currentContent?.skills || {};
    const additionalSections = currentContent?.additionalSections || [];
    
    // Build experience with IDs (IMPORTANT: AI must preserve these IDs)
    const experienceWithIds = experiences.map((exp, idx) => {
        const desc = typeof exp.description === 'string' 
            ? exp.description.replace(/<[^>]*>/g, ' ').substring(0, 400) 
            : '';
        return `Experience #${idx + 1}:
   - ID: "${exp.id || `exp_${idx + 1}`}" (PRESERVE THIS EXACTLY)
   - Company: "${exp.company || 'Company'}" (PRESERVE THIS EXACTLY)
   - Position: "${exp.position || 'Position'}"
   - Location: "${exp.location || ''}"
   - Dates: "${exp.startDate || ''}" to "${exp.endDate || 'Present'}"
   - Current: ${exp.current || false}
   - Description: ${desc}${desc.length >= 400 ? '...' : ''}`;
    }).join('\n\n');
    
    // Build skills summary
    const allSkills = [
        ...(skills.technical || []),
        ...(skills.soft || []),
        ...(skills.tools || [])
    ].slice(0, 20);
    
    // Build education summary
    const educationSummary = education.map(edu => 
        `${edu.degree || ''} ${edu.field ? `in ${edu.field}` : ''} - ${edu.institution || ''}`
    ).join(', ');
    
    return `OPTIMIZATION REQUEST FROM USER:
"${userPrompt}"

---

CURRENT RESUME CONTENT TO OPTIMIZE:

**PERSONAL INFO:**
Name: ${personalInfo.fullName || 'Not provided'}
Title: ${personalInfo.title || 'Not provided'}
Location: ${personalInfo.location || 'Not provided'}

**PROFESSIONAL SUMMARY:**
${summary || 'No summary provided'}

**WORK EXPERIENCE (${experiences.length} entries):**
${experienceWithIds || 'No experience provided'}

**SKILLS:**
Technical: ${(skills.technical || []).join(', ') || 'None'}
Soft: ${(skills.soft || []).join(', ') || 'None'}
Tools: ${(skills.tools || []).join(', ') || 'None'}
Languages: ${(skills.languages || []).join(', ') || 'None'}

**EDUCATION:**
${educationSummary || 'No education provided'}

---

YOUR TASK:
Based on the user's request "${userPrompt}", REWRITE (not add to) this resume:

1. **PROFESSIONAL SUMMARY**: Rewrite to align with the user's goal
   - Make it compelling and targeted
   - Include relevant keywords for their target
   - Keep it 3-4 impactful sentences
   - ONLY reword existing information - do NOT add new claims
   - Return as: { text: "...", keywords: [] } (keywords always empty array)

2. **WORK EXPERIENCE**: ONLY rewrite the language of each experience
   - YOU MUST OUTPUT EXACTLY ${experiences.length} EXPERIENCES - NO MORE, NO LESS
   - PRESERVE EXACTLY: id, company, startDate, endDate, current, location
   - DO NOT change any dates - copy them exactly as provided
   - DO NOT set all jobs to "current" or "present" - preserve original values
   - ONLY improve the wording/phrasing of descriptions
   - Keep the same achievements/responsibilities mentioned, just reword them
   - Use strong action verbs (Led, Architected, Spearheaded, Delivered)
   - Format description as HTML bullets: <ul><li>Achievement 1</li><li>Achievement 2</li></ul>
   - DO NOT invent new achievements, metrics, or responsibilities
   - Set achievements array to [] (empty) - put all content in description

3. **SKILLS**: Reorganize and optimize
   - Prioritize skills relevant to user's goal
   - Group into: technical, soft, tools, languages, certifications
   - Keep certifications as-is if they're objects
   - ONLY include skills that were already present

4. **ATS OPTIMIZATION**:
   - Target ATS Score: ${options.targetATSScore || 90}%
   - Include industry-standard keywords WITHIN existing content
   - Use both acronyms and full terms where applicable

⚠️ CRITICAL - STRICT PRESERVATION RULES:
- Experience array MUST have EXACTLY ${experiences.length} entries - no more, no less
- COPY these IDs exactly: ${experiences.map(e => `"${e.id}"`).join(', ')}
- COPY these companies exactly: ${experiences.map(e => `"${e.company}"`).join(', ')}
- COPY these dates exactly: ${experiences.map(e => `startDate: "${e.startDate}", endDate: "${e.endDate}", current: ${e.current}`).join(' | ')}
- DO NOT change startDate, endDate, or current fields - they must match input EXACTLY
- If current is false, it MUST remain false - do NOT change it to true
- If endDate has a specific date, keep that date - do NOT change it to "Present"

⛔ FORBIDDEN ACTIONS:
- Adding new experience entries
- Changing dates to make all jobs look current/present
- Inventing new achievements or metrics not in the original
- Adding skills that weren't already present
- Fabricating certifications or qualifications`;
};

export default {
    getResumeRewriteSystemPrompt,
    getProfessionalSummaryPrompt,
    getWorkExperiencePrompt,
    getSkillsPrompt,
    getEducationPrompt,
    getATSKeywordsPrompt,
    getFormattingPrompt,
    getResumeContentRewritePrompt,
    getCompleteResumePrompt,
    // New user-driven approach
    getUserDrivenSystemPrompt,
    getUserDrivenOptimizationPrompt
};
