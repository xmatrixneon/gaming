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

  // Game API specific limits
  private readonly GAME_CALLBACK_RATE_LIMIT = 100; // Max 100 callbacks per minute per user
  private readonly GAME_CALLBACK_WINDOW = 60; // 1 minute in seconds

  private readonly GAME_MAX_BET_AMOUNT = 50000; // Max ₹50,000 per bet (in rupees)
  private readonly GAME_HOURLY_BET_LIMIT = 500000; // Max ₹500,000 total bets per hour (in rupees)

  private readonly GAME_WIN_PATTERN_COUNT = 5; // Check last 5 wins for pattern detection
  private readonly GAME_WIN_PATTERN_THRESHOLD = 0.8; // 80% threshold for suspicious pattern detection

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

  // ==========================================================================
  // GAME API SPECIFIC CHECKS
  // ==========================================================================

  /**
   * Check game callback rate
   * Prevents excessive callbacks that may indicate:
   * - Bot activity
   * - API abuse
   * - System malfunction
   *
   * @param userId - User identifier
   * @returns Check result with remaining attempts if denied
   */
  async checkGameCallbackRate(userId: string): Promise<FraudCheckResult> {
    const key = `game_callback_rate:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) {
      // First request, set expiry
      await redisSetExpiry(key, this.GAME_CALLBACK_WINDOW);
    }

    if (count > this.GAME_CALLBACK_RATE_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: 'Game callback rate limit exceeded. Maximum 100 callbacks per minute.',
        retryAfter: ttl,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.GAME_CALLBACK_RATE_LIMIT - count,
    };
  }

  /**
   * Check bet amount limits for Game API
   * Enforces maximum bet amounts and hourly limits
   *
   * @param userId - User identifier
   * @param amount - Bet amount in rupees
   * @returns Check result
   */
  async checkGameBetAmount(userId: string, amount: number): Promise<FraudCheckResult> {
    // Check per-bet limit
    if (amount > this.GAME_MAX_BET_AMOUNT) {
      return {
        allowed: false,
        reason: `Maximum bet amount exceeded. Maximum ₹${this.GAME_MAX_BET_AMOUNT.toLocaleString()} per bet.`,
      };
    }

    // Check hourly limit
    const hourlyKey = `game_hourly_bet:${userId}:${Math.floor(Date.now() / 3600000)}`; // Hourly bucket
    const hourlyTotal = await redis.get(hourlyKey);
    const currentHourlyTotal = parseFloat(hourlyTotal || "0");

    if (currentHourlyTotal + amount > this.GAME_HOURLY_BET_LIMIT) {
      return {
        allowed: false,
        reason: `Hourly bet limit exceeded. Maximum ₹${this.GAME_HOURLY_BET_LIMIT.toLocaleString()} per hour.`,
      };
    }

    return {
      allowed: true,
    };
  }

  /**
   * Update hourly bet total for Game API
   * Should be called after successful bet placement
   *
   * @param userId - User identifier
   * @param amount - Bet amount in rupees
   */
  async updateGameHourlyBetTotal(userId: string, amount: number): Promise<void> {
    const hourlyKey = `game_hourly_bet:${userId}:${Math.floor(Date.now() / 3600000)}`; // Hourly bucket
    const currentTotal = await redis.get(hourlyKey);
    const newTotal = parseFloat(currentTotal || "0") + amount;

    await redis.set(hourlyKey, newTotal.toString());
    await redis.expire(hourlyKey, 3600); // 1 hour
  }

  /**
   * Check win patterns for suspicious activity
   * Detects patterns that may indicate:
   * - Game manipulation
   * - Collusion with providers
   * - Exploiting bugs
   *
   * @param userId - User identifier
   * @param winAmount - Current win amount in rupees
   * @returns Check result with warning if pattern detected
   */
  async checkGameWinPattern(userId: string, winAmount: number): Promise<FraudCheckResult & { warning?: boolean }> {
    // Store recent wins in Redis for pattern analysis
    const winKey = `game_recent_wins:${userId}`;
    const recentWins = await redis.get(winKey);
    const wins = recentWins ? JSON.parse(recentWins) as number[] : [];

    // Add current win
    wins.push(winAmount);

    // Keep only last GAME_WIN_PATTERN_COUNT wins
    if (wins.length > this.GAME_WIN_PATTERN_COUNT) {
      wins.shift();
    }

    // Store updated wins
    await redis.set(winKey, JSON.stringify(wins));
    await redis.expire(winKey, 3600); // 1 hour

    // Check for suspicious pattern (wins within 80% of each other)
    if (wins.length >= this.GAME_WIN_PATTERN_COUNT) {
      const avgWin = wins.reduce((sum, win) => sum + win, 0) / wins.length;
      const closeWins = wins.filter(win => Math.abs(win - avgWin) / avgWin < (1 - this.GAME_WIN_PATTERN_THRESHOLD));

      if (closeWins.length >= this.GAME_WIN_PATTERN_COUNT) {
        console.warn('[FraudDetection] Suspicious win pattern detected', {
          userId,
          wins,
          avgWin,
          closeWins: closeWins.length,
        });

        return {
          allowed: true,
          warning: true,
          reason: 'Unusual win pattern detected. This session is being reviewed.',
        };
      }
    }

    return {
      allowed: true,
    };
  }

  /**
   * Get game-specific counter values
   * Useful for displaying remaining limits to users
   *
   * @param userId - User identifier
   * @returns Current game counter values
   */
  async getGameCounters(userId: string): Promise<{
    callbackCount: number;
    callbackResetIn: number;
    hourlyBetTotal: number;
    hourlyBetLimit: number;
    hourlyBetResetIn: number;
  }> {
    const callbackKey = `game_callback_rate:${userId}`;
    const hourlyKey = `game_hourly_bet:${userId}:${Math.floor(Date.now() / 3600000)}`;

    const [callbackCount, callbackTtl, hourlyTotal] = await Promise.all([
      redis.get(callbackKey).then((v) => parseInt(v || '0')),
      redis.ttl(callbackKey),
      redis.get(hourlyKey).then((v) => parseFloat(v || '0')),
    ]);

    // Calculate when hourly bucket resets (next hour)
    const nextHour = Math.ceil((Date.now() + 1) / 3600000) * 3600000;
    const hourlyResetIn = Math.max(0, (nextHour - Date.now()) / 1000);

    return {
      callbackCount,
      callbackResetIn: callbackTtl > 0 ? callbackTtl : 0,
      hourlyBetTotal: Math.round(hourlyTotal),
      hourlyBetLimit: this.GAME_HOURLY_BET_LIMIT,
      hourlyBetResetIn: Math.round(hourlyResetIn),
    };
  }
}

// Export singleton instance
export const fraudDetection = new FraudDetection();
