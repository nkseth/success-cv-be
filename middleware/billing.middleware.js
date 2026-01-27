import { AppError } from "./error.js";
import billingModel from "../models/billing.model.js";
import logger from "./logger.js";
import { userTypeConstants } from "../utils/constants.js";

/**
 * Middleware to check and reserve credits before processing
 * Attaches transaction info to req for later confirmation/refund
 * 
 * IMPORTANT: 
 * - Users (individual) can only use their personal wallet credits
 * - Candidates can ONLY use organisation wallet credits (they cannot have personal wallets)
 * 
 * @param {string} operationType - Type of operation ('analysis' or 'rewrite')
 */
export const checkAndReserveCredits = (operationType) => {
    return async (req, res, next) => {
        try {
            const { userID, candidateID, type: userType, organisationID } = req;
            const creditsRequired = 1;
            
            let wallet;
            let walletType;
            let entityID;
            
            // Candidates can ONLY use organisation credits
            if (userType === userTypeConstants.CANDIDATE) {
                if (!organisationID) {
                    throw new AppError('Candidate must belong to an organisation to use credits', 400);
                }
                
                wallet = await billingModel.getOrCreateWallet('organisation', organisationID);
                walletType = 'organisation';
                entityID = candidateID;
                
                logger.info('[BILLING] Candidate using org credits', { 
                    candidateID, 
                    organisationID, 
                    walletID: wallet.id 
                });
            } 
            // Users use their personal credits only
            else if (userType === userTypeConstants.USER) {
                wallet = await billingModel.getOrCreateWallet('user', userID);
                walletType = 'user';
                entityID = userID;
                
                logger.info('[BILLING] User using personal credits', { 
                    userID, 
                    walletID: wallet.id 
                });
            } 
            else {
                throw new AppError('Invalid user type for billing', 400);
            }
            
            // Check balance
            if (wallet.balance < creditsRequired) {
                logger.warn('[BILLING] Insufficient credits', { 
                    entityID, 
                    userType, 
                    walletID: wallet.id,
                    balance: wallet.balance, 
                    required: creditsRequired 
                });
                
                const errorMessage = userType === userTypeConstants.CANDIDATE
                    ? 'Organisation has insufficient credits. Please contact your organisation admin.'
                    : 'Insufficient credits. Please purchase more credits.';
                
                throw new AppError(
                    errorMessage,
                    402,
                    { 
                        currentBalance: wallet.balance, 
                        required: creditsRequired,
                        walletType
                    }
                );
            }
            
            // Reserve credits
            const transaction = await billingModel.reserveCredits(
                wallet.id,
                creditsRequired,
                operationType,
                null, // referenceID will be set after job creation
                {
                    userID: userType === userTypeConstants.USER ? userID : null,
                    candidateID: userType === userTypeConstants.CANDIDATE ? candidateID : null
                }
            );
            
            // Attach to request for later use in controller/worker
            req.creditTransaction = {
                id: transaction.id,
                walletID: wallet.id,
                amount: creditsRequired,
                walletType
            };
            
            logger.info('[BILLING] Credits reserved for operation', { 
                transactionID: transaction.id,
                operationType,
                entityID,
                userType,
                walletType
            });
            
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Optional middleware to check if user has credits without reserving
 * Useful for UI to show warnings before initiating operations
 * 
 * - Users get their personal balance
 * - Candidates get their org balance
 */
export const checkCreditsAvailable = async (req, res, next) => {
    try {
        const { userID, candidateID, type: userType, organisationID } = req;
        
        let wallet;
        
        // Candidates can only see org credits
        if (userType === userTypeConstants.CANDIDATE) {
            if (!organisationID) {
                req.creditsAvailable = 0;
                req.creditsPending = 0;
                return next();
            }
            wallet = await billingModel.getOrCreateWallet('organisation', organisationID);
        } 
        // Users see their personal credits
        else {
            wallet = await billingModel.getOrCreateWallet('user', userID);
        }
        
        req.creditsAvailable = wallet.balance;
        req.creditsPending = wallet.pendingBalance;
        
        next();
    } catch (error) {
        // Don't fail the request, just set credits to 0
        req.creditsAvailable = 0;
        req.creditsPending = 0;
        next();
    }
};

/**
 * Middleware to validate resume content before analysis
 * Must run BEFORE checkAndReserveCredits to avoid reserving credits for invalid requests
 */
export const validateResumeContentForAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userID, candidateID, type: userType } = req;
        
        // Dynamic import to avoid circular dependencies
        const { validateInteger } = await import('../utils/validate-helper.js');
        const { validateResumeForAnalysis } = await import('../utils/resumeSchema.js');
        const { getDynamicTables, isCandidate } = await import('../utils/dynamic-tables.js');
        const { db } = await import('../config/db.js');
        const { resumeContentTable, candidateResumeContentTable } = await import('../drizzle/schema.js');
        const { eq, and } = await import('drizzle-orm');
        
        const resumeContentID = validateInteger(id, 'Resume ID');
        const entityID = isCandidate(userType) ? candidateID : userID;
        
        // Get appropriate tables based on user type
        const tables = getDynamicTables(userType);
        const entityIDColumn = tables.entityIDColumn;
        const contentTable = isCandidate(userType) ? candidateResumeContentTable : resumeContentTable;
        
        // Fetch the resume content
        const [resumeContent] = await db.select()
            .from(contentTable)
            .where(
                and(
                    eq(contentTable.id, resumeContentID),
                    eq(contentTable[entityIDColumn], entityID)
                )
            )
            .limit(1);
        
        if (!resumeContent) {
            throw new AppError('Resume not found or you do not have permission to access it', 404);
        }
        
        // Validate the resume has sufficient content for analysis
        const contentToValidate = {
            personalInfo: resumeContent.personalInfo || {},
            summary: resumeContent.summary || {},
            experience: resumeContent.experience || [],
            education: resumeContent.education || [],
            skills: resumeContent.skills || {},
            additionalSections: resumeContent.additionalSections || []
        };
        
        const validation = validateResumeForAnalysis(contentToValidate);
        
        if (!validation.isValid) {
            logger.warn('[BILLING] Resume content validation failed before credit reservation', {
                resumeContentID,
                missingFields: validation.missingFields
            });
            
            throw new AppError(
                validation.message,
                400,
                {
                    code: 'INSUFFICIENT_CONTENT',
                    missingFields: validation.missingFields,
                    details: validation.details,
                    warnings: validation.warnings
                }
            );
        }
        
        // Attach validated content to request for use in controller
        req.validatedResumeContent = resumeContent;
        req.contentValidation = validation;
        
        logger.info('[BILLING] Resume content validated successfully', {
            resumeContentID,
            entityID,
            userType
        });
        
        next();
    } catch (error) {
        next(error);
    }
};

export default {
    checkAndReserveCredits,
    checkCreditsAvailable,
    validateResumeContentForAnalysis
};
