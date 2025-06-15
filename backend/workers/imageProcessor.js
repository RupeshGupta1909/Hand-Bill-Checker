const { imageProcessingQueue } = require('../queues/imageProcessingQueue');
const ocrService = require('../services/ocrService');
const Receipt = require('../models/Receipt');
const User = require('../models/User');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class ImageProcessor {
  constructor() {
    this.isRunning = false;
    this.activeJobs = new Map();
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Image processor is already running');
      return;
    }
    try {
      await ocrService.initialize();
      imageProcessingQueue.process('process-receipt-image', 2, this.processReceiptImage.bind(this));
      this.isRunning = true;
      logger.info('Image processor started successfully');
    } catch (error) {
      logger.error('Failed to start image processor:', error);
      throw error;
    }
  }

  async processReceiptImage(job) {
    const { receiptId, imagePath, userId } = job.data;
    const startTime = Date.now();
    logger.info(`Starting image processing for receipt ${receiptId}`);
    
    try {
      this.activeJobs.set(job.id, { receiptId, userId, startTime, currentStage: 'initializing' });
      await job.progress(5);

      const receipt = await Receipt.findById(receiptId);
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      receipt.status = 'processing';
      receipt.jobId = job.id;
      receipt.updateProcessingStage('gemini_analysis_started');
      await receipt.save();

      await job.progress(10);

      const fullImagePath = path.resolve(imagePath);
      try {
        await fs.access(fullImagePath);
      } catch (error) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      this.activeJobs.get(job.id).currentStage = 'gemini_analysis';
      await job.progress(20);

      logger.info(`Starting Gemini analysis for receipt ${receiptId}`);
      const analysisResult = await ocrService.analyzeImage(fullImagePath);
      
      await job.progress(80);

      // Update receipt with analysis results
      receipt.extractedData = analysisResult.extractedData;
      receipt.analysis = {
        hasDiscrepancies: analysisResult.extractedData.mismatch,
        totalDiscrepancy: Math.abs(
          (analysisResult.extractedData.written_total || 0) - 
          (analysisResult.extractedData.computed_total || 0)
        ),
        itemsWithErrors: [], // Simplified, can be enhanced later
        overallConfidence: 0.95, // High confidence for Gemini
        suggestions: ["Review the extracted items and totals."],
        aiAnalysis: "Analysis performed by Google Gemini.",
      };
      
      const totalProcessingTime = Date.now() - startTime;
      receipt.processingMetadata = {
        totalProcessingTime,
        geminiProcessingTime: analysisResult.processingTime,
        retryCount: receipt.processingMetadata?.retryCount || 0
      };
      
      receipt.status = 'completed';
      receipt.updateProcessingStage('gemini_analysis_completed');
      receipt.calculateProcessingTime();
      await receipt.save();
      
      await job.progress(95);

      const user = await User.findById(userId);
      if (user) {
        await user.updateUsageStats();
      }

      await job.progress(100);
      this.activeJobs.delete(job.id);

      logger.info(`Successfully processed receipt ${receiptId} in ${totalProcessingTime}ms.`);
      
      // Clean up the temporary image file on success
      try {
        await fs.unlink(fullImagePath);
        logger.info(`Cleaned up temporary file: ${fullImagePath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temporary file ${fullImagePath}:`, cleanupError);
      }

    } catch (error) {
      logger.error(`Failed to process receipt ${receiptId}:`, { message: error.message, stack: error.stack, jobData: job.data });
      // Update receipt status to failed
      try {
        const receipt = await Receipt.findById(receiptId);
        if (receipt) {
          receipt.status = 'failed';
          receipt.processingStage = 'error';
          receipt.analysis = {
            ...receipt.analysis,
            errorMessage: error.message,
          };
          await receipt.save();
        }
      } catch (dbError) {
        logger.error(`Failed to update receipt status to 'failed' for receipt ${receiptId}:`, dbError);
      }
      throw error; // Re-throw to let Bull handle retries/failure
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Image processor is not running');
      return;
    }
    logger.info('Stopping image processor...');
    await imageProcessingQueue.close();
    this.isRunning = false;
    logger.info('Image processor stopped gracefully');
  }

  healthCheck() {
    return {
      isRunning: this.isRunning,
      activeJobCount: this.activeJobs.size,
      activeJobs: Array.from(this.activeJobs.entries()).map(([jobId, jobData]) => ({
        jobId,
        ...jobData
      }))
    };
  }

  // Method to retry failed receipt processing
  async retryFailedReceipt(receiptId) {
    try {
      const receipt = await Receipt.findById(receiptId);
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (receipt.status !== 'failed') {
        throw new Error('Receipt is not in failed state');
      }

      // Reset receipt status
      receipt.status = 'pending';
      receipt.processingStage = 'uploaded';
      receipt.analysis = {};
      receipt.processingMetadata.retryCount += 1;
      
      if (receipt.processingMetadata.retryCount > 3) {
        throw new Error('Maximum retry attempts exceeded');
      }

      await receipt.save();

      // Add back to queue
      const { addImageProcessingJob } = require('../queues/imageProcessingQueue');
      const jobResult = await addImageProcessingJob(
        receiptId, 
        receipt.originalImagePath, 
        receipt.userId.toString()
      );

      return jobResult;
    } catch (error) {
      logger.error('Failed to retry receipt processing:', error);
      throw error;
    }
  }
}

// Export a single instance of the ImageProcessor
module.exports = new ImageProcessor();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down image processor...');
  await imageProcessor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down image processor...');
  await imageProcessor.stop();
  process.exit(0);
}); 