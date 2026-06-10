/**
 * Game Router
 *
 * tRPC router for game operations.
 * Provides type-safe API procedures for launching games,
 * fetching game lists, and managing game sessions.
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { gameAdapter } from "@/lib/game-adapter";
import { z } from "zod";
import type { GameCallbackPayload } from "@/lib/game-api-types";

// ============================================================================
// GAME ROUTER
// ============================================================================

/**
 * Game operations router
 *
 * Provides procedures for:
 * - Game launching (authenticated)
 * - Provider and game listing (public)
 * - Transaction history (authenticated)
 * - Callback processing (public/internal)
 */
export const gameRouter = router({
  // ========================================================================
  // PLAYER OPERATIONS
  // ========================================================================

  /**
   * Launch a game for the authenticated user
   *
   * Requires authentication. Checks user balance and returns
   * a game launch URL.
   */
  launchGame: protectedProcedure
    .input(
      z.object({
        gameUid: z.string().min(1, "Game UID is required"),
        language: z.string().default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.info("[tRPC] Launching game", {
        userId: ctx.user.id,
        gameUid: input.gameUid,
        language: input.language,
      });

      // TODO: Get user's member account from database
      // For now, use user ID as member account (will be updated when user table has member_account field)
      const memberAccount = ctx.user.id;

      try {
        // Launch game via adapter
        const result = await gameAdapter.launchGame({
          userId: ctx.user.id,
          memberAccount: memberAccount,
          gameUid: input.gameUid,
          language: input.language,
        });

        console.info("[tRPC] Game launched successfully", {
          userId: ctx.user.id,
          gameUid: input.gameUid,
        });

        return {
          success: true,
          gameUrl: result.gameUrl,
          balance: result.balance, // Current balance in paisa
        };
      } catch (error) {
        console.error("[tRPC] Game launch failed", {
          userId: ctx.user.id,
          gameUid: input.gameUid,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new Error(
          `Failed to launch game: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get available game providers
   *
   * Public endpoint - no authentication required.
   * Returns list of game providers with their supported currencies and languages.
   */
  getProviders: publicProcedure.query(async () => {
    console.info("[tRPC] Fetching game providers");

    try {
      const providers = await gameAdapter.getProviders();

      console.info("[tRPC] Providers fetched successfully", {
        count: providers.length,
      });

      return {
        success: true,
        providers,
      };
    } catch (error) {
      console.error("[tRPC] Failed to fetch providers", {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `Failed to fetch providers: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }),

  /**
   * Get games from a specific provider
   *
   * Public endpoint - no authentication required.
   * Returns list of available games from the specified provider.
   */
  getGameList: publicProcedure
    .input(
      z.object({
        providerCode: z.string().min(1, "Provider code is required"),
      })
    )
    .query(async ({ input }) => {
      console.info("[tRPC] Fetching game list", {
        providerCode: input.providerCode,
      });

      try {
        const games = await gameAdapter.getGameList(input.providerCode);

        console.info("[tRPC] Game list fetched successfully", {
          providerCode: input.providerCode,
          count: games.length,
        });

        return {
          success: true,
          games,
        };
      } catch (error) {
        console.error("[tRPC] Failed to fetch game list", {
          providerCode: input.providerCode,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new Error(
          `Failed to fetch game list: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get user's game transaction history
   *
   * Requires authentication. Returns paginated list of
   * user's game sessions and bets.
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        fromDate: z.number().optional(), // Unix timestamp in ms
        toDate: z.number().optional(), // Unix timestamp in ms
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      console.info("[tRPC] Fetching user transactions", {
        userId: ctx.user.id,
        page: input.page,
        pageSize: input.pageSize,
      });

      try {
        // Convert timestamps to Dates if provided
        const fromDate = input.fromDate
          ? new Date(input.fromDate)
          : undefined;
        const toDate = input.toDate ? new Date(input.toDate) : undefined;

        // Get transactions from adapter
        const result = await gameAdapter.getTransactions({
          userId: ctx.user.id,
          fromDate: fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: 7 days ago
          toDate: toDate || new Date(),
          page: input.page,
          pageSize: input.pageSize,
        });

        console.info("[tRPC] Transactions fetched successfully", {
          userId: ctx.user.id,
          count: result.records.length,
          totalCount: result.totalCount,
        });

        return {
          success: true,
          transactions: result.records,
          pagination: {
            totalCount: result.totalCount,
            currentPage: result.currentPage,
            pageSize: input.pageSize,
          },
        };
      } catch (error) {
        console.error("[tRPC] Failed to fetch transactions", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new Error(
          `Failed to fetch transactions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get user's game session history
   *
   * Requires authentication. Returns paginated list of
   * user's game sessions with totals.
   */
  getGameSessions: protectedProcedure
    .input(
      z.object({
        fromDate: z.number().optional(), // Unix timestamp in ms
        toDate: z.number().optional(), // Unix timestamp in ms
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      console.info("[tRPC] Fetching user game sessions", {
        userId: ctx.user.id,
        page: input.page,
        pageSize: input.pageSize,
      });

      try {
        // TODO: Implement session history via repository
        // const result = await gameRepository.getPlayerGameSessions(ctx.user.id, {
        //   fromDate: input.fromDate ? new Date(input.fromDate) : undefined,
        //   toDate: input.toDate ? new Date(input.toDate) : undefined,
        //   page: input.page,
        //   pageSize: input.pageSize,
        // });

        console.warn("[tRPC] Game sessions not yet implemented", {
          userId: ctx.user.id,
        });

        // Mock response for now
        return {
          success: true,
          sessions: [],
          pagination: {
            totalCount: 0,
            currentPage: input.page,
            pageSize: input.pageSize,
          },
        };
      } catch (error) {
        console.error("[tRPC] Failed to fetch game sessions", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new Error(
          `Failed to fetch game sessions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  // ========================================================================
  // INTERNAL/ADMIN OPERATIONS
  // ========================================================================

  /**
   * Process game callback (internal use by webhook)
   *
   * Public endpoint but should only be called from webhook handler.
   * Processes bet settlement callbacks from Game API.
   */
  processCallback: publicProcedure
    .input(
      z.object({
        agencyUid: z.string(),
        timestamp: z.string(),
        payload: z.string(), // Encrypted callback data
      })
    )
    .mutation(async ({ input }) => {
      console.info("[tRPC] Processing game callback", {
        agencyUid: input.agencyUid,
        timestamp: input.timestamp,
      });

      try {
        // TODO: Implement callback processing via adapter
        // This would decrypt the payload and process the bet/win
        //
        // const result = await gameAdapter.handleCallback(callbackData);

        console.warn("[tRPC] Callback processing not yet implemented");

        // Mock response for now
        return {
          success: true,
          code: 0,
          msg: "",
        };
      } catch (error) {
        console.error("[tRPC] Callback processing failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        // Return error (triggers Game API retry)
        return {
          success: false,
          code: 1,
          msg: error instanceof Error ? error.message : "Processing failed",
        };
      }
    }),

  /**
   * Reconcile game transactions (admin only)
   *
   * Requires admin role. Reconciles Game API transactions
   * for a specific date to identify any discrepancies.
   */
  reconcileTransactions: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.info("[tRPC] Reconciling transactions", {
        userId: ctx.user.id,
        date: input.date,
      });

      // TODO: Check if user has admin role
      // if (ctx.user.role !== "admin") {
      //   throw new Error("Unauthorized: Admin role required");
      // }

      try {
        // TODO: Implement reconciliation via repository
        // const result = await gameRepository.reconcileGameTransactions(
        //   new Date(input.date)
        // );

        console.warn("[tRPC] Transaction reconciliation not yet implemented");

        // Mock response for now
        return {
          success: true,
          reconciliation: {
            date: new Date(input.date),
            totalCallbacks: 0,
            totalBets: 0,
            totalWins: 0,
            totalAmount: 0,
            discrepancies: [],
          },
        };
      } catch (error) {
        console.error("[tRPC] Reconciliation failed", {
          userId: ctx.user.id,
          date: input.date,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new Error(
          `Reconciliation failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
});
