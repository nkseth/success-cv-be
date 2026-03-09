/**
 * Language Detection Utility
 * Detects whether resume text is in English or Spanish using heuristic word patterns.
 * Lightweight — no external NLP dependencies.
 */

// Common Spanish words/patterns (high frequency in resumes)
const SPANISH_INDICATORS = [
    // Resume section headers
    'experiencia', 'educación', 'educacion', 'habilidades', 'idiomas',
    'formación', 'formacion', 'objetivo', 'perfil', 'profesional',
    'estudios', 'capacitación', 'capacitacion', 'certificaciones',
    'logros', 'referencias', 'datos personales', 'resumen',
    'competencias', 'conocimientos', 'voluntariado', 'publicaciones',
    'premios', 'intereses', 'contacto', 'dirección', 'direccion',
    // Common resume words
    'empresa', 'puesto', 'cargo', 'responsabilidades', 'desarrollo',
    'gestión', 'gestion', 'implementación', 'implementacion',
    'universidad', 'licenciatura', 'ingeniero', 'ingeniería', 'ingenieria',
    'maestría', 'maestria', 'administración', 'administracion',
    'trabajo', 'actual', 'presente', 'proyecto', 'proyectos',
    // Common Spanish function words (very frequent)
    'de', 'en', 'para', 'con', 'los', 'las', 'del', 'una', 'por',
    'como', 'más', 'fue', 'ser', 'está', 'entre', 'también',
    'sobre', 'desde', 'hasta', 'durante', 'mediante', 'según'
];

// Common English words/patterns (high frequency in resumes)
const ENGLISH_INDICATORS = [
    // Resume section headers
    'experience', 'education', 'skills', 'summary', 'objective',
    'profile', 'certifications', 'achievements', 'references',
    'publications', 'awards', 'interests', 'contact', 'address',
    'qualifications', 'employment', 'professional',
    // Common resume words
    'managed', 'developed', 'implemented', 'leadership', 'responsible',
    'company', 'position', 'university', 'bachelor', 'master',
    'engineering', 'project', 'team', 'performance', 'improvement',
    // Common English function words
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have',
    'has', 'was', 'were', 'been', 'are', 'will', 'would', 'which',
    'their', 'about', 'into', 'through', 'during', 'before', 'after'
];

/**
 * Detect the language of resume text content.
 * Currently supports English and Spanish detection.
 * 
 * @param {string} text - Extracted text content from the resume
 * @returns {{ language: string, confidence: 'high' | 'medium' | 'low', languageName: string }}
 */
export function detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { language: 'en', confidence: 'low', languageName: 'English' };
    }

    const lowerText = text.toLowerCase();
    // Normalize accented characters for matching
    const normalizedText = lowerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Count matches for each language
    let spanishScore = 0;
    let englishScore = 0;

    for (const word of SPANISH_INDICATORS) {
        const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Check both accented and normalized versions
        const regex = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, 'gi');
        const matches = normalizedText.match(regex);
        if (matches) {
            spanishScore += matches.length;
        }
    }

    for (const word of ENGLISH_INDICATORS) {
        const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
            englishScore += matches.length;
        }
    }

    // Check for Spanish-specific characters (ñ, ¿, ¡, accented vowels in context)
    const spanishChars = (text.match(/[ñ¿¡áéíóúü]/gi) || []).length;
    spanishScore += spanishChars * 2; // Weight these heavily

    // Calculate total and ratio
    const totalScore = spanishScore + englishScore;

    if (totalScore === 0) {
        return { language: 'en', confidence: 'low', languageName: 'English' };
    }

    const spanishRatio = spanishScore / totalScore;
    const englishRatio = englishScore / totalScore;

    let language, confidence, languageName;

    if (spanishRatio > 0.6) {
        language = 'es';
        languageName = 'Spanish';
        confidence = spanishRatio > 0.75 ? 'high' : 'medium';
    } else if (englishRatio > 0.6) {
        language = 'en';
        languageName = 'English';
        confidence = englishRatio > 0.75 ? 'high' : 'medium';
    } else {
        // Mixed content — check which has higher absolute score
        if (spanishScore > englishScore) {
            language = 'es';
            languageName = 'Spanish';
            confidence = 'low';
        } else {
            language = 'en';
            languageName = 'English';
            confidence = 'low';
        }
    }

    return { language, confidence, languageName };
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { detectLanguage };
