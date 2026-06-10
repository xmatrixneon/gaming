/**
 * Bonus Router
 * tRPC procedures for bonus system
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/drizzle';
import { userBonus } from '@/drizzle/schema';
import { bonusService } from '@/lib/bonus-service';

export const bonusRouter = router({
  /**
   * Get user's active bonuses
   */
  getActiveBonuses: protectedProcedure
    .query(async ({ ctx }) => {
      return await bonusService.getActiveBonuses(ctx.user.id);
    }),

  /**
   * Get bonus history
   */
  getBonusHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return await bonusService.getBonusHistory(
        ctx.user.id,
        input.limit,
        input.offset
      );
    }),
});
