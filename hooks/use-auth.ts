"use client";

/**
 * Better Auth Integration Hook
 *
 * Auth operations that must set cookies (signIn, phoneNumber.verify) call
 * authClient directly so the Set-Cookie header reaches the browser.
 *
 * Business-logic operations with server-side validation (sendOTP, setPassword,
 * changePassword, requestPasswordReset, resetPassword) go through tRPC.
 *
 * NOTE: Email/password sign-up is DISABLED. Users sign up via phone + OTP only.
 */

import * as React from "react";
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

export interface LinkedAccount {
  accountId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
  scopes: string[];
}

// ============================================================================
// AUTH HOOK
// ============================================================================

export function useAuth() {
  const queryClient = useQueryClient();
  const trpcClient = useTRPCClient();

  // ── Session state ──────────────────────────────────────────────────────────
  const sessionResult = authClient.useSession();
  const session = sessionResult.data;
  const sessionLoading = sessionResult.isPending;
  const sessionError = sessionResult.error;

  const isAuthenticated = !!session;
  const user = session?.user as UserProfile | null;

  // ── Account / password detection ───────────────────────────────────────────
  const [accounts, setAccounts] = React.useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [accountsError, setAccountsError] = React.useState<Error | null>(null);

  const fetchAccounts = React.useCallback(async () => {
    if (!isAuthenticated) {
      setAccounts([]);
      setAccountsLoading(false);
      setAccountsError(null);
      return;
    }
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const result = await authClient.listAccounts();
      setAccounts((result.data as LinkedAccount[]) || []);
    } catch (err) {
      setAccountsError(err as Error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const hasPassword = accounts.some((a) => a.providerId === "credential");

  // ── Sign out ───────────────────────────────────────────────────────────────

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("[AUTH] Failed to sign out:", err);
    }
  };

  // ── Phone / SMS authentication ─────────────────────────────────────────────

  /**
   * Check whether a phone number is already registered.
   * Used in signup to avoid sending an OTP to an existing user.
   */
  const checkPhoneNumber = async (phoneNumber: string) => {
    try {
      return await trpcClient.auth.checkPhoneNumber.mutate({ phoneNumber });
    } catch {
      return { exists: false, message: "Unable to check phone number availability" };
    }
  };

  /**
   * Send OTP for signup. Includes server-side duplicate-prevention logic.
   */
  const sendPhoneOTP = async (phoneNumber: string) => {
    try {
      await trpcClient.auth.sendPhoneOTP.mutate({ phoneNumber });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send OTP",
      };
    }
  };

  /**
   * Sign in with phone number + password.
   * Calls authClient directly so the session cookie is set in the browser.
   */
  const signInWithPhone = async (params: {
    phoneNumber: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    try {
      const result = await authClient.signIn.phoneNumber({
        phoneNumber: params.phoneNumber,
        password: params.password,
        rememberMe: params.rememberMe ?? true,
      });
      if (result.error) {
        return { success: false, error: result.error.message || "Sign in failed" };
      }
      return { success: true, data: result.data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Sign in failed" };
    }
  };

  /**
   * Request a password-reset OTP sent to the phone number.
   */
  const requestPasswordResetPhone = async (phoneNumber: string) => {
    try {
      await trpcClient.auth.requestPasswordResetPhone.mutate({ phoneNumber });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to request password reset",
      };
    }
  };

  /**
   * Reset password using the OTP received on the phone.
   */
  const resetPasswordPhone = async (params: {
    phoneNumber: string;
    otp: string;
    newPassword: string;
  }) => {
    try {
      await trpcClient.auth.resetPasswordPhone.mutate(params);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to reset password",
      };
    }
  };

  // ── Password management ────────────────────────────────────────────────────

  /**
   * Change password for the current user.
   */
  const changePassword = async (params: {
    currentPassword: string;
    newPassword: string;
  }) => {
    try {
      await trpcClient.auth.changePassword.mutate(params);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to change password",
      };
    }
  };

  /**
   * Set password for a user who signed up via OTP and has no password yet.
   * Creates the credential account needed for phone + password sign-in.
   */
  const setUserPassword = async (newPassword: string) => {
    try {
      await trpcClient.auth.setUserPassword.mutate({ newPassword });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to set password",
      };
    }
  };

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    isAuthenticated,
    user,
    isLoading: sessionLoading,
    error: sessionError as Error | null,

    // Account detection
    hasPassword,
    isAccountsLoading: accountsLoading,
    accountsError,
    refetchAccounts: fetchAccounts,

    // Session
    signOut,

    // Phone/SMS
    checkPhoneNumber,
    sendPhoneOTP,
    signInWithPhone,
    requestPasswordResetPhone,
    resetPasswordPhone,

    // Password management
    changePassword,
    setUserPassword,
  };
}

// ============================================================================
// USER PROFILE HOOK
// ============================================================================

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
    profile: profile.data,
    isLoading: profile.isLoading,
    sessions: sessions.data,
    updateProfile,
    updateEmail,
    updatePhoneNumber,
    removePhoneNumber,
    updateBalance,
    updateVipLevel,
    deleteAccount,
    revokeSession,
    revokeAllSessions,
  };
}
