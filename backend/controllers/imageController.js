const Receipt = require('../models/Receipt');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { addImageProcessingJob, addPriorityJob, getJobStatus, getUserJobs } = require('../queues/imageProcessingQueue');
const cloudStorage = require('../services/cloudStorage');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Configure multer to use memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
});

// Upload receipt image
const uploadReceipt = asyncHandler(async (req, res) => {
  upload.single('receipt')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new AppError('File size too large. Maximum size is 10MB.', 400);
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          throw new AppError('Unexpected file field. Use "receipt" field name.', 400);
        }
      }
      throw new AppError(err.message, 400);
    }

    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    try {
      // Optimize image in memory
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize(1920, 1920, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 85,
          progressive: true 
        })
        .toBuffer();

      // Upload optimized buffer to cloud storage
      const now = new Date();
      const fileName = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}_${now.getDate()}${now.toLocaleString('default', { month: 'short' })}${now.getFullYear()}.jpg`;
      
      const cloudUploadResult = await cloudStorage.uploadBuffer(optimizedBuffer, fileName);

      // Create receipt record
      const receipt = new Receipt({
        userId: req.user._id,
        originalImagePath: cloudUploadResult.url,
        cloudStorageId: cloudUploadResult.publicId,
        status: 'pending',
        processingStage: 'uploaded'
      });
      await receipt.save();

      // Determine priority based on subscription
      const isPriority = req.user.subscriptionStatus === 'premium';
      
      // Add to processing queue with cloud storage URL
      const jobResult = isPriority
        ? await addPriorityJob(receipt._id.toString(), cloudUploadResult.url, req.user._id.toString())
        : await addImageProcessingJob(receipt._id.toString(), cloudUploadResult.url, req.user._id.toString());

      // Update receipt with job info
      receipt.jobId = jobResult.jobId;
      receipt.queuePosition = jobResult.queuePosition;
      await receipt.save();

      logger.logUserAction(req.user._id, 'receipt_uploaded', {
        receiptId: receipt._id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        jobId: jobResult.jobId,
        priority: isPriority ? 'high' : 'normal',
        cloudStorageId: cloudUploadResult.publicId
      });

      res.status(201).json({
        status: 'success',
        message: 'Receipt uploaded successfully and queued for processing',
        data: {
          receipt: {
            id: receipt._id,
            status: receipt.status,
            processingStage: receipt.processingStage,
            imageUrl: cloudUploadResult.url,
            createdAt: receipt.createdAt
          },
          processing: {
            jobId: jobResult.jobId,
            queuePosition: jobResult.queuePosition,
            estimatedTime: jobResult.estimatedTime,
            priority: isPriority ? 'high' : 'normal'
          }
        }
      });
    } catch (error) {
      logger.error('Failed to process upload:', error);
      throw error;
    }
  });
});

// Optimize uploaded image
const optimizeImage = async (imagePath) => {
  const optimizedPath = imagePath + '_optimized.jpg';
  
  try {
    await sharp(imagePath)
      .resize(1920, 1920, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toFile(optimizedPath);
    
    return optimizedPath;
  } catch (error) {
    logger.error('Image optimization failed:', error);
    return imagePath; // Return original path if optimization fails
  }
};

// Get receipt details
const getReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const receipt = await Receipt.findById(id).populate('userId', 'name email');
  
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }

  // Check ownership
  if (receipt.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  // Get job status if still processing
  let jobStatus = null;
  if (receipt.jobId && ['pending', 'processing'].includes(receipt.status)) {
    jobStatus = await getJobStatus(receipt.jobId);
  }

  res.json({
    status: 'success',
    data: {
      receipt: {
        id: receipt._id,
        status: receipt.status,
        processingStage: receipt.processingStage,
        ocrResults: receipt.ocrResults,
        extractedData: receipt.extractedData,
        analysis: receipt.analysis,
        processingMetadata: receipt.processingMetadata,
        userFeedback: receipt.userFeedback,
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt
      },
      jobStatus
    }
  });
});

// Get user's receipts
const getUserReceipts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, hasDiscrepancies } = req.query;
  
  const query = { 
    userId: req.user._id,
    isArchived: false 
  };
  
  if (status) {
    query.status = status;
  }
  
  if (hasDiscrepancies !== undefined) {
    query['analysis.hasDiscrepancies'] = hasDiscrepancies === 'true';
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: {
      path: 'userId',
      select: 'name email'
    }
  };

  const receipts = await Receipt.paginate(query, options);

  // Get job statuses for processing receipts
  const receiptsWithJobStatus = await Promise.all(
    receipts.docs.map(async (receipt) => {
      let jobStatus = null;
      if (receipt.jobId && ['pending', 'processing'].includes(receipt.status)) {
        jobStatus = await getJobStatus(receipt.jobId);
      }
      
      return {
        id: receipt._id,
        status: receipt.status,
        processingStage: receipt.processingStage,
        hasDiscrepancies: receipt.analysis?.hasDiscrepancies || false,
        totalDiscrepancy: receipt.analysis?.totalDiscrepancy || 0,
        itemCount: receipt.extractedData?.items?.length || 0,
        confidence: receipt.analysis?.overallConfidence || 0,
        createdAt: receipt.createdAt,
        originalImagePath: receipt.originalImagePath,
        jobStatus
      };
    })
  );

  res.json({
    status: 'success',
    data: {
      receipts: receiptsWithJobStatus,
      pagination: {
        currentPage: receipts.page,
        totalPages: receipts.totalPages,
        totalReceipts: receipts.totalDocs,
        hasNextPage: receipts.hasNextPage,
        hasPrevPage: receipts.hasPrevPage
      }
    }
  });
});

// Get processing status by job ID
const getProcessingStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const jobStatus = await getJobStatus(jobId);

  if (!jobStatus) {
    throw new AppError('Job not found', 404);
  }

  // If job is completed or failed, fetch the full receipt details
  if (['completed', 'failed'].includes(jobStatus.status) && jobStatus.data.receiptId) {
    const receipt = await Receipt.findById(jobStatus.data.receiptId);
    if (receipt) {
      return res.json({
        status: 'success',
        data: {
          jobStatus,
          receipt
        }
      });
    }
  }

  res.json({
    status: 'success',
    data: {
      jobStatus
    }
  });
});

// Get user's processing jobs
const getUserJobsHandler = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const jobs = await getUserJobs(req.user._id.toString(), parseInt(limit));
  
  res.json({
    status: 'success',
    data: {
      jobs
    }
  });
});

// Provide feedback on receipt analysis
const provideFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isAccurate, correctedItems, comments, rating } = req.body;
  
  const receipt = await Receipt.findById(id);
  
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }

  // Check ownership
  if (receipt.userId.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  // Update feedback
  receipt.userFeedback = {
    isAccurate: isAccurate,
    correctedItems: correctedItems || [],
    comments: comments || '',
    rating: rating || null
  };

  await receipt.save();

  logger.logUserAction(req.user._id, 'feedback_provided', {
    receiptId: receipt._id,
    isAccurate,
    rating,
    hasComments: !!comments
  });

  res.json({
    status: 'success',
    message: 'Feedback saved successfully',
    data: {
      feedback: receipt.userFeedback
    }
  });
});

// Archive receipt
const archiveReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const receipt = await Receipt.findById(id);
  
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }

  // Check ownership
  if (receipt.userId.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  receipt.isArchived = true;
  receipt.archivedAt = new Date();
  await receipt.save();

  logger.logUserAction(req.user._id, 'receipt_archived', {
    receiptId: receipt._id
  });

  res.json({
    status: 'success',
    message: 'Receipt archived successfully'
  });
});

// Delete receipt
const deleteReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const receipt = await Receipt.findById(id);
  
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }

  // Check ownership
  if (receipt.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Access denied', 403);
  }

  // Delete image files
  try {
    if (receipt.originalImagePath) {
      await fs.unlink(receipt.originalImagePath);
    }
    if (receipt.processedImagePath) {
      await fs.unlink(receipt.processedImagePath);
    }
  } catch (error) {
    logger.warn('Failed to delete image files:', error);
  }

  await Receipt.findByIdAndDelete(id);

  logger.logUserAction(req.user._id, 'receipt_deleted', {
    receiptId: receipt._id
  });

  res.json({
    status: 'success',
    message: 'Receipt deleted successfully'
  });
});

// Get receipt statistics
const getReceiptStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const stats = await Receipt.aggregate([
    { $match: { userId, isArchived: false } },
    {
      $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        completedReceipts: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        receiptsWithDiscrepancies: {
          $sum: { $cond: ['$analysis.hasDiscrepancies', 1, 0] }
        },
        totalDiscrepancyAmount: {
          $sum: '$analysis.totalDiscrepancy'
        },
        avgConfidence: {
          $avg: '$analysis.overallConfidence'
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalReceipts: 0,
    completedReceipts: 0,
    receiptsWithDiscrepancies: 0,
    totalDiscrepancyAmount: 0,
    avgConfidence: 0
  };

  // Get recent activity
  const recentReceipts = await Receipt.find({
    userId,
    isArchived: false
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('status analysis.hasDiscrepancies analysis.totalDiscrepancy createdAt');

  res.json({
    status: 'success',
    data: {
      stats: {
        ...result,
        avgConfidence: Math.round((result.avgConfidence || 0) * 100) / 100,
        totalDiscrepancyAmount: Math.round((result.totalDiscrepancyAmount || 0) * 100) / 100
      },
      recentActivity: recentReceipts
    }
  });
});

module.exports = {
  uploadReceipt,
  getReceipt,
  getUserReceipts,
  getProcessingStatus,
  getUserJobs: getUserJobsHandler,
  provideFeedback,
  archiveReceipt,
  deleteReceipt,
  getReceiptStats
}; 