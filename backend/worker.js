#!/usr/bin/env node

/**
 * Miscalc Image Processing Worker
 * 
 * This is a separate process that handles image processing jobs
 * from the Redis queue. It can be scaled independently from the API server.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const imageProcessor = require('./workers/imageProcessor');
const logger = require('./utils/logger');
const { connectRedis } = require('./utils/redis');

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/miscalc_db?authSource=admin';
    await mongoose.connect(mongoUri);
    logger.info('Worker: MongoDB connected successfully');
  } catch (error) {
    logger.error('Worker: MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Start the worker
const startWorker = async () => {
  try {
    console.log("[WORKER LOG] 1. 'startWorker' function entered.");
    logger.info('Starting Miscalc Image Processing Worker...');
    
    // Connect to databases
    console.log("[WORKER LOG] 2. Attempting to connect to MongoDB...");
    await connectDB();
    console.log("[WORKER LOG] 3. MongoDB connected.");

    console.log("[WORKER LOG] 4. Attempting to connect to Redis...");
    await connectRedis();
    console.log("[WORKER LOG] 5. Redis connected.");

    // Start the image processor
    console.log("[WORKER LOG] 6. Attempting to start ImageProcessor...");
    await imageProcessor.start();
    console.log("[WORKER LOG] 7. ImageProcessor has started.");
    
    logger.info('Image Processing Worker started successfully');
    logger.info(`Worker PID: ${process.pid}`);
    logger.info(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
    
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Worker received ${signal}, shutting down gracefully...`);
  
  try {
    await imageProcessor.stop();
    await mongoose.connection.close();
    logger.info('Worker shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during worker shutdown:', error);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Worker: Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Worker: Unhandled Rejection:', error);
  shutdown('unhandledRejection');
});

// Start the worker
startWorker(); 