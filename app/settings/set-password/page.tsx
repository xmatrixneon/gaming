"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  AuthHeader,
  PasswordField,
  AuthButton,
} from "@/components/game";
import { useAuth } from "@/hooks/use-auth";

interface SetPasswordState {
  newPassword: string;
  confirmPassword: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: SetPasswordState = {
  newPassword: "",
  confirmPassword: "",
  showNewPassword: false,
  showConfirmPassword: false,
  isLoading: false,
  error: null,
  success: false,
};

export default function SetPasswordPage() {
  const router = useRouter();
  const { setUserPassword, refetchAccounts } = useAuth();
  const [state, setState] = useState<SetPasswordState>(initialState);

  const updateState = useCallback(<K extends keyof SetPasswordState>(
    key: K,
    value: SetPasswordState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBack = useCallback(() => router.push("/settings"), [router]);

  // Validate form before submission
  const validateForm = useCallback(() => {
    if (state.newPassword.length < 6) {
      updateState("error", "Password must be at least 6 characters");
      return false;
    }
    if (state.newPassword !== state.confirmPassword) {
      updateState("error", "Passwords do not match");
      return false;
    }
    return true;
  }, [state.newPassword, state.confirmPassword, updateState]);

  // Handle password setting
  const handleSetPassword = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    try {
      const result = await setUserPassword(state.newPassword);

      if (!result.success) {
        updateState("error", result.error || "Failed to set password");
        return;
      }

      // Refetch accounts to update hasPassword state
      await refetchAccounts();

      updateState("success", true);
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to set password");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.newPassword, validateForm, updateState, setUserPassword, refetchAccounts]);

  const canSubmit =
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
            <h1 className="text-2xl font-bold text-foreground mb-1">Password Set!</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been set successfully. You can now sign in with your phone number and password.
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
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Set Password</h1>
              <p className="text-sm text-muted-foreground">
                Add password authentication to your account
              </p>
            </div>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">
              After setting a password, you can sign in using your phone number and password for quicker access.
            </p>
          </div>
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

        {/* ── New Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
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
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <PasswordField
            label="Confirm Password"
            required
            placeholder="Re-enter password"
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
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <AuthButton
            variant="primary"
            className="w-full"
            onClick={handleSetPassword}
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
                  Setting Password...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Set Password
                </motion.span>
              )}
            </AnimatePresence>
          </AuthButton>
        </motion.div>

        {/* ── Info Note ── */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <p className="text-xs text-muted-foreground">
            Make sure to use a strong password with at least 6 characters
          </p>
        </motion.div>
      </div>
    </div>
  );
}
