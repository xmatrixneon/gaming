/**
 * Referral Router
 * tRPC procedures for referral system
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/drizzle';
import { user, referral } from '@/drizzle/schema';
import { referralService } from '@/lib/referral-service';
import { headers } from 'next/headers';

export const referralRouter = router({
  /**
   * Get current user's referral code and share link
   */
  getReferralCode: protectedProcedure
    .query(async ({ ctx }) => {
      const userData = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { referralCode: true }
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://clausbet.com';

      return {
        referralCode: userData?.referralCode || null,
        shareLink: userData?.referralCode
          ? `${appUrl}/signup?ref=${userData.referralCode}`
          : null,
      };
    }),

  /**
   * Get referral statistics
   */
  getReferralStats: protectedProcedure
    .query(async ({ ctx }) => {
      return await referralService.getStats(ctx.user.id);
    }),

  /**
   * Get referral history
   */
  getReferralHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const referrals = await db.query.referral.findMany({
        where: eq(referral.referrerId, ctx.user.id),
        with: {
          referredUser: {
            columns: {
              id: true,
              username: true,
              email: true,
              createdAt: true,
            },
          },
          bonusTransaction: {
            columns: { amount: true },
          },
        },
        orderBy: [desc(referral.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return referrals;
    }),

  /**
   * Apply a referral code after signup.
   * Never throws — referral errors must not surface to the user.
   */
  applyReferralCode: protectedProcedure
    .input(z.object({ referralCode: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const headersList = await headers();
        const ip =
          headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          headersList.get('x-real-ip') ||
          '127.0.0.1';

        const userData = await db.query.user.findFirst({
          where: eq(user.id, ctx.user.id),
          columns: { email: true },
        });

        await referralService.createReferralOnSignup(
          ctx.user.id,
          input.referralCode,
          ip,
          userData?.email || '',
        );

        return { success: true as const };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Failed to apply referral code',
        };
      }
    }),
});
