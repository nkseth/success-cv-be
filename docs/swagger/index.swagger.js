/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and authorization endpoints for users
 *   - name: Candidate Auth
 *     description: Candidate authentication and bulk registration endpoints
 *   - name: Profile
 *     description: Unified profile endpoint that works across all subdomains (admin, app, organisation)
 *   - name: User
 *     description: User management endpoints
 *   - name: Organisation
 *     description: Organisation management, members, and invitations
 *   - name: Invites
 *     description: Invitation management and acceptance endpoints
 *   - name: Resume Analysis
 *     description: Resume analysis management and data retrieval endpoints
 *   - name: Resumes
 *     description: Unified resume content, editing, rewrites, and theming
 *   - name: Download
 *     description: Resume PDF download and preview operations
 *   - name: SSE (Server-Sent Events)
 *     description: Real-time updates via Server-Sent Events
 *   - name: Health
 *     description: Health check and system monitoring endpoints
 *   - name: Upload
 *     description: File upload with Azure Blob Storage presigned URLs
 *   - name: Admin
 *     description: Admin system management, settings, templates, and user blocking
 */

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Check API v1 health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy and operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success-CV API v1
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                       example: v1
 *                     endpoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [
 *                         "GET /api/v1/health",
 *                         "GET /api/v1/health/redis",
 *                         "GET /api/v1/health/queue", 
 *                         "GET /api/v1/health/cache",
 *                         "GET /api/v1/health/full"
 *                       ]
 */
