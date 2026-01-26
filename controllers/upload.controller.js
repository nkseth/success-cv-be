import { sendSuccess, sendError } from "../utils/apiHelpers.js";
import { generatePresignedUploadUrl, getFileAccessUrl } from "../services/Integraion/uploadImage.js";
import logger from "../middleware/logger.js";

// Simple async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Generate presigned URL for file upload
 * POST /api/v1/upload/presigned-url
 */
export const generatePresignedUrlController = asyncHandler(async (req, res) => {
    try {
        const { fileName, maxSizeInMB, expiryMinutes } = req.body;
        const userId = req.userID; // Get from authenticated user

        logger.info("Presigned URL request received", { fileName, userId, body: req.body });

        if (!fileName) {
            logger.warn("Presigned URL request missing fileName", { userId });
            return sendError(res, "fileName is required", 400);
        }

        if (!userId) {
            logger.warn("Presigned URL request missing user authentication");
            return sendError(res, "Authentication required", 401);
        }

        // Use user ID as container name (simplified approach)
        const containerName = `user-uploads`;
        // const containerName = `user-${userId}`;

        const options = {
            maxSizeInMB: maxSizeInMB || 5,
            expiryMinutes: expiryMinutes || 60,
            generateUniqueName: true
        };

        const result = await generatePresignedUploadUrl(containerName, fileName, options);

        logger.info(`Generated presigned URL for user ${userId}, file: ${fileName}`, { 
            originalName: result.originalName,
            generatedName: result.fileName 
        });

        return sendSuccess(res, result, "Presigned URL generated successfully");

    } catch (error) {
        logger.error("Error generating presigned URL:", error);
        return sendError(res, error.message, 500);
    }
});

/**
 * Get access URL for uploaded file
 * POST /api/v1/upload/access-url
 */
export const getAccessUrlController = asyncHandler(async (req, res) => {
    try {
        const { fileName } = req.body;
        const userId = req.userID // Get from authenticated user

        if (!fileName) {
            return sendError(res, "fileName is required", 400);
        }

        // Use user ID as container name (same as upload)
        const containerName = `user-uploads`;

        const accessUrl = await getFileAccessUrl(containerName, fileName, 60); // 1 hour expiry

        logger.info(`Generated access URL for user ${userId}, file: ${fileName}`);

        return sendSuccess(res, {
            accessUrl,
            fileName,
            expiryMinutes: 60
        }, "Access URL generated successfully");

    } catch (error) {
        logger.error("Error generating access URL:", error);
        return sendError(res, error.message, 500);
    }
});
