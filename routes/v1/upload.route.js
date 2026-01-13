import { Router } from "express";
import logger from "../../middleware/logger.js";
import { sendSuccess } from "../../utils/apiHelpers.js";
import { commonAuthenticate } from "../../middleware/authenticate-routes.js";
import { generatePresignedUrlController, getAccessUrlController } from "../../controllers/upload.controller.js";

/**
 * Upload Routes
 */

const router = Router();

router.use(commonAuthenticate);

router.get('/health', (req, res, next) => {
    logger.info("API v1 Upload health route accessed");
    sendSuccess(res, null, "Success-CV API v1 Upload is healthy");
});

// Generate presigned URL for upload
router.post('/presigned', generatePresignedUrlController);

// Get access URL for uploaded file
router.post('/access', getAccessUrlController);

export const uploadRoutes = router;
