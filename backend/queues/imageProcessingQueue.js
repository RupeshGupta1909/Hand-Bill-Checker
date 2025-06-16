const Bull = require('bull');
const { getRedisClient } = require('../utils/redis');
const logger = require('../utils/logger');

// Create queue for image processing
const imageProcessingQueue = new Bull('image processing', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
    db: 1 // Use different database for queues
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,
    }
  }
});

// Queue configuration
const QUEUE_CONFIG = {
  concurrency: 2, // Process 2 jobs concurrently
  maxJobs: 100,   // Maximum jobs in queue
  priorities: {
    high: 10,
    normal: 5,
    low: 1
  }
};

// Add job to queue
const addImageProcessingJob = async (receiptId, imagePath, userId, priority = 'normal') => {
  try {
    // Check queue size
    const waiting = await imageProcessingQueue.getWaiting();
    if (waiting.length >= QUEUE_CONFIG.maxJobs) {
      throw new Error('Queue is full. Please try again later.');
    }
    console.log("imageProcessingQueue======creating job================");
    const job = await imageProcessingQueue.add(
      'process-receipt-image',
      {
        receiptId,
        imagePath,
        userId,
        timestamp: new Date().toISOString()
      },
      {
        priority: QUEUE_CONFIG.priorities[priority] || QUEUE_CONFIG.priorities.normal,
        attempts: 3,
        backoff: 'exponential',
        removeOnComplete: 10,
        removeOnFail: 5
      }
    );

    logger.logJobProcess('image-processing', job.id, 'queued', {
      receiptId,
      userId,
      priority,
      queuePosition: waiting.length + 1
    });

    return {
      jobId: job.id,
      queuePosition: waiting.length + 1,
      estimatedTime: calculateEstimatedTime(waiting.length + 1)
    };
  } catch (error) {
    logger.error('Failed to add job to queue:', error);
    throw error;
  }
};

// Calculate estimated processing time
const calculateEstimatedTime = (queuePosition) => {
  const avgProcessingTime = 60; // 60 seconds average
  return Math.ceil((queuePosition * avgProcessingTime) / QUEUE_CONFIG.concurrency);
};

// Get job status
const getJobStatus = async (jobId) => {
  try {
    const job = await imageProcessingQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress();
    
    return {
      id: job.id,
      status: state,
      progress,
      data: job.data,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts
    };
  } catch (error) {
    logger.error('Failed to get job status:', error);
    return { status: 'error', message: error.message };
  }
};

// Get queue statistics
const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      imageProcessingQueue.getWaiting(),
      imageProcessingQueue.getActive(),
      imageProcessingQueue.getCompleted(),
      imageProcessingQueue.getFailed(),
      imageProcessingQueue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return null;
  }
};

// Get user's jobs
const getUserJobs = async (userId, limit = 10) => {
  try {
    const jobs = await imageProcessingQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, limit);
    
    const userJobs = jobs
      .filter(job => job.data.userId === userId)
      .map(job => ({
        id: job.id,
        receiptId: job.data.receiptId,
        status: job.opts.jobId ? 'processing' : 'waiting',
        progress: job.progress(),
        createdAt: new Date(job.timestamp),
        processedOn: job.processedOn ? new Date(job.processedOn) : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return userJobs;
  } catch (error) {
    logger.error('Failed to get user jobs:', error);
    return [];
  }
};

// Clean up old jobs
const cleanupQueue = async () => {
  try {
    await imageProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
    await imageProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    
    logger.info('Queue cleanup completed');
  } catch (error) {
    logger.error('Queue cleanup failed:', error);
  }
};

// Pause/Resume queue
const pauseQueue = async () => {
  try {
    await imageProcessingQueue.pause();
    logger.info('Image processing queue paused');
    return true;
  } catch (error) {
    logger.error('Failed to pause queue:', error);
    return false;
  }
};

const resumeQueue = async () => {
  try {
    await imageProcessingQueue.resume();
    logger.info('Image processing queue resumed');
    return true;
  } catch (error) {
    logger.error('Failed to resume queue:', error);
    return false;
  }
};

// Priority job for premium users
const addPriorityJob = async (receiptId, imagePath, userId) => {
  return addImageProcessingJob(receiptId, imagePath, userId, 'high');
};

// Retry failed job
const retryJob = async (jobId) => {
  try {
    const job = await imageProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.retry();
    logger.info(`Job ${jobId} retried`);
    return true;
  } catch (error) {
    logger.error('Failed to retry job:', error);
    return false;
  }
};

// Cancel job
const cancelJob = async (jobId) => {
  try {
    const job = await imageProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    logger.info(`Job ${jobId} cancelled`);
    return true;
  } catch (error) {
    logger.error('Failed to cancel job:', error);
    return false;
  }
};

// Monitor queue events
imageProcessingQueue.on('completed', (job, result) => {
  logger.logJobProcess('image-processing', job.id, 'completed', {
    receiptId: job.data.receiptId,
    userId: job.data.userId,
    processingTime: result.processingTime,
    hasDiscrepancies: result.hasDiscrepancies
  });
});

imageProcessingQueue.on('failed', (job, err) => {
  logger.logJobProcess('image-processing', job.id, 'failed', {
    receiptId: job.data.receiptId,
    userId: job.data.userId,
    error: err.message,
    attempts: job.attemptsMade
  });
});

imageProcessingQueue.on('active', (job) => {
  logger.logJobProcess('image-processing', job.id, 'active', {
    receiptId: job.data.receiptId,
    userId: job.data.userId
  });
});

imageProcessingQueue.on('stalled', (job) => {
  logger.logJobProcess('image-processing', job.id, 'stalled', {
    receiptId: job.data.receiptId,
    userId: job.data.userId
  });
});

// Graceful shutdown
const shutdown = async () => {
  try {
    await imageProcessingQueue.close();
    logger.info('Image processing queue closed');
  } catch (error) {
    logger.error('Error closing queue:', error);
  }
};

// Schedule periodic cleanup
setInterval(cleanupQueue, 60 * 60 * 1000); // Run every hour

module.exports = {
  imageProcessingQueue,
  addImageProcessingJob,
  addPriorityJob,
  getJobStatus,
  getQueueStats,
  getUserJobs,
  cleanupQueue,
  pauseQueue,
  resumeQueue,
  retryJob,
  cancelJob,
  shutdown
}; 