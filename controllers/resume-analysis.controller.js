import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger } from "../utils/validate-helper.js";
import { db } from "../config/db.js";
import { 
    analysisTable, 
    processedAndRawDataTable, 
    userDocumentTable,
    candidateAnalysisTable,
    candidateProcessedAndRawDataTable,
    candidateDocumentTable,
    resumeContentTable,
    candidateResumeContentTable
} from "../drizzle/schema.js";
import { eq, and, desc, asc, inArray, gte, lte, or, like, ilike, count } from "drizzle-orm";
import logger from "../middleware/logger.js";
import { 
    parseQueryParams, 
    buildWhereConditions, 
    buildSearchCondition, 
    buildOrderBy, 
    getPaginationMeta, 
    formatPaginatedResponse 
} from "../utils/pagination-filter.js";
import { getDynamicTables, isCandidate } from "../utils/dynamic-tables.js";
import { userTypeConstants } from "../utils/constants.js";
import { validateResumeForAnalysis } from "../utils/resumeSchema.js";
import { addManualAnalysisJob } from "../queues/manual-analysis.queue.js";

/**
 * Get resume analysis details by analysis ID
 * GET /api/v1/resume-analysis/:analysisId
 */
export const getResumeAnalysisController = asyncHandler(async (req, res, next) => {
    const { analysisId } = req.params;
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    // Validate analysis ID
    const validatedAnalysisId = validateInteger(analysisId, 'Analysis ID');

    logger.info(`Fetching analysis details for analysisId: ${validatedAnalysisId}, userID: ${userID}, userType: ${userType}`);

    // Get dynamic tables based on user type
    const tables = getDynamicTables(userType);
    const { 
        analysisTable: dynAnalysisTable, 
        documentTable: dynDocumentTable, 
        processedDataTable: dynProcessedDataTable,
        entityIDColumn 
    } = tables;

    // Fetch analysis record with processed data
    const analysisRecord = await db
        .select({
            // Analysis table fields
            analysisId: dynAnalysisTable.id,
            status: dynAnalysisTable.status,
            jobID: dynAnalysisTable.jobID,
            createdAt: dynAnalysisTable.createdAt,
            updatedAt: dynAnalysisTable.updatedAt,
            completedAt: dynAnalysisTable.completedAt,
            analysisMeta: dynAnalysisTable.meta,
            // Document table fields
            documentId: dynDocumentTable.id,
            documentTitle: dynDocumentTable.title,
            fileURL: dynDocumentTable.fileURL,
            // Processed data fields
            processedDataId: dynProcessedDataTable.id,
            rawData: dynProcessedDataTable.rawData,
            processedData: dynProcessedDataTable.processedData,
            processedDataMeta: dynProcessedDataTable.meta,
        })
        .from(dynAnalysisTable)
        .leftJoin(dynDocumentTable, eq(dynAnalysisTable.documentID, dynDocumentTable.id))
        .leftJoin(dynProcessedDataTable, eq(dynAnalysisTable.id, dynProcessedDataTable.analysisID))
        .where(
            and(
                eq(dynAnalysisTable.id, validatedAnalysisId),
                eq(dynAnalysisTable[entityIDColumn], userID)
            )
        )
        .limit(1);

    if (!analysisRecord || analysisRecord.length === 0) {
        return next(new AppError('Analysis not found or you do not have permission to access it', 404));
    }

    const result = analysisRecord[0];

    // Parse JSON fields
    let parsedProcessedData = null;
    let parsedAnalysisMeta = null;
    let parsedProcessedDataMeta = null;

    try {
        if (result.processedData) {
            parsedProcessedData = JSON.parse(result.processedData);
        }
        if (result.analysisMeta) {
            parsedAnalysisMeta = JSON.parse(result.analysisMeta);
        }
        if (result.processedDataMeta) {
            parsedProcessedDataMeta = JSON.parse(result.processedDataMeta);
        }
    } catch (error) {
        logger.error('Error parsing JSON fields:', error);
    }

    // Structure the response
    const response = {
        analysis: {
            id: result.analysisId,
            status: result.status,
            jobID: result.jobID,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            completedAt: result.completedAt,
            meta: parsedAnalysisMeta,
        },
        document: {
            id: result.documentId,
            title: result.documentTitle,
            fileURL: result.fileURL,
        },
        processedData: {
            id: result.processedDataId,
            rawData: result.rawData,
            processedData: parsedProcessedData,
            meta: parsedProcessedDataMeta,
        }
    };

    logger.info(`Successfully fetched analysis details for analysisId: ${validatedAnalysisId}`);

    sendSuccess(res, response, "Analysis details retrieved successfully", 200);
});

/**
 * Update processed data for a resume analysis
 * PUT /api/v1/resume-analysis/:analysisId
 */
export const updateResumeAnalysisController = asyncHandler(async (req, res, next) => {
    const { analysisId } = req.params;
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const { processedData, meta } = req.body;

    // Validate analysis ID
    const validatedAnalysisId = validateInteger(analysisId, 'Analysis ID');

    logger.info(`Updating analysis data for analysisId: ${validatedAnalysisId}, userID: ${userID}, userType: ${userType}`);

    // Get dynamic tables based on user type
    const tables = getDynamicTables(userType);
    const { 
        analysisTable: dynAnalysisTable, 
        processedDataTable: dynProcessedDataTable,
        entityIDColumn 
    } = tables;

    // Verify the analysis belongs to the user
    const analysisRecord = await db
        .select()
        .from(dynAnalysisTable)
        .where(
            and(
                eq(dynAnalysisTable.id, validatedAnalysisId),
                eq(dynAnalysisTable[entityIDColumn], userID)
            )
        )
        .limit(1);

    if (!analysisRecord || analysisRecord.length === 0) {
        return next(new AppError('Analysis not found or you do not have permission to update it', 404));
    }

    // Check if there's existing processed data
    const existingProcessedData = await db
        .select()
        .from(dynProcessedDataTable)
        .where(eq(dynProcessedDataTable.analysisID, validatedAnalysisId))
        .limit(1);

    if (!existingProcessedData || existingProcessedData.length === 0) {
        return next(new AppError('No processed data found for this analysis', 404));
    }

    // Prepare update data
    const updateData = {
        updatedAt: new Date(),
    };

    if (processedData !== undefined) {
        updateData.processedData = typeof processedData === 'string'
            ? processedData
            : JSON.stringify(processedData);
    }

    if (meta !== undefined) {
        updateData.meta = typeof meta === 'string'
            ? meta
            : JSON.stringify(meta);
    }

    // Update the processed data
    const [updatedRecord] = await db
        .update(dynProcessedDataTable)
        .set(updateData)
        .where(eq(dynProcessedDataTable.analysisID, validatedAnalysisId))
        .returning();

    logger.info(`Successfully updated analysis data for analysisId: ${validatedAnalysisId}`);

    // Parse the updated data for response
    let parsedProcessedData = null;
    let parsedMeta = null;

    try {
        if (updatedRecord.processedData) {
            parsedProcessedData = JSON.parse(updatedRecord.processedData);
        }
        if (updatedRecord.meta) {
            parsedMeta = JSON.parse(updatedRecord.meta);
        }
    } catch (error) {
        logger.error('Error parsing JSON fields:', error);
    }

    const response = {
        id: updatedRecord.id,
        analysisID: updatedRecord.analysisID,
        documentID: updatedRecord.documentID,
        processedData: parsedProcessedData,
        meta: parsedMeta,
        updatedAt: updatedRecord.updatedAt,
    };

    sendSuccess(res, response, "Analysis data updated successfully", 200);
});

/**
 * Get all resume analyses for the authenticated user
 * GET /api/v1/resume-analysis
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - q: Search in document title
 * - status: Filter by status (completed, pending, failed) - supports multiple: ?status=completed,pending
 * - createdAt: Date range filter ?createdAt=2025-01-01,2025-12-31
 * - completedAt: Date range filter for completed analyses
 * - atsScore: Filter by ATS score (stored in meta.atsScore)
 * - sortBy: Sort field (createdAt, updatedAt, completedAt, atsScore)
 * - sortOrder: Sort order (asc, desc)
 */
export const getAllResumeAnalysesController = asyncHandler(async (req, res, next) => {
    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;

    logger.info(`Fetching all analyses for userID: ${userID}, userType: ${userType}`, { query: req.query });

    // Get dynamic tables based on user type
    const tables = getDynamicTables(userType);
    const { 
        analysisTable: dynAnalysisTable, 
        documentTable: dynDocumentTable,
        resumeContentTable: dynResumeContentTable,
        entityIDColumn 
    } = tables;

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        searchFields: [dynDocumentTable.title],
        filterableFields: {
            status: 'array', // supports multiple: ?status=completed,pending
            createdAt: 'dateRange',
            completedAt: 'dateRange',
        },
        sortableFields: ['createdAt', 'updatedAt', 'completedAt', 'atsScore'],
        defaultSort: { field: 'createdAt', order: 'desc' }
    });

    // Build base where conditions
    const whereConditions = [eq(dynAnalysisTable[entityIDColumn], userID)];

    // Add filter conditions
    const filterConditions = buildWhereConditions(
        filters,
        dynAnalysisTable,
        { eq, inArray, gte, lte, or, and, like, ilike }
    );
    whereConditions.push(...filterConditions);

    // Add search condition
    const searchCondition = buildSearchCondition(
        search.query,
        [dynDocumentTable.title],
        { or, ilike }
    );
    if (searchCondition) {
        whereConditions.push(searchCondition);
    }

    // Get total count for pagination
    const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(dynAnalysisTable)
        .leftJoin(dynDocumentTable, eq(dynAnalysisTable.documentID, dynDocumentTable.id))
        .where(and(...whereConditions));

    // Check if sorting by atsScore (which is in JSON meta field)
    const sortingByAtsScore = sort.field === 'atsScore';
    
    let analyses;
    if (sortingByAtsScore) {
        // Fetch all matching records for in-memory sorting
        analyses = await db
            .select({
                analysisId: dynAnalysisTable.id,
                status: dynAnalysisTable.status,
                jobID: dynAnalysisTable.jobID,
                createdAt: dynAnalysisTable.createdAt,
                updatedAt: dynAnalysisTable.updatedAt,
                completedAt: dynAnalysisTable.completedAt,
                analysisMeta: dynAnalysisTable.meta,
                documentId: dynDocumentTable.id,
                documentTitle: dynDocumentTable.title,
                fileURL: dynDocumentTable.fileURL,
                resumeId: dynResumeContentTable.id,
                currentScores: dynResumeContentTable.currentScores,
            })
            .from(dynAnalysisTable)
            .leftJoin(dynDocumentTable, eq(dynAnalysisTable.documentID, dynDocumentTable.id))
            .leftJoin(dynResumeContentTable, eq(dynAnalysisTable.id, dynResumeContentTable.analysisID))
            .where(and(...whereConditions));
    } else {
        // Build order by for SQL sorting
        const orderByClause = buildOrderBy(sort, dynAnalysisTable, { asc, desc });

        // Fetch paginated analysis records
        analyses = await db
            .select({
                analysisId: dynAnalysisTable.id,
                status: dynAnalysisTable.status,
                jobID: dynAnalysisTable.jobID,
                createdAt: dynAnalysisTable.createdAt,
                updatedAt: dynAnalysisTable.updatedAt,
                completedAt: dynAnalysisTable.completedAt,
                analysisMeta: dynAnalysisTable.meta,
                documentId: dynDocumentTable.id,
                documentTitle: dynDocumentTable.title,
                fileURL: dynDocumentTable.fileURL,
                resumeId: dynResumeContentTable.id,
                currentScores: dynResumeContentTable.currentScores,
            })
            .from(dynAnalysisTable)
            .leftJoin(dynDocumentTable, eq(dynAnalysisTable.documentID, dynDocumentTable.id))
            .leftJoin(dynResumeContentTable, eq(dynAnalysisTable.id, dynResumeContentTable.analysisID))
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);
    }

    // Parse meta fields and extract scores from resume content
    const formattedAnalyses = analyses.map(analysis => {
        let parsedMeta = null;
        let atsScore = null;
        let scores = null;
        
        try {
            if (analysis.analysisMeta) {
                parsedMeta = JSON.parse(analysis.analysisMeta);
            }
        } catch (error) {
            logger.error('Error parsing analysis meta:', error);
        }

        // Extract scores from resume content's currentScores
        if (analysis.currentScores) {
            scores = typeof analysis.currentScores === 'string' 
                ? JSON.parse(analysis.currentScores) 
                : analysis.currentScores;
            atsScore = scores?.atsScore || null;
        }

        return {
            id: analysis.analysisId,
            resumeId: analysis.resumeId || null,
            status: analysis.status,
            jobID: analysis.jobID,
            createdAt: analysis.createdAt,
            updatedAt: analysis.updatedAt,
            completedAt: analysis.completedAt,
            scores, // Full scores from resume content
            atsScore, // Extracted for easy filtering on frontend
            meta: parsedMeta,
            document: {
                id: analysis.documentId,
                title: analysis.documentTitle,
                fileURL: analysis.fileURL,
            }
        };
    });

    // If sorting by atsScore, sort in memory and apply pagination
    let paginatedAnalyses = formattedAnalyses;
    if (sortingByAtsScore) {
        // Sort by atsScore (handle null values by placing them at the end)
        paginatedAnalyses.sort((a, b) => {
            const scoreA = a.atsScore ?? -Infinity;
            const scoreB = b.atsScore ?? -Infinity;
            
            if (sort.order === 'asc') {
                return scoreA === -Infinity ? 1 : scoreB === -Infinity ? -1 : scoreA - scoreB;
            } else {
                return scoreB === -Infinity ? 1 : scoreA === -Infinity ? -1 : scoreB - scoreA;
            }
        });

        // Apply pagination after sorting
        paginatedAnalyses = paginatedAnalyses.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    // Calculate pagination metadata
    const paginationMeta = getPaginationMeta(totalCount, pagination);

    // Format response
    const response = formatPaginatedResponse(paginatedAnalyses, paginationMeta, filters);

    logger.info(`Successfully fetched ${paginatedAnalyses.length} of ${totalCount} analyses for userID: ${userID}`);

    sendSuccess(res, response, "Analyses retrieved successfully", 200);
});

/**
 * Create a new resume document and start analysis
 * POST /api/v1/user/:id/resumes
 * Supports both regular users and candidates based on token type
 */
export const createResumeController = asyncHandler(async (req, res, next) => {
    const { createUserDocument, createAnalysisRecord, createCandidateDocument, createCandidateAnalysisRecord } = await import("../models/resume-and-analysis.model.js");
    const { getUserByIDModel } = await import("../models/user.model.js");
    const { getCandidateById } = await import("../models/candidate.model.js");

    const userID = req.userID;
    const userType = req.type || userTypeConstants.USER;
    const creditTransaction = req.creditTransaction;
    const validatedId = validateInteger(userID, 'User ID');

    // Get entity based on user type
    let entity;
    if (isCandidate(userType)) {
        entity = await getCandidateById(validatedId);
        if (!entity) {
            return next(new AppError('Candidate not found', 404));
        }
    } else {
        entity = await getUserByIDModel(validatedId);
        if (!entity) {
            return next(new AppError('User not found', 404));
        }
    }

    // Check req body
    if (!req.body || typeof req.body !== 'object') {
        return next(new AppError('Invalid request body', 400));
    }

    const { fileURL } = req.body;
    if (!fileURL) {
        return next(new AppError('Missing required field: fileURL', 400));
    }

    // Create document record with temporary title (will be updated after parsing)
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const documentTitle = `Pending Analysis - ${timestamp}`;
    
    let createdDocument;
    let createAnalysis;
    
    if (isCandidate(userType)) {
        // Use candidate-specific functions
        createdDocument = await createCandidateDocument(validatedId, {
            title: documentTitle,
            fileURL,
            meta: {}
        });

        createAnalysis = await createCandidateAnalysisRecord(validatedId, createdDocument.id, {}, {
            title: documentTitle,
            fileURL,
            meta: {}
        }, creditTransaction?.id);
    } else {
        // Use user-specific functions
        createdDocument = await createUserDocument(validatedId, {
            title: documentTitle,
            fileURL,
            meta: {}
        });

        createAnalysis = await createAnalysisRecord(validatedId, createdDocument.id, {}, {
            title: documentTitle,
            fileURL,
            meta: {}
        }, creditTransaction?.id);
    }

    if (!createAnalysis) {
        return next(new AppError('Analysis creation failed', 500));
    }

    logger.info(`Created new resume document and analysis for ${userType}: ${validatedId}, analysisId: ${createAnalysis.id}`);

    sendSuccess(res, { 
        ...createAnalysis, 
        steps: "Use the jobId to track the analysis process" 
    }, "Document created successfully", 201);
});

/**
 * Analyze a manually-created resume (blank resume with user content)
 * POST /api/v1/resumes/:id/analyze
 * 
 * This endpoint:
 * 1. Validates the resume has sufficient content
 * 2. Reserves 1 credit (via middleware)
 * 3. Queues the analysis job
 * 4. Returns job ID for progress tracking
 * 
 * Requires: checkAndReserveCredits('analysis') middleware
 */
export const analyzeManualResumeController = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userID = req.userID;
    const candidateID = req.candidateID;
    const userType = req.type || userTypeConstants.USER;
    const creditTransaction = req.creditTransaction;
    
    // Use pre-validated content from middleware (validateResumeContentForAnalysis)
    // This middleware runs BEFORE credit reservation, so credits are only reserved for valid requests
    let resumeContent = req.validatedResumeContent;
    let validation = req.contentValidation;

    // Validate resume ID
    const resumeContentID = validateInteger(id, 'Resume ID');
    const entityID = isCandidate(userType) ? candidateID : userID;

    logger.info('[MANUAL_ANALYSIS] Starting manual resume analysis', {
        resumeContentID,
        entityID,
        userType,
        creditTransactionID: creditTransaction?.id,
        hasPrevalidatedContent: !!resumeContent
    });

    // Get appropriate tables based on user type
    const tables = getDynamicTables(userType);
    const entityIDColumn = tables.entityIDColumn;
    const contentTable = isCandidate(userType) ? candidateResumeContentTable : resumeContentTable;

    // If no pre-validated content (middleware was bypassed), fetch and validate
    if (!resumeContent) {
        const [fetchedContent] = await db.select()
            .from(contentTable)
            .where(
                and(
                    eq(contentTable.id, resumeContentID),
                    eq(contentTable[entityIDColumn], entityID)
                )
            )
            .limit(1);

        if (!fetchedContent) {
            return next(new AppError('Resume not found or you do not have permission to access it', 404));
        }

        // Validate the resume has sufficient content for analysis
        const contentToValidate = {
            personalInfo: fetchedContent.personalInfo || {},
            summary: fetchedContent.summary || {},
            experience: fetchedContent.experience || [],
            education: fetchedContent.education || [],
            skills: fetchedContent.skills || {},
            additionalSections: fetchedContent.additionalSections || []
        };

        validation = validateResumeForAnalysis(contentToValidate);

        if (!validation.isValid) {
            logger.warn('[MANUAL_ANALYSIS] Resume has insufficient content for analysis', {
                resumeContentID,
                missingFields: validation.missingFields,
                details: validation.details
            });

            return next(new AppError(
                validation.message,
                400,
                {
                    code: 'INSUFFICIENT_CONTENT',
                    missingFields: validation.missingFields,
                    details: validation.details,
                    warnings: validation.warnings
                }
            ));
        }
        
        resumeContent = fetchedContent;
    }

    // Get the analysis record for this resume
    const analysisID = resumeContent.analysisID;
    if (!analysisID) {
        return next(new AppError('No analysis record associated with this resume', 400));
    }

    // Get document ID
    const dynAnalysisTable = tables.analysisTable;
    const [analysisRecord] = await db.select()
        .from(dynAnalysisTable)
        .where(eq(dynAnalysisTable.id, analysisID))
        .limit(1);

    if (!analysisRecord) {
        return next(new AppError('Analysis record not found', 404));
    }

    // Check if analysis is already in progress
    if (analysisRecord.status === 'processing') {
        return next(new AppError(
            'Analysis is already in progress. Please wait for it to complete.',
            409,
            { 
                code: 'ANALYSIS_IN_PROGRESS',
                jobID: analysisRecord.jobID 
            }
        ));
    }

    // Final validation check before updating analysis - ensures empty resumes can't trigger analysis
    // This is a safeguard in case middleware was bypassed or validation was skipped
    if (!validation || !validation.isValid) {
        const contentToRevalidate = {
            personalInfo: resumeContent.personalInfo || {},
            summary: resumeContent.summary || {},
            experience: resumeContent.experience || [],
            education: resumeContent.education || [],
            skills: resumeContent.skills || {},
            additionalSections: resumeContent.additionalSections || []
        };
        
        const finalValidation = validateResumeForAnalysis(contentToRevalidate);
        
        if (!finalValidation.isValid) {
            logger.warn('[MANUAL_ANALYSIS] Final validation failed - empty resume cannot be analyzed', {
                resumeContentID,
                entityID,
                missingFields: finalValidation.missingFields
            });
            
            return next(new AppError(
                finalValidation.message,
                400,
                {
                    code: 'INSUFFICIENT_CONTENT',
                    missingFields: finalValidation.missingFields,
                    details: finalValidation.details,
                    warnings: finalValidation.warnings
                }
            ));
        }
        
        validation = finalValidation;
    }

    // Update analysis status to pending
    await db.update(dynAnalysisTable)
        .set({
            status: 'pending',
            updatedAt: new Date()
        })
        .where(eq(dynAnalysisTable.id, analysisID));

    // Queue the manual analysis job
    const job = await addManualAnalysisJob({
        analysisID,
        userID: entityID,
        userType,
        resumeContentID,
        documentID: analysisRecord.documentID,
        creditTransactionID: creditTransaction?.id
    });

    logger.info('[MANUAL_ANALYSIS] Analysis job queued', {
        jobId: job.id,
        analysisID,
        resumeContentID,
        entityID,
        userType
    });

    sendSuccess(res, {
        analysisID,
        resumeContentID,
        jobID: job.id,
        status: 'pending',
        message: 'Resume analysis started. Use the jobID to track progress.',
        validation: {
            isValid: true,
            details: validation.details,
            warnings: validation.warnings
        }
    }, 'Resume analysis started successfully', 202);
});
