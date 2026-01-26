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
 *         analysisSummary:
 *           type: object
 *           description: Lightweight summary of analysis issues and improvements. Full analysis data fetched via analysisID.
 *           properties:
 *             issuesCounts:
 *               type: object
 *               description: Count of issues by severity
 *               properties:
 *                 critical:
 *                   type: integer
 *                 major:
 *                   type: integer
 *                 minor:
 *                   type: integer
 *             improvementSummary:
 *               type: string
 *               description: Summary of what was fixed/changed
 *             scoreChange:
 *               type: object
 *               nullable: true
 *               description: Score comparison (null for initial upload)
 *               properties:
 *                 before:
 *                   type: integer
 *                 after:
 *                   type: integer
 *             version:
 *               type: string
 *               description: Version marker (initial, rewrite_v1, rewrite_v2, etc.)
 *             updatedAt:
 *               type: string
 *               format: date-time
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
 *         resumeId:
 *           type: integer
 *           description: ID of the resume content this rewrite belongs to
 *         analysisId:
 *           type: integer
 *           description: ID of the analysis this rewrite is based on
 *         versionNumber:
 *           type: integer
 *           description: Sequential version number (1, 2, 3, etc.)
 *         versionLabel:
 *           type: string
 *           description: User-friendly label like "ATS Optimized v2"
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         isActive:
 *           type: boolean
 *           description: Whether this rewrite is currently applied to the resume content
 *         wasModifiedAfterApply:
 *           type: boolean
 *           description: Whether the resume was manually edited after this rewrite was applied
 *         sourceContentSnapshot:
 *           type: object
 *           description: Snapshot of resume content at time of rewrite request
 *         rewrittenContent:
 *           type: object
 *           description: AI-optimized content (only present when status is completed)
 *         improvements:
 *           type: object
 *           description: Improvement metrics and changes made
 *         rewriteSummary:
 *           type: object
 *           description: Lightweight summary of what was fixed/improved in this rewrite
 *           properties:
 *             improvementSummary:
 *               type: string
 *               description: Summary text of what was improved
 *             resolvedCounts:
 *               type: object
 *               description: Count of resolved issues by severity
 *               properties:
 *                 critical:
 *                   type: integer
 *                 major:
 *                   type: integer
 *                 minor:
 *                   type: integer
 *             totalResolved:
 *               type: integer
 *               description: Total number of resolved issues
 *             totalRemaining:
 *               type: integer
 *               description: Total number of remaining issues
 *             scoreComparison:
 *               type: object
 *               properties:
 *                 before:
 *                   type: object
 *                   properties:
 *                     atsScore:
 *                       type: integer
 *                     contentScore:
 *                       type: integer
 *                     overallScore:
 *                       type: integer
 *                 after:
 *                   type: object
 *                   properties:
 *                     atsScore:
 *                       type: integer
 *                     contentScore:
 *                       type: integer
 *                     overallScore:
 *                       type: integer
 *                 improvement:
 *                   type: object
 *                   properties:
 *                     atsScore:
 *                       type: integer
 *                     description:
 *                       type: string
 *             version:
 *               type: string
 *               description: Version marker (rewrite_v1, rewrite_v2, etc.)
 *             generatedAt:
 *               type: string
 *               format: date-time
 *         optimizationSettings:
 *           type: object
 *           properties:
 *             targetATSScore:
 *               type: integer
 *             focusAreas:
 *               type: array
 *               items:
 *                 type: string
 *             optimizationLevel:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         appliedAt:
 *           type: string
 *           format: date-time
 *           description: When this rewrite was last applied to the resume
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
 * /api/v1/resumes/blank:
 *   post:
 *     summary: Create a blank resume from scratch
 *     description: Creates a new resume with empty sections for manual editing. No file upload required.
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Resume name (optional, defaults to "Untitled Resume")
 *                 maxLength: 255
 *                 example: "Software Engineer Resume"
 *     responses:
 *       201:
 *         description: Blank resume created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Blank resume created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Resume content ID
 *                       example: 123
 *                     userID:
 *                       type: integer
 *                       example: 456
 *                     analysisID:
 *                       type: integer
 *                       description: Associated analysis ID (status: completed)
 *                       example: 789
 *                     documentID:
 *                       type: integer
 *                       description: Associated document ID
 *                       example: 101
 *                     themeID:
 *                       type: integer
 *                       description: Default theme ID
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Software Engineer Resume"
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     customConfig:
 *                       type: object
 *                       nullable: true
 *                       example: null
 *                     isLocked:
 *                       type: boolean
 *                       example: false
 *                     isDraft:
 *                       type: boolean
 *                       description: Always true for new resumes
 *                       example: true
 *                     publishedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: null
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-26T10:00:00Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-26T10:00:00Z"
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: null
 *                     sections:
 *                       type: array
 *                       description: Array of empty sections ready to be filled
 *                       items:
 *                         type: object
 *                         properties:
 *                           sectionName:
 *                             type: string
 *                             enum: [personal_info, summary, experience, education, skills]
 *                           content:
 *                             oneOf:
 *                               - type: object
 *                               - type: array
 *                           isVisible:
 *                             type: boolean
 *                           displayOrder:
 *                             type: integer
 *                       example:
 *                         - sectionName: "personal_info"
 *                           content: {}
 *                           isVisible: true
 *                           displayOrder: 1
 *                         - sectionName: "summary"
 *                           content: {}
 *                           isVisible: true
 *                           displayOrder: 2
 *                         - sectionName: "experience"
 *                           content: []
 *                           isVisible: true
 *                           displayOrder: 3
 *                         - sectionName: "education"
 *                           content: []
 *                           isVisible: true
 *                           displayOrder: 4
 *                         - sectionName: "skills"
 *                           content: {}
 *                           isVisible: true
 *                           displayOrder: 5
 *       400:
 *         description: Bad request (invalid name)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Resume name: Must be a valid string"
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Failed to create blank resume: [error details]"
 *                 statusCode:
 *                   type: integer
 *                   example: 500
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
 * /api/v1/resumes/rewrites:
 *   get:
 *     summary: Get all rewrites for authenticated user
 *     description: Returns all rewrite jobs across all resumes/analyses for the current user with pagination, filtering, and sorting.
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (pending, processing, completed, failed). Supports comma-separated values.
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active rewrite status
 *       - in: query
 *         name: createdAt
 *         schema:
 *           type: string
 *           example: "2025-01-01,2025-12-31"
 *         description: Date range filter (start,end)
 *       - in: query
 *         name: completedAt
 *         schema:
 *           type: string
 *           example: "2025-01-01,2025-12-31"
 *         description: Date range filter (start,end)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, completedAt, versionNumber]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of user rewrites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Rewrites fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Rewrite'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                         nextPage:
 *                           type: integer
 *                           nullable: true
 *                         prevPage:
 *                           type: integer
 *                           nullable: true
 *                     filters:
 *                       type: object
 *                       nullable: true
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
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
 * /api/v1/resumes/{id}/rewrites/{rewriteId}/switch:
 *   post:
 *     summary: Switch to a different rewrite version
 *     description: Updates resume content with the selected version's content. Use this to switch between different rewrite versions.
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resume content ID
 *       - in: path
 *         name: rewriteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target rewrite version ID to switch to
 *     responses:
 *       200:
 *         description: Version switched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       $ref: '#/components/schemas/ResumeContent'
 *                     activeRewrite:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         versionNumber:
 *                           type: integer
 *                         versionLabel:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         appliedAt:
 *                           type: string
 *                           format: date-time
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites/active:
 *   get:
 *     summary: Get the currently active rewrite version
 *     description: Returns information about which rewrite version is currently applied to the resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resume content ID
 *     responses:
 *       200:
 *         description: Active rewrite information (null if no rewrite is active)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     versionNumber:
 *                       type: integer
 *                     versionLabel:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     wasModifiedAfterApply:
 *                       type: boolean
 *                       description: Whether the resume was edited after this rewrite was applied
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *   delete:
 *     summary: Clear active rewrite (revert to manual editing mode)
 *     description: Deactivates all rewrites and clears the activeRewriteID from the resume content. Content remains unchanged but is no longer linked to any rewrite version.
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resume content ID
 *     responses:
 *       200:
 *         description: Reverted to manual editing mode
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites/compare:
 *   get:
 *     summary: Compare two rewrite versions
 *     description: Returns the content and metadata of two rewrite versions for side-by-side comparison
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resume content ID
 *       - in: query
 *         name: version1
 *         required: true
 *         schema:
 *           type: integer
 *         description: First rewrite ID to compare
 *       - in: query
 *         name: version2
 *         required: true
 *         schema:
 *           type: integer
 *         description: Second rewrite ID to compare
 *     responses:
 *       200:
 *         description: Comparison of two rewrite versions
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
 *                     version1:
 *                       $ref: '#/components/schemas/Rewrite'
 *                     version2:
 *                       $ref: '#/components/schemas/Rewrite'
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
