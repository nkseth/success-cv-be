/**
 * @swagger
 * tags:
 *   - name: Resume Analysis
 *     description: Resume analysis management and data retrieval endpoints
 */

/**
 * @swagger
 * /api/v1/resume-analysis:
 *   get:
 *     summary: Get all resume analyses for the authenticated user
 *     tags: [Resume Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analyses retrieved successfully
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
 *                   example: Analyses retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       resumeId:
 *                         type: integer
 *                         nullable: true
 *                         description: Resume content ID
 *                         example: 5
 *                       status:
 *                         type: string
 *                         enum: [pending, processing, completed, failed]
 *                         example: completed
 *                       jobID:
 *                         type: string
 *                         example: "job-123"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       scores:
 *                         type: object
 *                         nullable: true
 *                         description: Current scores from resume content
 *                         properties:
 *                           atsScore:
 *                             type: number
 *                             description: ATS compatibility score
 *                             example: 85
 *                           contentScore:
 *                             type: number
 *                             description: Content quality score
 *                             example: 78
 *                           formatScore:
 *                             type: number
 *                             description: Format/presentation score
 *                             example: 90
 *                           overallScore:
 *                             type: number
 *                             description: Overall resume score
 *                             example: 84
 *                       atsScore:
 *                         type: number
 *                         nullable: true
 *                         description: ATS score (extracted for convenience)
 *                         example: 85
 *                       meta:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           processedDataID:
 *                             type: integer
 *                       document:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           fileURL:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/v1/resume-analysis/{analysisId}:
 *   get:
 *     summary: Get detailed resume analysis by ID
 *     tags: [Resume Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Analysis ID
 *     responses:
 *       200:
 *         description: Analysis details retrieved successfully
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
 *                   example: Analysis details retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         status:
 *                           type: string
 *                         jobID:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         meta:
 *                           type: object
 *                     document:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         fileURL:
 *                           type: string
 *                     processedData:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         rawData:
 *                           type: string
 *                           description: Extracted text from resume
 *                         processedData:
 *                           type: object
 *                           description: AI-processed structured data
 *                           properties:
 *                             personal_info:
 *                               type: object
 *                             experiences:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             education:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             skills:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             critical_mistakes:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             major_issues:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             minor_improvements:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             optimization_opportunities:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             resume_quality:
 *                               type: object
 *                             relevance:
 *                               type: object
 *                         meta:
 *                           type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Analysis not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update resume analysis processed data
 *     tags: [Resume Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Analysis ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               processedData:
 *                 type: object
 *                 description: Updated processed data (can be partial)
 *                 properties:
 *                   personal_info:
 *                     type: object
 *                   experiences:
 *                     type: array
 *                     items:
 *                       type: object
 *                   education:
 *                     type: array
 *                     items:
 *                       type: object
 *               meta:
 *                 type: object
 *                 description: Updated metadata
 *     responses:
 *       200:
 *         description: Analysis data updated successfully
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
 *                   example: Analysis data updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     analysisID:
 *                       type: integer
 *                     documentID:
 *                       type: integer
 *                     processedData:
 *                       type: object
 *                     meta:
 *                       type: object
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Analysis not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
