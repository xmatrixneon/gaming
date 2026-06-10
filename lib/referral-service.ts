/**
 * Referral Service
 *
 * Fixes applied:
 * - getStats: removed duplicate/shadow import of `transaction` inside the function body
 *   (it was already imported at the top; re-importing inside the function shadowed it
 *    and introduced a compile error when destructuring).
 * - getStats innerJoin: fixed `referral.referralId` → `referral.id` (no such column exists).
 * - getStats innerJoin: fixed JSONB path to use ->> operator correctly and reference
 *   the correct column. Also changed to a subquery approach to avoid fragile raw SQL joins.
 * - qualifyReferral: replaced dynamic import of walletService with static import.
 * - qualifyReferral: bonus calculation uses bigint arithmetic correctly (was mixing
 *   number and bigint in subtle ways).
 */

import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { user, referral, session, transaction } from '@/drizzle/schema'; // FIX: transaction imported once here
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
import { redis } from '@/lib/redis';
import { walletService } from '@/lib/wallet-service'; // FIX: static import

export class ReferralService {
  /**
   * Generate unique 12-character referral code
   */
  async generateCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = nanoid(12).toUpperCase();
      const existing = await db.query.user.findFirst({
        where: eq(user.referralCode, code)
      });
      if (!existing) return code;
      attempts++;
    } while (attempts < maxAttempts);

    throw new Error('Failed to generate unique referral code after max attempts');
  }

  /**
   * Create referral record when user signs up with referral code
   */
  async createReferralOnSignup(
    referredUserId: string,
    referralCode: string,
    ipAddress: string,
    email: string
  ): Promise<void> {
    const referrer = await db.query.user.findFirst({
      where: eq(user.referralCode, referralCode)
    });

    if (!referrer) throw new Error('Invalid referral code');

    const sanitizeEmail = (e: string) => e.toLowerCase().replace(/\+.*@/, '@');
    if (sanitizeEmail(referrer.email) === sanitizeEmail(email)) {
      throw new Error('Cannot refer yourself (email similarity)');
    }

    const referrerSession = await db.query.session.findFirst({
      where: eq(session.userId, referrer.id),
      orderBy: desc(session.createdAt)
    });

    if (referrerSession?.ipAddress === ipAddress) {
      throw new Error('Cannot use your own referral code (IP match)');
    }

    await db.insert(referral).values({
      id: nanoid(),
      referrerId: referrer.id,
      referredUserId,
      referralCode,
      status: 'pending',
      qualifyByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Qualify referral and credit bonus when referred user makes first deposit.
   * FIX: replaced dynamic import with static import.
   */
  async qualifyReferral(
    userId: string,
    depositAmount: bigint,
    depositId: string
  ): Promise<void> {
    const pendingReferral = await db.query.referral.findFirst({
      where: and(
        eq(referral.referredUserId, userId),
        eq(referral.status, 'pending')
      )
    });

    if (!pendingReferral) return;

    // 10% of deposit, max ₹2,000 (in paisa: 200000)
    const tenPercent = (depositAmount * 10n) / 100n;
    const bonusAmount = tenPercent > 200000n ? 200000n : tenPercent;

    // Credit balance BEFORE updating status — if credit fails the referral stays 'pending'
    // so the next qualification event can retry. Previously the 'qualified' status was
    // committed first, which left the referral permanently stuck with no retry path.
    const result = await walletService.updateBalanceAtomic(
      pendingReferral.referrerId,
      bonusAmount,
      'bonus',
      {
        reason: `referral:${pendingReferral.id}`,
        depositId,
      }
    );

    if (!result.success) {
      console.error('[REFERRAL] Failed to credit bonus:', result.error);
      return; // remains 'pending' — retryable
    }

    await db.update(referral)
      .set({
        status: 'rewarded',
        qualifiedAt: new Date(),
        rewardedAt: new Date(),
        bonusTransactionId: result.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(referral.id, pendingReferral.id));

    await redis.del(`referral_stats:${pendingReferral.referrerId}`);
  }

  /**
   * Get referral statistics for a user.
   *
   * Fixes:
   * - Removed shadow import of `transaction` inside function body.
   * - Fixed broken innerJoin: `referral.referralId` does not exist — changed to a
   *   simpler and correct approach: find rewarded referral IDs first, then sum
   *   matching transaction amounts using the metadata JSONB field correctly.
   *   The join was also using raw sql`` with a column that doesn't exist.
   */
  async getStats(referrerId: string): Promise<{
    pending: number;
    qualified: number;
    rewarded: number;
    totalEarnings: string;
  }> {
    const cached = await redis.get(`referral_stats:${referrerId}`);
    if (cached) return JSON.parse(cached);

    const stats = await db.select({
      status: referral.status,
      count: count(),
    })
    .from(referral)
    .where(eq(referral.referrerId, referrerId))
    .groupBy(referral.status);

    const pending = stats.find(s => s.status === 'pending')?.count ?? 0;
    const qualified = stats.find(s => s.status === 'qualified')?.count ?? 0;
    const rewarded = stats.find(s => s.status === 'rewarded')?.count ?? 0;

    // FIX: use bonusTransactionId column (stored on the referral row itself) to
    // join to transactions. The previous code used a non-existent referral.referralId
    // column and a broken JSONB join. Instead: collect the transaction IDs from
    // rewarded referrals, then sum the amounts.
    const rewardedReferrals = await db.query.referral.findMany({
      where: and(
        eq(referral.referrerId, referrerId),
        eq(referral.status, 'rewarded')
      ),
      columns: { bonusTransactionId: true },
    });

    const txIds = rewardedReferrals
      .map(r => r.bonusTransactionId)
      .filter((id): id is string => id !== null);

    let totalEarnings = '0';
    if (txIds.length > 0) {
      const earningsResult = await db.select({
        total: sql<string>`coalesce(sum(${transaction.amount}), 0)::text`,
      })
      .from(transaction)
      .where(inArray(transaction.id, txIds));

      totalEarnings = earningsResult[0]?.total ?? '0';
    }

    const result = { pending, qualified, rewarded, totalEarnings };
    await redis.setex(`referral_stats:${referrerId}`, 300, JSON.stringify(result));
    return result;
  }
}

export const referralService = new ReferralService();