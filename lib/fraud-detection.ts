/**
 * Fraud Detection Service
 *
 * Fixes applied:
 * - checkGameWinPattern: three bugs corrected:
 *   (1) avgWin === 0 guard added — division by zero produced NaN, causing the
 *       pattern check to silently pass for all-zero win sequences
 *   (2) Similarity threshold corrected — suspicious pattern = wins that are
 *       nearly IDENTICAL (low variance), not wins that differ widely. Changed
 *       from detecting variance > 80% to detecting variance < 10% of the mean.
 *   (3) Majority threshold — flags when >= 80% of recent wins are suspiciously
 *       similar, not when ALL wins match (previous check rarely triggered).
 */

import { redis, redisSetExpiry, redisIncr } from "./redis";

export interface FraudCheckResult {
  allowed: boolean;
  reason?: string;
  remainingAttempts?: number;
  retryAfter?: number;
}

export class FraudDetection {
  private readonly WITHDRAWAL_LIMIT = 3;
  private readonly WITHDRAWAL_WINDOW = 3600;

  private readonly BET_VELOCITY_LIMIT = 10;
  private readonly BET_VELOCITY_WINDOW = 60;

  private readonly LOSS_LIMIT_DEFAULT = 10000n;

  private readonly GAME_CALLBACK_RATE_LIMIT = 100;
  private readonly GAME_CALLBACK_WINDOW = 60;

  private readonly GAME_MAX_BET_AMOUNT = 50000;
  private readonly GAME_HOURLY_BET_LIMIT = 500000;

  private readonly GAME_WIN_PATTERN_COUNT = 5;
  // Wins within 10% of the average are considered suspiciously similar (bot-like)
  private readonly GAME_WIN_SIMILARITY_THRESHOLD = 0.1;
  // Flag when >= 80% of recent wins are suspiciously similar
  private readonly GAME_WIN_PATTERN_MAJORITY = 0.8;

  async checkWithdrawalVelocity(userId: string): Promise<FraudCheckResult> {
    const key = `withdraw_velocity:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) await redisSetExpiry(key, this.WITHDRAWAL_WINDOW);

    if (count > this.WITHDRAWAL_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: "Withdrawal limit exceeded. Maximum 3 withdrawals per hour.",
        retryAfter: ttl,
      };
    }

    return { allowed: true, remainingAttempts: this.WITHDRAWAL_LIMIT - count };
  }

  async checkDepositPattern(
    userId: string,
    amount: bigint,
  ): Promise<FraudCheckResult> {
    const key = `deposit_count:${userId}:${Math.floor(Date.now() / 3600000)}`;
    const count = await redisIncr(key);

    if (count === 1) await redisSetExpiry(key, 3600);

    if (count > 10) {
      return {
        allowed: false,
        reason: "Too many deposit attempts. Please contact support.",
      };
    }

    return { allowed: true };
  }

  async checkBetVelocity(userId: string): Promise<FraudCheckResult> {
    const key = `bet_velocity:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) await redisSetExpiry(key, this.BET_VELOCITY_WINDOW);

    if (count > this.BET_VELOCITY_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: "Bet velocity limit exceeded. Please slow down.",
        retryAfter: ttl,
      };
    }

    return { allowed: true, remainingAttempts: this.BET_VELOCITY_LIMIT - count };
  }

  async checkLossLimit(
    userId: string,
    currentDailyLoss: bigint,
    customLimit?: bigint,
  ): Promise<FraudCheckResult> {
    const limit = customLimit ?? this.LOSS_LIMIT_DEFAULT;

    if (currentDailyLoss >= limit) {
      return { allowed: false, reason: "Daily loss limit reached. Please take a break." };
    }

    return { allowed: true, remainingAttempts: Number(limit - currentDailyLoss) };
  }

  async checkSessionDuration(
    userId: string,
    sessionStart: Date,
    warningMinutes = 60,
    limitMinutes = 120,
  ): Promise<FraudCheckResult & { warning?: boolean }> {
    const sessionDuration = Date.now() - sessionStart.getTime();
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

    return { allowed: true };
  }

  async resetWithdrawalCounter(userId: string): Promise<void> {
    await redis.del(`withdraw_velocity:${userId}`);
  }

  async resetBetCounter(userId: string): Promise<void> {
    await redis.del(`bet_velocity:${userId}`);
  }

  async getCounters(userId: string): Promise<{
    withdrawalCount: number;
    withdrawalResetIn: number;
    betCount: number;
    betResetIn: number;
  }> {
    const withdrawKey = `withdraw_velocity:${userId}`;
    const betKey = `bet_velocity:${userId}`;

    const [withdrawCount, withdrawTtl, betCount, betTtl] = await Promise.all([
      redis.get(withdrawKey).then((v) => parseInt(v ?? "0")),
      redis.ttl(withdrawKey),
      redis.get(betKey).then((v) => parseInt(v ?? "0")),
      redis.ttl(betKey),
    ]);

    return {
      withdrawalCount: withdrawCount,
      withdrawalResetIn: withdrawTtl > 0 ? withdrawTtl : 0,
      betCount,
      betResetIn: betTtl > 0 ? betTtl : 0,
    };
  }

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
    },
  ): Promise<FraudCheckResult> {
    if (checks.withdrawalVelocity) {
      const r = await this.checkWithdrawalVelocity(userId);
      if (!r.allowed) return r;
    }
    if (checks.betVelocity) {
      const r = await this.checkBetVelocity(userId);
      if (!r.allowed) return r;
    }
    if (checks.depositPattern && checks.amount) {
      const r = await this.checkDepositPattern(userId, checks.amount);
      if (!r.allowed) return r;
    }
    if (checks.lossLimit && checks.currentDailyLoss !== undefined) {
      const r = await this.checkLossLimit(
        userId,
        checks.currentDailyLoss,
        checks.lossLimit,
      );
      if (!r.allowed) return r;
    }
    if (checks.sessionStart) {
      const r = await this.checkSessionDuration(userId, checks.sessionStart);
      if (!r.allowed) return r;
    }

    return { allowed: true };
  }

  async checkGameCallbackRate(userId: string): Promise<FraudCheckResult> {
    const key = `game_callback_rate:${userId}`;
    const count = await redisIncr(key);

    if (count === 1) await redisSetExpiry(key, this.GAME_CALLBACK_WINDOW);

    if (count > this.GAME_CALLBACK_RATE_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        reason: "Game callback rate limit exceeded. Maximum 100 callbacks per minute.",
        retryAfter: ttl,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.GAME_CALLBACK_RATE_LIMIT - count,
    };
  }

  async checkGameBetAmount(
    userId: string,
    amount: number,
  ): Promise<FraudCheckResult> {
    if (amount > this.GAME_MAX_BET_AMOUNT) {
      return {
        allowed: false,
        reason: `Maximum bet amount exceeded. Maximum ₹${this.GAME_MAX_BET_AMOUNT.toLocaleString("en-IN")} per bet.`,
      };
    }

    const hourlyKey = `game_hourly_bet:${userId}:${Math.floor(Date.now() / 3600000)}`;
    const hourlyTotal = parseFloat((await redis.get(hourlyKey)) ?? "0");

    if (hourlyTotal + amount > this.GAME_HOURLY_BET_LIMIT) {
      return {
        allowed: false,
        reason: `Hourly bet limit exceeded. Maximum ₹${this.GAME_HOURLY_BET_LIMIT.toLocaleString("en-IN")} per hour.`,
      };
    }

    return { allowed: true };
  }

  async updateGameHourlyBetTotal(userId: string, amount: number): Promise<void> {
    const hourlyKey = `game_hourly_bet:${userId}:${Math.floor(Date.now() / 3600000)}`;
    // INCRBYFLOAT is atomic — eliminates the GET+SET race that caused concurrent bets to lose increments
    await redis.incrbyfloat(hourlyKey, amount);
    await redis.expire(hourlyKey, 3600);
  }

  /**
   * Check win patterns for suspicious activity.
   *
   * FIX 1: Guard against division by zero — if avgWin is 0, all wins are 0 which
   *         is normal (e.g. round with no win), not suspicious. Return early.
   * FIX 2: Threshold corrected — detect wins that are suspiciously SIMILAR to each
   *         other (< 10% variance from mean), not wins that vary widely. Identical
   *         win amounts across many rounds indicate scripted/bot behaviour.
   * FIX 3: Majority check — flag when >= 80% of recent wins match, not when ALL
   *         match (previous check required 100% match, rarely triggered).
   */
  async checkGameWinPattern(
    userId: string,
    winAmount: number,
  ): Promise<FraudCheckResult & { warning?: boolean }> {
    const winKey = `game_recent_wins:${userId}`;
    const stored = await redis.get(winKey);
    const wins: number[] = stored ? (JSON.parse(stored) as number[]) : [];

    wins.push(winAmount);
    if (wins.length > this.GAME_WIN_PATTERN_COUNT) wins.shift();

    await redis.set(winKey, JSON.stringify(wins));
    await redis.expire(winKey, 3600);

    if (wins.length < this.GAME_WIN_PATTERN_COUNT) return { allowed: true };

    const avgWin = wins.reduce((sum, w) => sum + w, 0) / wins.length;

    // FIX 1: all wins are 0 → not suspicious, avoid division by zero
    if (avgWin === 0) return { allowed: true };

    // FIX 2: count wins within GAME_WIN_SIMILARITY_THRESHOLD (10%) of the mean
    const similarWins = wins.filter(
      (w) => Math.abs(w - avgWin) / avgWin < this.GAME_WIN_SIMILARITY_THRESHOLD,
    );

    // FIX 3: flag when majority (>= 80%) are similar, not all
    const majorityThreshold = Math.ceil(
      wins.length * this.GAME_WIN_PATTERN_MAJORITY,
    );

    if (similarWins.length >= majorityThreshold) {
      console.warn("[FraudDetection] Suspicious win pattern detected", {
        userId,
        wins,
        avgWin,
        similarWins: similarWins.length,
        threshold: majorityThreshold,
      });

      return {
        allowed: true,
        warning: true,
        reason: "Unusual win pattern detected. This session is being reviewed.",
      };
    }

    return { allowed: true };
  }

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
      redis.get(callbackKey).then((v) => parseInt(v ?? "0")),
      redis.ttl(callbackKey),
      redis.get(hourlyKey).then((v) => parseFloat(v ?? "0")),
    ]);

    const nextHour =
      Math.ceil((Date.now() + 1) / 3600000) * 3600000;
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

export const fraudDetection = new FraudDetection();