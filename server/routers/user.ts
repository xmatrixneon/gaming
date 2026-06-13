/**
 * User Router
 * tRPC procedures for user profile and preferences management
 */

import { router, protectedProcedure, adminProcedure } from "../trpc";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle";
import { user } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// ============================================================================
// USER ROUTER
// ============================================================================

export const userRouter = router({
  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userProfile = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
      });

      return {
        success: true,
        data: userProfile,
      };
    } catch (error) {
      console.error("[USER] Failed to get profile:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get profile",
        data: ctx.user,
      };
    }
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2).optional(),
      username: z.string().min(3).max(30).optional(),
      image: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await auth.api.updateUser({
        body: input,
        headers: ctx.headers,
      });
      return { success: true, data: result };
    }),

  /**
   * Update user email
   */
  updateEmail: protectedProcedure
    .input(z.object({
      newEmail: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await auth.api.changeEmail({
        body: input,
        headers: ctx.headers,
      });
      return { success: true, data: result };
    }),

  /**
   * Update phone number (requires OTP verification)
   */
  updatePhoneNumber: protectedProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number"),
      code: z.string().length(6, "OTP must be 6 digits"),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await auth.api.verifyPhoneNumber({
        body: { phoneNumber: input.phoneNumber, code: input.code, updatePhoneNumber: true },
        headers: ctx.headers,
      });
      return { success: true, data: result };
    }),

  /**
   * Remove phone number
   */
  removePhoneNumber: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await auth.api.updateUser({
        body: { phoneNumber: null },
        headers: ctx.headers,
      });
      return { success: true, data: result };
    }),

  // ============================================================================
  // CASINO-SPECIFIC OPERATIONS
  // ============================================================================

  /**
   * Update user balance — admin only.
   * Delegates to walletService for atomicity, audit trail, and cache invalidation.
   */
  updateBalance: adminProcedure
    .input(z.object({
      // Delta in paisa (positive = credit, negative = debit). Integer only.
      delta: z.string().regex(/^-?\d+$/, "Delta must be a whole number (paisa)"),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const { walletService } = await import('@/lib/wallet-service');
      const result = await walletService.updateBalanceAtomic(
        ctx.user.id,
        BigInt(input.delta),
        'adjustment',
        { reason: input.reason, adjustedBy: ctx.user.id },
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to update balance',
        });
      }

      return { success: true, transactionId: result.transactionId };
    }),

  /**
   * Update VIP level for a target user — admin only.
   */
  updateVipLevel: adminProcedure
    .input(z.object({
      targetUserId: z.string(),
      vipLevel: z.enum(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]),
    }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(user)
        .set({ vipLevel: input.vipLevel })
        .where(eq(user.id, input.targetUserId))
        .returning({ id: user.id, vipLevel: user.vipLevel });

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return { success: true, userId: updated.id, vipLevel: updated.vipLevel };
    }),

  // ============================================================================
  // ACCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Delete user account
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      password: z.string().min(1, "Password is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      await auth.api.deleteUser({
        body: { password: input.password },
        headers: ctx.headers,
      });
      return { success: true };
    }),

  /**
   * List user sessions
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await auth.api.listSessions({ headers: ctx.headers });
    return { success: true, data: sessions };
  }),

  /**
   * Revoke a specific session by token
   */
  revokeSession: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await auth.api.revokeSession({
        body: { token: input.token },
        headers: ctx.headers,
      });
      return { success: true };
    }),

  /**
   * Revoke all sessions (sign out from all devices)
   */
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    await auth.api.revokeOtherSessions({ headers: ctx.headers });
    return { success: true };
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserRouter = typeof userRouter;
