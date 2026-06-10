/**
 * Bonus Service
 *
 * Fix in this version (TS2769):
 * - notification.metadata is typed in schema as:
 *   { transactionId?, withdrawalId?, depositId?, betId?, bonusId?, referralId?, actionUrl? }
 *   Two insert calls were passing extra fields not in that type:
 *   - awardWelcomeBonus: passed { bonusAmount, wageringRequired } → TS2769
 *   - completeBonus: passed { bonusId, bonusAmount } → bonusAmount not in type → TS2769
 *   FIX: removed unknown keys, kept only bonusId (which IS in the type).
 *   The amount info is already in the notification body string via formatPaisa().
 *
 * All other fixes from previous sessions preserved.
 */

import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import {
  userBonus,
  bonusTemplate,
  deposit,
  notification,
} from "@/drizzle/schema";
import { eq, and, inArray, gte, desc, sql } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { walletService } from "@/lib/wallet-service";
import { formatPaisa } from "@/lib/format-currency";

export class BonusService {
  async awardWelcomeBonus(
    userId: string,
    depositAmount: bigint,
    depositId: string,
  ): Promise<void> {
    const depositCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deposit)
      .where(and(eq(deposit.userId, userId), eq(deposit.status, "completed")));

    const depositCount = depositCountResult[0]?.count ?? 0;
    if (depositCount !== 1) return;

    const existingClaim = await db.query.userBonus.findFirst({
      where: and(
        eq(userBonus.userId, userId),
        eq(userBonus.templateId, "welcome-bonus-100"),
      ),
    });
    if (existingClaim) return;

    const template = await db.query.bonusTemplate.findFirst({
      where: eq(bonusTemplate.id, "welcome-bonus-100"),
    });
    if (!template || !template.isActive) return;

    // Scale by 100 before BigInt conversion to preserve 2 decimal places.
    // Math.round(Number("1.50")) = 2 (wrong); Math.round(Number("1.50") * 100) = 150 (correct).
    const valuePct100 = BigInt(Math.round(Number(template.value) * 100));
    const rawBonus = (depositAmount * valuePct100) / BigInt(10000);

    const cappedBonus = template.maxValue
      ? rawBonus > BigInt(template.maxValue)
        ? BigInt(template.maxValue)
        : rawBonus
      : rawBonus;

    const multiplier100 = BigInt(Math.round(Number(template.wageringMultiplier) * 100));
    const wageringRequired = (cappedBonus * multiplier100) / BigInt(100);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (template.expiryDays ?? 30));

    const bonusId = nanoid();

    await db.insert(userBonus).values({
      id: bonusId,
      userId,
      templateId: template.id,
      awardedAmount: cappedBonus.toString(),
      status: "pending",
      wageringRequired: wageringRequired.toString(),
      wageringCompleted: "0",
      expiresAt,
      sourceDepositId: depositId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await redis.del(`active_bonuses:${userId}`);

    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: "bonus_credited",
      title: "Welcome Bonus Credited!",
      body: `You received ${formatPaisa(cappedBonus)} bonus! Wager ${formatPaisa(wageringRequired)} to unlock it.`,
      // FIX: only pass keys that exist in the schema metadata type.
      // bonusAmount and wageringRequired are NOT in the type — they're in the body string.
      metadata: {
        bonusId,
      },
      createdAt: new Date(),
    });
  }

  async trackWagering(userId: string, betAmount: bigint): Promise<void> {
    const activeBonuses = await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ["pending", "active"]),
        gte(userBonus.expiresAt, new Date()),
      ),
    });

    if (activeBonuses.length === 0) return;

    const totalRemaining = activeBonuses.reduce((sum, bonus) => {
      const remaining =
        BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
      return sum + remaining;
    }, BigInt(0));

    for (const bonus of activeBonuses) {
      const remaining =
        BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
      const share =
        totalRemaining > BigInt(0)
          ? (betAmount * remaining) / totalRemaining
          : BigInt(0);

      const rawNewWagering = BigInt(bonus.wageringCompleted) + share;

      const clamped =
        rawNewWagering > BigInt(bonus.wageringRequired)
          ? BigInt(bonus.wageringRequired)
          : rawNewWagering;

      await db
        .update(userBonus)
        .set({
          wageringCompleted: clamped.toString(),
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(userBonus.id, bonus.id));

      if (rawNewWagering >= BigInt(bonus.wageringRequired)) {
        await this.completeBonus(bonus.id, userId);
      }
    }

    await redis.del(`active_bonuses:${userId}`);
  }

  private async completeBonus(bonusId: string, userId: string): Promise<void> {
    // Atomic claim: only the first concurrent caller can transition status from
    // pending/active → completed. If 0 rows returned, another call already won.
    const claimed = await db
      .update(userBonus)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userBonus.id, bonusId), inArray(userBonus.status, ["pending", "active"])))
      .returning({ id: userBonus.id, awardedAmount: userBonus.awardedAmount });

    if (claimed.length === 0) return;

    const bonusAmount = BigInt(claimed[0].awardedAmount);

    const result = await walletService.updateBalanceAtomic(
      userId,
      bonusAmount,
      "bonus",
      { reason: `wagering_complete:${bonusId}` },
    );

    if (!result.success) {
      // Roll back the status claim so the bonus can be retried
      await db
        .update(userBonus)
        .set({ status: "active", completedAt: null, updatedAt: new Date() })
        .where(eq(userBonus.id, bonusId));
      console.error("[BONUS] Failed to credit completed bonus:", result.error);
      return;
    }

    await db
      .update(userBonus)
      .set({ completionTransactionId: result.transactionId, updatedAt: new Date() })
      .where(eq(userBonus.id, bonusId));

    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: "bonus_credited",
      title: "Bonus Unlocked!",
      body: `You completed the wagering requirement! ${formatPaisa(bonusAmount)} has been credited to your balance.`,
      metadata: { bonusId },
      createdAt: new Date(),
    });
  }

  async getActiveBonuses(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      awardedAmount: string;
      wageringRequired: string;
      wageringCompleted: string;
      expiresAt: Date;
      progress: number;
    }>
  > {
    const bonuses = await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ["pending", "active"]),
        gte(userBonus.expiresAt, new Date()),
      ),
      with: { template: true },
      orderBy: [desc(userBonus.createdAt)],
    });

    return bonuses.map((bonus) => {
      const required = BigInt(bonus.wageringRequired);
      const completed = BigInt(bonus.wageringCompleted);
      const progress =
        required > BigInt(0)
          ? Number((completed * BigInt(100)) / required)
          : 100;

      return {
        id: bonus.id,
        name: bonus.template?.name ?? "Bonus",
        awardedAmount: bonus.awardedAmount,
        wageringRequired: bonus.wageringRequired,
        wageringCompleted: bonus.wageringCompleted,
        expiresAt: bonus.expiresAt,
        progress,
      };
    });
  }

  async getBonusHistory(userId: string, limit = 20, offset = 0) {
    return db.query.userBonus.findMany({
      where: eq(userBonus.userId, userId),
      with: { template: true },
      orderBy: [desc(userBonus.createdAt)],
      limit,
      offset,
    });
  }
}

export const bonusService = new BonusService();