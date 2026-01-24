/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: Dashboard analytics endpoints for users, candidates, and organisations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalResumes:
 *           type: integer
 *           description: Total number of resumes
 *           example: 12
 *         totalDocuments:
 *           type: integer
 *           description: Total number of uploaded documents
 *           example: 15
 *         totalRewrites:
 *           type: integer
 *           description: Total number of AI rewrites
 *           example: 5
 *         activeRewrites:
 *           type: integer
 *           description: Number of currently active rewrites
 *           example: 2
 *         analysisByStatus:
 *           type: object
 *           description: Analysis counts by status
 *           properties:
 *             pending:
 *               type: integer
 *             processing:
 *               type: integer
 *             completed:
 *               type: integer
 *             failed:
 *               type: integer
 *         rewritesByStatus:
 *           type: object
 *           description: Rewrite counts by status
 *           properties:
 *             pending:
 *               type: integer
 *             processing:
 *               type: integer
 *             completed:
 *               type: integer
 *             failed:
 *               type: integer
 * 
 *     ScoreAnalytics:
 *       type: object
 *       properties:
 *         averageScores:
 *           type: object
 *           properties:
 *             atsScore:
 *               type: integer
 *               example: 78
 *             contentScore:
 *               type: integer
 *               example: 82
 *             formatScore:
 *               type: integer
 *               example: 85
 *             overallScore:
 *               type: integer
 *               example: 80
 *         scoreDistribution:
 *           type: object
 *           description: Distribution of ATS scores
 *           properties:
 *             excellent:
 *               type: integer
 *               description: Scores 90-100
 *             good:
 *               type: integer
 *               description: Scores 70-89
 *             average:
 *               type: integer
 *               description: Scores 50-69
 *             needsWork:
 *               type: integer
 *               description: Scores 0-49
 *         bestScore:
 *           type: object
 *           properties:
 *             resumeId:
 *               type: integer
 *             score:
 *               type: integer
 *         worstScore:
 *           type: object
 *           properties:
 *             resumeId:
 *               type: integer
 *             score:
 *               type: integer
 *         totalAnalyzed:
 *           type: integer
 *           description: Total resumes with scores
 * 
 *     RecentResume:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         analysisID:
 *           type: integer
 *         title:
 *           type: string
 *           example: "Software Engineer Resume"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         atsScore:
 *           type: integer
 *           example: 78
 *         overallScore:
 *           type: integer
 *           example: 80
 *         version:
 *           type: integer
 *           example: 3
 *         lastEditType:
 *           type: string
 *           enum: [initial, manual, ai_rewrite]
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     RewriteAnalytics:
 *       type: object
 *       properties:
 *         totalRewrites:
 *           type: integer
 *         completedRewrites:
 *           type: integer
 *         activeRewrites:
 *           type: integer
 *         pendingRewrites:
 *           type: integer
 *         failedRewrites:
 *           type: integer
 *         averageScoreImprovement:
 *           type: integer
 *           description: Average ATS score improvement from rewrites
 *           example: 12
 *         issuesResolved:
 *           type: object
 *           properties:
 *             critical:
 *               type: integer
 *             major:
 *               type: integer
 *             minor:
 *               type: integer
 *             total:
 *               type: integer
 * 
 *     ActivityTimeline:
 *       type: object
 *       properties:
 *         period:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *             endDate:
 *               type: string
 *               format: date-time
 *             days:
 *               type: integer
 *         resumesCreated:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               count:
 *                 type: integer
 *         rewritesCreated:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               count:
 *                 type: integer
 *         documentsUploaded:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               count:
 *                 type: integer
 * 
 *     OrganisationStats:
 *       type: object
 *       properties:
 *         totalCandidates:
 *           type: integer
 *         verifiedCandidates:
 *           type: integer
 *         unverifiedCandidates:
 *           type: integer
 *         totalResumes:
 *           type: integer
 *         totalRewrites:
 *           type: integer
 *         analysisByStatus:
 *           type: object
 *         totalMembers:
 *           type: integer
 *         pendingInvites:
 *           type: integer
 * 
 *     OrganisationScoreAnalytics:
 *       type: object
 *       properties:
 *         averageScores:
 *           type: object
 *           properties:
 *             atsScore:
 *               type: integer
 *             contentScore:
 *               type: integer
 *             formatScore:
 *               type: integer
 *             overallScore:
 *               type: integer
 *         scoreDistribution:
 *           type: object
 *           properties:
 *             excellent:
 *               type: integer
 *             good:
 *               type: integer
 *             average:
 *               type: integer
 *             needsWork:
 *               type: integer
 *         topPerformers:
 *           type: array
 *           description: Top 5 candidates by ATS score
 *           items:
 *             type: object
 *             properties:
 *               resumeId:
 *                 type: integer
 *               candidateID:
 *                 type: integer
 *               name:
 *                 type: string
 *               atsScore:
 *                 type: integer
 *         needsAttention:
 *           type: array
 *           description: Bottom 5 candidates by ATS score
 *           items:
 *             type: object
 *             properties:
 *               resumeId:
 *                 type: integer
 *               candidateID:
 *                 type: integer
 *               name:
 *                 type: string
 *               atsScore:
 *                 type: integer
 *         totalAnalyzed:
 *           type: integer
 * 
 *     RecentCandidate:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         fullname:
 *           type: string
 *         email:
 *           type: string
 *         isVerified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         resumeCount:
 *           type: integer
 *         latestAtsScore:
 *           type: integer
 *           nullable: true
 */

/**
 * @swagger
 * /api/v1/dashboard:
 *   get:
 *     summary: Get complete dashboard for user/candidate
 *     description: Returns all dashboard data including stats, scores, recent resumes, and rewrite analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     stats:
 *                       $ref: '#/components/schemas/DashboardStats'
 *                     scores:
 *                       $ref: '#/components/schemas/ScoreAnalytics'
 *                     recentResumes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RecentResume'
 *                     rewriteAnalytics:
 *                       $ref: '#/components/schemas/RewriteAnalytics'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Get dashboard summary statistics
 *     description: Returns quick stat card data (totals and status breakdowns)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 */

/**
 * @swagger
 * /api/v1/dashboard/scores:
 *   get:
 *     summary: Get score analytics
 *     description: Returns ATS score analytics including averages, distribution, and best/worst scores
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Score analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ScoreAnalytics'
 */

/**
 * @swagger
 * /api/v1/dashboard/resumes/recent:
 *   get:
 *     summary: Get recent resumes
 *     description: Returns list of recently updated resumes
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           maximum: 20
 *         description: Number of resumes to return
 *     responses:
 *       200:
 *         description: Recent resumes retrieved successfully
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
 *                     $ref: '#/components/schemas/RecentResume'
 */

/**
 * @swagger
 * /api/v1/dashboard/rewrites:
 *   get:
 *     summary: Get rewrite analytics
 *     description: Returns rewrite statistics and score improvement metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rewrite analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RewriteAnalytics'
 */

/**
 * @swagger
 * /api/v1/dashboard/activity:
 *   get:
 *     summary: Get activity timeline
 *     description: Returns activity data grouped by date for charts
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Activity timeline retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ActivityTimeline'
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}:
 *   get:
 *     summary: Get complete organisation dashboard
 *     description: Returns all organisation dashboard data (requires org membership)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organisation ID
 *     responses:
 *       200:
 *         description: Organisation dashboard retrieved successfully
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
 *                     stats:
 *                       $ref: '#/components/schemas/OrganisationStats'
 *                     scores:
 *                       $ref: '#/components/schemas/OrganisationScoreAnalytics'
 *                     recentCandidates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RecentCandidate'
 *                     recentResumes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RecentResume'
 *       403:
 *         description: Not a member of this organisation
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}/stats:
 *   get:
 *     summary: Get organisation summary statistics
 *     description: Returns org-wide stats including candidate and resume counts
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Organisation stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/OrganisationStats'
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}/scores:
 *   get:
 *     summary: Get organisation score analytics
 *     description: Returns org-wide score analytics with top performers and those needing attention
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Organisation score analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/OrganisationScoreAnalytics'
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}/candidates/recent:
 *   get:
 *     summary: Get recent candidates in organisation
 *     description: Returns recently joined candidates with their resume stats
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Recent candidates retrieved successfully
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
 *                     $ref: '#/components/schemas/RecentCandidate'
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}/resumes/recent:
 *   get:
 *     summary: Get recent resumes across organisation
 *     description: Returns recent resumes from all candidates in the organisation
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Recent resumes retrieved successfully
 */

/**
 * @swagger
 * /api/v1/dashboard/organisation/{organisationId}/activity:
 *   get:
 *     summary: Get organisation activity timeline
 *     description: Returns org-wide activity data including candidates joined, resumes created
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *     responses:
 *       200:
 *         description: Organisation activity timeline retrieved successfully
 */
