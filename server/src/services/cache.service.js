import redisClient from "../config/redis.js";

/**
 * Redis cache helpers.
 *
 * Everything here is safe when Redis is down: reads fall back to
 * MongoDB and writes are skipped, so the API never breaks.
 *
 * CACHE_PREFIX (optional) keeps different apps / demo data apart
 * when they share one Redis.
 */
const PREFIX = process.env.CACHE_PREFIX || "";
const k = (key) => `${PREFIX}${key}`;

/**
 * Cache-aside:
 *   1. Redis mein dekho (look in Redis)
 *   2. Nahi mila to loader() se MongoDB se lao (else load from MongoDB)
 *   3. Redis mein save karo with expiry (TTL in seconds)
 */
export const getOrSetCache = async (key, ttlSeconds, loader) => {
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(k(key));
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
      await redisClient.set(k(key), JSON.stringify(data), { EX: ttlSeconds });
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
    await redisClient.del(keys.map(k));
  } catch (error) {
    console.error("Redis DEL failed:", error.message);
  }
};

/*
 * Versioned cache for data with many keys (every search query,
 * every provider profile...).
 *
 * Each key includes a version number, e.g. "providers:v7:search:...".
 * When any provider data changes we just increase the version
 * (one INCR). All old keys are then never read again and expire by
 * themselves. No need to find and delete hundreds of keys.
 */
const versionKey = (name) => `cache-version:${name}`;

export const getCacheVersion = async (name) => {
  if (!redisClient.isReady) return "0";
  try {
    return (await redisClient.get(k(versionKey(name)))) || "0";
  } catch {
    return "0";
  }
};

export const bumpCacheVersion = async (name) => {
  if (!redisClient.isReady) return;
  try {
    await redisClient.incr(k(versionKey(name)));
  } catch (error) {
    console.error("Redis INCR failed:", error.message);
  }
};

/** Cache something that depends on provider data (search, profiles). */
export const cacheProviders = async (key, ttlSeconds, loader) => {
  const version = await getCacheVersion("providers");
  return getOrSetCache(`providers:v${version}:${key}`, ttlSeconds, loader);
};

/**
 * Call after anything that changes what provider search or a provider
 * profile shows: profile edits, availability, banner, approvals,
 * bookings (busy/jobs done/no-shows), reviews, posts, user name/photo.
 */
export const invalidateProviders = () => bumpCacheVersion("providers");

/** Same query in a different order -> same cache key. */
export const stableQueryKey = (query) =>
  Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== "")
    .sort()
    .map((key) => `${key}=${String(query[key]).toLowerCase()}`)
    .join("&") || "all";

export const CACHE_KEYS = {
  categories: "categories:all",
  allUsers: "all_users",
};
