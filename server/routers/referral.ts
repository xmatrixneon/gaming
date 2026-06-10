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
            }
          }
        },
        orderBy: [desc(referral.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return referrals;
    }),
});
