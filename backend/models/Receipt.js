const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const receiptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalImagePath: {
    type: String,
    required: true
  },
  cloudStorageId: {
    type: String,
    required: true
  },
  processedImagePath: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'error'],
    default: 'pending'
  },
  processingStage: {
    type: String,
    enum: ['uploaded', 'gemini_analysis_started', 'gemini_analysis_completed', 'error'],
    default: 'uploaded'
  },
  
  // Extracted data from Gemini
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Analysis results
  analysis: {
    hasDiscrepancies: {
      type: Boolean,
      default: false
    },
    totalDiscrepancy: {
      type: Number,
      default: 0
    },
    itemsWithErrors: [mongoose.Schema.Types.Mixed],
    overallConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    suggestions: [String],
    aiAnalysis: String,
    errorMessage: String,
  },
  
  // Processing metadata
  processingMetadata: {
    totalProcessingTime: Number,
    geminiProcessingTime: Number,
    retryCount: {
      type: Number,
      default: 0
    },
    errorLogs: [String]
  },
  
  // User interaction
  userFeedback: {
    isAccurate: Boolean,
    correctedData: mongoose.Schema.Types.Mixed,
    comments: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Job tracking
  jobId: String,
  queuePosition: Number,
  
  // Visibility and sharing
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    email: String,
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    }
  }],
  
  // Archival
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Add pagination plugin
receiptSchema.plugin(mongoosePaginate);

// Indexes for better query performance
receiptSchema.index({ userId: 1, createdAt: -1 });
receiptSchema.index({ status: 1 });
receiptSchema.index({ processingStage: 1 });
receiptSchema.index({ jobId: 1 });
receiptSchema.index({ 'analysis.hasDiscrepancies': 1 });

// Method to update processing stage and log it
receiptSchema.methods.updateProcessingStage = function(newStage) {
  this.processingStage = newStage;
  // You can add logging here if needed
  console.log(`Receipt ${this._id} moved to stage: ${newStage}`);
};

// Method to calculate total processing time
receiptSchema.methods.calculateProcessingTime = function() {
    if (this.createdAt) {
        this.processingMetadata.totalProcessingTime = Date.now() - this.createdAt.getTime();
    }
};

// Static method to get user's recent receipts
receiptSchema.statics.getRecentReceipts = function(userId, limit = 10) {
  return this.find({ userId, isArchived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email');
};

// Static method to get receipts with discrepancies
receiptSchema.statics.getDiscrepancyReceipts = function(userId) {
  return this.find({ 
    userId, 
    'analysis.hasDiscrepancies': true,
    isArchived: false 
  })
    .sort({ createdAt: -1 })
    .populate('userId', 'name email');
};

module.exports = mongoose.model('Receipt', receiptSchema); 