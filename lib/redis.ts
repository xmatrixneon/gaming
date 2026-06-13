/**
 * Redis Client Configuration
 * Provides Redis connection for Better Auth secondary storage and application caching.
 */

import Redis from "ioredis";

// ============================================================================
// REDIS CLIENT
// ============================================================================

/**
 * Redis client instance
 */
export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  // Connection settings
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  // Retry strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// ============================================================================
// REDIS EVENTS
// ============================================================================

redis.on("connect", () => {
  console.log("[Redis] Connected to Redis server");
});

redis.on("ready", () => {
  console.log("[Redis] Redis connection ready");
});

redis.on("error", (err) => {
  console.error("[Redis] Redis connection error:", err);
});

redis.on("close", () => {
  console.log("[Redis] Redis connection closed");
});

redis.on("reconnecting", (delay: number) => {
  console.log(`[Redis] Reconnecting to Redis in ${delay}ms`);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set a value in Redis with TTL
 * @param key - Redis key
 * @param value - Value to store
 * @param ttlSeconds - Time to live in seconds
 */
export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
}

/**
 * Get a value from Redis
 * @param key - Redis key
 * @returns Value or null if not found
 */
export async function redisGet(key: string): Promise<string | null> {
  return await redis.get(key);
}

/**
 * Delete a value from Redis
 * @param key - Redis key
 */
export async function redisDelete(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Check if a key exists in Redis
 * @param key - Redis key
 * @returns True if key exists
 */
export async function redisExists(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Increment a counter in Redis
 * @param key - Redis key
 * @returns Incremented value
 */
export async function redisIncr(key: string): Promise<number> {
  return await redis.incr(key);
}

/**
 * Set a counter with expiry in Redis
 * @param key - Redis key
 * @param value - Counter value
 * @param ttlSeconds - Time to live in seconds
 */
export async function redisSetExpiry(
  key: string,
  ttlSeconds: number
): Promise<void> {
  await redis.expire(key, ttlSeconds);
}

/**
 * Close Redis connection
 * Call this when shutting down the application
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}

