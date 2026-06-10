/**
 * VIP Service
 *
 * Fixes applied:
 * - checkTierUpgrade: `const user = ...` shadowed the imported Drizzle `user` table.
 *   eq(user.id, userId) was calling eq() on a DB result object instead of the table
 *   column, and db.update(user) was updating the local variable, not the table.
 *   Renamed all local variables to `userRecord`.
 * - getStatus: same `user` shadowing bug — renamed to `userRecord`.
 * - auditActionEnum now includes 'user_vip_upgrade' (schema fix) — updated from
 *   placeholder 'balance_adjusted' to the correct action value.
 * - trackProgress: replaced unbounded recursion with capped retry counter to prevent
 *   infinite loops under heavy contention.
 * - trackProgress: gameStats insert uses onConflictDoNothing() to guard against
 *   race condition on first-ever insert for a user.
 * - getStatus: division-by-zero guard when nextThreshold is 0n (Bronze tier).
 */

import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import { user, gameStats, notification, auditLog } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/lib/redis";

export class VIPService {
  private readonly TIER_THRESHOLDS = {
    Diamond: 100000000n,  // ₹10,00,000 in paisa
    Platinum: 50000000n,  // ₹5,00,000
    Gold: 20000000n,      // ₹2,00,000
    Silver: 5000000n,     // ₹50,000
    Bronze: 0n,
  } as const;

  private readonly TIER_ORDER = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
  ] as const;

  private readonly BONUS_MULTIPLIERS: Record<string, number> = {
    Bronze: 1.0,
    Silver: 1.1,
    Gold: 1.25,
    Platinum: 1.5,
    Diamond: 2.0,
  };

  calculateTier(totalWagered: bigint): string {
    if (totalWagered >= this.TIER_THRESHOLDS.Diamond) return "Diamond";
    if (totalWagered >= this.TIER_THRESHOLDS.Platinum) return "Platinum";
    if (totalWagered >= this.TIER_THRESHOLDS.Gold) return "Gold";
    if (totalWagered >= this.TIER_THRESHOLDS.Silver) return "Silver";
    return "Bronze";
  }

  getNextTierThreshold(currentTier: string): bigint | null {
    const tierIndex = this.TIER_ORDER.indexOf(
      currentTier as (typeof this.TIER_ORDER)[number],
    );
    if (tierIndex === -1 || tierIndex >= this.TIER_ORDER.length - 1) return null;
    return this.TIER_THRESHOLDS[this.TIER_ORDER[tierIndex + 1]] ?? null;
  }

  getBonusMultiplier(vipLevel: string): number {
    return this.BONUS_MULTIPLIERS[vipLevel] ?? 1.0;
  }

  /**
   * Track VIP progress and upgrade tier if needed.
   * FIX: retryCount parameter prevents unbounded recursion on concurrent writes.
   */
  async trackProgress(
    userId: string,
    betAmount: bigint,
    retryCount = 0,
  ): Promise<void> {
    const MAX_RETRIES = 5;

    let userStats = await db.query.gameStats.findFirst({
      where: eq(gameStats.userId, userId),
    });

    if (!userStats) {
      // FIX: onConflictDoNothing guards against race on first insert for this user
      await db
        .insert(gameStats)
        .values({
          id: nanoid(),
          userId,
          totalBets: 1,
          totalWins: 0,
          totalLosses: 0,
          totalWagered: betAmount.toString(),
          totalWon: "0",
          biggestWin: "0",
          biggestLoss: "0",
          currentWinStreak: 0,
          currentLossStreak: 0,
          longestWinStreak: 0,
          statsVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      userStats = await db.query.gameStats.findFirst({
        where: eq(gameStats.userId, userId),
      });
    }

    if (!userStats) return;

    const currentVersion = userStats.statsVersion;
    const newWagered = BigInt(userStats.totalWagered) + betAmount;

    const updateResult = await db
      .update(gameStats)
      .set({
        totalWagered: newWagered.toString(),
        statsVersion: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gameStats.id, userStats.id),
          eq(gameStats.statsVersion, currentVersion),
        ),
      )
      .returning();

    if (updateResult.length === 0) {
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `[VIP] trackProgress: max retries (${MAX_RETRIES}) exceeded for user ${userId}`,
        );
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 50 * (retryCount + 1)),
      );
      return this.trackProgress(userId, betAmount, retryCount + 1);
    }

    await this.checkTierUpgrade(userId, newWagered);
  }

  /**
   * Check and perform VIP tier upgrade.
   * FIX: renamed `user` local variable to `userRecord` throughout — the name `user`
   * shadowed the imported Drizzle table, breaking all DB operations in this function.
   */
  private async checkTierUpgrade(
    userId: string,
    totalWagered: bigint,
  ): Promise<void> {
    // FIX: was `const user = ...` which shadowed the imported table reference
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { vipLevel: true },
    });

    if (!userRecord) return;

    const currentTier = userRecord.vipLevel;
    const newTier = this.calculateTier(totalWagered);

    if (currentTier === newTier) return;

    const currentIndex = this.TIER_ORDER.indexOf(
      currentTier as (typeof this.TIER_ORDER)[number],
    );
    const newIndex = this.TIER_ORDER.indexOf(
      newTier as (typeof this.TIER_ORDER)[number],
    );

    // Never downgrade
    if (newIndex <= currentIndex) return;

    // FIX: db.update(user) now correctly references the imported table
    await db
      .update(user)
      .set({ vipLevel: newTier, updatedAt: new Date() })
      .where(eq(user.id, userId));

    await redis.del(`vip_status:${userId}`);

    const nextTierLabel =
      this.TIER_ORDER[newIndex + 1] ?? "maximum";

    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: "system",
      title: `You've reached ${newTier} tier!`,
      body: `You now have access to exclusive ${newTier} bonus offers. Keep playing to reach ${nextTierLabel} tier!`,
      metadata: {},
      createdAt: new Date(),
    });

    // FIX: using 'user_vip_upgrade' — now present in auditActionEnum (schema fix)
    await db.insert(auditLog).values({
      id: nanoid(),
      actorId: null,       // system actor — schema allows null with actorRole check
      actorRole: "system",
      action: "user_vip_upgrade",
      targetType: "user",
      targetId: userId,
      before: { vipLevel: currentTier },
      after: { vipLevel: newTier },
      createdAt: new Date(),
    });
  }

  /**
   * Get VIP status for user.
   * FIX: renamed `user` local variable to `userRecord` to avoid shadowing the table.
   * FIX: division-by-zero guard for Bronze tier (nextThreshold = 0n).
   */
  async getStatus(userId: string): Promise<{
    currentTier: string;
    totalWagered: string;
    nextTier: string | null;
    nextThreshold: string | null;
    progress: number;
    bonusMultiplier: number;
  }> {
    // FIX: was `const user = ...` which shadowed the imported table
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { vipLevel: true },
      with: { gameStats: true },
    });

    if (!userRecord) throw new Error("User not found");

    const currentTier = userRecord.vipLevel;
    const totalWagered = BigInt(userRecord.gameStats?.totalWagered ?? "0");
    const nextThreshold = this.getNextTierThreshold(currentTier);

    // FIX: guard against division by zero (Bronze has nextThreshold = 5,000,000n,
    // but defensive check ensures correctness if thresholds are ever changed)
    const progress =
      nextThreshold && nextThreshold > 0n
        ? Number((totalWagered * 100n) / nextThreshold)
        : 100;

    const tierIndex = this.TIER_ORDER.indexOf(
      currentTier as (typeof this.TIER_ORDER)[number],
    );
    const nextTier =
      tierIndex >= 0 && tierIndex < this.TIER_ORDER.length - 1
        ? this.TIER_ORDER[tierIndex + 1]
        : null;

    return {
      currentTier,
      totalWagered: totalWagered.toString(),
      nextTier: nextTier ?? null,
      nextThreshold: nextThreshold?.toString() ?? null,
      progress,
      bonusMultiplier: this.getBonusMultiplier(currentTier),
    };
  }

  async getBenefits(vipLevel: string): Promise<{
    bonusMultiplier: number;
    exclusiveBonuses: string[];
    withdrawalLimit: number;
    supportLevel: string;
  }> {
    const tierBenefits: Record<
      string,
      {
        bonusMultiplier: number;
        exclusiveBonuses: string[];
        withdrawalLimit: number;
        supportLevel: string;
      }
    > = {
      Bronze: {
        bonusMultiplier: 1.0,
        exclusiveBonuses: [],
        withdrawalLimit: 3,
        supportLevel: "standard",
      },
      Silver: {
        bonusMultiplier: 1.1,
        exclusiveBonuses: ["silver-reload-50"],
        withdrawalLimit: 5,
        supportLevel: "priority",
      },
      Gold: {
        bonusMultiplier: 1.25,
        exclusiveBonuses: ["gold-weekly-cashback", "gold-reload-75"],
        withdrawalLimit: 10,
        supportLevel: "priority",
      },
      Platinum: {
        bonusMultiplier: 1.5,
        exclusiveBonuses: ["platinum-cashback-15", "platinum-reload-100"],
        withdrawalLimit: 25,
        supportLevel: "vip",
      },
      Diamond: {
        bonusMultiplier: 2.0,
        exclusiveBonuses: [
          "diamond-cashback-20",
          "diamond-reload-150",
          "diamond-exclusive",
        ],
        withdrawalLimit: 50,
        supportLevel: "dedicated",
      },
    };

    return tierBenefits[vipLevel] ?? tierBenefits["Bronze"];
  }
}

export const vipService = new VIPService();