import { db } from "../config/db.js";
import { validateString } from "../utils/validate-helper.js";
import { AppError } from "../middleware/error.js";
import { 
    analysisTable, 
    userDocumentTable,
    candidateAnalysisTable,
    candidateDocumentTable
} from "../drizzle/schema/analytics-rewrite-schema.js";
import { addResumeAnalysisJob } from "../queues/resume-analysis.queue.js";
import { eq } from "drizzle-orm";
import { userTypeConstants } from "../utils/constants.js";

// ========== USER DOCUMENT AND ANALYSIS FUNCTIONS ==========

export const createUserDocument = async (userID, data) => {

    try {

        const { title, fileURL, meta } = data;

        const validatedTitle = validateString(title, "Document Title", { minLength: 2, maxLength: 100 });
        const validatedFileURL = validateString(fileURL, "File URL", { minLength: 2, maxLength: 200 });

        const [createDocument] = await db.insert(userDocumentTable).values({
            title: validatedTitle,
            fileURL: validatedFileURL,
            userID: userID,
            meta: meta || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        return createDocument;
    } catch (error) {
        // If it's already an AppError, don't wrap it
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to create document: ${error.message}`, 500);
    }
}

export const createAnalysisRecord = async (userID, documentID, meta, documentData) => {
    try {

        const [createAnalytics] = await db.insert(analysisTable).values({
            userID,
            documentID,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
            meta: meta || null
        }).returning();
        if (!createAnalytics || !createAnalytics.id) {
            throw new AppError('Failed to create analysis record', 500);
        }
        const resp = await addResumeAnalysisJob({
            analysisID: createAnalytics.id,
            userID,
            userType: userTypeConstants.USER,
            resumeId: documentID,
            meta: meta || null,
            documentData
        });

        if (resp.error) {
            throw new AppError(`Failed to enqueue analysis job: ${resp.error}`, 500);
        }
        // update jobID in analysis record

        const [updatedAnalytics] = await db.update(analysisTable)
            .set({
                jobID: resp.id,
                updatedAt: new Date()
            })
            .where(eq(analysisTable.id, createAnalytics.id))
            .returning();
        console.log();

        return updatedAnalytics;
    } catch (error) {
        // If it's already an AppError, don't wrap it
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to create analysis record: ${error.message}`, 500);
    }
};

// ========== CANDIDATE DOCUMENT AND ANALYSIS FUNCTIONS ==========

export const createCandidateDocument = async (candidateID, data) => {
    try {
        const { title, fileURL, meta } = data;

        const validatedTitle = validateString(title, "Document Title", { minLength: 2, maxLength: 100 });
        const validatedFileURL = validateString(fileURL, "File URL", { minLength: 2, maxLength: 200 });

        const [createDocument] = await db.insert(candidateDocumentTable).values({
            title: validatedTitle,
            fileURL: validatedFileURL,
            candidateID: candidateID,
            meta: meta || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        return createDocument;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to create candidate document: ${error.message}`, 500);
    }
};

export const createCandidateAnalysisRecord = async (candidateID, documentID, meta, documentData) => {
    try {
        const [createAnalytics] = await db.insert(candidateAnalysisTable).values({
            candidateID,
            documentID,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
            meta: meta || null
        }).returning();
        
        if (!createAnalytics || !createAnalytics.id) {
            throw new AppError('Failed to create candidate analysis record', 500);
        }
        
        const resp = await addResumeAnalysisJob({
            analysisID: createAnalytics.id,
            userID: candidateID,
            userType: userTypeConstants.CANDIDATE,
            resumeId: documentID,
            meta: meta || null,
            documentData
        });

        if (resp.error) {
            throw new AppError(`Failed to enqueue analysis job: ${resp.error}`, 500);
        }
        
        // update jobID in analysis record
        const [updatedAnalytics] = await db.update(candidateAnalysisTable)
            .set({
                jobID: resp.id,
                updatedAt: new Date()
            })
            .where(eq(candidateAnalysisTable.id, createAnalytics.id))
            .returning();

        return updatedAnalytics;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to create candidate analysis record: ${error.message}`, 500);
    }
};