import axios from 'axios';

/**
 * Send email using Brevo HTTP API
 */
export const sendEmail = async (to, subject, htmlContent, from = { email: process.env.BREVO_SENDER_EMAIL }) => {
    // Validate API key
    if (!process.env.BREVO_API_KEY) {
        const error = "BREVO_API_KEY is not configured in environment variables";
        console.error("Brevo configuration error:", error);
        return { success: false, error };
    }

    // Validate input parameters
    if (!to || !subject || !htmlContent) {
        const error = "Missing required parameters: to, subject, or htmlContent";
        console.error("Email validation error:", error);
        return { success: false, error };
    }

    try {
        console.log("Sending email via Brevo HTTP API...", {
            to,
            subject,
            apiKeyLength: process.env.BREVO_API_KEY?.length,
            apiKeyPrefix: process.env.BREVO_API_KEY?.substring(0, 20) + "..."
        });
        
        const emailData = {
            sender: from,
            to: [{ email: to }],
            subject: subject,
            htmlContent: htmlContent
        };

        const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            }
        });

        console.log("Email sent successfully", {
            to,
            subject,
            messageId: response.data.messageId
        });

        return { 
            success: true, 
            messageId: response.data.messageId,
            response: response.data 
        };
    } catch (error) {
        console.error("Brevo API Error:", {
            to,
            subject,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            apiKeySet: !!process.env.BREVO_API_KEY
        });
        
        return { success: false, error: error.message };
    }
};

/**
 * Send bulk emails using HTTP API
 * @param {Array} recipients - Array of email addresses: ["user1@example.com", "user2@example.com"]
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content for the email
 * @param {Object} from - Sender object: { email: "sender@example.com", name: "Sender Name" }
 * @returns {Promise<Object>} - Result object with success count, failures, and details
 */
export const sendBulkEmail = async (
    recipients,
    subject,
    htmlContent,
    from = { email: process.env.BREVO_SENDER_EMAIL , name: "Resume Project" }
) => {
    // Validate inputs
    if (!Array.isArray(recipients) || recipients.length === 0) {
        const error = "Recipients must be a non-empty array";
        console.log("Bulk email validation failed", { error, recipientCount: recipients?.length });
        return { success: false, error };
    }

    if (!subject || !htmlContent) {
        const error = "Subject and htmlContent are required";
        console.log("Bulk email validation failed", { error, subject: !!subject, htmlContent: !!htmlContent });
        return { success: false, error };
    }

    const results = {
        total: recipients.length,
        successful: 0,
        failed: 0,
        failures: [],
        successfulEmails: [],
        startTime: new Date().toISOString()
    };

    console.log("Starting bulk email sending", {
        totalRecipients: recipients.length,
        subject
    });

    // Send emails one by one
    for (let i = 0; i < recipients.length; i++) {
        const email = recipients[i];

        console.log(`Processing email ${i + 1}/${recipients.length}: ${email}`);

        try {
            const result = await sendEmail(email, subject, htmlContent, from);

            if (result.success) {
                results.successful++;
                results.successfulEmails.push({
                    email: email,
                    messageId: result.response?.messageId
                });
            } else {
                results.failed++;
                results.failures.push({
                    email: email,
                    error: result.error
                });
            }
        } catch (error) {
            results.failed++;
            results.failures.push({
                email: email,
                error: error.message
            });
        }
    }

    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);

    console.log("Bulk email sending completed", {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        successRate: `${((results.successful / results.total) * 100).toFixed(2)}%`,
        duration: `${results.duration}ms`
    });

    return {
        success: results.failed === 0,
        results
    };
};
