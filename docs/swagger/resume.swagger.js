/**
 * @swagger
 * tags:
 *   - name: Resumes
 *     description: Unified resume management - content, rewrites, and themes
 *   - name: Themes
 *     description: Resume theme/template browsing and management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ResumeContent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         analysisID:
 *           type: integer
 *         personalInfo:
 *           type: object
 *           properties:
 *             fullName:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *             location:
 *               type: string
 *             linkedin:
 *               type: string
 *             website:
 *               type: string
 *         summary:
 *           type: object
 *           properties:
 *             text:
 *               type: string
 *             keywords:
 *               type: array
 *               items:
 *                 type: string
 *         experience:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               company:
 *                 type: string
 *               position:
 *                 type: string
 *               startDate:
 *                 type: string
 *               endDate:
 *                 type: string
 *               current:
 *                 type: boolean
 *               description:
 *                 type: string
 *               achievements:
 *                 type: array
 *                 items:
 *                   type: string
 *         education:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               institution:
 *                 type: string
 *               degree:
 *                 type: string
 *               field:
 *                 type: string
 *               endDate:
 *                 type: string
 *         skills:
 *           type: object
 *           properties:
 *             technical:
 *               type: array
 *               items:
 *                 type: string
 *             soft:
 *               type: array
 *               items:
 *                 type: string
 *             tools:
 *               type: array
 *               items:
 *                 type: string
 *         currentScores:
 *           type: object
 *           properties:
 *             atsScore:
 *               type: integer
 *             overallScore:
 *               type: integer
 *         version:
 *           type: integer
 *         lastEditType:
 *           type: string
 *           enum: [initial, manual, ai_rewrite]
 * 
 *     Rewrite:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         versionNumber:
 *           type: integer
 *         versionLabel:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         isActive:
 *           type: boolean
 *         improvements:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 * 
 *     Theme:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         category:
 *           type: string
 *           enum: [professional, creative, minimal, ats-optimized, academic, technical]
 *         thumbnailURL:
 *           type: string
 *         previewURL:
 *           type: string
 *         isATSOptimized:
 *           type: boolean
 *         usageCount:
 *           type: integer
 *         config:
 *           type: object
 *           description: Theme configuration including colors, typography, layout
 */

/**
 * @swagger
 * /api/v1/resumes:
 *   get:
 *     summary: Get all resumes for authenticated user
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of resumes
 */

/**
 * @swagger
 * /api/v1/resumes/{id}:
 *   get:
 *     summary: Get resume by ID with full details
 *     tags: [Resumes]
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
 *         description: Resume with content, theme, and rewrites
 */

/**
 * @swagger
 * /api/v1/resumes/by-analysis/{analysisId}:
 *   get:
 *     summary: Get resume by analysis ID
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resume for the specified analysis
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/sections/{sectionName}:
 *   patch:
 *     summary: Update a single section of resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: sectionName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [personalInfo, summary, experience, education, skills, additionalSections]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *                 description: Section data (structure depends on section type)
 *     responses:
 *       200:
 *         description: Section updated successfully
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/sections:
 *   patch:
 *     summary: Update multiple sections at once
 *     tags: [Resumes]
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
 *             required:
 *               - sections
 *             properties:
 *               sections:
 *                 type: object
 *                 description: Object with section names as keys and data as values
 *     responses:
 *       200:
 *         description: Sections updated successfully
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites:
 *   post:
 *     summary: Create a new AI rewrite job
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               versionLabel:
 *                 type: string
 *                 example: "ATS Optimized Version"
 *               targetATSScore:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 90
 *               focusAreas:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["all"]
 *               optimizationLevel:
 *                 type: string
 *                 enum: [light, moderate, comprehensive]
 *                 default: comprehensive
 *     responses:
 *       201:
 *         description: Rewrite job created and queued
 *   get:
 *     summary: Get all rewrites for a resume
 *     tags: [Resumes]
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
 *         description: List of rewrites
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites/{rewriteId}:
 *   get:
 *     summary: Get specific rewrite details
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: rewriteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rewrite details including rewritten content if completed
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites/{rewriteId}/apply:
 *   post:
 *     summary: Apply a completed rewrite to resume content
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: rewriteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rewrite applied successfully
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/theme:
 *   post:
 *     summary: Apply a theme to resume
 *     tags: [Resumes]
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
 *             required:
 *               - themeId
 *             properties:
 *               themeId:
 *                 type: integer
 *               customOverrides:
 *                 type: object
 *                 description: Optional custom overrides for colors, fonts, etc.
 *     responses:
 *       200:
 *         description: Theme applied successfully
 *   patch:
 *     summary: Update theme customizations
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customOverrides:
 *                 type: object
 *               sectionVisibility:
 *                 type: object
 *               sectionOrder:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Theme updated successfully
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/render:
 *   get:
 *     summary: Get resume formatted for rendering with applied theme
 *     tags: [Resumes]
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
 *         description: Resume with content, theme config, and section order for rendering
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/publish:
 *   post:
 *     summary: Publish/finalize resume
 *     tags: [Resumes]
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
 *         description: Resume published successfully
 */

/**
 * @swagger
 * /api/v1/resumes/themes:
 *   get:
 *     summary: Get all available themes
 *     tags: [Themes]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [professional, creative, minimal, ats-optimized, academic, technical]
 *       - in: query
 *         name: isATSOptimized
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: usageCount
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of available themes
 */

/**
 * @swagger
 * /api/v1/resumes/themes/{themeId}:
 *   get:
 *     summary: Get theme details including full configuration
 *     tags: [Themes]
 *     parameters:
 *       - in: path
 *         name: themeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Theme details with configuration
 */

/**
 * @swagger
 * /api/v1/resumes/themes/category/{category}:
 *   get:
 *     summary: Get themes by category
 *     tags: [Themes]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [professional, creative, minimal, ats-optimized, academic, technical]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Themes in the specified category
 */
