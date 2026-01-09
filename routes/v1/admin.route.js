import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { authenticateAdmin, requireSuperAdmin, requireAdminRole } from "../../middleware/admin-auth.js";
import {
    // Auth
    adminLoginController,
    getAdminProfileController,
    createAdminController,
    listAdminsController,
    // Settings
    getSettingController,
    updateSettingController,
    getSettingsByCategoryController,
    getAllSettingsController,
    deleteSettingController,
    // Templates
    getTemplateUploadUrlController,
    createResumeTemplateController,
    getResumeTemplateController,
    listResumeTemplatesController,
    updateResumeTemplateController,
    deleteResumeTemplateController,
    // User blocking
    blockUserController,
    unblockUserController,
    checkUserBlockedController,
    listBlockedUsersController,
    // User management
    listAllUsersController,
    listAllCandidatesController,
    listAllOrganisationsController,
    // Activity logs
    getActivityLogsController,
    // Dashboard
    getAdminDashboardController
} from "../../controllers/admin.controller.js";

const router = Router();

// ==================== PUBLIC ROUTES (No Auth) ====================

// Health check
router.get('/health', (req, res) => {
    logger.info("Admin API health route accessed");
    sendSuccess(res, null, "Admin API is healthy");
});

// Admin login
router.post('/login', adminLoginController);

// ==================== PROTECTED ROUTES (Admin Auth Required) ====================
router.use(authenticateAdmin);

// Profile
router.get('/profile', getAdminProfileController);

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

// ==================== RESUME TEMPLATES ====================
router.get('/templates', listResumeTemplatesController);
router.get('/templates/:id', getResumeTemplateController);
router.post('/templates/upload-url', getTemplateUploadUrlController);
router.post('/templates', createResumeTemplateController);
router.put('/templates/:id', updateResumeTemplateController);
router.delete('/templates/:id', deleteResumeTemplateController);

// ==================== USER BLOCKING ====================
router.get('/blocked-users', listBlockedUsersController);
router.get('/blocked-users/check', checkUserBlockedController);
router.post('/blocked-users', blockUserController);
router.delete('/blocked-users/:id', unblockUserController);

// ==================== USER MANAGEMENT ====================
router.get('/users', listAllUsersController);
router.get('/candidates', listAllCandidatesController);
router.get('/organisations', listAllOrganisationsController);

// ==================== ACTIVITY LOGS ====================
router.get('/activity-logs', getActivityLogsController);

export const adminRoutes = router;
