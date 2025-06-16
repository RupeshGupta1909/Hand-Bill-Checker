const User = require('../models/User');
const { validationResult } = require('express-validator');
const { asyncHandler, AppError, validationError } = require('../middleware/errorHandler');
const { blacklistToken } = require('../middleware/auth');
const { cache, session } = require('../utils/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Register new user
const register = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors);
  }
  console.log("register controller loaded====================register============================");
  console.log("req.body==============", req.body);
  const { name, email, password, shopName, address, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  console.log("existingUser==============", existingUser);
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create new user
  const user = new User({
    name: name.trim(),
    email: email.toLowerCase(),
    password,
    profile: {
      shopName: shopName?.trim(),
      address: address?.trim(),
      phone: phone?.trim()
    }
  });

  await user.save();

  // Generate tokens
  const authToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Create session
  await session.create(user._id.toString(), {
    authToken,
    refreshToken,
    loginTime: new Date(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Update login stats
  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save();

  logger.logUserAction(user._id, 'registered', {
    email: user.email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        subscriptionStatus: user.subscriptionStatus,
        usageStats: user.usageStats
      },
      tokens: {
        authToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    }
  });
});

// Login user
const login = asyncHandler(async (req, res) => {
  try {
    logger.info('Login attempt:', {
      email: req.body.email,
      timestamp: new Date().toISOString()
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors);
    }

    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      logger.info('Login failed: Missing email or password');
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    console.log("email==============", email);
    console.log("password==============", password);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    console.log("user==============", user);
    if (!user || !await user.comparePassword(password)) {
      logger.info('Login failed: Invalid credentials', {
        email: req.body.email,
        userExists: !!user
      });
      logger.logSecurityEvent('failed_login', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact support.', 401);
    }

    // Generate tokens
    const authToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Create session
    await session.create(user._id.toString(), {
      authToken,
      refreshToken,
      loginTime: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Update login stats
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    logger.logUserAction(user._id, 'logged_in', {
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info('Login successful:', {
      userId: user._id,
      email: user.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          subscriptionStatus: user.subscriptionStatus,
          usageStats: user.usageStats,
          lastLogin: user.lastLogin
        },
        tokens: {
          authToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Refresh token
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  // Verify refresh token
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // Generate new auth token
    const newAuthToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    // Update session
    await session.update(user._id.toString(), {
      authToken: newAuthToken,
      refreshToken: newRefreshToken,
      lastRefresh: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    logger.logUserAction(user._id, 'token_refreshed', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          authToken: newAuthToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired refresh token', 401);
    }
    throw error;
  }
});

// Logout user
const logout = asyncHandler(async (req, res) => {
  const token = req.token;
  const userId = req.user._id.toString();

  // Blacklist the current token
  await blacklistToken(token);

  // Destroy session
  await session.destroy(userId);

  logger.logUserAction(req.user._id, 'logged_out', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Logout successful'
  });
});

// Get current user profile
const getMe = asyncHandler(async (req, res) => {
  console.log("getMe controller loaded====================getMe============================");
  console.log("req.user==============", req.user);
  const user = await User.findById(req.user._id).populate({
    path: 'usageStats',
    select: 'totalUploads monthlyUploads'
  });

  res.json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        usageStats: user.usageStats,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        createdAt: user.createdAt
      }
    }
  });
});

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors);
  }

  const { name, shopName, address, phone, preferredLanguage } = req.body;
  const user = await User.findById(req.user._id);

  // Update allowed fields
  if (name) user.name = name.trim();
  if (shopName !== undefined) user.profile.shopName = shopName.trim();
  if (address !== undefined) user.profile.address = address.trim();
  if (phone !== undefined) user.profile.phone = phone.trim();
  if (preferredLanguage) user.profile.preferredLanguage = preferredLanguage;

  await user.save();

  logger.logUserAction(user._id, 'profile_updated', {
    updatedFields: Object.keys(req.body),
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        subscriptionStatus: user.subscriptionStatus,
        usageStats: user.usageStats
      }
    }
  });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors);
  }

  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  if (!await user.comparePassword(currentPassword)) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Invalidate all existing sessions for this user
  await session.destroy(user._id.toString());

  logger.logUserAction(user._id, 'password_changed', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Password changed successfully. Please log in again.'
  });
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors);
  }

  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if user exists or not
    return res.json({
      status: 'success',
      message: 'If an account with that email exists, we have sent a password reset link.'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save();

  // In a real application, you would send an email here
  // For now, we'll just log it
  logger.info(`Password reset token for ${email}: ${resetToken}`);

  logger.logUserAction(user._id, 'password_reset_requested', {
    email: user.email,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'If an account with that email exists, we have sent a password reset link.',
    // In development, include the token
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors);
  }

  const { token, newPassword } = req.body;

  // Hash the token to compare with database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  // Update password
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Invalidate all existing sessions
  await session.destroy(user._id.toString());

  logger.logUserAction(user._id, 'password_reset_completed', {
    email: user.email,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Password reset successful. Please log in with your new password.'
  });
});

// Get usage statistics
const getUsageStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  const limits = {
    free: 10,
    basic: 100,
    premium: 1000
  };

  const currentLimit = limits[user.subscriptionStatus];
  const remainingUploads = Math.max(0, currentLimit - user.usageStats.monthlyUploads);

  res.json({
    status: 'success',
    data: {
      usageStats: {
        totalUploads: user.usageStats.totalUploads,
        monthlyUploads: user.usageStats.monthlyUploads,
        remainingUploads,
        currentLimit,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        lastMonthReset: user.usageStats.lastMonthReset,
        canUpload: user.canUpload()
      }
    }
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getUsageStats
}; 