const redis = require('redis');
const logger = require('./logger');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        // Retry after
        return Math.min(options.attempt * 100, 3000);
      }
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

    redisClient.on('end', () => {
      logger.info('Redis Client Connection Ended');
    });

    await redisClient.connect();
    logger.info('Redis connected successfully');
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

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