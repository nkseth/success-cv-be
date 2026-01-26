/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin management and system configuration endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         fullname:
 *           type: string
 *           example: Admin User
 *         email:
 *           type: string
 *           format: email
 *           example: admin@example.com
 *         role:
 *           type: string
 *           enum: [super_admin, admin, moderator]
 *           example: admin
 *         isActive:
 *           type: boolean
 *           example: true
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     SystemSetting:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         settingKey:
 *           type: string
 *           example: max_upload_size
 *         settingValue:
 *           type: string
 *           example: "10"
 *         settingType:
 *           type: string
 *           enum: [string, number, boolean, json]
 *           example: number
 *         category:
 *           type: string
 *           enum: [general, email, security, features, limits]
 *           example: limits
 *         description:
 *           type: string
 *           example: Maximum file upload size in MB
 *         isPublic:
 *           type: boolean
 *           example: false
 *         parsedValue:
 *           description: The setting value parsed according to its type
 *           example: 10
 *     
 *     ResumeTheme:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Modern Professional
 *         slug:
 *           type: string
 *           example: modern-professional
 *         description:
 *           type: string
 *           example: A clean, modern resume theme
 *         category:
 *           type: string
 *           enum: [professional, creative, minimal, ats-optimized, academic]
 *           example: professional
 *         config:
 *           type: object
 *           description: Theme configuration (layout, colors, typography, etc.)
 *           properties:
 *             layout:
 *               type: object
 *             colors:
 *               type: object
 *             typography:
 *               type: object
 *             sections:
 *               type: object
 *             style:
 *               type: object
 *         thumbnailURL:
 *           type: string
 *           example: https://storage.example.com/themes/modern-pro-thumb.png
 *         previewURL:
 *           type: string
 *           example: https://storage.example.com/themes/modern-pro-preview.png
 *         isSystemTheme:
 *           type: boolean
 *           example: true
 *         isATSOptimized:
 *           type: boolean
 *           example: false
 *         isPublic:
 *           type: boolean
 *           example: true
 *         usageCount:
 *           type: integer
 *           example: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     BlockedUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         userID:
 *           type: integer
 *           example: 123
 *         candidateID:
 *           type: integer
 *           example: null
 *         userType:
 *           type: string
 *           enum: [user, candidate]
 *           example: user
 *         reason:
 *           type: string
 *           example: Violation of terms of service
 *         blockedBy:
 *           type: integer
 *           example: 1
 *         blockedAt:
 *           type: string
 *           format: date-time
 *         isActive:
 *           type: boolean
 *           example: true
 *     
 *     ActivityLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         adminId:
 *           type: integer
 *           example: 1
 *         action:
 *           type: string
 *           example: block_user
 *         resourceType:
 *           type: string
 *           example: user
 *         resourceId:
 *           type: integer
 *           example: 123
 *         details:
 *           type: object
 *           example: { reason: "Spam" }
 *         ipAddress:
 *           type: string
 *           example: 192.168.1.1
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// ==================== AUTH ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/health:
 *   get:
 *     summary: Admin API health check
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */

/**
 * @swagger
 * /api/v1/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       $ref: '#/components/schemas/AdminUser'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     expiresIn:
 *                       type: string
 *                       example: 8h
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 1500
 *                     totalCandidates:
 *                       type: integer
 *                       example: 500
 *                     blockedUsers:
 *                       type: integer
 *                       example: 10
 *                     totalTemplates:
 *                       type: integer
 *                       example: 25
 */

// ==================== ADMIN MANAGEMENT ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/admins:
 *   get:
 *     summary: List all admins (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of admins
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AdminUser'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Forbidden - Super admin access required
 *   
 *   post:
 *     summary: Create a new admin (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullname
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               fullname:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [super_admin, admin, moderator]
 *                 default: admin
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       403:
 *         description: Forbidden - Super admin access required
 */

// ==================== SYSTEM SETTINGS ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/settings:
 *   get:
 *     summary: Get all system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, email, security, features, limits]
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SystemSetting'
 *   
 *   put:
 *     summary: Create or update a system setting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *             properties:
 *               key:
 *                 type: string
 *                 example: max_upload_size
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *                   - type: object
 *                 example: 10
 *               type:
 *                 type: string
 *                 enum: [string, number, boolean, json]
 *                 default: string
 *               category:
 *                 type: string
 *                 enum: [general, email, security, features, limits]
 *                 default: general
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */

/**
 * @swagger
 * /api/v1/admin/settings/{key}:
 *   get:
 *     summary: Get a specific setting by key
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SystemSetting'
 *       404:
 *         description: Setting not found
 *   
 *   delete:
 *     summary: Delete a setting (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       403:
 *         description: Forbidden - Super admin access required
 *       404:
 *         description: Setting not found
 */

/**
 * @swagger
 * /api/v1/admin/settings/category/{category}:
 *   get:
 *     summary: Get settings by category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [general, email, security, features, limits]
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */

// ==================== RESUME THEME ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/themes:
 *   get:
 *     summary: List all resume themes
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [professional, creative, minimal, ats-optimized, academic]
 *       - in: query
 *         name: isATSOptimized
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Themes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ResumeTheme'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *   
 *   post:
 *     summary: Create a new resume theme
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Modern Professional
 *               slug:
 *                 type: string
 *                 example: modern-professional
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [professional, creative, minimal, ats-optimized, academic]
 *                 default: professional
 *               config:
 *                 type: object
 *                 description: Theme configuration (layout, colors, typography, etc.)
 *               thumbnailURL:
 *                 type: string
 *               previewURL:
 *                 type: string
 *               isATSOptimized:
 *                 type: boolean
 *                 default: false
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Theme created successfully
 */

/**
 * @swagger
 * /api/v1/admin/themes/upload-url:
 *   post:
 *     summary: Get presigned URL for theme asset upload (thumbnail, preview)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: theme-preview.png
 *     responses:
 *       200:
 *         description: Upload URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadUrl:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /api/v1/admin/themes/{id}:
 *   get:
 *     summary: Get a resume theme by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Theme retrieved successfully
 *       404:
 *         description: Theme not found
 *   
 *   put:
 *     summary: Update a resume theme
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               config:
 *                 type: object
 *               thumbnailURL:
 *                 type: string
 *               previewURL:
 *                 type: string
 *               isATSOptimized:
 *                 type: boolean
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Theme updated successfully
 *       404:
 *         description: Theme not found
 *   
 *   delete:
 *     summary: Delete a resume theme
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Theme deleted successfully
 *       404:
 *         description: Theme not found
 */

// ==================== USER BLOCKING ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/blocked-users:
 *   get:
 *     summary: List blocked users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [user, candidate]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Blocked users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BlockedUser'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *   
 *   post:
 *     summary: Block a user or candidate
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userType
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: Required when userType is 'user'
 *               candidateId:
 *                 type: integer
 *                 description: Required when userType is 'candidate'
 *               userType:
 *                 type: string
 *                 enum: [user, candidate]
 *               reason:
 *                 type: string
 *                 example: Violation of terms of service
 *     responses:
 *       201:
 *         description: User blocked successfully
 *       409:
 *         description: User is already blocked
 */

/**
 * @swagger
 * /api/v1/admin/blocked-users/check:
 *   get:
 *     summary: Check if a user is blocked
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, candidate]
 *     responses:
 *       200:
 *         description: Block status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isBlocked:
 *                       type: boolean
 */

/**
 * @swagger
 * /api/v1/admin/blocked-users/{id}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The block record ID
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       404:
 *         description: Block record not found or already unblocked
 */

// ==================== USER MANAGEMENT ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *   
 *   post:
 *     summary: Create a new user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullname
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               fullname:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       409:
 *         description: User with this email already exists
 */

/**
 * @swagger
 * /api/v1/admin/candidates:
 *   get:
 *     summary: List all candidates
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: organisationId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Candidates retrieved successfully
 *   
 *   post:
 *     summary: Create a new candidate
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullname
 *               - organisationId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: candidate@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: password123
 *               fullname:
 *                 type: string
 *                 example: Jane Smith
 *               organisationId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Candidate created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     organisationID:
 *                       type: integer
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       404:
 *         description: Organisation not found
 *       409:
 *         description: Candidate with this email already exists
 */

/**
 * @swagger
 * /api/v1/admin/organisations:
 *   get:
 *     summary: List all organisations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or slug
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Organisations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           creatorID:
 *                             type: integer
 *                           address:
 *                             type: string
 *                           country:
 *                             type: string
 *                           state:
 *                             type: string
 *                           city:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *   
 *   post:
 *     summary: Create a new organisation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - creatorId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corporation
 *               slug:
 *                 type: string
 *                 example: acme-corp
 *               creatorId:
 *                 type: integer
 *                 description: The user ID who will be the creator/owner
 *                 example: 1
 *               address:
 *                 type: string
 *                 example: 123 Main Street
 *               country:
 *                 type: string
 *                 example: United States
 *               state:
 *                 type: string
 *                 example: California
 *               city:
 *                 type: string
 *                 example: San Francisco
 *     responses:
 *       201:
 *         description: Organisation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     creatorID:
 *                       type: integer
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       404:
 *         description: Creator user not found
 *       409:
 *         description: Organisation with this slug already exists
 */

/**
 * @swagger
 * /api/v1/admin/organisations/{id}/members:
 *   post:
 *     summary: Add a user to an organisation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The organisation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: The user ID to add
 *                 example: 5
 *               role:
 *                 type: string
 *                 description: The role for the user in the organisation
 *                 example: member
 *                 enum: [admin, member]
 *     responses:
 *       201:
 *         description: User added to organisation successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     userID:
 *                       type: integer
 *                     organisationID:
 *                       type: integer
 *                     role:
 *                       type: string
 *                     joinedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       404:
 *         description: Organisation or user not found
 *       409:
 *         description: User is already a member of this organisation
 */

// ==================== ACTIVITY LOG ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/activity-logs:
 *   get:
 *     summary: Get admin activity logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: adminId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Activity logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ActivityLog'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */

// ==================== CREDIT/WALLET MANAGEMENT ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/wallets:
 *   get:
 *     summary: Get wallet info for a user or organisation
 *     description: Retrieve wallet balance and recent transactions for a specific user or organisation. Use this to check credit balance before making adjustments.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ownerType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user, organisation]
 *         description: Whether the wallet belongs to a user or organisation
 *       - in: query
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user or organisation
 *     responses:
 *       200:
 *         description: Wallet info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     ownerType:
 *                       type: string
 *                       enum: [user, organisation]
 *                     ownerId:
 *                       type: integer
 *                     wallet:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         balance:
 *                           type: integer
 *                           description: Available credits
 *                         pendingBalance:
 *                           type: integer
 *                           description: Credits reserved for in-progress tasks
 *                         lifetimeCredits:
 *                           type: integer
 *                           description: Total credits ever added
 *                         lifetimeUsed:
 *                           type: integer
 *                           description: Total credits ever consumed
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     recentTransactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           type:
 *                             type: string
 *                             enum: [purchase, debit, refund, admin_adjustment]
 *                           amount:
 *                             type: integer
 *                           balanceAfter:
 *                             type: integer
 *                           description:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Missing or invalid parameters
 *       401:
 *         description: Unauthorized - Admin authentication required
 */

/**
 * @swagger
 * /api/v1/admin/wallets/adjust:
 *   post:
 *     summary: Adjust credits for a user or organisation wallet
 *     description: |
 *       Add or remove credits from a user's or organisation's wallet. 
 *       Use positive amount to add credits, negative amount to remove credits.
 *       A reason is required for audit purposes. This action is logged in admin activity logs.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ownerType
 *               - ownerId
 *               - amount
 *               - reason
 *             properties:
 *               ownerType:
 *                 type: string
 *                 enum: [user, organisation]
 *                 description: Whether the wallet belongs to a user or organisation
 *               ownerId:
 *                 type: integer
 *                 description: ID of the user or organisation
 *               amount:
 *                 type: integer
 *                 description: Credits to add (positive) or remove (negative). Cannot be zero.
 *               reason:
 *                 type: string
 *                 minLength: 5
 *                 description: Required explanation for the adjustment (min 5 characters)
 *           examples:
 *             addCredits:
 *               summary: Add credits to user wallet
 *               value:
 *                 ownerType: user
 *                 ownerId: 123
 *                 amount: 100
 *                 reason: Promotional credits for beta testing
 *             removeCredits:
 *               summary: Remove credits from organisation wallet
 *               value:
 *                 ownerType: organisation
 *                 ownerId: 5
 *                 amount: -50
 *                 reason: Credit refund due to billing error
 *     responses:
 *       200:
 *         description: Credits adjusted successfully
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
 *                   example: 100 credits added to wallet successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     ownerType:
 *                       type: string
 *                     ownerId:
 *                       type: integer
 *                     adjustment:
 *                       type: integer
 *                       description: The amount that was adjusted
 *                     wallet:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         balance:
 *                           type: integer
 *                         pendingBalance:
 *                           type: integer
 *                         lifetimeCredits:
 *                           type: integer
 *                         lifetimeUsed:
 *                           type: integer
 *                     transaction:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         type:
 *                           type: string
 *                           example: admin_adjustment
 *                         amount:
 *                           type: integer
 *                         balanceAfter:
 *                           type: integer
 *                         description:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: |
 *           Invalid request:
 *           - Missing required fields
 *           - Invalid ownerType
 *           - Amount is zero
 *           - Reason too short
 *           - Insufficient balance for removal
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       404:
 *         description: Wallet not found
 */
