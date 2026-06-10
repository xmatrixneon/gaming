/**
 * Referral Service
 *
 * Handles referral code generation, tracking, and qualification
 */

import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { user, referral, session, transaction } from '@/drizzle/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { redis } from '@/lib/redis';

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
    // Validate referral code exists
    const referrer = await db.query.user.findFirst({
      where: eq(user.referralCode, referralCode)
    });

    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    // Self-referral detection: Email similarity
    const sanitizeEmail = (email: string) => {
      return email.toLowerCase().replace(/\+.*@/, '@');
    };

    if (sanitizeEmail(referrer.email) === sanitizeEmail(email)) {
      throw new Error('Cannot refer yourself (email similarity)');
    }

    // Self-referral detection: IP check (basic)
    const referrerSession = await db.query.session.findFirst({
      where: eq(session.userId, referrer.id),
      orderBy: desc(session.createdAt)
    });

    if (referrerSession?.ipAddress === ipAddress) {
      throw new Error('Cannot use your own referral code (IP match)');
    }

    // Create referral record
    await db.insert(referral).values({
      id: nanoid(),
      referrerId: referrer.id,
      referredUserId,
      referralCode,
      status: 'pending',
      qualifyByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Qualify referral and credit bonus when referred user makes first deposit
   */
  async qualifyReferral(
    userId: string,
    depositAmount: bigint,
    depositId: string
  ): Promise<void> {
    // Find pending referral for this user
    const pendingReferral = await db.query.referral.findFirst({
      where: and(
        eq(referral.referredUserId, userId),
        eq(referral.status, 'pending')
      )
    });

    if (!pendingReferral) {
      return; // No pending referral
    }

    // Calculate bonus: 10% of deposit, max ₹2,000
    const bonusAmount = Math.min(
      (depositAmount * 10n) / 100n,
      200000n // ₹2,000 in paisa
    );

    // Update referral status to qualified
    await db.update(referral)
      .set({
        status: 'qualified',
        qualifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referral.id, pendingReferral.id));

    // Import wallet service dynamically
    const { walletService } = await import('@/lib/wallet-service');

    // Credit referrer balance
    const result = await walletService.updateBalanceAtomic(
      pendingReferral.referrerId,
      bonusAmount,
      'bonus',
      {
        referralId: pendingReferral.id,
        type: 'referral',
        depositId,
      }
    );

    if (!result.success) {
      console.error('[REFERRAL] Failed to credit bonus:', result.error);
      return;
    }

    // Update referral status to rewarded
    await db.update(referral)
      .set({
        status: 'rewarded',
        rewardedAt: new Date(),
        bonusTransactionId: result.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(referral.id, pendingReferral.id));

    // Invalidate cache
    await redis.del(`referral_stats:${pendingReferral.referrerId}`);
  }

  /**
   * Get referral statistics for a user
   */
  async getStats(referrerId: string): Promise<{
    pending: number;
    qualified: number;
    rewarded: number;
    totalEarnings: string;
  }> {
    // Check cache first
    const cached = await redis.get(`referral_stats:${referrerId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get counts by status
    const stats = await db.select({
      status: referral.status,
      count: count(),
    })
    .from(referral)
    .where(eq(referral.referrerId, referrerId))
    .groupBy(referral.status);

    const pending = stats.find(s => s.status === 'pending')?.count || 0;
    const qualified = stats.find(s => s.status === 'qualified')?.count || 0;
    const rewarded = stats.find(s => s.status === 'rewarded')?.count || 0;

    // Get total earnings from rewarded referrals
    const { transaction } = await import('@/drizzle/schema');

    const totalEarningsResult = await db.select({
      total: sql<string>`sum(${transaction.amount})`,
    })
    .from(transaction)
    .innerJoin(referral, eq(transaction.metadata->>'referralId', referral.id))
    .where(
      and(
        eq(referral.referrerId, referrerId),
        eq(referral.status, 'rewarded')
      )
    );

    const totalEarnings = totalEarningsResult[0]?.total || '0';

    const result = {
      pending,
      qualified,
      rewarded,
      totalEarnings,
    };

    // Cache for 5 minutes
    await redis.setex(`referral_stats:${referrerId}`, 300, JSON.stringify(result));

    return result;
  }
}

// Singleton instance
export const referralService = new ReferralService();
