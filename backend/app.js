try {
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const helmet = require('helmet');
  const compression = require('compression');
  const rateLimit = require('express-rate-limit');
  const path = require('path');
  require('dotenv').config();

  // Import routes
  const authRoutes = require('./routes/authRoutes');
  const imageRoutes = require('./routes/imageRoutes');
  const dashboardRoutes = require('./routes/dashboardRoutes');

  // Import utilities
  const logger = require('./utils/logger');
  const { connectRedis } = require('./utils/redis');
  const { errorHandler } = require('./middleware/errorHandler');

  const app = express();

  // Trust proxy for rate limiting
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    contentSecurityPolicy: false
  }));

  // Debug logging for CORS
  app.use((req, res, next) => {
    console.log('Incoming Request:', {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      host: req.headers.host
    });
    next();
  });

  // Enable CORS
  const allowedOrigins = [
    'http://localhost:5173',
    'https://hand-bill-checker.netlify.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean); // Remove any undefined values

  console.log('Allowed Origins:', allowedOrigins);

  // CORS configuration
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  });

  app.use(cors({
    origin: function(origin, callback) {
      console.log('Request Origin:', origin);
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('No origin provided - allowing request');
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        console.log('Origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('Origin not allowed:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    maxAge: 86400
  }));

  // Handle preflight requests for all routes
  app.options('*', (req, res) => {
    console.log('Handling OPTIONS request');
    res.status(200).end();
  });

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Stricter rate limiting for auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 5 to 50 for development
    message: 'Too many authentication attempts, please try again later.',
  });
  app.use('/api/auth/', authLimiter);

  // Middleware
  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/image', imageRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Health check route
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Miscalc API is running',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Root route handler
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Miscalc API Server',
      docs: '/api/health',
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use('*', (req, res, next) => {
      const { AppError } = require('./middleware/errorHandler');
      next(new AppError(`Route ${req.originalUrl} not found`, 404));
  });

  // Global error handler
  app.use(errorHandler);

  // Database connection
  const connectDB = async () => {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/miscalc_db?authSource=admin';
      await mongoose.connect(mongoUri);
      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      process.exit(1);
    }
  };

  // Start server
  const PORT = process.env.PORT || 8080;
  const startServer = async () => {
    logger.info('Starting server...');
    try {
      // Connect to databases
      logger.info('Connecting to MongoDB...');
      await connectDB();
      logger.info('MongoDB connection successful.');
      
      // Try to connect to Redis but don't fail if it's not available
      try {
        logger.info('Connecting to Redis...');
        await connectRedis();
        logger.info('Redis connection successful.');
      } catch (error) {
        logger.warn('Redis connection failed, continuing without Redis.', { error: error.message });
      }
      
      // Start server
      logger.info(`Attempting to start server on port ${PORT}...`);
      const server = app.listen(PORT, () => {
        logger.info(`🚀 Server running on port ${PORT}`, {
          environment: process.env.NODE_ENV || 'development'
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed.');
            process.exit(0);
          });
        });
      });

    } catch (error) {
      logger.error('Server startup failed', { error: error.message, stack: error.stack });
      process.exit(1);
    }
  };

  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', error);
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', { error: error.name, message: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (error) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...', error);
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', { error: error.name, message: error.message, stack: error.stack });
    if (app && app.close) {
      app.close(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });

  startServer();

  module.exports = app;
} catch (error) {
  console.error('A critical error occurred during initialization:', error);
  process.exit(1);
} 