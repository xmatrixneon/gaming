/**
 * Authentication Router
 * tRPC procedures for phone/SMS authentication
 *
 * SIGN-UP METHOD: Phone number + OTP (SMS verification)
 *
 * NOTE: Email/password sign-up is DISABLED. Existing users can still
 * set/change passwords for account security after signing up via phone.
 *
 * Cookie-setting operations (verifyPhoneNumber, signInWithPhone) must call
 * authClient directly from the browser — tRPC server responses cannot forward
 * Set-Cookie headers back to the browser's cookie jar.
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle";
import { user } from "@/drizzle/schema";

// ============================================================================
// AUTH ROUTER
// ============================================================================

export const authRouter = router({
  // ============================================================================
  // PHONE/SMS AUTHENTICATION
  // ============================================================================

  /**
   * Check if phone number is already registered.
   * Used in signup to prevent duplicate registrations before sending an OTP.
   */
  checkPhoneNumber: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number. Use format: +91XXXXXXXXXX"),
    }))
    .mutation(async ({ input }) => {
      const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.phoneNumber, input.phoneNumber))
        .limit(1);

      return {
        exists: existingUser.length > 0,
        message: existingUser.length > 0
          ? "This phone number is already registered"
          : "Phone number is available",
      };
    }),

  /**
   * Send OTP to phone number for signup.
   * Prevents re-registering a verified number. Cleans up abandoned unverified
   * accounts so a user can retry signup with the same number.
   */
  sendPhoneOTP: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number. Use format: +91XXXXXXXXXX"),
    }))
    .mutation(async ({ input }) => {
      const existingUsers = await db
        .select({ id: user.id, phoneNumberVerified: user.phoneNumberVerified })
        .from(user)
        .where(eq(user.phoneNumber, input.phoneNumber))
        .limit(1);

      const existingUser = existingUsers[0];

      if (existingUser?.phoneNumberVerified) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This phone number is already registered. Please sign in instead.",
        });
      }

      // Clean up abandoned unverified account so signup can restart cleanly.
      if (existingUser && !existingUser.phoneNumberVerified) {
        await db.delete(user).where(eq(user.id, existingUser.id));
      }

      await auth.api.sendPhoneNumberOTP({
        body: { phoneNumber: input.phoneNumber },
      });

      return { success: true };
    }),

  /**
   * Set password for the authenticated user.
   * Called after phone verification during signup to create the credential
   * account needed for phone + password sign-in.
   */
  setUserPassword: protectedProcedure
    .input(z.object({
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      await auth.api.setPassword({
        body: { newPassword: input.newPassword },
        headers: ctx.headers,
      });
      return { success: true };
    }),

  /**
   * Request a password-reset OTP sent to the user's phone.
   */
  requestPasswordResetPhone: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number. Use format: +91XXXXXXXXXX"),
    }))
    .mutation(async ({ input }) => {
      await auth.api.requestPasswordResetPhoneNumber({ body: input });
      return { success: true };
    }),

  /**
   * Reset password using the OTP received on the user's phone.
   */
  resetPasswordPhone: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian mobile number. Use format: +91XXXXXXXXXX"),
      otp: z.string().length(6, "OTP must be 6 digits"),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ input }) => {
      await auth.api.resetPasswordPhoneNumber({ body: input });
      return { success: true };
    }),

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Change password for the authenticated user.
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      await auth.api.changePassword({
        body: input,
        headers: ctx.headers,
      });
      return { success: true };
    }),
});

export type AuthRouter = typeof authRouter;
