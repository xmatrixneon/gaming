/**
 * Authentication Router
 * tRPC procedures for phone/SMS and Google OAuth authentication
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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

  // ============================================================================
  // PHONE/SMS AUTHENTICATION
  // ============================================================================

  /**
   * Send OTP to phone number
   */
  sendPhoneOTP: publicProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format. Use E.164: +1234567890"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.sendPhoneNumberOTP({
          body: input,
        });

        return { success: true, data: result };
      } catch (error) {
        console.error("[AUTH] Failed to send OTP:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send OTP",
        };
      }
    }),

  /**
   * Verify phone number with OTP
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
        const result = await auth.api.verifyPhoneNumber({
          body: input,
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
        const result = await auth.api.changePassword({
          body: input,
        });

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
