import express, { json, urlencoded } from "express";
import { errorHandler, notFound } from "./middleware/error.js";
import logger, { requestLogger, errorLogger, logStartup, logShutdown } from "./middleware/logger.js";
import { sendSuccess } from "./utils/apiHelpers.js";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import v1Routes from "./routes/v1/index.route.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.config.js";
import { connectRedis, disconnectRedis, bullMQConnection, getRedisConnectionConfig } from "./config/redis.config.js";
import { closeAllQueues } from "./queues/index.js";
import pubSubService from "./services/pubsub.service.js";
import sseService from "./services/sse.service.js";
import { schedulePeriodicScraping, scheduleIndianScraping } from "./queues/job-scraping.queue.js";
import { isScrapeServiceHealthy } from "./services/jobBoards/indianBoards.service.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Validate required environment variables
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET_ACCESS_KEY',
    'REDIS_HOST'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    if (isProduction) {
        process.exit(1);
    } else {
        console.warn('⚠️  Running in development mode - missing env vars will cause runtime errors');
    }
}

// Rate limiting configuration from environment
const rateLimitConfig = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/health-check';
    }
};

// Apply rate limiting
const limiter = rateLimit(rateLimitConfig);
app.use(limiter);

// Request timeout configuration
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000; // 30 seconds default
app.use((req, res, next) => {
    // Skip timeout for SSE connections as they are long-lived by design
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
        return next();
    }

    // Also skip if path includes sse 
    if (req.originalUrl && req.originalUrl.includes('/sse/')) {
        return next();
    }

    res.setTimeout(requestTimeout, () => {
        logger.warn('Request timeout', { path: req.originalUrl || req.path, method: req.method });
        if (!res.headersSent) {
            res.status(503).json({
                success: false,
                message: 'Request timeout - please try again'
            });
        }
    });

    next();
});

// Log application startup
logStartup(PORT, NODE_ENV);

// Security middleware - Helmet with production optimizations
app.use(helmet({
    contentSecurityPolicy: isProduction ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"]
        }
    } : false,
    hsts: isProduction ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    crossOriginEmbedderPolicy: false // Allow embedding for API docs
}));

// Disable X-Powered-By header
app.disable('x-powered-by');

// Trust proxy for correct IP detection behind load balancers
if (isProduction) {
    app.set('trust proxy', 1);
}

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

// Body parsing middleware with environment-based limits
const bodyParserLimit = process.env.BODY_PARSER_LIMIT || '10mb';
app.use(urlencoded({ extended: true, limit: bodyParserLimit }));
app.use(json({
    limit: bodyParserLimit,
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

// Swagger documentation (disabled in production by default)
const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
if (swaggerEnabled || !isProduction) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "Success-CV API Docs"
    }));
}

// API routes
app.use("/api/v1", v1Routes);

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

        // Schedule periodic job scraping (global sources: RemoteOK, Remotive, etc.)
        await schedulePeriodicScraping();

        // Schedule Indian job board scraping only if the Python scraper service is reachable
        const scraperHealthy = await isScrapeServiceHealthy();
        if (scraperHealthy) {
            await scheduleIndianScraping();
            logger.info('Indian job board scraping scheduled — Python scraper service is reachable');
        } else {
            logger.warn('Skipping Indian job board scheduling — Python scraper service is not reachable at ' + (process.env.SCRAPER_SERVICE_URL || 'http://localhost:8001'));
        }

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
