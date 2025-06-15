const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name must be less than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  profile: {
    shopName: {
      type: String,
      trim: true,
      maxlength: [100, 'Shop name must be less than 100 characters']
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address must be less than 200 characters']
    },
    phone: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian mobile number']
    },
    preferredLanguage: {
      type: String,
      enum: ['hindi', 'english', 'both'],
      default: 'both'
    }
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'basic', 'premium'],
    default: 'free'
  },
  subscriptionExpiry: Date,
  usageStats: {
    totalUploads: {
      type: Number,
      default: 0
    },
    monthlyUploads: {
      type: Number,
      default: 0
    },
    lastMonthReset: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email,
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

// Method to update usage stats
userSchema.methods.updateUsageStats = async function() {
  const now = new Date();
  const lastReset = this.usageStats.lastMonthReset;
  
  // Reset monthly uploads if it's a new month
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usageStats.monthlyUploads = 0;
    this.usageStats.lastMonthReset = now;
  }
  
  this.usageStats.totalUploads += 1;
  this.usageStats.monthlyUploads += 1;
  
  await this.save();
};

// Method to check if user can upload (based on subscription)
userSchema.methods.canUpload = function() {
  const limits = {
    free: 10,
    basic: 100,
    premium: 1000
  };
  
  return this.usageStats.monthlyUploads < limits[this.subscriptionStatus];
};

module.exports = mongoose.model('User', userSchema); 