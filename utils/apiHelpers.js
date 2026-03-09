// Simple API Response Builder

/**
 * Build success response
 */
export const successResponse = (data = null, message = "Success", meta = {}) => {
    const response = {
        success: true,
        message
    };

    if (data !== null) {
        response.data = data;
    }

    if (Object.keys(meta).length > 0) {
        response.meta = meta;
    }

    return response;
};

/**
 * Build error response
 */
export const errorResponse = (message = "Error", statusCode = 500) => {
    return {
        success: false,
        message,
        statusCode
    };
};

/**
 * Send success response
 */
export const sendSuccess = (res, data, message = "Success", statusCode = 200, meta = {}) => {
    return res.status(statusCode).json(successResponse(data, message, meta));
};

/**
 * Send error response
 */
export const sendError = (res, message = "Error", statusCode = 500) => {
    return res.status(statusCode).json(errorResponse(message, statusCode));
};

export const destructureRequest = (req) => {
    const headers = req.headers;
    const method = req.method;
    const url = req.url;
    const body = req.body;

    // Enhanced token extraction with better validation
    let token = null;
    const authHeader = req.headers['authorization'];

    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        } else if (authHeader.startsWith('bearer ')) {
            token = authHeader.substring(7); // Handle lowercase 'bearer'
        } else {
            // If no Bearer prefix, assume the entire header is the token
            token = authHeader;
        }

        // Trim any whitespace
        token = token.trim();

        // Validate token is not empty after processing
        if (token === '') {
            token = null;
        }
    }

    const refreshToken = req.headers['x-refresh-token'] || null;

    return { headers, method, url, body, token, refreshToken };
}

export const removeTimestampFields = (obj) => {

    const { createdAt, updatedAt, id, ...cleanObj } = obj;
    return cleanObj;
}

export const getAppFrontendUrl = () => {
    return process.env.FRONTEND_URL.replace(/^(https?:\/\/)(?!app\.)/, '$1app.');
};