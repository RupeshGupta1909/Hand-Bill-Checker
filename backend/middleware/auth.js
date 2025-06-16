const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { cache } = require('../utils/redis');

// Main authentication middleware
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No valid token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        status: 'error',
        message: 'Token has been invalidated.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select('+role');
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'User no longer exists or is inactive.'
      });
    }

    // Check if user changed password after token was issued
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'error',
        message: 'User recently changed password. Please log in again.'
      });
    }

    // Add user to request object
    req.user = user;
    req.token = token;

    // Log the authentication event
    logger.logUserAction(user._id, 'authenticated', {
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.logSecurityEvent('invalid_token', {
        token: req.header('Authorization'),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.logSecurityEvent('expired_token', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        status: 'error',
        message: 'Token expired. Please log in again.'
      });
    }

    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+role');
    
    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurityEvent('unauthorized_access', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions.'
      });
    }

    next();
  };
};

// Check if user can perform the action based on subscription
const checkSubscription = (requiredLevel = 'free') => {
  const subscriptionLevels = {
    free: 0,
    basic: 1,
    premium: 2
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.'
      });
    }

    const userLevel = subscriptionLevels[req.user.subscriptionStatus] || 0;
    const requiredLevelValue = subscriptionLevels[requiredLevel] || 0;

    if (userLevel < requiredLevelValue) {
      return res.status(403).json({
        status: 'error',
        message: `This feature requires ${requiredLevel} subscription.`,
        currentPlan: req.user.subscriptionStatus,
        requiredPlan: requiredLevel
      });
    }

    // Check if subscription is expired
    if (req.user.subscriptionExpiry && new Date() > req.user.subscriptionExpiry) {
      return res.status(403).json({
        status: 'error',
        message: 'Subscription expired. Please renew your subscription.',
        expired: true
      });
    }

    next();
  };
};

// Check upload limits based on subscription
const checkUploadLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.'
      });
    }

    // Update usage stats and check if user can upload
    const user = await User.findById(req.user._id);
    
    if (!user.canUpload()) {
      const limits = {
        free: 100,
        basic: 500,
        premium: 1000
      };

      return res.status(429).json({
        status: 'error',
        message: 'Monthly upload limit exceeded.',
        currentUsage: user.usageStats.monthlyUploads,
        limit: limits[user.subscriptionStatus],
        subscriptionStatus: user.subscriptionStatus
      });
    }

    next();
  } catch (error) {
    logger.error('Upload limit check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking upload limits.'
    });
  }
};

// Middleware to blacklist tokens (for logout)
const blacklistToken = async (token, expiresIn = '7d') => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cache.set(`blacklist:${token}`, true, ttl);
      }
    } else {
      // Default to 7 days if we can't determine expiry
      await cache.set(`blacklist:${token}`, true, 7 * 24 * 60 * 60);
    }
    return true;
  } catch (error) {
    logger.error('Token blacklist error:', error);
    return false;
  }
};

// Middleware to ensure user owns the resource
const checkResourceOwnership = (resourceIdParam = 'id', resourceModel) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required.'
        });
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({
          status: 'error',
          message: 'Resource ID required.'
        });
      }

      const resource = await resourceModel.findById(resourceId);
      if (!resource) {
        return res.status(404).json({
          status: 'error',
          message: 'Resource not found.'
        });
      }

      // Check if user owns the resource or is admin
      if (resource.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        logger.logSecurityEvent('unauthorized_resource_access', {
          userId: req.user._id,
          resourceId,
          resourceType: resourceModel.modelName,
          ip: req.ip
        });

        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not own this resource.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Resource ownership check error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error checking resource ownership.'
      });
    }
  };
};

module.exports = {
  auth,
  optionalAuth,
  authorize,
  checkSubscription,
  checkUploadLimit,
  blacklistToken,
  checkResourceOwnership
}; 