/**
 * VIP Router
 * tRPC procedures for VIP system
 */

import { router, protectedProcedure } from '../trpc';
import { eq } from 'drizzle-orm';
import { db } from '@/drizzle';
import { vipService } from '@/lib/vip-service';
import { user } from '@/drizzle/schema';

export const vipRouter = router({
  /**
   * Get user's VIP status
   */
  getVIPStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return await vipService.getStatus(ctx.user.id);
    }),

  /**
   * Get VIP benefits for current tier
   */
  getVIPBenefits: protectedProcedure
    .query(async ({ ctx }) => {
      // FIX: renamed from `user` — that name shadowed the imported Drizzle table,
      // making eq(user.id, ...) reference the local variable instead of the column.
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { vipLevel: true },
      });

      if (!userRecord) {
        throw new Error('User not found');
      }

      return await vipService.getBenefits(userRecord.vipLevel);
    }),
});
