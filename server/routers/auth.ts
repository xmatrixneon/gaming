/**
 * Authentication Router
 * tRPC procedures for phone/SMS and Google OAuth authentication
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
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
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get current session
   */
  getSession: publicProcedure.query(async ({ ctx }) => {
    return {
      session: ctx.session,
      user: ctx.user,
    };
  }),

  /**
   * Sign out
   */
  signOut: publicProcedure.mutation(async () => {
    // Note: Sign out is handled client-side by clearing cookies
    // Better Auth handles this via POST to /api/auth/sign-out
    return { success: true };
  }),

  /**
   * Check if phone number is already registered
   */
  checkPhoneNumber: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format. Use E.164: +1234567890"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Query database to check if phone number exists
        const existingUser = await db
          .select()
          .from(user)
          .where(eq(user.phoneNumber, input.phoneNumber))
          .limit(1);

        return {
          exists: existingUser.length > 0,
          message: existingUser.length > 0
            ? "This phone number is already registered"
            : "Phone number is available",
        };
      } catch (error) {
        console.error("[AUTH] Failed to check phone number:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check phone number availability",
        });
      }
    }),

  // ============================================================================
  // PHONE/SMS AUTHENTICATION
  // ============================================================================

  /**
   * Send OTP to phone number
   * Includes duplicate phone number prevention at the server level
   * Supports both signup (new users) and signin (existing verified users)
   */
  sendPhoneOTP: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format. Use E.164: +1234567890"),
      password: z.string().min(6, "Password must be at least 6 characters").optional(),
      isSignin: z.boolean().optional().default(false), // true for signin, false for signup
    }))
    .mutation(async ({ input }) => {
      try {
        // =====================================================================
        // CHECK EXISTING USER
        // =====================================================================
        const existingUsers = await db
          .select()
          .from(user)
          .where(eq(user.phoneNumber, input.phoneNumber))
          .limit(1);

        const existingUser = existingUsers[0];

        // =====================================================================
        // SIGNIN FLOW: Send OTP to existing verified users
        // =====================================================================
        if (input.isSignin) {
          if (!existingUser || !existingUser.phoneNumberVerified) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Phone number not found. Please sign up first.",
            });
          }

          // Send OTP for signin (Better Auth allows this for verified users)
          const result = await auth.api.sendPhoneNumberOTP({
            body: { phoneNumber: input.phoneNumber },
          });

          return { success: true, data: result, isSignin: true };
        }

        // =====================================================================
        // SIGNUP FLOW: Prevent duplicate phone numbers
        // =====================================================================
        // If phone number is already verified for another user, block OTP
        if (existingUser && existingUser.phoneNumberVerified) {
          console.log(`[AUTH] Phone number ${input.phoneNumber} already verified for user ${existingUser.id}. Blocking OTP.`);

          // Throw a user-friendly error that will be caught by client
          throw new TRPCError({
            code: "CONFLICT",
            message: "This phone number is already registered. Please sign in instead.",
          });
        }

        // If phone number exists but isn't verified, clean up the old unverified user
        // This allows the user to restart the signup process
        if (existingUser && !existingUser.phoneNumberVerified) {
          console.log(`[AUTH] Phone number ${input.phoneNumber} exists but unverified. Cleaning up old unverified user: ${existingUser.id}`);

          // Delete the unverified user to allow a fresh signup
          await db.delete(user).where(eq(user.id, existingUser.id));
          console.log(`[AUTH] Deleted unverified user to allow retry: ${existingUser.id}`);
        }

        // =====================================================================
        // SEND OTP VIA BETTER AUTH (for signup)
        // =====================================================================
        const result = await auth.api.sendPhoneNumberOTP({
          body: { phoneNumber: input.phoneNumber },
        });

        return { success: true, data: result, isSignin: false };
      } catch (error) {
        console.error("[AUTH] Failed to send OTP:", error);

        // If it's our custom TRPCError, re-throw it as-is
        if (error instanceof TRPCError) {
          return {
            success: false,
            error: error.message,
          };
        }

        // Otherwise, return a generic error
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send OTP",
        };
      }
    }),

  /**
   * Verify phone number with OTP
   * Creates user and session (no password setting - that's Step 3)
   */
  verifyPhoneNumber: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
      code: z.string().length(6, "OTP must be 6 digits"),
      disableSession: z.boolean().optional().default(false),
      updatePhoneNumber: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      try {
        // Verify phone number - creates user and session
        // Session cookies will be set in the response
        const result = await auth.api.verifyPhoneNumber({
          body: {
            phoneNumber: input.phoneNumber,
            code: input.code,
            disableSession: input.disableSession,
            updatePhoneNumber: input.updatePhoneNumber,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to verify phone:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to verify phone number",
        };
      }
    }),

  /**
   * Sign in with phone number and password
   */
  signInWithPhone: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      rememberMe: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.signInPhoneNumber({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to sign in with phone:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to sign in",
        };
      }
    }),

  /**
   * Set password for authenticated user
   * Called after phone verification to create credential account
   * This enables phone + password signin
   *
   * Uses protectedProcedure to ensure session context is available
   * Better Auth's setPassword API requires an active session
   */
  setUserPassword: protectedProcedure
    .input(z.object({
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Import headers dynamically to avoid issues with Next.js headers()
        const { headers } = await import("next/headers");

        // Use Better Auth's internal API with session from request headers
        // protectedProcedure ensures session context is available
        const result = await auth.api.setPassword({
          body: {
            newPassword: input.newPassword,
          },
          // Pass the request headers which include session cookies
          headers: await headers(),
        });

        console.log("[AUTH] Password set successfully via Better Auth API");
        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to set password:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to set password",
        };
      }
    }),

  /**
   * Request password reset via phone
   */
  requestPasswordResetPhone: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.requestPasswordResetPhoneNumber({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to request password reset:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to request password reset",
        };
      }
    }),

  /**
   * Reset password with OTP
   */
  resetPasswordPhone: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
      otp: z.string().length(6, "OTP must be 6 digits"),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.resetPasswordPhoneNumber({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to reset password:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to reset password",
        };
      }
    }),

  // ============================================================================
  // EMAIL AUTHENTICATION
  // ============================================================================

  /**
   * Sign up with email and password
   */
  signUp: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      name: z.string().min(2, "Name must be at least 2 characters").optional(),
      username: z.string().min(3, "Username must be at least 3 characters").optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Validate required fields for Better Auth
        if (!input.email || !input.password) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Email and password are required",
          });
        }

        // Better Auth requires name to be a string, not optional
        // Generate default name if not provided
        const name = input.name || input.email.split('@')[0];

        const result = await auth.api.signUpEmail({
          body: {
            email: input.email,
            password: input.password,
            name,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to sign up:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to sign up",
        };
      }
    }),

  /**
   * Sign in with email and password
   */
  signIn: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(1, "Password is required"),
      rememberMe: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.signInEmail({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to sign in:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to sign in",
        };
      }
    }),

  /**
   * Send email verification
   */
  sendVerificationEmail: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.sendVerificationEmail({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to send verification email:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send verification email",
        };
      }
    }),

  /**
   * Verify email with token
   */
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string().min(1, "Token is required"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Validate required fields
        if (!input.token) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Token is required",
          });
        }

        const result = await auth.api.verifyEmail({
          query: {
            token: input.token,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to verify email:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to verify email",
        };
      }
    }),

  // ============================================================================
  // GOOGLE OAUTH
  // ============================================================================

  /**
   * Generate Google OAuth URL
   */
  getGoogleOAuthURL: publicProcedure
    .input(z.object({
      redirectURI: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
      const redirectURI = input?.redirectURI || `${baseURL}`;

      // Better Auth generates the OAuth URL
      // The client should call: await authClient.signIn.social({ provider: "google" })
      // This procedure provides metadata for UI
      return {
        provider: "google",
        callbackURL: `${baseURL}/api/auth/callback/google`,
        scopes: [
          "openid",
          "profile",
          "email",
        ],
      };
    }),

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Change password (authenticated)
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Import headers dynamically to avoid issues with Next.js headers()
        const { headers } = await import("next/headers");

        // Use Better Auth's internal API with session from request headers
        // protectedProcedure ensures session context is available
        const result = await auth.api.changePassword({
          body: input,
          // Pass the request headers which include session cookies
          headers: await headers(),
        });

        console.log("[AUTH] Password changed successfully via Better Auth API");
        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to change password:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to change password",
        };
      }
    }),

  // ============================================================================
  // 2FA (Two-Factor Authentication)
  // ============================================================================
  // NOTE: 2FA features require the @better-auth/two-factor plugin
  // Uncomment these procedures when the plugin is installed and configured

  // /**
  //  * Enable 2FA
  //  */
  // enable2FA: protectedProcedure
  //   .mutation(async ({ ctx }) => {
  //     try {
  //       const result = await auth.api.enable2FA({
  //         body: {
  //           userId: ctx.user.id,
  //         },
  //       });
  //
  //       return { success: true, data: result };
  //     } catch (error) {
  //       console.error("[AUTH] Failed to enable 2FA:", error);
  //       return {
  //         success: false,
  //         error: error instanceof Error ? error.message : "Failed to enable 2FA",
  //       };
  //     }
  //   }),
  //
  // /**
  //  * Verify 2FA
  //  */
  // verify2FA: protectedProcedure
  //   .input(z.object({
  //     code: z.string().min(1, "Code is required"),
  //   }))
  //   .mutation(async ({ input, ctx }) => {
  //     try {
  //       const result = await auth.api.verify2FA({
  //         body: {
  //           ...input,
  //           userId: ctx.user.id,
  //         },
  //       });
  //
  //       return { success: true, data: result };
  //     } catch (error) {
  //       console.error("[AUTH] Failed to verify 2FA:", error);
  //       return {
  //         success: false,
  //         error: error instanceof Error ? error.message : "Failed to verify 2FA",
  //       };
  //     }
  //   }),
  //
  // /**
  //  * Disable 2FA
  //  */
  // disable2FA: protectedProcedure
  //   .input(z.object({
  //     password: z.string().min(1, "Password is required"),
  //   }))
  //   .mutation(async ({ input, ctx }) => {
  //     try {
  //       const result = await auth.api.disable2FA({
  //         body: {
  //           ...input,
  //           userId: ctx.user.id,
  //         },
  //       });
  //
  //       return { success: true, data: result };
  //     } catch (error) {
  //       console.error("[AUTH] Failed to disable 2FA:", error);
  //       return {
  //         success: false,
  //         error: error instanceof Error ? error.message : "Failed to disable 2FA",
  //       };
  //     }
  //   }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AuthRouter = typeof authRouter;
