/**
 * @swagger
 * tags:
 *   - name: Profile
 *     description: Unified profile endpoints that work across all subdomains
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ProfileResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Profile retrieved successfully
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/AdminUser'
 *             - $ref: '#/components/schemas/User'
 *             - $ref: '#/components/schemas/Candidate'
 */

/**
 * @swagger
 * /api/v1/profile/health:
 *   get:
 *     summary: Profile service health check
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile service is healthy
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
 *                   example: Profile API is healthy
 */

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get current user profile (token-type-aware)
 *     description: |
 *       Unified profile endpoint that uses the JWT token type to return the appropriate profile:
 *       
 *       - Token type **"admin"** → Returns admin profile from admin_users table
 *       - Token type **"user"** → Returns user profile from users table + profiles table
 *       - Token type **"candidate"** → Returns candidate profile from candidates table + profiles table
 *       
 *       **Frontend Subdomain Support:**
 *       - Frontend at admin.localhost:3000 → Uses admin token → Gets admin profile
 *       - Frontend at app.localhost:3000 → Uses user token → Gets user profile
 *       - Frontend at [org].localhost:3000 → Uses candidate token → Gets candidate profile
 *       
 *       Backend determines profile type from the JWT token, not from subdomain.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                   example: Admin profile retrieved successfully
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/AdminUser'
 *                     - type: object
 *                       description: User with profile data
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                         isVerified:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         profile:
 *                           type: object
 *                           description: Additional profile data from profiles table
 *                     - type: object
 *                       description: Candidate with profile data
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                         organisationID:
 *                           type: integer
 *                         isVerified:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         profile:
 *                           type: object
 *                           description: Additional profile data from profiles table
 *       400:
 *         description: Invalid subdomain context
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Invalid subdomain context
 *       401:
 *         description: Unauthorized - No token or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               noToken:
 *                 value:
 *                   success: false
 *                   message: No token provided
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid token
 *                   error: INVALID_TOKEN
 *               expiredToken:
 *                 value:
 *                   success: false
 *                   message: Token has expired
 *                   error: TOKEN_EXPIRED
 *       403:
 *         description: Access denied - Wrong subdomain or token type mismatch
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               wrongSubdomain:
 *                 value:
 *                   success: false
 *                   message: Admin tokens can only be used on admin subdomain
 *               notAdmin:
 *                 value:
 *                   success: false
 *                   message: Access Denied - Admin access required
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               adminNotFound:
 *                 value:
 *                   success: false
 *                   message: Admin profile not found
 *               userNotFound:
 *                 value:
 *                   success: false
 *                   message: User profile not found
 *               candidateNotFound:
 *                 value:
 *                   success: false
 *                   message: Candidate profile not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Subdomain context not found. Subdomain middleware may not be applied.
 */
