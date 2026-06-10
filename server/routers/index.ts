/**
 * tRPC Router Configuration
 * Main router with all sub-routers
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { transactionRouter } from "./transaction";
import { walletRouter } from "./wallet";
import { gameRouter } from "./game";
import { referralRouter } from "./referral";
import { bonusRouter } from "./bonus";
import { vipRouter } from "./vip";
import { z } from "zod";

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Root tRPC router
 * Combines all sub-routers into a single API
 */
export const appRouter = router({
  // Health check
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),

  // Authentication procedures
  auth: authRouter,

  // User procedures
  user: userRouter,

  // Transaction procedures
  transaction: transactionRouter,

  // Wallet procedures
  wallet: walletRouter,

  // Game procedures
  game: gameRouter,

  // Referral procedures
  referral: referralRouter,

  // Bonus procedures
  bonus: bonusRouter,

  // VIP procedures
  vip: vipRouter,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AppRouter = typeof appRouter;
