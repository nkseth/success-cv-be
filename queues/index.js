import queueService from '../services/queue.service.js';
import { resumeAnalysisQueue } from './resume-analysis.queue.js';
import { jobScrapingQueue } from './job-scraping.queue.js';
import { getJobMatchingQueue } from './job-matching.queue.js';
import { manualAnalysisQueue } from './manual-analysis.queue.js';

/**
 * Central export for all queues
 */

// Export queue service for centralized queue management
export { default as queueService } from '../services/queue.service.js';

// Export resume analysis queue functions
export {
    // Resume Analysis Queue
    resumeAnalysisQueue,
    addResumeAnalysisJob,
    removeResumeAnalysisJob,
    getJobStatus,
    getQueueStats,
    removeJob,
    retryJob,
    cleanQueue,
    pauseQueue,
    resumeQueue,
    closeQueue
} from './resume-analysis.queue.js';

// Export manual analysis queue functions
export {
    manualAnalysisQueue,
    addManualAnalysisJob,
    removeManualAnalysisJob,
    getManualAnalysisJobStatus,
    getManualAnalysisQueueStats,
    retryManualAnalysisJob,
    cleanManualAnalysisQueue,
    pauseManualAnalysisQueue,
    resumeManualAnalysisQueue,
    closeManualAnalysisQueue
} from './manual-analysis.queue.js';

// Queue registry
export const queues = {
    resumeAnalysis: resumeAnalysisQueue,
    jobScraping: jobScrapingQueue,
    jobMatching: getJobMatchingQueue(),
    manualAnalysis: manualAnalysisQueue,
};

// Export job matching queue
export { getJobMatchingQueue, addMatchJobsForUserJob, addRematchJobsForUserJob, triggerMatchingAfterAnalysis } from './job-matching.queue.js';

// Close all queues using the queue service
export async function closeAllQueues() {
    return queueService.closeAllQueues();
}

export default {
    queues,
    queueService,
    closeAllQueues,
};
