/**
 * Fraud Detection Service
 *
 * Implements responsible gambling controls and fraud prevention:
 * - Withdrawal velocity limits (prevent rapid withdrawals)
 * - Deposit pattern detection (prevent bonus abuse)
 * - Bet velocity limits (prevent automated betting)
 * - Loss limit enforcement (responsible gambling)
 *
 * Uses Redis for distributed rate limiting across instances.
 */

import { redis, redisSetExpiry, redisIncr } from "./redis";

export interface FraudCheckResult {
  allowed: boolean;
  reason?: string;
  remainingAttempts?: number;
  retryAfter?: number; // seconds
}

export class FraudDetection {
  private readonly WITHDRAWAL_LIMIT = 3; // Max 3 withdrawals per hour
  private readonly WITHDRAWAL_WINDOW = 3600; // 1 hour in seconds

  private readonly BET_VELOCITY_LIMIT = 10; // Max 10 bets per minute
  private readonly BET_VELOCITY_WINDOW = 60; // 1 minute in seconds

  private readonly DEPOSIT_PATTERN_COUNT = 3; // Check last 3 deposits
  private readonly DEPOSIT_AMOUNT_TOLERANCE = 0.01; // 1% tolerance for pattern detection

  private readonly LOSS_LIMIT_DEFAULT = 10000n; // Default daily loss limit (in smallest currency unit)

  /**
   * Check withdrawal velocity
   * Prevents rapid withdrawals that may indicate:
   * - Compulsive gambling behavior
   * - Money laundering attempts
   * - Account takeover
   *
   * @param userId - User identifier
   * @returns Check result with remaining attempts if denied
   */
  async checkWithdrawalVelocity(userId: string): Promise<FraudCheckResult> {
    const key = `withdraw_velocity:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) {
      // First request, set expiry
      await redisSetExpiry(key, this.WITHDRAWAL_WINDOW);
    }

    if (count > this.WITHDRAWAL_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: 'Withdrawal limit exceeded. Maximum 3 withdrawals per hour.',
        retryAfter: ttl,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.WITHDRAWAL_LIMIT - count,
    };
  }

  /**
   * Check deposit patterns
   * Detects suspicious patterns that may indicate:
   * - Bonus abuse (repeated small deposits to claim bonuses)
   - Structuring (breaking large deposits into smaller ones)
   - Testing stolen payment methods
   *
   * @param userId - User identifier
   * @param amount - Deposit amount
   * @returns Check result
   */
  async checkDepositPattern(userId: string, amount: bigint): Promise<FraudCheckResult> {
    // This would require storing deposit history in Redis
    // For now, implementing a simplified version using transaction count

    const key = `deposit_count:${userId}:${Date.now() / 3600000}`; // Hourly bucket
    const count = await redisIncr(key);

    if (count === 1) {
      await redisSetExpiry(key, 3600); // 1 hour
    }

    // Flag if more than 10 deposits per hour (suspicious)
    if (count > 10) {
      return {
        allowed: false,
        reason: 'Too many deposit attempts. Please contact support.',
      };
    }

    // For full pattern detection, would query recent deposits from database
    // and check if amounts are similar (within tolerance)
    // This is a simplified version

    return {
      allowed: true,
    };
  }

  /**
   * Check bet velocity
   * Prevents automated betting and compulsive behavior:
   * - More than humanly possible bets per minute
   * - May indicate bot activity or gambling addiction
   *
   * @param userId - User identifier
   * @returns Check result with remaining attempts if denied
   */
  async checkBetVelocity(userId: string): Promise<FraudCheckResult> {
    const key = `bet_velocity:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) {
      // First request, set expiry
      await redisSetExpiry(key, this.BET_VELOCITY_WINDOW);
    }

    if (count > this.BET_VELOCITY_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: 'Bet velocity limit exceeded. Please slow down.',
        retryAfter: ttl,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.BET_VELOCITY_LIMIT - count,
    };
  }

  /**
   * Check daily loss limit
   * Enforces responsible gambling by limiting daily losses
   * Users can set custom limits, defaults to system limit
   *
   * @param userId - User identifier
   * @param currentDailyLoss - Current loss for today
   * @param customLimit - Optional custom limit set by user
   * @returns Check result
   */
  async checkLossLimit(
    userId: string,
    currentDailyLoss: bigint,
    customLimit?: bigint
  ): Promise<FraudCheckResult> {
    const limit = customLimit || this.LOSS_LIMIT_DEFAULT;

    if (currentDailyLoss >= limit) {
      return {
        allowed: false,
        reason: 'Daily loss limit reached. Please take a break.',
      };
    }

    const remaining = limit - currentDailyLoss;

    return {
      allowed: true,
      remainingAttempts: Number(remaining), // Approximate "attempts" as remaining amount
    };
  }

  /**
   * Check session duration
   * Warns or blocks after extended play sessions
   * Part of responsible gambling measures
   *
   * @param userId - User identifier
   * @param sessionStart - When the session started
   * @param warningMinutes - Minutes before warning (default: 60)
   * @param limitMinutes - Minutes before blocking (default: 120)
   * @returns Check result with warning or block status
   */
  async checkSessionDuration(
    userId: string,
    sessionStart: Date,
    warningMinutes = 60,
    limitMinutes = 120
  ): Promise<FraudCheckResult & { warning?: boolean }> {
    const now = Date.now();
    const sessionDuration = now - sessionStart.getTime();
    const warningMs = warningMinutes * 60 * 1000;
    const limitMs = limitMinutes * 60 * 1000;

    if (sessionDuration > limitMs) {
      return {
        allowed: false,
        reason: `Session time limit reached (${limitMinutes} minutes). Please take a break.`,
      };
    }

    if (sessionDuration > warningMs) {
      return {
        allowed: true,
        warning: true,
        reason: `You've been playing for ${Math.floor(sessionDuration / 60000)} minutes. Consider taking a break.`,
      };
    }

    return {
      allowed: true,
    };
  }

  /**
   * Reset withdrawal counter
   * Called when withdrawal is processed successfully
   * This is handled automatically by Redis TTL, but can be called manually
   *
   * @param userId - User identifier
   */
  async resetWithdrawalCounter(userId: string): Promise<void> {
    const key = `withdraw_velocity:${userId}`;
    await redis.del(key);
  }

  /**
   * Reset bet velocity counter
   * Called automatically by Redis TTL, but can be called manually
   *
   * @param userId - User identifier
   */
  async resetBetCounter(userId: string): Promise<void> {
    const key = `bet_velocity:${userId}`;
    await redis.del(key);
  }

  /**
   * Get current counter values
   * Useful for displaying remaining limits to users
   *
   * @param userId - User identifier
   * @returns Current counter values
   */
  async getCounters(userId: string): Promise<{
    withdrawalCount: number;
    withdrawalResetIn: number;
    betCount: number;
    betResetIn: number;
  }> {
    const withdrawKey = `withdraw_velocity:${userId}`;
    const betKey = `bet_velocity:${userId}`;

    const [withdrawCount, withdrawTtl, betCount, betTtl] = await Promise.all([
      redis.get(withdrawKey).then((v) => parseInt(v || '0')),
      redis.ttl(withdrawKey),
      redis.get(betKey).then((v) => parseInt(v || '0')),
      redis.ttl(betKey),
    ]);

    return {
      withdrawalCount: withdrawCount,
      withdrawalResetIn: withdrawTtl > 0 ? withdrawTtl : 0,
      betCount: betCount,
      betResetIn: betTtl > 0 ? betTtl : 0,
    };
  }

  /**
   * Check multiple fraud detection rules
   * Convenience method to run multiple checks at once
   *
   * @param userId - User identifier
   * @param checks - Which checks to perform
   * @returns Combined check result
   */
  async performChecks(
    userId: string,
    checks: {
      withdrawalVelocity?: boolean;
      betVelocity?: boolean;
      depositPattern?: boolean;
      amount?: bigint;
      currentDailyLoss?: bigint;
      lossLimit?: bigint;
      sessionStart?: Date;
    }
  ): Promise<FraudCheckResult> {
    if (checks.withdrawalVelocity) {
      const result = await this.checkWithdrawalVelocity(userId);
      if (!result.allowed) return result;
    }

    if (checks.betVelocity) {
      const result = await this.checkBetVelocity(userId);
      if (!result.allowed) return result;
    }

    if (checks.depositPattern && checks.amount) {
      const result = await this.checkDepositPattern(userId, checks.amount);
      if (!result.allowed) return result;
    }

    if (checks.lossLimit && checks.currentDailyLoss !== undefined) {
      const result = await this.checkLossLimit(
        userId,
        checks.currentDailyLoss,
        checks.lossLimit
      );
      if (!result.allowed) return result;
    }

    if (checks.sessionStart) {
      const result = await this.checkSessionDuration(userId, checks.sessionStart);
      if (!result.allowed) return result;
    }

    return {
      allowed: true,
    };
  }
}

// Export singleton instance
export const fraudDetection = new FraudDetection();
