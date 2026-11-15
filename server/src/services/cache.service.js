import redisClient from "../config/redis.js";

/**
 * Cache-aside helper:
 *   1. Redis mein dekho (look in Redis)
 *   2. Nahi mila to loader() se MongoDB se lao (else load from MongoDB)
 *   3. Redis mein save karo with expiry (TTL in seconds)
 *
 * If Redis is down, it just calls loader() so the API keeps working.
 */
export const getOrSetCache = async (key, ttlSeconds, loader) => {
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error("Redis GET failed:", error.message);
    }
  }

  const data = await loader();

  if (redisClient.isReady) {
    try {
      await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
    } catch (error) {
      console.error("Redis SET failed:", error.message);
    }
  }

  return data;
};

/**
 * Delete cache keys after data changes, so users never see old data.
 */
export const clearCache = async (...keys) => {
  if (!redisClient.isReady) return;
  try {
    await redisClient.del(keys);
  } catch (error) {
    console.error("Redis DEL failed:", error.message);
  }
};

export const CACHE_KEYS = {
  categories: "categories:all",
  allUsers: "all_users",
};
