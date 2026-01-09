import jwt from "jsonwebtoken";
import { destructureRequest } from "../utils/apiHelpers.js";
import { userTypeConstants, adminRoleConstants } from "../utils/constants.js";
import { isUserBlockedModel } from "../models/admin.model.js";

/**
 * Authenticate admin users
 */
export function authenticateAdmin(req, res, next) {
    const { token } = destructureRequest(req);
    
    if (!token) {
        console.log('[ADMIN AUTH ERROR] No token provided');
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_ACCESS_KEY);
        
        if (decoded.type !== userTypeConstants.ADMIN) {
            console.log('[ADMIN AUTH ERROR] Access denied - not an admin, type:', decoded.type);
            return res.status(403).json({ message: "Access Denied: Admin access required" });
        }
        
        console.log('[ADMIN AUTH SUCCESS] Admin authenticated:', decoded.id, 'Role:', decoded.role);
        req.adminID = decoded.id;
        req.adminRole = decoded.role;
        req.type = decoded.type;
        next();
    } catch (err) {
        console.log('[ADMIN AUTH ERROR] Token verification failed:', err.message);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired", error: "TOKEN_EXPIRED" });
        }
        return res.status(403).json({ message: "Invalid token", error: "INVALID_TOKEN" });
    }
}

/**
 * Require super admin role
 */
export function requireSuperAdmin(req, res, next) {
    if (req.adminRole !== adminRoleConstants.SUPER_ADMIN) {
        console.log('[ADMIN AUTH ERROR] Super admin required, current role:', req.adminRole);
        return res.status(403).json({ message: "Access Denied: Super admin access required" });
    }
    next();
}

/**
 * Require admin or super admin role
 */
export function requireAdminRole(req, res, next) {
    const allowedRoles = [adminRoleConstants.SUPER_ADMIN, adminRoleConstants.ADMIN];
    
    if (!allowedRoles.includes(req.adminRole)) {
        console.log('[ADMIN AUTH ERROR] Admin role required, current role:', req.adminRole);
        return res.status(403).json({ message: "Access Denied: Admin role required" });
    }
    next();
}

/**
 * Middleware to check if a user/candidate is blocked
 * Use this in user authentication flows
 */
export async function checkUserNotBlocked(req, res, next) {
    try {
        const userId = req.userID;
        const userType = req.type;
        
        if (!userId || !userType) {
            return next();
        }

        const isBlocked = await isUserBlockedModel(userId, userType);
        
        if (isBlocked) {
            console.log('[AUTH ERROR] User is blocked:', userId, userType);
            return res.status(403).json({ 
                message: "Your account has been blocked. Please contact support.",
                error: "ACCOUNT_BLOCKED"
            });
        }
        
        next();
    } catch (err) {
        console.error('[AUTH ERROR] Failed to check block status:', err.message);
        // Don't block the request if we can't check - log the error
        next();
    }
}
