/**
 * Idempotency Service
 *
 * Prevents duplicate transaction processing from:
 * - Network retries (client resending requests)
 * - Double-spending attacks (replay attacks)
 * - Payment gateway webhook duplicates
 *
 * Uses Redis with TTL for distributed coordination across instances.
 */

import { redis } from "./redis";

export class IdempotencyService {
  private readonly PREFIX = 'idempotency';
  private readonly TTL = 900; // 15 minutes - reasonable retry window
  private readonly COMPLETE_TTL = 86400; // 24 hours - audit retention

  /**
   * Check if request is duplicate
   * Returns true if should proceed (new request), false if duplicate
   *
   * @param key - Unique identifier for this operation
   * @returns Promise<boolean> - true to proceed, false to reject
   */
  async check(key: string): Promise<boolean> {
    const redisKey = `${this.PREFIX}:${key}`;
    // Atomic SET NX — eliminates the TOCTOU race between EXISTS and SETEX
    const result = await redis.set(redisKey, 'processing', 'EX', this.TTL, 'NX');
    if (result !== 'OK') {
      const existing = await redis.get(redisKey);
      console.log(`[IDEMPOTENCY] Duplicate request detected: ${key} (status: ${existing})`);
      return false;
    }
    return true;
  }

  /**
   * Check if request is duplicate and return status atomically
   * Prevents TOCTOU race condition between check() and getStatus()
   *
   * @param key - Unique identifier for this operation
   * @returns Promise<{canProceed: boolean, status: string | null}>
   */
  async checkWithStatus(key: string): Promise<{ canProceed: boolean; status: string | null }> {
    const redisKey = `${this.PREFIX}:${key}`;
    // Atomic SET NX — eliminates the TOCTOU race between GET and SETEX
    const result = await redis.set(redisKey, 'processing', 'EX', this.TTL, 'NX');
    if (result !== 'OK') {
      const existing = await redis.get(redisKey);
      console.log(`[IDEMPOTENCY] Duplicate request detected: ${key} (status: ${existing})`);
      return { canProceed: false, status: existing };
    }
    return { canProceed: true, status: 'processing' };
  }

  /**
   * Generate idempotency key for request
   *
   * @param userId - User identifier
   * @param action - Action type (deposit, withdraw, bet, etc.)
   * @param identifier - Unique identifier (timestamp, reference, etc.)
   * @returns Formatted idempotency key
   */
  generateKey(userId: string, action: string, identifier: string): string {
    return `${userId}:${action}:${identifier}`;
  }

  /**
   * Generate idempotency key from request context
   * Useful for API requests with consistent structure
   */
  generateKeyFromRequest(params: {
    userId: string;
    action: string;
    amount?: string | bigint;
    timestamp?: number;
    clientProvidedKey?: string;
  }): string {
    // If client provides idempotency key, use it (standard pattern)
    if (params.clientProvidedKey) {
      return `${params.userId}:${params.action}:${params.clientProvidedKey}`;
    }

    // Otherwise generate from context
    const identifier = params.timestamp || Date.now();
    const amountSuffix = params.amount ? `:${params.amount.toString()}` : '';
    return `${params.userId}:${params.action}:${identifier}${amountSuffix}`;
  }

  /**
   * Mark operation as complete (for successful operations)
   * Extends TTL for audit trail
   *
   * @param key - Idempotency key to mark complete
   */
  async complete(key: string): Promise<void> {
    const redisKey = `${this.PREFIX}:${key}`;
    // Keep for audit but mark complete with longer TTL
    await redis.setex(redisKey, this.COMPLETE_TTL, 'completed');
  }

  /**
   * Mark operation as failed (allows retry after TTL)
   *
   * @param key - Idempotency key to mark failed
   */
  async fail(key: string, error?: string): Promise<void> {
    const redisKey = `${this.PREFIX}:${key}`;
    // Store briefly to prevent immediate retry spam
    await redis.setex(redisKey, 60, `failed:${error || 'unknown'}`);
  }

  /**
   * Delete key (for manual retries or admin operations)
   *
   * @param key - Idempotency key to delete
   */
  async delete(key: string): Promise<void> {
    const redisKey = `${this.PREFIX}:${key}`;
    await redis.del(redisKey);
  }

  /**
   * Check status of an idempotency key
   *
   * @param key - Idempotency key to check
   * @returns Status: 'processing', 'completed', 'failed', or null (not found)
   */
  async getStatus(key: string): Promise<string | null> {
    const redisKey = `${this.PREFIX}:${key}`;
    const value = await redis.get(redisKey);
    return value;
  }

  /**
   * Clean up expired keys (called by scheduled job)
   * Redis handles TTL automatically, but this can be used
   * for explicit cleanup or maintenance
   */
  async cleanup(): Promise<number> {
    // Redis expires idempotency keys automatically via TTL — no manual scan needed.
    // SCAN only returns live keys, so ttl===-2 (evicted) can never be true for scanned keys.
    return 0;
  }
}

// Export singleton instance
export const idempotencyService = new IdempotencyService();
