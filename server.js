import express, { json, urlencoded } from "express";
import { errorHandler, notFound } from "./middleware/error.js";
import logger, { requestLogger, errorLogger, logStartup, logShutdown } from "./middleware/logger.js";
import { sendSuccess } from "./utils/apiHelpers.js";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import v1Routes from "./routes/v1/index.route.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.config.js";
import { connectRedis, disconnectRedis, bullMQConnection, getRedisConnectionConfig } from "./config/redis.config.js";
import { closeAllQueues } from "./queues/index.js";
import pubSubService from "./services/pubsub.service.js";
import sseService from "./services/sse.service.js";
import { schedulePeriodicScraping } from "./queues/job-scraping.queue.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Log application startup
logStartup(PORT, NODE_ENV);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Get allowed origins from environment or use defaults
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
        
        // Check if origin matches any allowed origin
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (origin === allowedOrigin) return true;
            
            // Check for subdomain pattern (e.g., *.localhost:3000)
            if (allowedOrigin.startsWith('*.')) {
                const domain = allowedOrigin.substring(2); // Remove '*.'
                return origin.endsWith(`.${domain}`) || origin === `http://${domain}` || origin === `https://${domain}`;
            }
            
            return false;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            logger.warn('CORS: Blocked origin', { origin });
            callback(null, false); // Don't throw error, just deny
        }
    },
    credentials: true
}));

// Request logging middleware (before all routes)
app.use(requestLogger);

// Body parsing middleware
// Use verify option to capture raw body for webhook signature verification
app.use(urlencoded({ extended: true, limit: '10mb' }));
app.use(json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook signature verification
        // Only capture for webhook endpoints
        if (req.originalUrl.includes('/webhook')) {
            req.rawBody = buf.toString();
        }
    }
}));

// Root route
app.get("/", (req, res) => {
    logger.info("Root route accessed");

    const apiInfo = {
        name: "Success-CV Backend API",
        version: "1.0.0",
        environment: NODE_ENV
    };

    sendSuccess(res, apiInfo, "Welcome to Success-CV Backend API");
});

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Success-CV API Docs"
}));

// API routes
app.use("/api/v1",v1Routes);

// Health check routes (both /health and /health-check for compatibility)
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

app.get("/health-check", (req, res) => {
    logger.info("Health check requested");

    const healthData = {
        environment: NODE_ENV,
        uptime: process.uptime(),
        status: "healthy"
    };

    sendSuccess(res, healthData, "Server is healthy");
});

// Error logging middleware (before error handlers)
app.use(errorLogger);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize services
async function initializeServices() {
    try {
        // Connect to Redis
        await connectRedis();
        
        // Initialize PubSub service with Redis configuration
        await pubSubService.initialize(
            getRedisConnectionConfig({
                db: parseInt(process.env.REDIS_DB_CACHE) || 0,
                connectionName: 'pubsub:api'
            }),
            {
                mode: 'both',
                connectionNamePrefix: 'pubsub:api'
            }
        );
        
        // Schedule periodic job scraping (every 6 hours)
        await schedulePeriodicScraping();
        
        logger.info('All services initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize services', { error: error.message });
        throw error;
    }
}

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, starting graceful shutdown...`);
    
    try {
        // Close SSE connections
        await sseService.closeAllConnections();
        
        // Disconnect PubSub service
        await pubSubService.disconnect();
        
        // Close Redis connections
        await disconnectRedis();
        
        // Close all queue connections
        await closeAllQueues();
        
        logShutdown(signal);
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        promise: promise.toString()
    });
    process.exit(1);
});

// Start the server with service initialization
const server = app.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`, {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
    
    // Initialize services after server starts
    try {
        await initializeServices();
    } catch (error) {
        logger.error('Failed to initialize services (Redis/Queues)', { 
            error: error.message 
        });
        logger.warn('⚠️  Server is running without Redis - queue and caching features disabled');
        logger.warn('⚠️  Email sending, resume analysis, and other background jobs will not work');
        // Don't crash the server - let it run in degraded mode
    }
});
