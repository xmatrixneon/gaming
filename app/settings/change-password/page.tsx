"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthHeader,
  PasswordField,
  AuthButton,
} from "@/components/game";
import { authClient } from "@/lib/auth-client";

interface ChangePasswordState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showCurrentPassword: boolean;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: ChangePasswordState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  showCurrentPassword: false,
  showNewPassword: false,
  showConfirmPassword: false,
  isLoading: false,
  error: null,
  success: false,
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<ChangePasswordState>(initialState);

  const updateState = useCallback(<K extends keyof ChangePasswordState>(
    key: K,
    value: ChangePasswordState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBack = useCallback(() => router.push("/settings"), [router]);

  // Validate form before submission
  const validateForm = useCallback(() => {
    if (!state.currentPassword) {
      updateState("error", "Enter your current password");
      return false;
    }
    if (state.newPassword.length < 6) {
      updateState("error", "New password must be at least 6 characters");
      return false;
    }
    if (state.newPassword === state.currentPassword) {
      updateState("error", "New password must be different from current");
      return false;
    }
    if (state.newPassword !== state.confirmPassword) {
      updateState("error", "Passwords do not match");
      return false;
    }
    return true;
  }, [state.currentPassword, state.newPassword, state.confirmPassword, updateState]);

  // Handle password change
  const handleChangePassword = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    try {
      const result = await authClient.changePassword({
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
        revokeOtherSessions: true, // Invalidate all other sessions for security
      });

      if (result.error) {
        updateState("error", result.error.message || "Failed to change password");
        return;
      }

      updateState("success", true);
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to change password");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.currentPassword, state.newPassword, validateForm, updateState]);

  const canSubmit =
    state.currentPassword.length > 0 &&
    state.newPassword.length >= 6 &&
    state.confirmPassword.length >= 6 &&
    !state.isLoading;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (state.success) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
        <AuthHeader onClose={handleBack} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="px-4 py-5 pb-10 space-y-4 text-center sm:px-6 sm:py-7"
        >
          <motion.div
            className="mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Password Changed!</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been updated successfully. Use your new password to sign in.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <AuthButton variant="primary" className="w-full" onClick={handleBack}>
              Back to Settings
            </AuthButton>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
      <AuthHeader onClose={handleBack} />

      <div className="px-4 py-5 pb-10 space-y-4 sm:px-6 sm:py-7">
        {/* Header */}
        <motion.div
          className="mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-1">Change Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your current password and choose a new one
          </p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {state.error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-sm text-red-400">{state.error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Current Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <PasswordField
            label="Current Password"
            required
            placeholder="Enter your current password"
            value={state.currentPassword}
            onChange={e => {
              updateState("currentPassword", e.target.value);
              if (state.error) updateState("error", null);
            }}
            showPassword={state.showCurrentPassword}
            onTogglePassword={() => updateState("showCurrentPassword", !state.showCurrentPassword)}
          />
        </motion.div>

        {/* ── New Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <PasswordField
            label="New Password"
            required
            placeholder="Min 6 characters"
            value={state.newPassword}
            onChange={e => {
              updateState("newPassword", e.target.value);
              if (state.error) updateState("error", null);
            }}
            showPassword={state.showNewPassword}
            onTogglePassword={() => updateState("showNewPassword", !state.showNewPassword)}
          />
        </motion.div>

        {/* ── Confirm Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <PasswordField
            label="Confirm New Password"
            required
            placeholder="Re-enter new password"
            value={state.confirmPassword}
            onChange={e => {
              updateState("confirmPassword", e.target.value);
              if (state.error) updateState("error", null);
            }}
            showPassword={state.showConfirmPassword}
            onTogglePassword={() => updateState("showConfirmPassword", !state.showConfirmPassword)}
          />
        </motion.div>

        {/* ── Submit ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <AuthButton
            variant="primary"
            className="w-full"
            onClick={handleChangePassword}
            disabled={!canSubmit}
          >
            <AnimatePresence mode="wait">
              {state.isLoading ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center"
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Change Password
                </motion.span>
              )}
            </AnimatePresence>
          </AuthButton>
        </motion.div>

        {/* ── Security Note ── */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-xs text-muted-foreground">
            For your security, you'll need to sign in again after changing your password
          </p>
        </motion.div>
      </div>
    </div>
  );
}
