const Bull = require('bull');
const logger = require('../utils/logger');

// Create queue for image processing
const imageProcessingQueue = new Bull('image processing', {
  redis: process.env.REDIS_URL, // Use direct URL for Upstash
  defaultJobOptions: {
    removeOnComplete: 20,    // Keep last 50 completed jobs
    removeOnFail: 20,        // Keep last 20 failed jobs
    attempts: 2,             // Reduce retry attempts
    backoff: {
      type: 'exponential',
      delay: 5000,          // Increased initial delay
    },
    timeout: 120000         // 2 minute timeout
  },
  settings: {
    lockDuration: 30000,    // 30 second lock
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 1      // Only retry stalled jobs once
  }
});

// Queue configuration
const QUEUE_CONFIG = {
  concurrency: 1, // Process 1 job at a time
  maxJobs: 50,   // Reduced maximum jobs
  priorities: {
    high: 10,
    normal: 5,
    low: 1
  }
};

// Add job to queue
const addImageProcessingJob = async (receiptId, imageUrl, userId) => {
  try {
    const job = await imageProcessingQueue.add('process-receipt-image', {
      receiptId,
      imageUrl,
      userId,
      timestamp: new Date().toISOString()
    }, {
      priority: QUEUE_CONFIG.priorities.normal
    });

    logger.info(`Added job to queue: ${job.id} for receipt: ${receiptId}`);
    
    return {
      jobId: job.id,
      queuePosition: 0, // Don't calculate position to avoid blocking
      estimatedTime: 120 // Fixed estimate of 2 minutes
    };
  } catch (error) {
    logger.error('Failed to add job to queue:', error);
    throw error;
  }
};

// Add priority job
const addPriorityJob = async (receiptId, imageUrl, userId) => {
  try {
    const job = await imageProcessingQueue.add('process-receipt-image', {
      receiptId,
      imageUrl,
      userId,
      timestamp: new Date().toISOString()
    }, {
      priority: QUEUE_CONFIG.priorities.high
    });

    logger.info(`Added priority job to queue: ${job.id} for receipt: ${receiptId}`);
    
    return {
      jobId: job.id,
      queuePosition: 0, // Don't calculate position to avoid blocking
      estimatedTime: 60 // Fixed estimate of 1 minute for priority
    };
  } catch (error) {
    logger.error('Failed to add priority job to queue:', error);
    throw error;
  }
};

// Get job status without blocking operations
const getJobStatus = async (jobId) => {
  try {
    const job = await imageProcessingQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;
    const error = job.failedReason;

    return {
      status: state,
      progress,
      data: job.data,
      result,
      error,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  } catch (error) {
    logger.error(`Failed to get job status for ${jobId}:`, error);
    return { status: 'error', error: error.message };
  }
};

// Get user's jobs without waiting count
const getUserJobs = async (userId) => {
  try {
    const jobs = await imageProcessingQueue.getJobs(['active', 'waiting', 'completed', 'failed']);
    return jobs.filter(job => job.data.userId === userId);
  } catch (error) {
    logger.error(`Failed to get jobs for user ${userId}:`, error);
    return [];
  }
};

module.exports = {
  imageProcessingQueue,
  addImageProcessingJob,
  addPriorityJob,
  getJobStatus,
  getUserJobs,
  QUEUE_CONFIG
}; 