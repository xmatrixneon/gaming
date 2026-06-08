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
   * Update user balance (internal use - requires admin permissions)
   * TODO: Add admin role check
   */
  updateBalance: protectedProcedure
    .input(z.object({
      balance: z.string().regex(/^\d+(\.\d{1,8})?$/, "Invalid balance format"),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const updatedUser = await db
          .update(user)
          .set({ balance: input.balance })
          .where(eq(user.id, ctx.user.id))
          .returning();

        return {
          success: true,
          data: updatedUser[0],
        };
      } catch (error) {
        console.error("[USER] Failed to update balance:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update balance",
        };
      }
    }),

  /**
   * Update VIP level (internal use - requires admin permissions)
   * TODO: Add admin role check
   */
  updateVipLevel: protectedProcedure
    .input(z.object({
      vipLevel: z.enum(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const updatedUser = await db
          .update(user)
          .set({ vipLevel: input.vipLevel })
          .where(eq(user.id, ctx.user.id))
          .returning();

        return {
          success: true,
          data: updatedUser[0],
        };
      } catch (error) {
        console.error("[USER] Failed to update VIP level:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update VIP level",
        };
      }
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
