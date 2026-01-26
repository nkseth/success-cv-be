import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { authenticateAdmin, requireSuperAdmin, requireAdminRole } from "../../middleware/admin-auth.js";

/**
 * Admin Routes
 * Protected by token-based context middleware (admin token type required)
 * All routes require admin authentication
 */
import {
    // Auth
    adminLoginController,
    createAdminController,
    listAdminsController,
    // Settings
    getSettingController,
    updateSettingController,
    getSettingsByCategoryController,
    getAllSettingsController,
    deleteSettingController,
    // Themes
    getThemeUploadUrlController,
    createResumeThemeController,
    getResumeThemeController,
    listResumeThemesController,
    updateResumeThemeController,
    deleteResumeThemeController,
    // User blocking
    blockUserController,
    unblockUserController,
    checkUserBlockedController,
    listBlockedUsersController,
    // User management
    listAllUsersController,
    listAllCandidatesController,
    listAllOrganisationsController,
    createUserController,
    createCandidateController,
    createOrganisationController,
    addUserToOrganisationController,
    // Activity logs
    getActivityLogsController,
    // Dashboard
    getAdminDashboardController,
    // Credit management
    getWalletController,
    adjustCreditsController
} from "../../controllers/admin.controller.js";

const router = Router();

// ==================== PUBLIC ROUTES (No Auth) ====================

// Health check
router.get('/health', (req, res) => {
    logger.info("Admin API health route accessed");
    sendSuccess(res, null, "Admin API is healthy");
});

// Admin login (public)
router.post('/login', adminLoginController);

// ==================== PROTECTED ROUTES (Admin Auth Required) ====================
router.use(authenticateAdmin);

// Dashboard
router.get('/dashboard', getAdminDashboardController);

// ==================== ADMIN MANAGEMENT (Super Admin Only) ====================
router.post('/admins', requireSuperAdmin, createAdminController);
router.get('/admins', requireSuperAdmin, listAdminsController);

// ==================== SYSTEM SETTINGS ====================
router.get('/settings', getAllSettingsController);
router.get('/settings/category/:category', getSettingsByCategoryController);
router.get('/settings/:key', getSettingController);
router.put('/settings', updateSettingController);
router.delete('/settings/:key', requireSuperAdmin, deleteSettingController);

// ==================== RESUME THEMES ====================
router.get('/themes', listResumeThemesController);
router.get('/themes/:id', getResumeThemeController);
router.post('/themes/upload-url', getThemeUploadUrlController);
router.post('/themes', createResumeThemeController);
router.put('/themes/:id', updateResumeThemeController);
router.delete('/themes/:id', deleteResumeThemeController);

// ==================== USER BLOCKING ====================
router.get('/blocked-users', listBlockedUsersController);
router.get('/blocked-users/check', checkUserBlockedController);
router.post('/blocked-users', blockUserController);
router.delete('/blocked-users/:id', unblockUserController);

// ==================== USER MANAGEMENT ====================
router.get('/users', listAllUsersController);
router.post('/users', createUserController);
router.get('/candidates', listAllCandidatesController);
router.post('/candidates', createCandidateController);
router.get('/organisations', listAllOrganisationsController);
router.post('/organisations', createOrganisationController);
router.post('/organisations/:id/members', addUserToOrganisationController);

// ==================== CREDIT/WALLET MANAGEMENT ====================
router.get('/wallets', getWalletController);
router.post('/wallets/adjust', adjustCreditsController);

// ==================== ACTIVITY LOGS ====================
router.get('/activity-logs', getActivityLogsController);

export const adminRoutes = router;
