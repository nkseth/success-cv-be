/**
 * Token-Based Context Middleware
 * 
 * Uses JWT token type to set user context (not actual subdomain):
 * - Token type "admin" → Admin users (admin_users table)
 * - Token type "user" → Regular users (users table)
 * - Token type "candidate" → Candidates (candidates table)
 * 
 * This allows frontend subdomains (admin.localhost, app.localhost, [org].localhost)
 * to work with a single backend (localhost:8000) without subdomain routing.
 */

import jwt from "jsonwebtoken";
import { userTypeConstants } from "../utils/constants.js";
import { destructureRequest } from "../utils/apiHelpers.js";

/**
 * Extract subdomain from host
 * @param {string} host - The request host (e.g., "admin.example.com", "app.localhost:3000")
 * @returns {string} - The subdomain or empty string
 */
export const extractSubdomain = (host) => {
    if (!host) return '';
    
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];
    
    // Split by dots
    const parts = hostWithoutPort.split('.');
    
    // Handle localhost specially (e.g., admin.localhost)
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
        return parts[0];
    }
    
    // For regular domains (e.g., admin.example.com, admin.example.co.uk)
    // If we have at least 3 parts, first part is subdomain
    if (parts.length >= 3) {
        return parts[0];
    }
    
    // For 2 parts like example.com, no subdomain
    if (parts.length === 2) {
        return '';
    }
    
    return '';
};

/**
 * Determine user type based on JWT token type
 * @param {string} tokenType - The token type from JWT
 * @returns {object} - User context with type info
 */
export const getUserContextFromTokenType = (tokenType) => {
    switch (tokenType) {
        case userTypeConstants.ADMIN:
            return {
                userType: userTypeConstants.ADMIN,
                isAdmin: true,
                isApp: false,
                isOrganisation: false,
                organisationSlug: null
            };
        case userTypeConstants.USER:
            return {
                userType: userTypeConstants.USER,
                isAdmin: false,
                isApp: true,
                isOrganisation: false,
                organisationSlug: null
            };
        case userTypeConstants.CANDIDATE:
            return {
                userType: userTypeConstants.CANDIDATE,
                isAdmin: false,
                isApp: false,
                isOrganisation: true,
                organisationSlug: null
            };
        default:
            return null;
    }
};

/**
 * Token-based context middleware
 * Attaches userContext to the request object with:
 * - userType: 'admin' | 'user' | 'candidate'
 * - isAdmin: boolean
 * - isApp: boolean  
 * - isOrganisation: boolean
 * - organisationSlug: string | null
 * 
 * Uses JWT token type instead of subdomain for routing
 */
export const subdomainMiddleware = (req, res, next) => {
    const { token } = destructureRequest(req);
    
    // If no token, we can't determine context - let auth middleware handle it
    if (!token) {
        // Set a default context for unauthenticated routes
        req.subdomainContext = null;
        req.subdomain = '';
        return next();
    }
    
    try {
        // Decode token to get type (don't verify here, auth middleware will do that)
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.type) {
            req.subdomainContext = null;
            req.subdomain = '';
            return next();
        }
        
        // Get user context based on token type
        const userContext = getUserContextFromTokenType(decoded.type);
        
        if (!userContext) {
            req.subdomainContext = null;
            req.subdomain = '';
            return next();
        }
        
        // Attach to request object
        req.subdomainContext = userContext;
        req.subdomain = decoded.type; // Use token type as "subdomain" for backward compatibility
        
        // Also attach individual flags for convenience
        req.isAdminSubdomain = userContext.isAdmin;
        req.isAppSubdomain = userContext.isApp;
        req.isOrgSubdomain = userContext.isOrganisation;
        req.organisationSlug = userContext.organisationSlug;
        
        next();
    } catch (err) {
        // Token decode failed, set null context
        req.subdomainContext = null;
        req.subdomain = '';
        next();
    }
};

/**
 * Middleware to require a specific token type
 * Returns 403 if the request token is not the expected type
 */
export const requireSubdomain = (expectedType) => {
    return (req, res, next) => {
        if (!req.subdomainContext) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required - no valid token found'
            });
        }
        
        const { userType } = req.subdomainContext;
        
        if (userType !== expectedType) {
            return res.status(403).json({
                success: false,
                message: `This endpoint requires ${expectedType} access`,
                expected: expectedType,
                received: userType
            });
        }
        
        next();
    };
};

/**
 * Middleware to require admin subdomain
 */
export const requireAdminSubdomain = requireSubdomain(userTypeConstants.ADMIN);

/**
 * Middleware to require app subdomain (regular users)
 */
export const requireAppSubdomain = requireSubdomain(userTypeConstants.USER);

/**
 * Middleware to require organisation subdomain (candidates)
 */
export const requireOrgSubdomain = requireSubdomain(userTypeConstants.CANDIDATE);

export default subdomainMiddleware;
