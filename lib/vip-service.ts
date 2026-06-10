/**
 * VIP Service
 *
 * Handles VIP tier calculation, progress tracking, and tier upgrades
 */

import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { user, gameStats, notification, auditLog } from '@/drizzle/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { redis } from '@/lib/redis';

export class VIPService {
  private readonly TIER_THRESHOLDS = {
    'Diamond': 100000000n,   // ₹1,000,000
    'Platinum': 50000000n,   // ₹500,000
    'Gold': 20000000n,       // ₹200,000
    'Silver': 5000000n,      // ₹50,000
    'Bronze': 0n,
  } as const;

  private readonly TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const;

  private readonly BONUS_MULTIPLIERS: Record<string, number> = {
    'Bronze': 1.0,
    'Silver': 1.1,
    'Gold': 1.25,
    'Platinum': 1.5,
    'Diamond': 2.0,
  };

  /**
   * Calculate VIP tier from total wagered amount
   */
  calculateTier(totalWagered: bigint): string {
    if (totalWagered >= this.TIER_THRESHOLDS.Diamond) return 'Diamond';
    if (totalWagered >= this.TIER_THRESHOLDS.Platinum) return 'Platinum';
    if (totalWagered >= this.TIER_THRESHOLDS.Gold) return 'Gold';
    if (totalWagered >= this.TIER_THRESHOLDS.Silver) return 'Silver';
    return 'Bronze';
  }

  /**
   * Get next tier threshold
   */
  getNextTierThreshold(currentTier: string): bigint | null {
    const tierIndex = this.TIER_ORDER.indexOf(currentTier as any);
    if (tierIndex === -1 || tierIndex >= this.TIER_ORDER.length - 1) {
      return null;
    }
    const nextTier = this.TIER_ORDER[tierIndex + 1];
    return this.TIER_THRESHOLDS[nextTier] || null;
  }

  /**
   * Get VIP bonus multiplier for tier
   */
  getBonusMultiplier(vipLevel: string): number {
    return this.BONUS_MULTIPLIERS[vipLevel] || 1.0;
  }

  /**
   * Track VIP progress and upgrade tier if needed
   */
  async trackProgress(userId: string, betAmount: bigint): Promise<void> {
    // Get or create game stats record
    let userStats = await db.query.gameStats.findFirst({
      where: eq(gameStats.userId, userId)
    });

    if (!userStats) {
      // Create game stats record
      await db.insert(gameStats).values({
        id: nanoid(),
        userId,
        totalWagered: betAmount.toString(),
        totalBets: 1,
        statsVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      userStats = await db.query.gameStats.findFirst({
        where: eq(gameStats.userId, userId)
      });
    }

    if (!userStats) return;

    // Atomic update with optimistic locking
    const currentVersion = userStats.statsVersion;
    const currentWagered = BigInt(userStats.totalWagered);
    const newWagered = currentWagered + betAmount;

    const updateResult = await db.update(gameStats)
      .set({
        totalWagered: newWagered.toString(),
        statsVersion: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(gameStats.id, userStats.id),
        eq(gameStats.statsVersion, currentVersion)
      ))
      .returning();

    if (updateResult.length === 0) {
      // Concurrent modification detected, retry
      await new Promise(resolve => setTimeout(resolve, 50));
      return this.trackProgress(userId, betAmount);
    }

    // Check if tier should upgrade
    await this.checkTierUpgrade(userId, newWagered);
  }

  /**
   * Check and perform VIP tier upgrade
   */
  private async checkTierUpgrade(userId: string, totalWagered: bigint): Promise<void> {
    const user = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { vipLevel: true }
    });

    if (!user) return;

    const currentTier = user.vipLevel;
    const newTier = this.calculateTier(totalWagered);

    if (currentTier === newTier) {
      return; // No tier change
    }

    // Check if upgrade (never downgrade)
    const currentIndex = this.TIER_ORDER.indexOf(currentTier as any);
    const newIndex = this.TIER_ORDER.indexOf(newTier as any);

    if (newIndex <= currentIndex) {
      return; // Not an upgrade
    }

    // Upgrade user's VIP tier
    await db.update(user)
      .set({
        vipLevel: newTier,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Invalidate cache
    await redis.del(`vip_status:${userId}`);

    // Create notification
    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: 'system',
      title: `🎉 Congratulations! You've reached ${newTier} tier!`,
      body: `You now have access to exclusive bonus offers. Keep playing to unlock ${this.TIER_ORDER[newIndex + 1] || 'max'} tier!`,
      metadata: {
        oldTier: currentTier,
        newTier,
      },
      createdAt: new Date(),
    });

    // Log to audit
    await db.insert(auditLog).values({
      id: nanoid(),
      actorId: userId,
      actorRole: 'system',
      action: 'user_vip_upgrade',
      targetType: 'user',
      targetId: userId,
      before: { tier: currentTier },
      after: { tier: newTier },
      createdAt: new Date(),
    });
  }

  /**
   * Get VIP status for user
   */
  async getStatus(userId: string): Promise<{
    currentTier: string;
    totalWagered: string;
    nextTier: string | null;
    nextThreshold: string | null;
    progress: number;
    bonusMultiplier: number;
  }> {
    const user = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { vipLevel: true },
      with: {
        gameStats: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentTier = user.vipLevel;
    const totalWagered = BigInt(user.gameStats?.totalWagered || 0);
    const nextThreshold = this.getNextTierThreshold(currentTier);
    const progress = nextThreshold
      ? Number(totalWagered * 100n / nextThreshold)
      : 100;

    const tierIndex = this.TIER_ORDER.indexOf(currentTier as any);
    const nextTier = tierIndex >= 0 && tierIndex < this.TIER_ORDER.length - 1
      ? this.TIER_ORDER[tierIndex + 1]
      : null;

    return {
      currentTier,
      totalWagered: totalWagered.toString(),
      nextTier,
      nextThreshold: nextThreshold?.toString() || null,
      progress,
      bonusMultiplier: this.getBonusMultiplier(currentTier),
    };
  }

  /**
   * Get VIP benefits for current tier
   */
  async getBenefits(vipLevel: string): Promise<{
    bonusMultiplier: number;
    exclusiveBonuses: string[];
    withdrawalLimit: number;
    supportLevel: string;
  }> {
    const tierBenefits: Record<string, {
      bonusMultiplier: number;
      exclusiveBonuses: string[];
      withdrawalLimit: number;
      supportLevel: string;
    }> = {
      'Bronze': {
        bonusMultiplier: 1.0,
        exclusiveBonuses: [],
        withdrawalLimit: 3,
        supportLevel: 'standard',
      },
      'Silver': {
        bonusMultiplier: 1.1,
        exclusiveBonuses: ['silver-reload-50'],
        withdrawalLimit: 5,
        supportLevel: 'priority',
      },
      'Gold': {
        bonusMultiplier: 1.25,
        exclusiveBonuses: ['gold-weekly-cashback', 'gold-reload-75'],
        withdrawalLimit: 10,
        supportLevel: 'priority',
      },
      'Platinum': {
        bonusMultiplier: 1.5,
        exclusiveBonuses: ['platinum-cashback-15', 'platinum-reload-100'],
        withdrawalLimit: 25,
        supportLevel: 'vip',
      },
      'Diamond': {
        bonusMultiplier: 2.0,
        exclusiveBonuses: [
          'diamond-cashback-20',
          'diamond-reload-150',
          'diamond-exclusive',
        ],
        withdrawalLimit: 50,
        supportLevel: 'dedicated',
      },
    };

    return tierBenefits[vipLevel] || tierBenefits['Bronze'];
  }
}

// Singleton instance
export const vipService = new VIPService();
