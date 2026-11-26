import { createClient } from "redis";

/**
 * Redis client used for caching.
 *
 * The app works without Redis: if it is not running, every cache
 * call simply goes to MongoDB instead (see cache.service.js).
 */
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    // Stop retrying after 5 attempts so the logs don't fill up
    // when Redis is not running locally.
    reconnectStrategy: (retries) => (retries > 5 ? false : retries * 500),
  },
});

redisClient.on("error", (err) => {
  console.log("Redis Client Error:", err.message);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Redis Connected!");
  } catch (error) {
    console.error("Redis Connection Failed (app will run without cache):", error.message);
  }
};

export default redisClient;
