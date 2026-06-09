/**
 * Wallet Router
 * tRPC procedures for wallet operations and balance management
 */

import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/drizzle";
import { transaction, user } from "@/drizzle/schema";
import { walletService } from "@/lib/wallet-service";
import { fraudDetection } from "@/lib/fraud-detection";

// ============================================================================
// WALLET ROUTER
// ============================================================================

export const walletRouter = router({
  // =========================================================================
  // BALANCE OPERATIONS
  // =========================================================================

  /**
   * Get current balance
   * Returns user's current wallet balance with metadata
   */
  getBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const balance = await walletService.getBalance(ctx.user.id);

      // Get counters for display
      const counters = await fraudDetection.getCounters(ctx.user.id);

      return {
        balance: balance.toString(),
        currency: 'USD', // TODO: Get from user preferences
        counters: {
          withdrawalsRemaining: 3 - counters.withdrawalCount,
          withdrawalsResetIn: counters.withdrawalResetIn,
          betsRemaining: 10 - counters.betCount,
          betsResetIn: counters.betResetIn,
        },
      };
    }),

  /**
   * Get balance history
   * Returns transactions that affected balance
   */
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const transactions = await db
        .select({
          id: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amount: transaction.amount,
          balanceBefore: transaction.balanceBefore,
          balanceAfter: transaction.balanceAfter,
          metadata: transaction.metadata,
          createdAt: transaction.createdAt,
        })
        .from(transaction)
        .where(eq(transaction.userId, ctx.user.id))
        .orderBy(desc(transaction.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return transactions;
    }),

  // =========================================================================
  // ADMIN OPERATIONS
  // =========================================================================

  /**
   * Manual balance adjustment (admin only)
   * Allows manual addition/subtraction of funds
   * TODO: Add admin role check
   */
  adjustBalance: protectedProcedure
    .input(z.object({
      userId: z.string(),
      amount: z.string().regex(/^-?\d+(\.\d{1,8})?$/),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Verify admin role
      // For now, allow any authenticated user (for testing)

      const delta = BigInt(input.amount);

      if (delta === 0n) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Amount cannot be zero',
        });
      }

      // Verify user exists
      const userRecord = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1);

      if (!userRecord[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if adjustment would result in negative balance
      const currentBalance = await walletService.getBalance(input.userId);
      if (delta < 0n && currentBalance < -delta) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Adjustment would result in negative balance',
        });
      }

      const result = await walletService.updateBalanceAtomic(
        input.userId,
        delta,
        'adjustment',
        {
          reason: input.reason,
          adjustedBy: ctx.user.id,
        }
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to adjust balance',
        });
      }

      return {
        success: true,
        transactionId: result.transactionId,
        newBalance: (currentBalance + delta).toString(),
        message: 'Balance adjusted successfully',
      };
    }),

  /**
   * Get user balance (admin only)
   * Allows admins to check any user's balance
   * TODO: Add admin role check
   */
  getUserBalance: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input }) => {
      // TODO: Verify admin role
      // For now, allow any authenticated user (for testing)

      const userRecord = await db
        .select({
          id: user.id,
          balance: user.balance,
          username: user.username,
        })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1);

      if (!userRecord[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return {
        userId: userRecord[0].id,
        username: userRecord[0].username,
        balance: userRecord[0].balance.toString(),
      };
    }),

  // =========================================================================
  // GAME AGGREGATOR ENDPOINTS
  // =========================================================================

  /**
   * Debit (bet) - called by game aggregator
   * This endpoint should be authenticated with API key, not session
   * TODO: Add API key authentication
   */
  aggregatorDebit: protectedProcedure
    .input(z.object({
      userId: z.string(),
      sessionId: z.string(),
      amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
      gameRoundId: z.string(),
      transactionRef: z.string(),
      gameCode: z.string().optional(),
      provider: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { aggregatorAdapter } = await import("@/lib/aggregator-adapter");

      const result = await aggregatorAdapter.debit({
        userId: input.userId,
        sessionId: input.sessionId,
        amount: BigInt(input.amount),
        gameRoundId: input.gameRoundId,
        transactionRef: input.transactionRef,
        gameCode: input.gameCode,
        provider: input.provider,
      });

      return result;
    }),

  /**
   * Credit (win) - called by game aggregator
   * This endpoint should be authenticated with API key, not session
   * TODO: Add API key authentication
   */
  aggregatorCredit: protectedProcedure
    .input(z.object({
      userId: z.string(),
      sessionId: z.string(),
      amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
      gameRoundId: z.string(),
      transactionRef: z.string(),
      gameCode: z.string().optional(),
      provider: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { aggregatorAdapter } = await import("@/lib/aggregator-adapter");

      const result = await aggregatorAdapter.credit({
        userId: input.userId,
        sessionId: input.sessionId,
        amount: BigInt(input.amount),
        gameRoundId: input.gameRoundId,
        transactionRef: input.transactionRef,
        gameCode: input.gameCode,
        provider: input.provider,
      });

      return result;
    }),

  /**
   * Get balance for aggregator
   * This endpoint should be authenticated with API key, not session
   * TODO: Add API key authentication
   */
  aggregatorGetBalance: protectedProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input }) => {
      const { aggregatorAdapter } = await import("@/lib/aggregator-adapter");

      const balance = await aggregatorAdapter.getBalance(input.userId);

      return {
        balance: balance.toString(),
      };
    }),

  /**
   * End game session
   * Marks session as completed
   */
  aggregatorEndSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { aggregatorAdapter } = await import("@/lib/aggregator-adapter");

      const result = await aggregatorAdapter.endSession(input.sessionId);

      return result;
    }),
});
