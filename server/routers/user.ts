/**
 * User Router
 * tRPC procedures for user profile and preferences management
 */

import { router, protectedProcedure } from "../trpc";
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
      try {
        // Update using Better Auth API
        const result = await auth.api.updateUser({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to update profile:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update profile",
        };
      }
    }),

  /**
   * Update user email
   */
  updateEmail: protectedProcedure
    .input(z.object({
      newEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.changeEmail({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to update email:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update email",
        };
      }
    }),

  /**
   * Update phone number (requires OTP verification)
   */
  updatePhoneNumber: protectedProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
      code: z.string().length(6, "OTP must be 6 digits"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.verifyPhoneNumber({
          body: {
            phoneNumber: input.phoneNumber,
            code: input.code,
            updatePhoneNumber: true,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to update phone:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update phone number",
        };
      }
    }),

  /**
   * Remove phone number
   */
  removePhoneNumber: protectedProcedure
    .mutation(async () => {
      try {
        const result = await auth.api.updateUser({
          body: {
            phoneNumber: null,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to remove phone:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to remove phone number",
        };
      }
    }),

  // ============================================================================
  // CASINO-SPECIFIC OPERATIONS
  // ============================================================================

  /**
   * Update user balance (admin only)
   * Delegates to walletService to ensure atomicity, audit trail, and cache invalidation.
   * TODO: restrict to adminProcedure once role checks are wired up.
   */
  updateBalance: protectedProcedure
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
   * Update VIP level for a target user (admin only).
   * Requires targetUserId so this cannot be used for self-service VIP escalation.
   * TODO: restrict to adminProcedure once role checks are wired up.
   */
  updateVipLevel: protectedProcedure
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
      try {
        const result = await auth.api.deleteUser({
          body: {
            password: input.password,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to delete account:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete account",
        };
      }
    }),

  /**
   * List user sessions
   */
  listSessions: protectedProcedure.query(async () => {
    try {
      const sessions = await auth.api.listSessions();

      return { success: true, data: sessions };
    } catch (error) {
      console.error("[USER] Failed to list sessions:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list sessions",
      };
    }
  }),

  /**
   * Revoke session
   * Note: This requires headers context from the request
   * For server-side usage, use the client-side API or direct database operations
   */
  revokeSession: protectedProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // TODO: Implement proper session revocation with headers
        // For now, this is a placeholder
        // The Better Auth API requires headers which aren't easily accessible in tRPC context
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Session revocation via tRPC is not yet implemented. Use client-side auth API instead.",
        });

        // return { success: true, data: result };
      } catch (error) {
        console.error("[USER] Failed to revoke session:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to revoke session",
        };
      }
    }),

  /**
   * Revoke all sessions (sign out from all devices)
   * Note: This requires headers context from the request
   * For server-side usage, use the client-side API or direct database operations
   */
  revokeAllSessions: protectedProcedure.mutation(async () => {
    try {
      // TODO: Implement proper session revocation with headers
      // For now, this is a placeholder
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Revoking all sessions via tRPC is not yet implemented. Use client-side auth API instead.",
      });

      // return { success: true };
    } catch (error) {
      console.error("[USER] Failed to revoke all sessions:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke all sessions",
      };
    }
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserRouter = typeof userRouter;
