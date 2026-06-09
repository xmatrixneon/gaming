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
import { api, useTRPCClient } from "@/lib/trpc/client";
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
  const trpcClient = useTRPCClient();

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
   * Check if phone number is already registered
   * Prevents duplicate signups and saves SMS costs
   */
  const checkPhoneNumber = async (phoneNumber: string) => {
    try {
      // Use tRPC client for proper type safety and error handling
      const result = await trpcClient.auth.checkPhoneNumber.mutate({
        phoneNumber,
      });

      return result;
    } catch (err) {
      return {
        exists: false,
        message: "Unable to check phone number availability",
      };
    }
  };

  /**
   * Send OTP to phone number
   * Uses tRPC mutation with server-side duplicate prevention
   * Optionally stores password for signup flow
   * @param phoneNumber - Phone number in E.164 format
   * @param password - Optional password (for signup flow)
   * @param isSignin - True for signin flow, false for signup flow
   */
  const sendPhoneOTP = async (phoneNumber: string, password?: string, isSignin?: boolean) => {
    try {
      // Use tRPC client instead of Better Auth client directly
      // This ensures our server-side duplicate prevention runs
      const result = await trpcClient.auth.sendPhoneOTP.mutate({
        phoneNumber,
        password, // Pass password for signup flow (stored temporarily in Redis)
        isSignin, // Pass true for signin, false/undefined for signup
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to send OTP",
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (err) {
      // Check for TRPCError with user-friendly message
      let errorMessage = "Failed to send OTP";
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Verify phone number with OTP
   * Uses tRPC mutation for server-side validation and consistent error handling
   * Session state will automatically update via useSession hook
   * Optionally sets password immediately after verification (server-side)
   */
  const verifyPhoneNumber = async (params: {
    phoneNumber: string;
    code: string;
    disableSession?: boolean;
    updatePhoneNumber?: boolean;
    password?: string; // Optional password to set after verification
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.verifyPhoneNumber.mutate({
        phoneNumber: params.phoneNumber,
        code: params.code,
        disableSession: params.disableSession,
        updatePhoneNumber: params.updatePhoneNumber,
        password: params.password, // Pass password to set after verification
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Verification failed",
        };
      }

      // Session state will update automatically via useSession hook
      // No need to manually refetch

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const signInWithPhone = async (params: {
    phoneNumber: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.signInWithPhone.mutate({
        phoneNumber: params.phoneNumber,
        password: params.password,
        rememberMe: params.rememberMe,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Sign in failed",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const requestPasswordResetPhone = async (phoneNumber: string) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.requestPasswordResetPhone.mutate({
        phoneNumber,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to request password reset",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const resetPasswordPhone = async (params: {
    phoneNumber: string;
    otp: string;
    newPassword: string;
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.resetPasswordPhone.mutate({
        phoneNumber: params.phoneNumber,
        otp: params.otp,
        newPassword: params.newPassword,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to reset password",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const signUp = async (params: {
    email: string;
    password: string;
    name?: string;
    username?: string;
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.signUp.mutate({
        email: params.email,
        password: params.password,
        name: params.name,
        username: params.username,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Sign up failed",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const signIn = async (params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.signIn.mutate({
        email: params.email,
        password: params.password,
        rememberMe: params.rememberMe,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Sign in failed",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const sendVerificationEmail = async (email: string) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.sendVerificationEmail.mutate({
        email,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to send verification email",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const verifyEmail = async (params: { token: string }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.verifyEmail.mutate({
        token: params.token,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to verify email",
        };
      }

      return {
        success: true,
        data: result.data,
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
   * Uses tRPC mutation for server-side validation
   */
  const changePassword = async (params: {
    currentPassword: string;
    newPassword: string;
  }) => {
    try {
      // Use tRPC client for server-side validation
      const result = await trpcClient.auth.changePassword.mutate({
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to change password",
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to change password",
      };
    }
  };

  /**
   * Set password for authenticated user
   * Uses tRPC server-side validation
   * Call this after phone verification when user is logged in
   * Creates the credential account needed for phone + password signin
   */
  const setUserPassword = async (newPassword: string) => {
    try {
      const result = await trpcClient.auth.setUserPassword.mutate({
        newPassword,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to set password",
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to set password",
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
    checkPhoneNumber,
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
    setUserPassword,

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
