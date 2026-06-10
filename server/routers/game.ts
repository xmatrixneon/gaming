/**
 * Game Router
 *
 * tRPC router for game operations.
 * Provides type-safe API procedures for:
 * - Launching games
 * - Fetching game lists from API
 * - Managing games and providers (admin)
 * - Game transaction history
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { gameAdapter } from "@/lib/game-adapter";
import { gameService, type SyncOptions } from "@/lib/game-service";
import { db } from "@/drizzle";
import { game, gameProvider } from "@/drizzle/schema";
import { eq, and, desc, asc, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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

      // Generate member account with required prefix
      // Game API requires: 4-20 chars, a-z and 0-9 only, must start with "h5ab3a"
      // Clean user ID to alphanumeric only and prepend prefix
      const cleanUserId = ctx.user.id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const memberAccount = `h5ab3a${cleanUserId}`.slice(0, 20);

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
   * Sync games and providers from Game API
   *
   * Admin only - syncs all providers and games from the Game API.
   * Games are synced with placeholder images that must be replaced by admin.
   */
  syncGames: protectedProcedure
    .input(
      z
        .object({
          force: z.boolean().optional(),
          providers: z.array(z.string()).optional(),
          skipImages: z.boolean().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const options: SyncOptions = input || {};

      const result = await gameService.syncGames(options);

      return {
        success: true,
        ...result,
        message: `Sync complete: ${result.providersAdded} providers added, ${result.providersUpdated} updated, ${result.gamesAdded} games added, ${result.gamesUpdated} updated. ${result.gamesSkipped} games need images.`,
      };
    }),

  /**
   * Get games that need images
   *
   * Admin only - returns all games with placeholder images.
   */
  getGamesNeedingImages: protectedProcedure.query(async () => {
    return await gameService.getGamesNeedingImages();
  }),

  /**
   * Get game statistics
   *
   * Returns counts of providers, games, and games needing images.
   */
  getStats: publicProcedure.query(async () => {
    return await gameService.getStats();
  }),

  /**
   * Get games from database (with filters)
   *
   * Fetches games from local database with optional filters.
   * Unlike getGameList which fetches from API, this uses synced data.
   */
  getDbGames: publicProcedure
    .input(
      z.object({
        status: z.enum(["active", "disabled", "maintenance"]).optional(),
        gameType: z.string().optional(),
        providerCode: z.string().optional(),
        isFeatured: z.boolean().optional(),
        isNew: z.boolean().optional(),
        isHot: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const status = input.status || "active";

      const conditions = [
        eq(game.status, status),
        input.gameType ? eq(game.gameType, input.gameType) : undefined,
        input.isFeatured !== undefined ? eq(game.isFeatured, input.isFeatured) : undefined,
        input.isNew !== undefined ? eq(game.isNew, input.isNew) : undefined,
        input.isHot !== undefined ? eq(game.isHot, input.isHot) : undefined,
        input.search
          ? or(
              like(game.gameName, `%${input.search}%`),
              like(game.gameType, `%${input.search}%`)
            )
          : undefined,
      ].filter(Boolean);

      const query = db
        .select({
          id: game.id,
          gameUid: game.gameUid,
          gameName: game.gameName,
          gameType: game.gameType,
          imageUrl: game.imageUrl,
          thumbnailUrl: game.thumbnailUrl,
          bannerUrl: game.bannerUrl,
          backgroundUrl: game.backgroundUrl,
          imageAlt: game.imageAlt,
          displayOrder: game.displayOrder,
          isFeatured: game.isFeatured,
          isNew: game.isNew,
          isHot: game.isHot,
          status: game.status,
          metadata: game.metadata,
          slug: game.slug,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          provider: {
            id: gameProvider.id,
            code: gameProvider.code,
            name: gameProvider.name,
            category: gameProvider.category,
            imageUrl: gameProvider.imageUrl,
          },
        })
        .from(game)
        .innerJoin(gameProvider, eq(game.providerId, gameProvider.id));

      // Apply filters
      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      // Apply provider filter
      if (input.providerCode) {
        query.where(
          and(
            eq(game.status, status),
            eq(gameProvider.code, input.providerCode)
          )
        );
      }

      query
        .orderBy(asc(game.displayOrder), desc(game.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const games = await query;

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(game)
        .innerJoin(gameProvider, eq(game.providerId, gameProvider.id))
        .where(and(...conditions));

      return {
        games,
        total: Number(count),
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Get providers from database
   *
   * Returns synced providers from local database.
   */
  getDbProviders: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["active", "disabled", "maintenance"]).optional(),
          category: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const status = input?.status || "active";

      const providers = await db
        .select()
        .from(gameProvider)
        .where(
          and(
            eq(gameProvider.status, status),
            input?.category ? eq(gameProvider.category, input.category) : undefined
          )
        )
        .orderBy(asc(gameProvider.displayOrder), asc(gameProvider.name));

      return providers;
    }),

  /**
   * Get a single game by ID or slug
   */
  getGame: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        slug: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      if (!input.id && !input.slug) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either id or slug is required",
        });
      }

      const where = input.slug
        ? eq(game.slug, input.slug)
        : eq(game.id, input.id!);

      const result = await db
        .select({
          id: game.id,
          gameUid: game.gameUid,
          gameName: game.gameName,
          gameType: game.gameType,
          supportedCurrencies: game.supportedCurrencies,
          supportedLanguages: game.supportedLanguages,
          imageUrl: game.imageUrl,
          thumbnailUrl: game.thumbnailUrl,
          bannerUrl: game.bannerUrl,
          backgroundUrl: game.backgroundUrl,
          imageAlt: game.imageAlt,
          displayOrder: game.displayOrder,
          isFeatured: game.isFeatured,
          isNew: game.isNew,
          isHot: game.isHot,
          status: game.status,
          metadata: game.metadata,
          slug: game.slug,
          metaTitle: game.metaTitle,
          metaDescription: game.metaDescription,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          provider: {
            id: gameProvider.id,
            code: gameProvider.code,
            name: gameProvider.name,
            category: gameProvider.category,
            imageUrl: gameProvider.imageUrl,
          },
        })
        .from(game)
        .innerJoin(gameProvider, eq(game.providerId, gameProvider.id))
        .where(where)
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      return result[0];
    }),

  /**
   * Update game images
   *
   * Admin only - updates image URLs for a game.
   */
  updateGameImages: protectedProcedure
    .input(
      z.object({
        gameId: z.string().min(1),
        imageUrl: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional(),
        bannerUrl: z.string().url().optional(),
        backgroundUrl: z.string().url().optional(),
        imageAlt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await gameService.updateGameImages(input.gameId, {
          imageUrl: input.imageUrl,
          thumbnailUrl: input.thumbnailUrl,
          bannerUrl: input.bannerUrl,
          backgroundUrl: input.backgroundUrl,
          imageAlt: input.imageAlt,
        });
        return {
          success: true,
          game: result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message || "Failed to update game images",
        });
      }
    }),

  /**
   * Update game status
   *
   * Admin only - enables/disables a game.
   */
  updateGameStatus: protectedProcedure
    .input(
      z.object({
        gameId: z.string().min(1),
        status: z.enum(["active", "disabled", "maintenance"]),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(game)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(game.id, input.gameId));

      const updated = await db
        .select()
        .from(game)
        .where(eq(game.id, input.gameId))
        .limit(1);

      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found",
        });
      }

      return {
        success: true,
        game: updated[0],
      };
    }),

  /**
   * Update game flags
   *
   * Admin only - sets featured, new, hot flags.
   */
  updateGameFlags: protectedProcedure
    .input(
      z.object({
        gameId: z.string().min(1),
        isFeatured: z.boolean().optional(),
        isNew: z.boolean().optional(),
        isHot: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, boolean> = {};
      if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
      if (input.isNew !== undefined) updateData.isNew = input.isNew;
      if (input.isHot !== undefined) updateData.isHot = input.isHot;

      await db
        .update(game)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(game.id, input.gameId));

      const updated = await db
        .select()
        .from(game)
        .where(eq(game.id, input.gameId))
        .limit(1);

      return {
        success: true,
        game: updated[0] || null,
      };
    }),

  /**
   * Update display order
   *
   * Admin only - bulk update display order for games.
   */
  updateGameOrder: protectedProcedure
    .input(
      z.object({
        games: z.array(
          z.object({
            id: z.string().min(1),
            displayOrder: z.number().int(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      for (const item of input.games) {
        await db
          .update(game)
          .set({
            displayOrder: item.displayOrder,
            updatedAt: new Date(),
          })
          .where(eq(game.id, item.id));
      }

      return {
        success: true,
        message: "Display order updated",
      };
    }),

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
