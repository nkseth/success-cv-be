import {
    createAdminModel,
    getAdminByEmailModel,
    getAdminByIdModel,
    updateAdminLastLoginModel,
    listAdminsModel,
    getSettingByKeyModel,
    upsertSettingModel,
    getSettingsByCategoryModel,
    getAllSettingsModel,
    deleteSettingModel,
    blockUserModel,
    unblockUserModel,
    isUserBlockedModel,
    listBlockedUsersModel,
    logAdminActivityModel,
    getAdminActivityLogsModel,
    listAllUsersModel,
    listAllCandidatesModel,
    listAllOrganisationsModel,
    adminCreateUserModel,
    adminCreateCandidateModel,
    adminCreateOrganisationModel,
    adminAddUserToOrganisationModel
} from "../models/admin.model.js";
import {
    createTheme,
    updateTheme,
    deleteTheme,
    getThemeByID,
    listAllThemesAdmin
} from "../models/theme.model.js";
import { comparePassword } from "../utils/security-helper.js";
import { AppError } from "../middleware/error.js";
import { adminActionConstants, settingTypeConstants } from "../utils/constants.js";
import { generatePresignedUploadUrl, getFileAccessUrl } from "./Integraion/uploadImage.js";

// ==================== ADMIN AUTH SERVICES ====================

/**
 * Authenticate admin user
 */
export const authenticateAdminService = async (email, password, ipAddress, userAgent) => {
    const admin = await getAdminByEmailModel(email);
    
    if (!admin) {
        throw new AppError('Invalid email or password', 401);
    }

    if (!admin.isActive) {
        throw new AppError('Admin account is deactivated', 403);
    }

    const isPasswordValid = await comparePassword(password, admin.passwordHash);
    if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await updateAdminLastLoginModel(admin.id);

    // Log the login activity
    await logAdminActivityModel({
        adminId: admin.id,
        action: adminActionConstants.LOGIN,
        ipAddress,
        userAgent
    });

    return {
        id: admin.id,
        fullname: admin.fullname,
        email: admin.email,
        role: admin.role
    };
};

/**
 * Create a new admin user (only super_admin can do this)
 */
export const createAdminService = async (adminData, creatorId, ipAddress, userAgent) => {
    const newAdmin = await createAdminModel(adminData);

    // Log the activity
    await logAdminActivityModel({
        adminId: creatorId,
        action: adminActionConstants.CREATE_ADMIN,
        resourceType: 'admin',
        resourceId: newAdmin.id,
        details: { email: newAdmin.email, role: newAdmin.role },
        ipAddress,
        userAgent
    });

    return newAdmin;
};

/**
 * Get admin by ID
 */
export const getAdminByIdService = async (id) => {
    return await getAdminByIdModel(id);
};

/**
 * List all admins
 */
export const listAdminsService = async (options) => {
    return await listAdminsModel(options);
};

// ==================== SYSTEM SETTINGS SERVICES ====================

/**
 * Get a system setting by key
 */
export const getSettingService = async (key) => {
    const setting = await getSettingByKeyModel(key);
    if (!setting) return null;

    // Parse value based on type
    return parseSettingValue(setting);
};

/**
 * Parse setting value based on its type
 */
const parseSettingValue = (setting) => {
    const { settingValue, settingType } = setting;
    
    switch (settingType) {
        case settingTypeConstants.NUMBER:
            return { ...setting, parsedValue: Number(settingValue) };
        case settingTypeConstants.BOOLEAN:
            return { ...setting, parsedValue: settingValue === 'true' };
        case settingTypeConstants.JSON:
            try {
                return { ...setting, parsedValue: JSON.parse(settingValue) };
            } catch {
                return { ...setting, parsedValue: settingValue };
            }
        default:
            return { ...setting, parsedValue: settingValue };
    }
};

/**
 * Update or create a system setting
 */
export const updateSettingService = async (settingData, adminId, ipAddress, userAgent) => {
    // Convert value to string for storage
    let valueToStore = settingData.value;
    if (settingData.type === settingTypeConstants.JSON && typeof valueToStore === 'object') {
        valueToStore = JSON.stringify(settingData.value);
    } else if (typeof valueToStore !== 'string') {
        valueToStore = String(settingData.value);
    }

    const result = await upsertSettingModel(
        { ...settingData, value: valueToStore },
        adminId
    );

    // Log the activity
    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.UPDATE_SETTINGS,
        resourceType: 'setting',
        details: { key: settingData.key },
        ipAddress,
        userAgent
    });

    return result;
};

/**
 * Get settings by category
 */
export const getSettingsByCategoryService = async (category) => {
    const settings = await getSettingsByCategoryModel(category);
    return settings.map(parseSettingValue);
};

/**
 * Get all settings
 */
export const getAllSettingsService = async (options) => {
    const settings = await getAllSettingsModel(options);
    return settings.map(parseSettingValue);
};

/**
 * Delete a setting
 */
export const deleteSettingService = async (key, adminId, ipAddress, userAgent) => {
    const result = await deleteSettingModel(key);

    if (result) {
        await logAdminActivityModel({
            adminId,
            action: 'delete_setting',
            resourceType: 'setting',
            details: { key },
            ipAddress,
            userAgent
        });
    }

    return result;
};

// ==================== RESUME THEME SERVICES ====================

/**
 * Generate presigned URL for theme asset upload (thumbnails, previews)
 */
export const getThemeUploadUrlService = async (fileName) => {
    const containerName = 'resume-themes';
    const options = {
        maxSizeInMB: 5,
        expiryMinutes: 30,
        generateUniqueName: true
    };

    return await generatePresignedUploadUrl(containerName, fileName, options);
};

/**
 * Create a new resume theme
 */
export const createResumeThemeService = async (themeData, adminId, ipAddress, userAgent) => {
    const theme = await createTheme(themeData);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.CREATE_THEME,
        resourceType: 'theme',
        resourceId: theme.id,
        details: { name: theme.name, category: theme.category },
        ipAddress,
        userAgent
    });

    return theme;
};

/**
 * Get resume theme by ID
 */
export const getResumeThemeService = async (id) => {
    return await getThemeByID(id);
};

/**
 * List resume themes for admin
 */
export const listResumeThemesService = async (options) => {
    return await listAllThemesAdmin(options);
};

/**
 * Update resume theme
 */
export const updateResumeThemeService = async (id, updateData, adminId, ipAddress, userAgent) => {
    const theme = await updateTheme(id, updateData);

    if (theme) {
        await logAdminActivityModel({
            adminId,
            action: adminActionConstants.UPDATE_THEME,
            resourceType: 'theme',
            resourceId: id,
            details: updateData,
            ipAddress,
            userAgent
        });
    }

    return theme;
};

/**
 * Delete resume theme
 */
export const deleteResumeThemeService = async (id, adminId, ipAddress, userAgent) => {
    const theme = await deleteTheme(id);

    if (theme) {
        await logAdminActivityModel({
            adminId,
            action: adminActionConstants.DELETE_THEME,
            resourceType: 'theme',
            resourceId: id,
            details: { name: theme.name },
            ipAddress,
            userAgent
        });
    }

    return theme;
};

// ==================== USER BLOCKING SERVICES ====================

/**
 * Block a user
 */
export const blockUserService = async (blockData, adminId, ipAddress, userAgent) => {
    const block = await blockUserModel(blockData, adminId);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.BLOCK_USER,
        resourceType: blockData.userType,
        resourceId: blockData.userId || blockData.candidateId,
        details: { reason: blockData.reason },
        ipAddress,
        userAgent
    });

    return block;
};

/**
 * Unblock a user
 */
export const unblockUserService = async (blockId, adminId, ipAddress, userAgent) => {
    const unblock = await unblockUserModel(blockId, adminId);

    if (unblock) {
        await logAdminActivityModel({
            adminId,
            action: adminActionConstants.UNBLOCK_USER,
            resourceType: unblock.userType,
            resourceId: unblock.userID || unblock.candidateID,
            ipAddress,
            userAgent
        });
    }

    return unblock;
};

/**
 * Check if user is blocked
 */
export const checkUserBlockedService = async (userId, userType) => {
    return await isUserBlockedModel(userId, userType);
};

/**
 * List blocked users
 */
export const listBlockedUsersService = async (options) => {
    return await listBlockedUsersModel(options);
};

// ==================== USER MANAGEMENT SERVICES ====================

/**
 * List all users (for admin dashboard)
 */
export const listAllUsersService = async (options) => {
    return await listAllUsersModel(options);
};

/**
 * List all candidates (for admin dashboard)
 */
export const listAllCandidatesService = async (options) => {
    return await listAllCandidatesModel(options);
};

/**
 * List all organisations (for admin dashboard)
 */
export const listAllOrganisationsService = async (options) => {
    return await listAllOrganisationsModel(options);
};

/**
 * Create a new user (admin only)
 */
export const createUserService = async (userData, adminId, ipAddress, userAgent) => {
    const user = await adminCreateUserModel(userData);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.CREATE_USER,
        resourceType: 'user',
        resourceId: user.id,
        details: { email: user.email, fullname: user.fullname },
        ipAddress,
        userAgent
    });

    return user;
};

/**
 * Create a new candidate (admin only)
 */
export const createCandidateService = async (candidateData, adminId, ipAddress, userAgent) => {
    const candidate = await adminCreateCandidateModel(candidateData);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.CREATE_CANDIDATE,
        resourceType: 'candidate',
        resourceId: candidate.id,
        details: { email: candidate.email, fullname: candidate.fullname, organisationID: candidate.organisationID },
        ipAddress,
        userAgent
    });

    return candidate;
};

/**
 * Create a new organisation (admin only)
 */
export const createOrganisationService = async (orgData, adminId, ipAddress, userAgent) => {
    const organisation = await adminCreateOrganisationModel(orgData);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.CREATE_ORGANISATION,
        resourceType: 'organisation',
        resourceId: organisation.id,
        details: { name: organisation.name, slug: organisation.slug },
        ipAddress,
        userAgent
    });

    return organisation;
};

/**
 * Add a user to an organisation (admin only)
 */
export const addUserToOrganisationService = async (memberData, adminId, ipAddress, userAgent) => {
    const member = await adminAddUserToOrganisationModel(memberData);

    await logAdminActivityModel({
        adminId,
        action: adminActionConstants.ADD_USER_TO_ORGANISATION,
        resourceType: 'organisation_member',
        resourceId: member.id,
        details: { userId: memberData.userId, organisationId: memberData.organisationId, role: memberData.role },
        ipAddress,
        userAgent
    });

    return member;
};

// ==================== ACTIVITY LOG SERVICES ====================

/**
 * Log admin activity
 */
export const logAdminActivityService = async (logData) => {
    return await logAdminActivityModel(logData);
};

/**
 * Get admin activity logs
 */
export const getActivityLogsService = async (options) => {
    return await getAdminActivityLogsModel(options);
};
