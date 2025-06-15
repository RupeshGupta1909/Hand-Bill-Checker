const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { getQueueStats } = require('../queues/imageProcessingQueue');
const imageProcessor = require('../workers/imageProcessor');
const User = require('../models/User');
const Receipt = require('../models/Receipt');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(auth);

// User dashboard - get overview stats
const getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  // Get user's receipt statistics
  const receiptStats = await Receipt.aggregate([
    { $match: { userId, isArchived: false } },
    {
      $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        completedReceipts: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        processingReceipts: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        failedReceipts: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
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

  const stats = receiptStats[0] || {
    totalReceipts: 0,
    completedReceipts: 0,
    processingReceipts: 0,
    failedReceipts: 0,
    receiptsWithDiscrepancies: 0,
    totalDiscrepancyAmount: 0,
    avgConfidence: 0
  };

  // Get recent receipts
  const recentReceipts = await Receipt.find({
    userId,
    isArchived: false
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('status analysis.hasDiscrepancies analysis.totalDiscrepancy extractedData.shopName createdAt');

  // Get monthly trends (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTrends = await Receipt.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: sixMonthsAgo },
        isArchived: false
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        discrepancies: {
          $sum: { $cond: ['$analysis.hasDiscrepancies', 1, 0] }
        },
        totalDiscrepancyAmount: {
          $sum: '$analysis.totalDiscrepancy'
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // Get user usage stats
  const user = await User.findById(userId);
  const limits = {
    free: 10,
    basic: 100,
    premium: 1000
  };

  const usageStats = {
    monthlyUploads: user.usageStats.monthlyUploads,
    totalUploads: user.usageStats.totalUploads,
    remainingUploads: Math.max(0, limits[user.subscriptionStatus] - user.usageStats.monthlyUploads),
    currentLimit: limits[user.subscriptionStatus],
    subscriptionStatus: user.subscriptionStatus
  };

  res.json({
    status: 'success',
    data: {
      stats: {
        ...stats,
        avgConfidence: Math.round((stats.avgConfidence || 0) * 100) / 100,
        totalDiscrepancyAmount: Math.round((stats.totalDiscrepancyAmount || 0) * 100) / 100
      },
      recentReceipts,
      monthlyTrends,
      usageStats
    }
  });
});

// Admin dashboard - system overview
const getAdminDashboard = asyncHandler(async (req, res) => {
  // System statistics
  const systemStats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Receipt.countDocuments(),
    Receipt.countDocuments({ status: 'completed' }),
    Receipt.countDocuments({ status: 'processing' }),
    Receipt.countDocuments({ status: 'failed' }),
    Receipt.countDocuments({ 'analysis.hasDiscrepancies': true })
  ]);

  const [
    totalUsers,
    activeUsers,
    totalReceipts,
    completedReceipts,
    processingReceipts,
    failedReceipts,
    receiptsWithDiscrepancies
  ] = systemStats;

  // Queue statistics
  const queueStats = await getQueueStats();

  // Worker status
  const workerStatus = imageProcessor.getStatus();

  // Recent user registrations
  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .select('name email subscriptionStatus createdAt');

  // Top users by upload count
  const topUsers = await User.find()
    .sort({ 'usageStats.totalUploads': -1 })
    .limit(10)
    .select('name email usageStats.totalUploads subscriptionStatus');

  // Daily statistics for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyStats = await Receipt.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        uploads: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        discrepancies: {
          $sum: { $cond: ['$analysis.hasDiscrepancies', 1, 0] }
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      systemStats: {
        totalUsers,
        activeUsers,
        totalReceipts,
        completedReceipts,
        processingReceipts,
        failedReceipts,
        receiptsWithDiscrepancies,
        successRate: totalReceipts > 0 ? Math.round((completedReceipts / totalReceipts) * 100) : 0
      },
      queueStats,
      workerStatus,
      recentUsers,
      topUsers,
      dailyStats
    }
  });
});

// Get system health status
const getSystemHealth = asyncHandler(async (req, res) => {
  const health = await imageProcessor.healthCheck();
  const queueStats = await getQueueStats();

  const systemHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy', // MongoDB connection is checked in app.js
      redis: queueStats ? 'healthy' : 'unhealthy',
      imageProcessor: health.status,
      queue: queueStats ? 'healthy' : 'unhealthy'
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeJobs: health.activeJobs || 0,
      queueSize: queueStats?.waiting || 0
    }
  };

  // Determine overall health
  const unhealthyServices = Object.values(systemHealth.services).filter(status => status !== 'healthy');
  if (unhealthyServices.length > 0) {
    systemHealth.status = 'degraded';
  }

  const statusCode = systemHealth.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: 'success',
    data: systemHealth
  });
});

// Get processing analytics
const getProcessingAnalytics = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(days));

  // Processing time analytics
  const processingAnalytics = await Receipt.aggregate([
    {
      $match: {
        createdAt: { $gte: daysAgo },
        status: 'completed',
        'processingMetadata.totalProcessingTime': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        avgProcessingTime: { $avg: '$processingMetadata.totalProcessingTime' },
        minProcessingTime: { $min: '$processingMetadata.totalProcessingTime' },
        maxProcessingTime: { $max: '$processingMetadata.totalProcessingTime' },
        avgOcrTime: { $avg: '$processingMetadata.ocrProcessingTime' },
        avgAiTime: { $avg: '$processingMetadata.aiProcessingTime' },
        totalProcessed: { $sum: 1 }
      }
    }
  ]);

  // Error analysis
  const errorAnalysis = await Receipt.aggregate([
    {
      $match: {
        createdAt: { $gte: daysAgo },
        status: 'failed'
      }
    },
    {
      $group: {
        _id: '$processingMetadata.errorLogs',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // Confidence distribution
  const confidenceDistribution = await Receipt.aggregate([
    {
      $match: {
        createdAt: { $gte: daysAgo },
        status: 'completed',
        'analysis.overallConfidence': { $exists: true }
      }
    },
    {
      $bucket: {
        groupBy: '$analysis.overallConfidence',
        boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
        default: 'other',
        output: {
          count: { $sum: 1 },
          avgDiscrepancy: { $avg: '$analysis.totalDiscrepancy' }
        }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      processingAnalytics: processingAnalytics[0] || {},
      errorAnalysis,
      confidenceDistribution
    }
  });
});

// Routes
router.get('/user', getUserDashboard);
router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/health', getSystemHealth);
router.get('/analytics', authorize('admin'), getProcessingAnalytics);

module.exports = router; 