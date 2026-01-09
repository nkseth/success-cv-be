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
 *     ResumeTemplate:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Modern Professional
 *         description:
 *           type: string
 *           example: A clean, modern resume template
 *         thumbnailUrl:
 *           type: string
 *           example: https://storage.example.com/thumbnails/modern-pro.png
 *         templateFileUrl:
 *           type: string
 *           example: https://storage.example.com/templates/modern-pro.pdf
 *         templateType:
 *           type: string
 *           enum: [pdf, docx, html]
 *           example: pdf
 *         category:
 *           type: string
 *           example: general
 *         isActive:
 *           type: boolean
 *           example: true
 *         isPremium:
 *           type: boolean
 *           example: false
 *         sortOrder:
 *           type: integer
 *           example: 0
 *         metadata:
 *           type: object
 *           example: { colors: ["#000", "#fff"], fonts: ["Arial"] }
 *         createdAt:
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
 * /api/v1/admin/profile:
 *   get:
 *     summary: Get current admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Unauthorized
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

// ==================== RESUME TEMPLATE ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/admin/templates:
 *   get:
 *     summary: List all resume templates
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isPremium
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: includeInactive
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
 *         description: Templates retrieved successfully
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
 *                         $ref: '#/components/schemas/ResumeTemplate'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *   
 *   post:
 *     summary: Create a new resume template
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
 *               - templateFileUrl
 *             properties:
 *               name:
 *                 type: string
 *                 example: Modern Professional
 *               description:
 *                 type: string
 *               thumbnailUrl:
 *                 type: string
 *               templateFileUrl:
 *                 type: string
 *               templateType:
 *                 type: string
 *                 enum: [pdf, docx, html]
 *                 default: pdf
 *               category:
 *                 type: string
 *                 default: general
 *               isPremium:
 *                 type: boolean
 *                 default: false
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Template created successfully
 */

/**
 * @swagger
 * /api/v1/admin/templates/upload-url:
 *   post:
 *     summary: Get presigned URL for template file upload
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
 *                 example: modern-template.pdf
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
 * /api/v1/admin/templates/{id}:
 *   get:
 *     summary: Get a resume template by ID
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
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 *   
 *   put:
 *     summary: Update a resume template
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
 *               description:
 *                 type: string
 *               thumbnailUrl:
 *                 type: string
 *               templateFileUrl:
 *                 type: string
 *               templateType:
 *                 type: string
 *               category:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               isPremium:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       404:
 *         description: Template not found
 *   
 *   delete:
 *     summary: Delete a resume template
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
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
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
