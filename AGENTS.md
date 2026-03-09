# AGENTS.md - Development Guidelines for Success-CV Backend

## Project Overview

This is an Express.js backend API for a resume building platform. It uses:
- **Runtime**: Node.js with ES modules (`"type": "module"` in package.json)
- **Database**: PostgreSQL with Drizzle ORM
- **Queue System**: BullMQ with Redis
- **Validation**: Zod for schemas, custom validate-helper.js for input validation

---

## Commands

### Development
```bash
npm run dev           # Start server with nodemon (recommended for development)
npm start            # Start server in production
```

### Workers (Background Jobs)
```bash
npm run worker           # Resume analysis worker
npm run worker:dev       # Resume analysis worker with nodemon
npm run worker:rewrite  # Resume rewrite worker
npm run worker:email    # Email worker
npm run worker:job-scraping    # Job scraping worker
npm run worker:job-matching    # Job matching worker
npm run workers         # Run all workers concurrently
npm run workers:dev     # Run all workers with nodemon
```

### Database (Drizzle)
```bash
npm run generate        # Generate Drizzle migrations
npm run migrate         # Run Drizzle migrations
npm run migrate:status  # Check migration status
npm run studio          # Open Drizzle Studio
```

### Seeding
```bash
npm run seed:themes            # Seed themes
npm run seed:themes:images     # Seed themes with images
npm run seed:themes:full      # Seed themes with auto-generated images
npm run generate:theme-images # Generate theme images
```

### Testing
```bash
# NOTE: No test framework is currently configured
# The npm test script is a placeholder: "echo \"Error: no test specified\" && exit 1"
# To run a single test when tests are added, use:
# npm test -- --testPathPattern=<test-name>
# Or with Jest: npm test -- --testNamePattern="<test-name>"
```

---

## Code Style Guidelines

### General Principles
- Use ES modules (`import`/`export`) - the project uses `"type": "module"`
- Use async/await for all asynchronous operations
- Always wrap route handlers with `asyncHandler` middleware
- Use `try/catch` in service functions and re-throw errors

### File Organization
```
src/
├── controllers/     # Route handlers (noun.controller.js)
├── services/        # Business logic (noun.service.js)
├── models/          # Database queries (noun.model.js)
├── routes/          # Express routes (noun.route.js)
├── middleware/      # Express middleware
├── utils/           # Helper functions
├── drizzle/         # Database schema and migrations
└── queues/          # BullMQ workers and queue definitions
```

### Naming Conventions
- **Files**: Use kebab-case: `resume.controller.js`, `job-scraping.worker.js`
- **Classes**: Use PascalCase: `AppError`, `ResumeService`
- **Functions/Variables**: Use camelCase: `getResumeByID`, `userID`
- **Constants**: Use SCREAMING_SNAKE_CASE: `userTypeConstants.USER`
- **Database tables**: Use snake_case: `resume_contents`, `user_profiles`
- **Database columns**: Use camelCase in Drizzle (converted to snake_case automatically)

### Imports Order
1. External libraries (express, dotenv, etc.)
2. Internal modules (services, models, utils)
3. Relative imports (../middleware, ./utils)
4. Configuration imports

Example:
```javascript
import express from "express";
import axios from "axios";
import { AppError, asyncHandler } from "../middleware/error.js";
import resumeService from "../services/resume.service.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger } from "../utils/validate-helper.js";
import logger from "../middleware/logger.js";
```

### Async Error Handling
Always use the `asyncHandler` wrapper for route handlers:
```javascript
export const getResumeController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const validatedID = validateInteger(id, 'Resume ID');
    const resume = await resumeService.getResumeByID(validatedID, req.userID);
    sendSuccess(res, resume, 'Resume fetched successfully');
});
```

### Error Handling
- Use `AppError` class for application errors with status codes
- Throw errors in services, let middleware handle responses
- Always log errors with context using the logger:
```javascript
logger.error('[SERVICE_NAME] Failed to do something', {
    error: error.message,
    userID,
    resumeID
});
throw error;
```

### Response Format
Use the `sendSuccess` utility for consistent API responses:
```javascript
sendSuccess(res, data, message, statusCode)
```
Response structure:
```json
{
    "success": true,
    "message": "string",
    "data": {}
}
```

### Validation
- Use `validateInteger`, `validateString`, `validateEmail` from `utils/validate-helper.js`
- Use Zod schemas in `utils/resumeSchema.js` for complex validation
- Validate at controller level, sanitize in services

### Logging
Use the built-in logger with structured logging:
```javascript
import logger from "../middleware/logger.js";

logger.info('[CONTROLLER] Doing something', { userID, data });
logger.error('[SERVICE] Failed', { error: error.message, context });
```
Use prefixes like `[CONTROLLER]`, `[SERVICE]`, `[WORKER]` for easy filtering.

### Database (Drizzle ORM)
- Define schemas in `drizzle/schema/` directories
- Use descriptive names: `resumeContents`, `userProfiles`
- Always include `timestamps` (createdAt, updatedAt) columns
- Use relationships with proper foreign keys

### Environment Variables
- All config via `process.env`
- Use `.env` file (add to `.gitignore`)
- Document required variables in `.env.example`

### API Design
- RESTful endpoints: `/api/v1/resource`
- Use proper HTTP methods: GET (read), POST (create), PATCH (update), DELETE (delete)
- Use plural nouns: `/resumes`, not `/resume`
- Nested resources: `/resumes/:id/rewrites`
- Version APIs: `/api/v1/`

### Pagination
Use the `parseQueryParams` utility from `utils/pagination-filter.js`:
```javascript
const { pagination, filters, sort } = parseQueryParams(req.query, {
    defaultPageSize: 10,
    maxPageSize: 100,
    filterableFields: { status: 'array', createdAt: 'dateRange' },
    sortableFields: ['createdAt', 'updatedAt']
});
```

### Documentation
- Use JSDoc comments for controller functions describing endpoint, params, body
- Include Swagger annotations for API documentation
- Document worker flows in comments

### Code to Avoid
- Don't use `console.log` - use the logger
- Don't return raw database objects directly - format in services
- Don't put business logic in controllers - delegate to services
- Don't use callbacks - use async/await
- Don't leave unused imports

---

## Common Patterns

### Creating a New Route
1. Create controller in `controllers/noun.controller.js`
2. Create service in `services/noun.service.js`
3. Create/update model in `models/noun.model.js`
4. Create route in `routes/v1/noun.route.js`
5. Register route in `routes/v1/index.route.js`

### Adding a Background Job
1. Create queue in `queues/noun.queue.js`
2. Create worker in `queues/workers/noun.worker.js`
3. Add job producer function in relevant service
4. Register queue in `queues/index.js`

### Database Migration
1. Make schema changes in `drizzle/schema/`
2. Run `npm run generate` to create migration
3. Review migration file in `drizzle/migrations/`
4. Run `npm run migrate` to apply

---

## Important Notes

- No formal test framework exists yet
- This is a multi-tenant system supporting both regular users and candidates (B2B)
- Background workers process AI resume analysis, rewriting, job scraping, and email
- Redis is required for queues and caching
- CORS is configured dynamically via `ALLOWED_ORIGINS` env var

---

## Production Configuration

### Required Environment Variables
The following variables MUST be set for production:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET_ACCESS_KEY` - Secret key for JWT access tokens
- `REDIS_HOST` - Redis host for queues/caching
- `NODE_ENV=production` - Set to "production"

### Optional Production Settings
All configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | 900000 (15 min) | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |
| `REQUEST_TIMEOUT_MS` | 30000 (30 sec) | Request timeout |
| `BODY_PARSER_LIMIT` | 10mb | Max request body size |
| `REDIS_TLS` | false | Enable TLS for Redis |
| `SWAGGER_ENABLED` | false (prod) | Enable API docs |

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` with production domains
- [ ] Enable `REDIS_TLS=true`
- [ ] Use strong `JWT_SECRET_ACCESS_KEY` (min 32 chars)
- [ ] Set `SWAGGER_ENABLED=false` (default in production)
- [ ] Configure proper `DATABASE_URL` with SSL
- [ ] Set up monitoring/logging infrastructure
