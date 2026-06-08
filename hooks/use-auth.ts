"use client";

/**
 * Better Auth Integration Hook
 * Follows Better Auth best practices for Next.js + tRPC:
 * - Auth operations: Better Auth client (sets cookies)
 * - Session state: Better Auth useSession hook (reactive)
 * - Business logic: tRPC (reads cookies from headers)
 *
 * Features:
 * - Phone/SMS authentication
 * - Google OAuth
 * - Email authentication
 * - Reactive session management
 */

import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified: boolean;
  name?: string;
  username?: string;
  image?: string;
  balance: string;
  vipLevel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// AUTH HOOK
// ============================================================================

/**
 * Main authentication hook
 * Provides authentication state and methods
 * Uses Better Auth's reactive useSession for real-time session updates
 * Better Auth handles SSR/hydration automatically
 */
export function useAuth() {
  const queryClient = useQueryClient();

  // ============================================================================
  // SESSION STATE - Better Auth Reactive Hook
  // ============================================================================
  // Better Auth handles SSR/hydration automatically
  // No custom client-side checks needed
  const sessionResult = authClient.useSession();

  const session = sessionResult.data;
  const sessionLoading = sessionResult.isPending;
  const sessionError = sessionResult.error;

  const isAuthenticated = !!session;
  const user = session?.user as UserProfile | null;

  // ============================================================================
  // SIGN OUT
  // ============================================================================

  const signOut = async () => {
    try {
      await authClient.signOut();
      // Session state will update automatically via useSession hook
    } catch (err) {
      console.error("[AUTH] Failed to sign out:", err);
    }
  };

  // ============================================================================
  // PHONE/SMS AUTHENTICATION
  // ============================================================================

  /**
   * Send OTP to phone number
   * Uses Better Auth client directly
   */
  const sendPhoneOTP = async (phoneNumber: string) => {
    try {
      const { data, error } = await authClient.phoneNumber.sendOtp({
        phoneNumber: phoneNumber as any,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to send OTP",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send OTP",
      };
    }
  };

  /**
   * Verify phone number with OTP
   * Uses Better Auth client directly to ensure session cookies are set
   * Session state will automatically update via useSession hook
   */
  const verifyPhoneNumber = async (params: {
    phoneNumber: string;
    code: string;
    disableSession?: boolean;
    updatePhoneNumber?: boolean;
  }) => {
    try {
      const { data, error } = await authClient.phoneNumber.verify({
        phoneNumber: params.phoneNumber as any,
        code: params.code as any,
        disableSession: params.disableSession,
        updatePhoneNumber: params.updatePhoneNumber,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Verification failed",
        };
      }

      // Session state will update automatically via useSession hook
      // No need to manually refetch

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Verification failed",
      };
    }
  };

  /**
   * Sign in with phone number and password
   */
  const signInWithPhone = async (params: {
    phoneNumber: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      const { data, error } = await authClient.signIn.phoneNumber({
        phoneNumber: params.phoneNumber as any,
        password: params.password,
        rememberMe: params.rememberMe,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Sign in failed",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Sign in failed",
      };
    }
  };

  /**
   * Request password reset via phone
   */
  const requestPasswordResetPhone = async (phoneNumber: string) => {
    try {
      const { data, error } = await authClient.phoneNumber.requestPasswordReset({
        phoneNumber: phoneNumber as any,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to request password reset",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to request password reset",
      };
    }
  };

  /**
   * Reset password with OTP
   */
  const resetPasswordPhone = async (params: {
    phoneNumber: string;
    otp: string;
    newPassword: string;
  }) => {
    try {
      const { data, error } = await authClient.phoneNumber.resetPassword({
        phoneNumber: params.phoneNumber as any,
        otp: params.otp as any,
        newPassword: params.newPassword,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to reset password",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to reset password",
      };
    }
  };

  // ============================================================================
  // EMAIL AUTHENTICATION
  // ============================================================================

  /**
   * Sign up with email and password
   */
  const signUp = async (params: {
    email: string;
    password: string;
    name?: string;
    username?: string;
  }) => {
    try {
      const { data, error } = await authClient.signUp.email({
        email: params.email,
        password: params.password,
        name: params.name || params.email.split('@')[0],
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Sign up failed",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Sign up failed",
      };
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      const { data, error } = await authClient.signIn.email({
        email: params.email,
        password: params.password,
        rememberMe: params.rememberMe,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Sign in failed",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Sign in failed",
      };
    }
  };

  /**
   * Send email verification
   */
  const sendVerificationEmail = async (email: string) => {
    try {
      const { data, error } = await authClient.sendVerificationEmail({
        email,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to send verification email",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send verification email",
      };
    }
  };

  /**
   * Verify email with token
   */
  const verifyEmail = async (params: { token: string }) => {
    try {
      const { data, error } = await authClient.verifyEmail({
        query: {
          token: params.token,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to verify email",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to verify email",
      };
    }
  };

  // ============================================================================
  // GOOGLE OAUTH
  // ============================================================================

  /**
   * Sign in with Google OAuth
   * Redirects to Google sign-in page
   */
  const signInWithGoogle = () => {
    // Better Auth handles OAuth via callback
    // Redirect to the Better Auth OAuth endpoint
    window.location.href = "/api/auth/sign-in/google";
  };

  /**
   * Get Google OAuth URL metadata
   */
  const googleOAuthConfig = api.auth.getGoogleOAuthURL.useQuery();

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Change password (authenticated)
   */
  const changePassword = async (params: {
    currentPassword: string;
    newPassword: string;
  }) => {
    try {
      const { data, error } = await authClient.changePassword({
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to change password",
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to change password",
      };
    }
  };

  // ============================================================================
  // RETURN AUTH STATE AND METHODS
  // ============================================================================

  return {
    // State
    isAuthenticated,
    user,
    isLoading: sessionLoading,
    error: sessionError as Error | null,

    // Session management (legacy compatibility)
    signOut,

    // Phone/SMS authentication
    sendPhoneOTP,
    verifyPhoneNumber,
    signInWithPhone,
    requestPasswordResetPhone,
    resetPasswordPhone,

    // Email authentication
    signUp,
    signIn,
    sendVerificationEmail,
    verifyEmail,

    // Google OAuth
    signInWithGoogle,
    googleOAuthConfig,

    // Password management
    changePassword,

    // 2FA (commented out - requires @better-auth/two-factor plugin)
    // enable2FA,
    // verify2FA,
    // disable2FA,
  };
}

// ============================================================================
// USER PROFILE HOOK
// ============================================================================

/**
 * User profile management hook
 * Provides user profile operations via tRPC
 */
export function useUserProfile() {
  const profile = api.user.getProfile.useQuery();

  const updateProfile = api.user.updateProfile.useMutation();

  const updateEmail = api.user.updateEmail.useMutation();

  const updatePhoneNumber = api.user.updatePhoneNumber.useMutation();

  const removePhoneNumber = api.user.removePhoneNumber.useMutation();

  const updateBalance = api.user.updateBalance.useMutation();

  const updateVipLevel = api.user.updateVipLevel.useMutation();

  const deleteAccount = api.user.deleteAccount.useMutation();

  const sessions = api.user.listSessions.useQuery();

  const revokeSession = api.user.revokeSession.useMutation();

  const revokeAllSessions = api.user.revokeAllSessions.useMutation();

  return {
    // State
    profile: profile.data,
    isLoading: profile.isLoading,
    sessions: sessions.data,

    // Profile management
    updateProfile,
    updateEmail,
    updatePhoneNumber,
    removePhoneNumber,

    // Casino-specific
    updateBalance,
    updateVipLevel,

    // Account management
    deleteAccount,
    revokeSession,
    revokeAllSessions,
  };
}
