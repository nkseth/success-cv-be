/**
 * @swagger
 * tags:
 *   - name: Download
 *     description: Resume PDF download and preview operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DownloadInfo:
 *       type: object
 *       properties:
 *         resumeContentID:
 *           type: integer
 *           description: Resume content ID
 *         version:
 *           type: integer
 *           description: Current resume version number
 *         lastEditType:
 *           type: string
 *           enum: [initial, manual, ai_rewrite]
 *           description: Type of last edit
 *         documentTitle:
 *           type: string
 *           description: Original document title
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         theme:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             category:
 *               type: string
 *             isATSOptimized:
 *               type: boolean
 *         availableFormats:
 *           type: array
 *           items:
 *             type: string
 *           example: ["pdf"]
 *         downloadOptions:
 *           type: object
 *           properties:
 *             showPageNumbers:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 default:
 *                   type: boolean
 *                 description:
 *                   type: string
 *             includeTimestamp:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 default:
 *                   type: boolean
 *                 description:
 *                   type: string
 *         endpoints:
 *           type: object
 *           properties:
 *             download:
 *               type: string
 *             preview:
 *               type: string
 *             customDownload:
 *               type: string
 *
 *     CustomDownloadRequest:
 *       type: object
 *       properties:
 *         themeId:
 *           type: integer
 *           description: Optional theme ID to use instead of applied theme
 *         themeOverrides:
 *           type: object
 *           description: Theme configuration overrides
 *           properties:
 *             colors:
 *               type: object
 *               properties:
 *                 primary:
 *                   type: string
 *                   example: "#2563eb"
 *                 secondary:
 *                   type: string
 *                   example: "#1e293b"
 *             typography:
 *               type: object
 *               properties:
 *                 fontFamily:
 *                   type: string
 *                   example: "Arial, sans-serif"
 *                 baseFontSize:
 *                   type: number
 *                   example: 11
 *             layout:
 *               type: object
 *               properties:
 *                 pageSize:
 *                   type: string
 *                   enum: [A4, Letter, Legal]
 *                 margins:
 *                   type: object
 *                   properties:
 *                     top:
 *                       type: number
 *                     right:
 *                       type: number
 *                     bottom:
 *                       type: number
 *                     left:
 *                       type: number
 *         sectionVisibility:
 *           type: object
 *           description: Control which sections to include
 *           properties:
 *             personalInfo:
 *               type: boolean
 *             summary:
 *               type: boolean
 *             experience:
 *               type: boolean
 *             education:
 *               type: boolean
 *             skills:
 *               type: boolean
 *             additionalSections:
 *               type: boolean
 *         sectionOrder:
 *           type: array
 *           description: Custom section order
 *           items:
 *             type: string
 *           example: ["personalInfo", "summary", "skills", "experience", "education"]
 *         showPageNumbers:
 *           type: boolean
 *           default: false
 *         includeTimestamp:
 *           type: boolean
 *           default: false
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/download:
 *   get:
 *     summary: Download resume as PDF
 *     description: Generate and download the resume as a PDF file with the currently applied theme
 *     tags: [Download]
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
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf]
 *           default: pdf
 *         description: Output format (currently only PDF supported)
 *       - in: query
 *         name: showPageNumbers
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include page numbers in PDF footer
 *       - in: query
 *         name: includeTimestamp
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Add current date to filename
 *     responses:
 *       200:
 *         description: PDF file download
 *         headers:
 *           Content-Disposition:
 *             description: Attachment with filename
 *             schema:
 *               type: string
 *               example: 'attachment; filename="John_Doe.pdf"'
 *           X-Resume-Version:
 *             description: Resume version number
 *             schema:
 *               type: integer
 *           X-Generated-At:
 *             description: PDF generation timestamp
 *             schema:
 *               type: string
 *           X-Theme-Name:
 *             description: Applied theme name
 *             schema:
 *               type: string
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resume not found
 *       500:
 *         description: PDF generation failed
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/download/info:
 *   get:
 *     summary: Get download options and metadata
 *     description: Returns available download options, resume metadata, and endpoint URLs
 *     tags: [Download]
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
 *         description: Download info retrieved successfully
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
 *                   example: "Download info retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DownloadInfo'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resume not found
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/download/custom:
 *   post:
 *     summary: Download with custom theme settings
 *     description: Generate PDF with custom theme overrides without permanently changing the applied theme
 *     tags: [Download]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resume content ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomDownloadRequest'
 *           examples:
 *             customColors:
 *               summary: Custom color scheme
 *               value:
 *                 themeOverrides:
 *                   colors:
 *                     primary: "#059669"
 *                     secondary: "#064e3b"
 *             hideSections:
 *               summary: Hide certain sections
 *               value:
 *                 sectionVisibility:
 *                   additionalSections: false
 *                   skills: true
 *             reorderSections:
 *               summary: Custom section order
 *               value:
 *                 sectionOrder: ["personalInfo", "skills", "experience", "education", "summary"]
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resume not found
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/preview:
 *   get:
 *     summary: Preview resume as PDF or HTML
 *     description: Get resume preview for inline viewing (not as download attachment)
 *     tags: [Download]
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
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, html]
 *           default: pdf
 *         description: Preview format (html is useful for debugging)
 *     responses:
 *       200:
 *         description: Preview content
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           text/html:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resume not found
 */

/**
 * @swagger
 * /api/v1/resumes/{id}/rewrites/{rewriteId}/download:
 *   get:
 *     summary: Download a specific rewrite version as PDF
 *     description: Generate PDF for a completed AI rewrite version
 *     tags: [Download]
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
 *         description: Rewrite ID
 *       - in: query
 *         name: showPageNumbers
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeTimestamp
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: PDF file download
 *         headers:
 *           X-Rewrite-Version:
 *             description: Rewrite version number
 *             schema:
 *               type: integer
 *           X-Version-Label:
 *             description: Version label if set
 *             schema:
 *               type: string
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Rewrite not completed or has no content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rewrite not found
 */

/**
 * @swagger
 * /api/v1/resumes/analysis/{analysisId}/download:
 *   get:
 *     summary: Download resume by analysis ID
 *     description: Generate and download PDF for a resume by its associated analysis ID
 *     tags: [Download]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Analysis ID
 *       - in: query
 *         name: showPageNumbers
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: includeTimestamp
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Resume not found for analysis
 */
