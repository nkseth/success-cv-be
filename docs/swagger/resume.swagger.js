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
 *         analysisReport:
 *           type: object
 *           description: Analysis report with issues and improvements (initial or post-rewrite)
 *           properties:
 *             criticalMistakes:
 *               type: array
 *               description: Critical issues that must be fixed
 *               items:
 *                 type: object
 *                 properties:
 *                   issue:
 *                     type: string
 *                   impact:
 *                     type: string
 *                   fixSuggestion:
 *                     type: string
 *             majorIssues:
 *               type: array
 *               description: Major issues that should be addressed
 *               items:
 *                 type: object
 *                 properties:
 *                   issue:
 *                     type: string
 *                   impact:
 *                     type: string
 *                   fixSuggestion:
 *                     type: string
 *             minorImprovements:
 *               type: array
 *               description: Minor improvements for polish
 *               items:
 *                 type: object
 *                 properties:
 *                   area:
 *                     type: string
 *                   suggestion:
 *                     type: string
 *             resumeQuality:
 *               type: object
 *               description: Quality scores from analysis
 *               properties:
 *                 atsCompatibilityScore:
 *                   type: integer
 *                 contentQualityScore:
 *                   type: integer
 *                 overallQualityScore:
 *                   type: integer
 *             resolvedIssues:
 *               type: array
 *               description: Issues resolved by rewrite (only in post-rewrite reports)
 *               items:
 *                 type: object
 *                 properties:
 *                   originalIssue:
 *                     type: string
 *                   category:
 *                     type: string
 *                   howFixed:
 *                     type: string
 *             version:
 *               type: string
 *               description: Version marker (initial, rewrite_v1, rewrite_v2, etc.)
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
 *         analysisReport:
 *           type: object
 *           description: Post-rewrite analysis showing resolved vs remaining issues
 *           properties:
 *             resolvedIssues:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   originalIssue:
 *                     type: string
 *                   category:
 *                     type: string
 *                   howFixed:
 *                     type: string
 *             remainingIssues:
 *               type: array
 *               items:
 *                 type: object
 *             newScores:
 *               type: object
 *             scoreComparison:
 *               type: object
 *               properties:
 *                 before:
 *                   type: object
 *                 after:
 *                   type: object
 *                 improvement:
 *                   type: object
 *             improvementSummary:
 *               type: string
 *             version:
 *               type: string
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
