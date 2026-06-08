/**
 * tRPC Router Configuration
 * Main router with all sub-routers
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { authRouter } from "./auth";
import { userRouter } from "./user";
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
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AppRouter = typeof appRouter;
