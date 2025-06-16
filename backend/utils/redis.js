const Redis = require('redis');
const logger = require('./logger');

let redisClient;

const connectRedis = async () => {
  try {
    // Free tier optimized configuration
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 10000,
        keepAlive: 5000,
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
      },
      commandsQueueMaxLength: 100, // Limit queue size
      maxRetriesPerRequest: 3
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    await redisClient.connect();
    logger.info('Redis connected successfully');
    
    // Set up periodic cleanup of old keys
    setInterval(async () => {
      try {
        const keys = await redisClient.keys('bull:*:completed');
        for (const key of keys) {
          // Keep only last 50 completed jobs
          await redisClient.zremrangebyrank(key, 0, -51);
        }
      } catch (error) {
        logger.warn('Redis cleanup error:', error);
      }
    }, 1800000); // Run every 30 minutes
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => redisClient;

const disconnectRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    } finally {
      redisClient = null;
    }
  }
};

// Cache utility functions
const cache = {
  // Set cache with expiration
  async set(key, value, expireInSeconds = 3600) {
    try {
      const client = getRedisClient();
      const serializedValue = JSON.stringify(value);
      await client.setEx(key, expireInSeconds, serializedValue);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  // Get cache
  async get(key) {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  // Delete cache
  async del(key) {
    try {
      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  // Set with no expiration
  async setPersistent(key, value) {
    try {
      const client = getRedisClient();
      const serializedValue = JSON.stringify(value);
      await client.set(key, serializedValue);
      return true;
    } catch (error) {
      logger.error('Cache setPersistent error:', error);
      return false;
    }
  },

  // Increment counter
  async incr(key, expireInSeconds = 3600) {
    try {
      const client = getRedisClient();
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, expireInSeconds);
      }
      return count;
    } catch (error) {
      logger.error('Cache incr error:', error);
      return 0;
    }
  },

  // Get all keys matching pattern
  async keys(pattern) {
    try {
      const client = getRedisClient();
      return await client.keys(pattern);
    } catch (error) {
      logger.error('Cache keys error:', error);
      return [];
    }
  },

  // Hash operations
  async hset(key, field, value) {
    try {
      const client = getRedisClient();
      const serializedValue = JSON.stringify(value);
      await client.hSet(key, field, serializedValue);
      return true;
    } catch (error) {
      logger.error('Cache hset error:', error);
      return false;
    }
  },

  async hget(key, field) {
    try {
      const client = getRedisClient();
      const value = await client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache hget error:', error);
      return null;
    }
  },

  async hgetall(key) {
    try {
      const client = getRedisClient();
      const hash = await client.hGetAll(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      logger.error('Cache hgetall error:', error);
      return {};
    }
  }
};

// Session management for user sessions
const session = {
  async create(userId, sessionData, expireInSeconds = 86400) { // 24 hours
    const sessionKey = `session:${userId}`;
    return await cache.set(sessionKey, sessionData, expireInSeconds);
  },

  async get(userId) {
    const sessionKey = `session:${userId}`;
    return await cache.get(sessionKey);
  },

  async update(userId, sessionData, expireInSeconds = 86400) {
    const sessionKey = `session:${userId}`;
    return await cache.set(sessionKey, sessionData, expireInSeconds);
  },

  async destroy(userId) {
    const sessionKey = `session:${userId}`;
    return await cache.del(sessionKey);
  }
};

// Rate limiting utilities
const rateLimit = {
  async isAllowed(identifier, maxRequests = 100, windowInSeconds = 3600) {
    const key = `rate_limit:${identifier}`;
    try {
      const count = await cache.incr(key, windowInSeconds);
      return count <= maxRequests;
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return true; // Allow request if Redis is down
    }
  },

  async getRemainingRequests(identifier, maxRequests = 100) {
    const key = `rate_limit:${identifier}`;
    try {
      const client = getRedisClient();
      const count = await client.get(key);
      return count ? Math.max(0, maxRequests - parseInt(count)) : maxRequests;
    } catch (error) {
      logger.error('Rate limit remaining check error:', error);
      return maxRequests;
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  cache,
  session,
  rateLimit
}; 