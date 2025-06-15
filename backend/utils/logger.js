const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Define log transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
  // No file transports
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// Add custom methods for specific use cases
logger.logApiRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || 'anonymous'
  };
  
  if (res.statusCode >= 400) {
    logger.warn('API Request Failed', logData);
  } else {
    logger.info('API Request', logData);
  }
};

logger.logJobProcess = (jobName, jobId, status, data = {}) => {
  logger.info('Job Processing', {
    jobName,
    jobId,
    status,
    ...data
  });
};

logger.logOCRProcess = (receiptId, processingTime, confidence, textLength) => {
  logger.info('OCR Processing Completed', {
    receiptId,
    processingTime: `${processingTime}ms`,
    confidence,
    textLength,
    timestamp: new Date().toISOString()
  });
};

logger.logAIAnalysis = (receiptId, processingTime, hasDiscrepancies, confidence) => {
  logger.info('AI Analysis Completed', {
    receiptId,
    processingTime: `${processingTime}ms`,
    hasDiscrepancies,
    confidence,
    timestamp: new Date().toISOString()
  });
};

logger.logUserAction = (userId, action, details = {}) => {
  logger.info('User Action', {
    userId,
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logSecurityEvent = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Handle uncaught exceptions and unhandled rejections
// Removed file transports for exceptions and rejections

module.exports = logger; 