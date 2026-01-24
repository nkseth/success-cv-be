/**
 * Prompt Validator Utility
 * Validates user prompts for resume optimization to ensure they are:
 * - Safe (no malicious content)
 * - Appropriate (no offensive/harmful content)
 * - Relevant (actually about resume optimization)
 */

import logger from '../middleware/logger.js';
import { AppError } from '../middleware/error.js';

// ========== BLOCKED PATTERNS ==========

/**
 * Patterns that indicate malicious intent (prompt injection, jailbreaking)
 */
const MALICIOUS_PATTERNS = [
    // Prompt injection attempts
    /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
    /disregard\s+(all|previous|prior)\s+(instructions?|prompts?)/i,
    /forget\s+(everything|all|previous)/i,
    /new\s+instructions?:/i,
    /system\s*prompt/i,
    /you\s+are\s+now\s+a/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /act\s+as\s+(if|though)/i,
    /roleplay\s+as/i,
    /jailbreak/i,
    /bypass\s+(filters?|restrictions?|rules?)/i,
    /override\s+(instructions?|settings?|rules?)/i,
    
    // Code injection attempts
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onerror=, etc.
    /\{\{.*\}\}/,  // Template injection
    /\$\{.*\}/,    // Template literals
    
    // SQL injection patterns
    /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\s/i,
    /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
    /UNION\s+(ALL\s+)?SELECT/i,
    
    // Command injection
    /[;&|`]\s*(rm|del|format|shutdown|reboot|curl|wget|nc|bash|sh|cmd)/i,
];

/**
 * Patterns that indicate inappropriate/harmful content
 */
const INAPPROPRIATE_PATTERNS = [
    // Violence and harm
    /\b(kill|murder|assault|attack|bomb|terrorist|weapon)\b/i,
    /\b(suicide|self[- ]?harm)\b/i,
    
    // Hate speech indicators
    /\b(racist|sexist|homophobic|transphobic)\b/i,
    /\bhate\s+(speech|group|crime)\b/i,
    
    // Explicit content
    /\b(porn|xxx|nsfw|explicit\s+content)\b/i,
    
    // Illegal activities
    /\b(illegal|fraud|scam|hack|crack|pirate)\b/i,
    /\b(fake\s+(credentials?|degree|certificate))\b/i,
    /\b(forge|falsify|fabricate)\s+(document|credential|degree)/i,
    
    // Discrimination
    /discriminat(e|ion)\s+(against|based\s+on)/i,
];

/**
 * Keywords that suggest the prompt is NOT about resume optimization
 */
const OFF_TOPIC_PATTERNS = [
    /\b(write\s+(a\s+)?(story|poem|essay|article|blog))\b/i,
    /\b(generate\s+(code|program|script|sql|query))\b/i,
    /\b(how\s+to\s+(cook|make|build|fix))\b/i,
    /\b(translate\s+(to|into))\b/i,
    /\b(solve\s+(this\s+)?(math|equation|problem))\b/i,
    /\b(play\s+(a\s+)?game)\b/i,
    /\b(tell\s+me\s+a\s+joke)\b/i,
];

// ========== VALIDATION FUNCTIONS ==========

/**
 * Check if prompt contains malicious patterns
 * @param {string} prompt - User prompt
 * @returns {Object} { isValid: boolean, reason?: string }
 */
function checkMaliciousContent(prompt) {
    for (const pattern of MALICIOUS_PATTERNS) {
        if (pattern.test(prompt)) {
            logger.warn('[PROMPT_VALIDATOR] Malicious pattern detected', {
                pattern: pattern.toString(),
                promptPreview: prompt.substring(0, 100)
            });
            return {
                isValid: false,
                reason: 'Your prompt contains content that cannot be processed. Please provide a clear resume optimization goal.'
            };
        }
    }
    return { isValid: true };
}

/**
 * Check if prompt contains inappropriate content
 * @param {string} prompt - User prompt
 * @returns {Object} { isValid: boolean, reason?: string }
 */
function checkInappropriateContent(prompt) {
    for (const pattern of INAPPROPRIATE_PATTERNS) {
        if (pattern.test(prompt)) {
            logger.warn('[PROMPT_VALIDATOR] Inappropriate content detected', {
                pattern: pattern.toString(),
                promptPreview: prompt.substring(0, 100)
            });
            return {
                isValid: false,
                reason: 'Your prompt contains inappropriate content. Please provide a professional resume optimization goal.'
            };
        }
    }
    return { isValid: true };
}

/**
 * Check if prompt is relevant to resume optimization
 * @param {string} prompt - User prompt
 * @returns {Object} { isValid: boolean, reason?: string }
 */
function checkRelevance(prompt) {
    // First, check for obviously off-topic requests
    for (const pattern of OFF_TOPIC_PATTERNS) {
        if (pattern.test(prompt)) {
            logger.warn('[PROMPT_VALIDATOR] Off-topic prompt detected', {
                pattern: pattern.toString(),
                promptPreview: prompt.substring(0, 100)
            });
            return {
                isValid: false,
                reason: 'Your prompt doesn\'t seem to be about resume optimization. Please describe how you want your resume improved.'
            };
        }
    }
    
    // Check for some resume-related keywords (soft check)
    const resumeKeywords = /\b(resume|cv|job|career|position|role|skills?|experience|hire|hiring|recruiter|ats|interview|apply|application|professional|work|employment|salary|company|industry)\b/i;
    
    // If prompt is short and has no resume keywords, it might be vague
    if (prompt.length < 20 && !resumeKeywords.test(prompt)) {
        return {
            isValid: false,
            reason: 'Please provide more details about how you want your resume optimized. For example: "Optimize for a Senior Developer role at a tech startup"'
        };
    }
    
    return { isValid: true };
}

/**
 * Check prompt length constraints
 * @param {string} prompt - User prompt
 * @returns {Object} { isValid: boolean, reason?: string }
 */
function checkLength(prompt) {
    const MIN_LENGTH = 10;
    const MAX_LENGTH = 2000;
    
    if (!prompt || prompt.trim().length < MIN_LENGTH) {
        return {
            isValid: false,
            reason: `Please provide a more detailed prompt (at least ${MIN_LENGTH} characters). Describe the role, industry, or specific improvements you want.`
        };
    }
    
    if (prompt.length > MAX_LENGTH) {
        return {
            isValid: false,
            reason: `Your prompt is too long (max ${MAX_LENGTH} characters). Please be more concise.`
        };
    }
    
    return { isValid: true };
}

/**
 * Sanitize prompt by removing potentially harmful characters
 * @param {string} prompt - User prompt
 * @returns {string} Sanitized prompt
 */
function sanitizePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return '';
    }
    
    return prompt
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove control characters (except newlines and tabs)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Trim
        .trim();
}

// ========== MAIN VALIDATION FUNCTION ==========

/**
 * Validate and sanitize a user prompt for resume optimization
 * 
 * @param {string} prompt - The user's optimization prompt
 * @param {Object} options - Validation options
 * @param {boolean} options.strictRelevance - Require resume-related keywords (default: false)
 * @param {boolean} options.throwOnInvalid - Throw AppError if invalid (default: true)
 * @returns {Object} { isValid: boolean, sanitizedPrompt?: string, error?: string }
 * @throws {AppError} If throwOnInvalid is true and validation fails
 */
export const validateOptimizationPrompt = (prompt, options = {}) => {
    const { strictRelevance = false, throwOnInvalid = true } = options;
    
    logger.info('[PROMPT_VALIDATOR] Validating optimization prompt', {
        promptLength: prompt?.length || 0,
        options
    });
    
    // Sanitize first
    const sanitizedPrompt = sanitizePrompt(prompt);
    
    // Run all validations
    const validations = [
        checkLength(sanitizedPrompt),
        checkMaliciousContent(sanitizedPrompt),
        checkInappropriateContent(sanitizedPrompt),
    ];
    
    // Add relevance check if strict mode
    if (strictRelevance) {
        validations.push(checkRelevance(sanitizedPrompt));
    }
    
    // Find first failure
    for (const result of validations) {
        if (!result.isValid) {
            logger.warn('[PROMPT_VALIDATOR] Validation failed', {
                reason: result.reason
            });
            
            if (throwOnInvalid) {
                throw new AppError(result.reason, 400);
            }
            
            return {
                isValid: false,
                error: result.reason
            };
        }
    }
    
    logger.info('[PROMPT_VALIDATOR] ✅ Prompt validated successfully');
    
    return {
        isValid: true,
        sanitizedPrompt
    };
};

/**
 * Get example prompts to show users
 * @returns {Array<string>} Example optimization prompts
 */
export const getExamplePrompts = () => [
    "Optimize my resume for a Senior Software Engineer position at a FAANG company",
    "Tailor my resume for a Product Manager role in the fintech industry",
    "Make my resume more ATS-friendly for Data Science positions",
    "Highlight my leadership experience for a Director-level marketing role",
    "Optimize for remote frontend developer positions at startups",
    "Improve my resume for transitioning from teaching to corporate training",
    "Make my resume stand out for UX Designer roles at design agencies",
    "Tailor for entry-level positions in healthcare administration"
];

export default {
    validateOptimizationPrompt,
    getExamplePrompts,
    sanitizePrompt
};
