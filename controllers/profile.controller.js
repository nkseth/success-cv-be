import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { userTypeConstants } from "../utils/constants.js";
import { getAdminByIdService } from "../services/admin.service.js";
import { getUserByIDModel } from "../models/user.model.js";
import { getCandidateById } from "../models/candidate.model.js";
import { getProfileByUserId } from "../models/profile.model.js";
import { excludeFields } from "../utils/security-helper.js";

/**
 * Unified Profile Controller
 * Uses JWT token type to determine which table to query
 */
export const getProfileController = asyncHandler(async (req, res, next) => {
    const tokenType = req.type;
    const userId = req.adminID || req.userID;
    
    if (!userId) {
        return next(new AppError('User ID not found in request. Authentication required.', 401));
    }

    if (!tokenType) {
        return next(new AppError('Token type not found in request.', 401));
    }

    console.log('[PROFILE CONTROLLER]', {
        tokenType,
        userId,
        adminID: req.adminID,
        userID: req.userID
    });

    let profile;
    let profileData;

    // Route to appropriate service/model based on token type
    if (tokenType === userTypeConstants.ADMIN) {
        // Admin token - fetch from admin_users table
        profile = await getAdminByIdService(userId);
        
        if (!profile) {
            return next(new AppError('Admin profile not found', 404));
        }
        
        sendSuccess(res, profile, 'Admin profile retrieved successfully');
        
    } else if (tokenType === userTypeConstants.USER) {
        // User token - fetch from users table
        profile = await getUserByIDModel(userId);
        
        if (!profile) {
            return next(new AppError('User profile not found', 404));
        }

        // Get additional profile data from profiles table
        profileData = await getProfileByUserId(userId);
        if (profileData) {
            profile.profile = excludeFields(profileData, ['userID', 'createdAt', 'updatedAt', 'deletedAt', 'id', 'candidateID']);
        }

        sendSuccess(res, profile, 'User profile retrieved successfully');
        
    } else if (tokenType === userTypeConstants.CANDIDATE) {
        // Candidate token - fetch from candidates table
        profile = await getCandidateById(userId);
        
        if (!profile) {
            return next(new AppError('Candidate profile not found', 404));
        }

        // Get additional profile data from profiles table
        profileData = await getProfileByUserId(userId);
        if (profileData) {
            profile.profile = excludeFields(profileData, ['userID', 'createdAt', 'updatedAt', 'deletedAt', 'id', 'candidateID']);
        }

        sendSuccess(res, profile, 'Candidate profile retrieved successfully');
        
    } else {
        return next(new AppError('Invalid token type: ' + tokenType, 400));
    }
});
