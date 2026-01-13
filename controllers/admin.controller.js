import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateEmail, validateString, validateInteger } from "../utils/validate-helper.js";
import { userTypeConstants, adminRoleConstants } from "../utils/constants.js";
import {
    authenticateAdminService,
    createAdminService,
    getAdminByIdService,
    listAdminsService,
    getSettingService,
    updateSettingService,
    getSettingsByCategoryService,
    getAllSettingsService,
    deleteSettingService,
    getThemeUploadUrlService,
    createResumeThemeService,
    getResumeThemeService,
    listResumeThemesService,
    updateResumeThemeService,
    deleteResumeThemeService,
    blockUserService,
    unblockUserService,
    checkUserBlockedService,
    listBlockedUsersService,
    listAllUsersService,
    listAllCandidatesService,
    listAllOrganisationsService,
    getActivityLogsService,
    createUserService,
    createCandidateService,
    createOrganisationService,
    addUserToOrganisationService
} from "../services/admin.service.js";

// Helper to get request metadata
const getRequestMeta = (req) => ({
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
});

// ==================== ADMIN AUTH CONTROLLERS ====================

/**
 * Admin login
 */
export const adminLoginController = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Email and password are required', 400));
    }

    const validatedEmail = validateEmail(email);
    const validatedPassword = validateString(password, 'Password', { minLength: 1 });

    const { ipAddress, userAgent } = getRequestMeta(req);
    const admin = await authenticateAdminService(validatedEmail, validatedPassword, ipAddress, userAgent);

    // Generate JWT token
    const accessToken = jwt.sign(
        { 
            id: admin.id, 
            type: userTypeConstants.ADMIN,
            role: admin.role 
        },
        process.env.JWT_SECRET_ACCESS_KEY,
        { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
        { 
            id: admin.id, 
            type: userTypeConstants.ADMIN,
            role: admin.role 
        },
        process.env.JWT_SECRET_REFRESH_KEY || process.env.JWT_SECRET_ACCESS_KEY,
        { expiresIn: '7d' }
    );

    sendSuccess(res, {
        admin,
        accessToken,
        refreshToken,
        expiresIn: '8h'
    }, 'Admin login successful');
});

/**
 * Get current admin profile
 */
export const getAdminProfileController = asyncHandler(async (req, res, next) => {
    const admin = await getAdminByIdService(req.adminID);
    
    if (!admin) {
        return next(new AppError('Admin not found', 404));
    }

    sendSuccess(res, admin, 'Admin profile retrieved successfully');
});

/**
 * Create new admin (super_admin only)
 */
export const createAdminController = asyncHandler(async (req, res, next) => {
    const { email, password, fullname, role } = req.body;

    if (!email || !password || !fullname) {
        return next(new AppError('Email, password, and fullname are required', 400));
    }

    // Only super_admin can create other admins
    if (req.adminRole !== adminRoleConstants.SUPER_ADMIN) {
        return next(new AppError('Only super admins can create new admin accounts', 403));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const newAdmin = await createAdminService(
        { email, password, fullname, role },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, newAdmin, 'Admin created successfully', 201);
});

/**
 * List all admins
 */
export const listAdminsController = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;

    const result = await listAdminsService({
        page: parseInt(page),
        limit: parseInt(limit)
    });

    sendSuccess(res, result, 'Admins retrieved successfully');
});

// ==================== SYSTEM SETTINGS CONTROLLERS ====================

/**
 * Get a specific setting
 */
export const getSettingController = asyncHandler(async (req, res, next) => {
    const { key } = req.params;

    if (!key) {
        return next(new AppError('Setting key is required', 400));
    }

    const setting = await getSettingService(key);

    if (!setting) {
        return next(new AppError('Setting not found', 404));
    }

    sendSuccess(res, setting, 'Setting retrieved successfully');
});

/**
 * Update or create a setting
 */
export const updateSettingController = asyncHandler(async (req, res, next) => {
    const { key, value, type, category, description, isPublic } = req.body;

    if (!key) {
        return next(new AppError('Setting key is required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const setting = await updateSettingService(
        { key, value, type, category, description, isPublic },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, setting, 'Setting updated successfully');
});

/**
 * Get settings by category
 */
export const getSettingsByCategoryController = asyncHandler(async (req, res, next) => {
    const { category } = req.params;

    if (!category) {
        return next(new AppError('Category is required', 400));
    }

    const settings = await getSettingsByCategoryService(category);
    sendSuccess(res, settings, 'Settings retrieved successfully');
});

/**
 * Get all settings
 */
export const getAllSettingsController = asyncHandler(async (req, res, next) => {
    const { category, isPublic, page = 1, limit = 50 } = req.query;

    const settings = await getAllSettingsService({
        category,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
    });

    sendSuccess(res, settings, 'All settings retrieved successfully');
});

/**
 * Delete a setting
 */
export const deleteSettingController = asyncHandler(async (req, res, next) => {
    const { key } = req.params;

    if (!key) {
        return next(new AppError('Setting key is required', 400));
    }

    // Only super_admin can delete settings
    if (req.adminRole !== adminRoleConstants.SUPER_ADMIN) {
        return next(new AppError('Only super admins can delete settings', 403));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const deleted = await deleteSettingService(key, req.adminID, ipAddress, userAgent);

    if (!deleted) {
        return next(new AppError('Setting not found', 404));
    }

    sendSuccess(res, null, 'Setting deleted successfully');
});

// ==================== RESUME THEME CONTROLLERS ====================

/**
 * Get presigned URL for theme asset upload
 */
export const getThemeUploadUrlController = asyncHandler(async (req, res, next) => {
    const { fileName } = req.body;

    if (!fileName) {
        return next(new AppError('fileName is required', 400));
    }

    const result = await getThemeUploadUrlService(fileName);
    sendSuccess(res, result, 'Upload URL generated successfully');
});

/**
 * Create resume theme
 */
export const createResumeThemeController = asyncHandler(async (req, res, next) => {
    const { 
        name, 
        slug,
        description, 
        thumbnailURL, 
        previewURL,
        category, 
        config,
        isATSOptimized,
        isPublic
    } = req.body;

    if (!name) {
        return next(new AppError('Name is required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const theme = await createResumeThemeService(
        { 
            name, 
            slug,
            description, 
            thumbnailURL, 
            previewURL,
            category, 
            config,
            isATSOptimized,
            isPublic
        },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, theme, 'Resume theme created successfully', 201);
});

/**
 * Get resume theme by ID
 */
export const getResumeThemeController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const theme = await getResumeThemeService(parseInt(id));

    if (!theme) {
        return next(new AppError('Theme not found', 404));
    }

    sendSuccess(res, theme, 'Theme retrieved successfully');
});

/**
 * List resume themes
 */
export const listResumeThemesController = asyncHandler(async (req, res, next) => {
    const { category, isATSOptimized, isPublic, search, page = 1, limit = 20 } = req.query;

    const result = await listResumeThemesService({
        category,
        isATSOptimized: isATSOptimized === 'true' ? true : isATSOptimized === 'false' ? false : undefined,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        search,
        page: parseInt(page),
        limit: parseInt(limit)
    });

    sendSuccess(res, result, 'Themes retrieved successfully');
});

/**
 * Update resume theme
 */
export const updateResumeThemeController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const updateData = req.body;

    if (Object.keys(updateData).length === 0) {
        return next(new AppError('No update data provided', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const theme = await updateResumeThemeService(
        parseInt(id),
        updateData,
        req.adminID,
        ipAddress,
        userAgent
    );

    if (!theme) {
        return next(new AppError('Theme not found', 404));
    }

    sendSuccess(res, theme, 'Theme updated successfully');
});

/**
 * Delete resume theme
 */
export const deleteResumeThemeController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { ipAddress, userAgent } = getRequestMeta(req);
    const deleted = await deleteResumeThemeService(
        parseInt(id),
        req.adminID,
        ipAddress,
        userAgent
    );

    if (!deleted) {
        return next(new AppError('Theme not found', 404));
    }

    sendSuccess(res, null, 'Theme deleted successfully');
});

// ==================== USER BLOCKING CONTROLLERS ====================

/**
 * Block a user
 */
export const blockUserController = asyncHandler(async (req, res, next) => {
    const { userId, candidateId, userType, reason } = req.body;

    if (!userType) {
        return next(new AppError('userType is required', 400));
    }

    if (userType === userTypeConstants.USER && !userId) {
        return next(new AppError('userId is required for user type', 400));
    }

    if (userType === userTypeConstants.CANDIDATE && !candidateId) {
        return next(new AppError('candidateId is required for candidate type', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const block = await blockUserService(
        { userId, candidateId, userType, reason },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, block, 'User blocked successfully', 201);
});

/**
 * Unblock a user
 */
export const unblockUserController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { ipAddress, userAgent } = getRequestMeta(req);
    const unblock = await unblockUserService(
        parseInt(id),
        req.adminID,
        ipAddress,
        userAgent
    );

    if (!unblock) {
        return next(new AppError('Block record not found or already unblocked', 404));
    }

    sendSuccess(res, unblock, 'User unblocked successfully');
});

/**
 * Check if user is blocked
 */
export const checkUserBlockedController = asyncHandler(async (req, res, next) => {
    const { userId, userType } = req.query;

    if (!userId || !userType) {
        return next(new AppError('userId and userType are required', 400));
    }

    const isBlocked = await checkUserBlockedService(parseInt(userId), userType);
    sendSuccess(res, { isBlocked }, 'Block status retrieved successfully');
});

/**
 * List blocked users
 */
export const listBlockedUsersController = asyncHandler(async (req, res, next) => {
    const { userType, isActive, page = 1, limit = 20 } = req.query;

    const result = await listBlockedUsersService({
        userType,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
    });

    sendSuccess(res, result, 'Blocked users retrieved successfully');
});

// ==================== USER MANAGEMENT CONTROLLERS ====================

/**
 * List all users
 */
export const listAllUsersController = asyncHandler(async (req, res, next) => {
    const { search, page = 1, limit = 20, includeDeleted } = req.query;

    const result = await listAllUsersService({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        includeDeleted: includeDeleted === 'true'
    });

    sendSuccess(res, result, 'Users retrieved successfully');
});

/**
 * List all candidates
 */
export const listAllCandidatesController = asyncHandler(async (req, res, next) => {
    const { search, organisationId, page = 1, limit = 20, includeDeleted } = req.query;
    console.log('organisationId:', req);
    const result = await listAllCandidatesService({
        search,
        organisationId: organisationId ? parseInt(organisationId) : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
        includeDeleted: includeDeleted === 'true'
    });

    sendSuccess(res, result, 'Candidates retrieved successfully');
});

/**
 * List all organisations
 */
export const listAllOrganisationsController = asyncHandler(async (req, res, next) => {
    const { search, page = 1, limit = 20, includeDeleted } = req.query;

    const result = await listAllOrganisationsService({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        includeDeleted: includeDeleted === 'true'
    });

    sendSuccess(res, result, 'Organisations retrieved successfully');
});

/**
 * Create a new user (admin only)
 */
export const createUserController = asyncHandler(async (req, res, next) => {
    const { email, password, fullname } = req.body;

    if (!email || !password || !fullname) {
        return next(new AppError('Email, password, and fullname are required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const user = await createUserService(
        { email, password, fullname },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, user, 'User created successfully', 201);
});

/**
 * Create a new candidate (admin only)
 */
export const createCandidateController = asyncHandler(async (req, res, next) => {
    const { email, password, fullname, organisationId } = req.body;

    if (!email || !password || !fullname || !organisationId) {
        return next(new AppError('Email, password, fullname, and organisationId are required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const candidate = await createCandidateService(
        { email, password, fullname, organisationID: parseInt(organisationId) },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, candidate, 'Candidate created successfully', 201);
});

/**
 * Create a new organisation (admin only)
 */
export const createOrganisationController = asyncHandler(async (req, res, next) => {
    const { name, slug, creatorId, address, country, state, city } = req.body;

    if (!name || !slug || !creatorId) {
        return next(new AppError('Name, slug, and creatorId are required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const organisation = await createOrganisationService(
        { name, slug, creatorID: parseInt(creatorId), address, country, state, city },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, organisation, 'Organisation created successfully', 201);
});

/**
 * Add a user to an organisation (admin only)
 */
export const addUserToOrganisationController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
        return next(new AppError('userId and role are required', 400));
    }

    const { ipAddress, userAgent } = getRequestMeta(req);
    const member = await addUserToOrganisationService(
        { organisationId: parseInt(id), userId: parseInt(userId), role },
        req.adminID,
        ipAddress,
        userAgent
    );

    sendSuccess(res, member, 'User added to organisation successfully', 201);
});

// ==================== ACTIVITY LOG CONTROLLERS ====================

/**
 * Get activity logs
 */
export const getActivityLogsController = asyncHandler(async (req, res, next) => {
    const { adminId, action, resourceType, page = 1, limit = 50 } = req.query;

    const result = await getActivityLogsService({
        adminId: adminId ? parseInt(adminId) : undefined,
        action,
        resourceType,
        page: parseInt(page),
        limit: parseInt(limit)
    });

    sendSuccess(res, result, 'Activity logs retrieved successfully');
});

// ==================== ADMIN DASHBOARD CONTROLLERS ====================

/**
 * Get admin dashboard stats
 */
export const getAdminDashboardController = asyncHandler(async (req, res, next) => {
    // Get counts for dashboard
    const [users, candidates, blockedUsers, templates] = await Promise.all([
        listAllUsersService({ limit: 1 }),
        listAllCandidatesService({ limit: 1 }),
        listBlockedUsersService({ isActive: true, limit: 1 }),
        listResumeTemplatesService({ limit: 1 })
    ]);

    const stats = {
        totalUsers: users.pagination.total,
        totalCandidates: candidates.pagination.total,
        blockedUsers: blockedUsers.pagination.total,
        totalTemplates: templates.pagination.total
    };

    sendSuccess(res, stats, 'Dashboard stats retrieved successfully');
});
