const express = require('express');
const { body, param, query } = require('express-validator');
const {
  uploadReceipt,
  getReceipt,
  getUserReceipts,
  getProcessingStatus,
  getUserJobs,
  provideFeedback,
  archiveReceipt,
  deleteReceipt,
  getReceiptStats
} = require('../controllers/imageController');
const { auth, checkUploadLimit, checkResourceOwnership } = require('../middleware/auth');
const Receipt = require('../models/Receipt');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Validation rules
const feedbackValidation = [
  body('isAccurate')
    .isBoolean()
    .withMessage('isAccurate must be a boolean'),
  body('correctedItems')
    .optional()
    .isArray()
    .withMessage('correctedItems must be an array'),
  body('comments')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comments must be less than 500 characters'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
];

const receiptIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid receipt ID')
];

const jobIdValidation = [
  param('jobId')
    .isNumeric()
    .withMessage('Invalid job ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed'])
    .withMessage('Invalid status filter'),
  query('hasDiscrepancies')
    .optional()
    .isBoolean()
    .withMessage('hasDiscrepancies must be a boolean')
];

// Routes

// Upload receipt image
router.post('/upload', checkUploadLimit, uploadReceipt);

// Get user's receipts with pagination and filters
router.get('/', paginationValidation, getUserReceipts);

// Get receipt statistics
router.get('/stats', getReceiptStats);

// Get user's processing jobs
router.get('/jobs', getUserJobs);

// Get specific receipt details
router.get('/:id', receiptIdValidation, getReceipt);

// Get processing status by job ID
router.get('/jobs/:jobId/status', jobIdValidation, getProcessingStatus);

// Provide feedback on receipt analysis
router.post('/:id/feedback', 
  receiptIdValidation, 
  feedbackValidation, 
  checkResourceOwnership('id', Receipt),
  provideFeedback
);

// Archive receipt
router.patch('/:id/archive', 
  receiptIdValidation,
  checkResourceOwnership('id', Receipt),
  archiveReceipt
);

// Delete receipt
router.delete('/:id', 
  receiptIdValidation,
  checkResourceOwnership('id', Receipt),
  deleteReceipt
);

module.exports = router; 