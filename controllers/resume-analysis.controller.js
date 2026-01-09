import { AppError, asyncHandler } from "../middleware/error.js";
import { sendSuccess } from "../utils/apiHelpers.js";
import { validateInteger } from "../utils/validate-helper.js";
import { db } from "../config/db.js";
import { analysisTable, processedAndRawDataTable, userDocumentTable } from "../drizzle/schema/analytics-rewrite-schema.js";
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

/**
 * Get resume analysis details by analysis ID
 * GET /api/v1/resume-analysis/:analysisId
 */
export const getResumeAnalysisController = asyncHandler(async (req, res, next) => {
    const { analysisId } = req.params;
    const userID = req.userID;

    // Validate analysis ID
    const validatedAnalysisId = validateInteger(analysisId, 'Analysis ID');

    logger.info(`Fetching analysis details for analysisId: ${validatedAnalysisId}, userID: ${userID}`);

    // Fetch analysis record with processed data
    const analysisRecord = await db
        .select({
            // Analysis table fields
            analysisId: analysisTable.id,
            status: analysisTable.status,
            jobID: analysisTable.jobID,
            createdAt: analysisTable.createdAt,
            updatedAt: analysisTable.updatedAt,
            completedAt: analysisTable.completedAt,
            analysisMeta: analysisTable.meta,
            // Document table fields
            documentId: userDocumentTable.id,
            documentTitle: userDocumentTable.title,
            fileURL: userDocumentTable.fileURL,
            // Processed data fields
            processedDataId: processedAndRawDataTable.id,
            rawData: processedAndRawDataTable.rawData,
            processedData: processedAndRawDataTable.processedData,
            processedDataMeta: processedAndRawDataTable.meta,
        })
        .from(analysisTable)
        .leftJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
        .leftJoin(processedAndRawDataTable, eq(analysisTable.id, processedAndRawDataTable.analysisID))
        .where(
            and(
                eq(analysisTable.id, validatedAnalysisId),
                eq(analysisTable.userID, userID)
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
    const { processedData, meta } = req.body;

    // Validate analysis ID
    const validatedAnalysisId = validateInteger(analysisId, 'Analysis ID');

    logger.info(`Updating analysis data for analysisId: ${validatedAnalysisId}, userID: ${userID}`);

    // Verify the analysis belongs to the user
    const analysisRecord = await db
        .select()
        .from(analysisTable)
        .where(
            and(
                eq(analysisTable.id, validatedAnalysisId),
                eq(analysisTable.userID, userID)
            )
        )
        .limit(1);

    if (!analysisRecord || analysisRecord.length === 0) {
        return next(new AppError('Analysis not found or you do not have permission to update it', 404));
    }

    // Check if there's existing processed data
    const existingProcessedData = await db
        .select()
        .from(processedAndRawDataTable)
        .where(eq(processedAndRawDataTable.analysisID, validatedAnalysisId))
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
        .update(processedAndRawDataTable)
        .set(updateData)
        .where(eq(processedAndRawDataTable.analysisID, validatedAnalysisId))
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

    logger.info(`Fetching all analyses for userID: ${userID}`, { query: req.query });

    // Parse query parameters
    const { pagination, search, filters, sort } = parseQueryParams(req.query, {
        defaultPageSize: 10,
        maxPageSize: 100,
        searchFields: [userDocumentTable.title],
        filterableFields: {
            status: 'array', // supports multiple: ?status=completed,pending
            createdAt: 'dateRange',
            completedAt: 'dateRange',
        },
        sortableFields: ['createdAt', 'updatedAt', 'completedAt', 'atsScore'],
        defaultSort: { field: 'createdAt', order: 'desc' }
    });

    // Build base where conditions
    const whereConditions = [eq(analysisTable.userID, userID)];

    // Add filter conditions
    const filterConditions = buildWhereConditions(
        filters,
        analysisTable,
        { eq, inArray, gte, lte, or, and, like, ilike }
    );
    whereConditions.push(...filterConditions);

    // Add search condition
    const searchCondition = buildSearchCondition(
        search.query,
        [userDocumentTable.title],
        { or, ilike }
    );
    if (searchCondition) {
        whereConditions.push(searchCondition);
    }

    // Get total count for pagination
    const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(analysisTable)
        .leftJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
        .where(and(...whereConditions));

    // Check if sorting by atsScore (which is in JSON meta field)
    const sortingByAtsScore = sort.field === 'atsScore';
    
    let analyses;
    if (sortingByAtsScore) {
        // Fetch all matching records for in-memory sorting
        analyses = await db
            .select({
                analysisId: analysisTable.id,
                status: analysisTable.status,
                jobID: analysisTable.jobID,
                createdAt: analysisTable.createdAt,
                updatedAt: analysisTable.updatedAt,
                completedAt: analysisTable.completedAt,
                analysisMeta: analysisTable.meta,
                documentId: userDocumentTable.id,
                documentTitle: userDocumentTable.title,
                fileURL: userDocumentTable.fileURL,
            })
            .from(analysisTable)
            .leftJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .where(and(...whereConditions));
    } else {
        // Build order by for SQL sorting
        const orderByClause = buildOrderBy(sort, analysisTable, { asc, desc });

        // Fetch paginated analysis records
        analyses = await db
            .select({
                analysisId: analysisTable.id,
                status: analysisTable.status,
                jobID: analysisTable.jobID,
                createdAt: analysisTable.createdAt,
                updatedAt: analysisTable.updatedAt,
                completedAt: analysisTable.completedAt,
                analysisMeta: analysisTable.meta,
                documentId: userDocumentTable.id,
                documentTitle: userDocumentTable.title,
                fileURL: userDocumentTable.fileURL,
            })
            .from(analysisTable)
            .leftJoin(userDocumentTable, eq(analysisTable.documentID, userDocumentTable.id))
            .where(and(...whereConditions))
            .orderBy(...orderByClause)
            .limit(pagination.limit)
            .offset(pagination.offset);
    }

    // Parse meta fields and extract ATS score if available
    const formattedAnalyses = analyses.map(analysis => {
        let parsedMeta = null;
        let atsScore = null;
        try {
            if (analysis.analysisMeta) {
                parsedMeta = JSON.parse(analysis.analysisMeta);
                atsScore = parsedMeta?.atsScore || null;
            }
        } catch (error) {
            logger.error('Error parsing analysis meta:', error);
        }

        return {
            id: analysis.analysisId,
            status: analysis.status,
            jobID: analysis.jobID,
            createdAt: analysis.createdAt,
            updatedAt: analysis.updatedAt,
            completedAt: analysis.completedAt,
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
 */
export const createResumeController = asyncHandler(async (req, res, next) => {
    const { createUserDocument, createAnalysisRecord } = await import("../models/resume-and-analysis.model.js");
    const { getUserByIDModel } = await import("../models/user.model.js");

    const userID = req.userID;
    const validatedId = validateInteger(userID, 'User ID');

    const user = await getUserByIDModel(validatedId);
    if (!user) {
        return next(new AppError('User not found', 404));
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
    const documentTitle = `Resume Analysis (Pending) - ${timestamp}`;
    
    const createdDocument = await createUserDocument(validatedId, {
        title: documentTitle,
        fileURL,
        meta: {}
    });

    // Create analysis record and queue job
    const createAnalysis = await createAnalysisRecord(validatedId, createdDocument.id, {}, {
        title: documentTitle,
        fileURL,
        meta: {}
    });

    if (!createAnalysis) {
        return next(new AppError('Analysis creation failed', 500));
    }

    logger.info(`Created new resume document and analysis for userID: ${validatedId}, analysisId: ${createAnalysis.id}`);

    sendSuccess(res, { 
        ...createAnalysis, 
        steps: "Use the jobId to track the analysis process" 
    }, "Document created successfully", 201);
});
