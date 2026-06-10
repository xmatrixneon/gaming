/**
 * Bonus Service
 *
 * Handles welcome bonus awarding, wagering tracking, and bonus completion
 */

import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { userBonus, bonusTemplate, deposit, notification, transaction } from '@/drizzle/schema';
import { eq, and, inArray, gte, desc, sql } from 'drizzle-orm';
import { redis } from '@/lib/redis';

export class BonusService {
  /**
   * Award welcome bonus on first deposit
   */
  async awardWelcomeBonus(
    userId: string,
    depositAmount: bigint,
    depositId: string
  ): Promise<void> {
    // Check if this is user's first completed deposit
    const depositCountResult = await db.select({
      count: sql<number>`count(*)::int`
    })
    .from(deposit)
    .where(and(
      eq(deposit.userId, userId),
      eq(deposit.status, 'completed')
    ));

    const depositCount = depositCountResult[0]?.count || 0;

    if (depositCount !== 1) {
      return; // Not first deposit
    }

    // Check if already claimed welcome bonus
    const existingClaim = await db.query.userBonus.findFirst({
      where: and(
        eq(userBonus.userId, userId),
        eq(userBonus.templateId, 'welcome-bonus-100')
      )
    });

    if (existingClaim) {
      return; // Already claimed
    }

    // Get welcome bonus template
    const template = await db.query.bonusTemplate.findFirst({
      where: eq(bonusTemplate.id, 'welcome-bonus-100')
    });

    if (!template || !template.isActive) {
      return; // Template not found or inactive
    }

    // Calculate bonus amount: 100% match, max ₹10,000
    const bonusAmount = Math.min(
      (depositAmount * BigInt(template.value)) / 100n,
      BigInt(template.maxValue || '999999')
    );

    // Calculate wagering requirement
    const wageringRequired = (bonusAmount * BigInt(template.wageringMultiplier)) / 100n;

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (template.expiryDays || 30));

    // Create user bonus record
    await db.insert(userBonus).values({
      id: nanoid(),
      userId,
      templateId: template.id,
      awardedAmount: bonusAmount.toString(),
      status: 'pending',
      wageringRequired: wageringRequired.toString(),
      wageringCompleted: '0',
      expiresAt,
      sourceDepositId: depositId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Invalidate cache
    await redis.del(`active_bonuses:${userId}`);

    // Notify user
    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: 'bonus_credited',
      title: '🎁 Welcome Bonus Credited!',
      body: `You received ₹${(Number(bonusAmount) / 100).toFixed(2)} bonus! Wager ₹${(Number(wageringRequired) / 100).toFixed(2)} to unlock it.`,
      metadata: {
        bonusAmount: bonusAmount.toString(),
        wageringRequired: wageringRequired.toString(),
      },
      createdAt: new Date(),
    });
  }

  /**
   * Track wagering progress for active bonuses
   */
  async trackWagering(userId: string, betAmount: bigint): Promise<void> {
    // Get all active bonuses for user
    const activeBonuses = await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ['pending', 'active']),
        gte(userBonus.expiresAt, new Date())
      )
    });

    if (activeBonuses.length === 0) {
      return; // No active bonuses to track
    }

    // Distribute wagering proportionally across active bonuses
    const totalRemaining = activeBonuses.reduce((sum, bonus) => {
      const remaining = BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
      return sum + remaining;
    }, 0n);

    for (const bonus of activeBonuses) {
      const remaining = BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
      const share = totalRemaining > 0n
        ? (betAmount * remaining) / totalRemaining
        : 0n;

      const newWageringCompleted = BigInt(bonus.wageringCompleted) + share;

      // Update bonus wagering progress
      await db.update(userBonus)
        .set({
          wageringCompleted: Math.min(
            newWageringCompleted,
            BigInt(bonus.wageringRequired)
          ).toString(),
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(userBonus.id, bonus.id));

      // Check if wagering completed
      if (newWageringCompleted >= BigInt(bonus.wageringRequired)) {
        await this.completeBonus(bonus.id, userId);
      }
    }

    // Invalidate cache
    await redis.del(`active_bonuses:${userId}`);
  }

  /**
   * Complete bonus and credit to balance
   */
  private async completeBonus(bonusId: string, userId: string): Promise<void> {
    const bonus = await db.query.userBonus.findFirst({
      where: eq(userBonus.id, bonusId)
    });

    if (!bonus || bonus.status === 'completed') {
      return;
    }

    const bonusAmount = BigInt(bonus.awardedAmount);

    // Import wallet service
    const { walletService } = await import('@/lib/wallet-service');

    // Credit bonus to real balance
    const result = await walletService.updateBalanceAtomic(
      userId,
      bonusAmount,
      'bonus',
      {
        userBonusId: bonus.id,
        type: 'wagering_complete',
      }
    );

    if (!result.success) {
      console.error('[BONUS] Failed to credit completed bonus:', result.error);
      return;
    }

    // Update bonus status
    await db.update(userBonus)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completionTransactionId: result.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(userBonus.id, bonusId));

    // Notify user
    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: 'bonus_credited',
      title: '🎉 Bonus Unlocked!',
      body: `You've completed the wagering requirement! ₹${(Number(bonusAmount) / 100).toFixed(2)} has been credited to your balance.`,
      metadata: {
        userBonusId: bonus.id,
        bonusAmount: bonusAmount.toString(),
      },
      createdAt: new Date(),
    });
  }

  /**
   * Get active bonuses for user
   */
  async getActiveBonuses(userId: string): Promise<Array<{
    id: string;
    name: string;
    awardedAmount: string;
    wageringRequired: string;
    wageringCompleted: string;
    expiresAt: Date;
    progress: number;
  }>> {
    const bonuses = await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ['pending', 'active']),
        gte(userBonus.expiresAt, new Date())
      ),
      with: {
        template: true,
      },
      orderBy: [desc(userBonus.createdAt)],
    });

    return bonuses.map(bonus => ({
      id: bonus.id,
      name: bonus.template?.name || 'Bonus',
      awardedAmount: bonus.awardedAmount,
      wageringRequired: bonus.wageringRequired,
      wageringCompleted: bonus.wageringCompleted,
      expiresAt: bonus.expiresAt,
      progress: Number(BigInt(bonus.wageringCompleted) * 100n / BigInt(bonus.wageringRequired)),
    }));
  }

  /**
   * Get bonus history
   */
  async getBonusHistory(userId: string, limit = 20, offset = 0) {
    return await db.query.userBonus.findMany({
      where: eq(userBonus.userId, userId),
      with: {
        template: true,
      },
      orderBy: [desc(userBonus.createdAt)],
      limit,
      offset,
    });
  }
}

// Singleton instance
export const bonusService = new BonusService();
