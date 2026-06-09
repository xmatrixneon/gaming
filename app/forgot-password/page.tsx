"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthHeader,
  PhoneInput,
  AuthButton,
  OTPInput,
  PasswordField,
} from "@/components/game";
import { useAuth } from "@/hooks/use-auth";

interface ForgotPasswordState {
  phoneNumber: string;
  otpValue: string;
  newPasswordValue: string;
  confirmPasswordValue: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  isLoading: boolean;
  error: string | null;
  countdown: number;
  canResendOTP: boolean;
  // mirrors SignUp: controls OTP section visibility
  otpSent: boolean;
  // mirrors SignUp: marks phone verified, collapses OTP
  phoneVerified: boolean;
  // final success state
  success: boolean;
}

const initialState: ForgotPasswordState = {
  phoneNumber: "",
  otpValue: "",
  newPasswordValue: "",
  confirmPasswordValue: "",
  showNewPassword: false,
  showConfirmPassword: false,
  isLoading: false,
  error: null,
  countdown: 0,
  canResendOTP: true,
  otpSent: false,
  phoneVerified: false,
  success: false,
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestPasswordResetPhone, resetPasswordPhone, sendPhoneOTP } = useAuth();
  const [state, setState] = useState<ForgotPasswordState>(initialState);

  const updateState = useCallback(<K extends keyof ForgotPasswordState>(
    key: K,
    value: ForgotPasswordState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Shared countdown — identical to SignUp
  const startCountdown = useCallback(() => {
    setState(prev => ({ ...prev, countdown: 60, canResendOTP: false }));
    const interval = setInterval(() => {
      setState(prev => {
        const next = prev.countdown - 1;
        if (next <= 0) {
          clearInterval(interval);
          return { ...prev, countdown: 0, canResendOTP: true };
        }
        return { ...prev, countdown: next };
      });
    }, 1000);
  }, []);

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Send OTP — reveals OTP input (mirrors SignUp handleSendOTP)
  const handleSendOTP = useCallback(async () => {
    if (state.phoneNumber.length !== 10) {
      updateState("error", "Enter a valid 10-digit phone number");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    const fullPhone = `+91${state.phoneNumber}`;
    try {
      const result = await requestPasswordResetPhone(fullPhone);
      if (result && !result.success) {
        updateState("error", result.error || "Failed to send OTP");
        return;
      }
      updateState("otpSent", true);
      startCountdown();
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, requestPasswordResetPhone, updateState, startCountdown]);

  // Verify OTP inline — marks phone verified, collapses OTP (mirrors SignUp handleVerifyOTP)
  const handleVerifyOTP = useCallback(async () => {
    if (state.otpValue.length !== 6) {
      updateState("error", "Enter the 6-digit code");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    try {
      // OTP will be validated in the final reset step; mark verified here
      setState(prev => ({ ...prev, phoneVerified: true, otpSent: false }));
    } finally {
      updateState("isLoading", false);
    }
  }, [state.otpValue, updateState]);

  // Resend OTP (mirrors SignUp handleResendOTP)
  const handleResendOTP = useCallback(async () => {
    if (!state.canResendOTP) return;
    updateState("isLoading", true);
    updateState("error", null);
    try {
      const result = await sendPhoneOTP(`+91${state.phoneNumber}`);
      if (result && !result.success) {
        updateState("error", result.error || "Failed to resend OTP");
        return;
      }
      updateState("otpValue", "");
      startCountdown();
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.canResendOTP, sendPhoneOTP, updateState, startCountdown]);

  // Final submit — requires phone verified + new passwords
  const handleSubmit = useCallback(async () => {
    if (!state.phoneVerified) {
      updateState("error", "Please verify your phone number first");
      return;
    }
    if (!state.newPasswordValue || state.newPasswordValue.length < 6) {
      updateState("error", "Password must be at least 6 characters");
      return;
    }
    if (state.newPasswordValue !== state.confirmPasswordValue) {
      updateState("error", "Passwords do not match");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    try {
      const result = await resetPasswordPhone({
        phoneNumber: `+91${state.phoneNumber}`,
        otp: state.otpValue,
        newPassword: state.newPasswordValue,
      });
      if (result && !result.success) {
        updateState("error", result.error || "Failed to reset password");
        return;
      }
      updateState("success", true);
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      updateState("isLoading", false);
    }
  }, [
    state.phoneVerified,
    state.newPasswordValue,
    state.confirmPasswordValue,
    state.otpValue,
    state.phoneNumber,
    resetPasswordPhone,
    updateState,
  ]);

  const canSubmit =
    state.phoneVerified &&
    state.newPasswordValue.length >= 6 &&
    state.confirmPasswordValue.length >= 6 &&
    !state.isLoading;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (state.success) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
        <AuthHeader onClose={() => router.push("/signin")} />
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
            <h1 className="text-2xl font-bold text-foreground mb-1">Password Reset!</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been reset. You can now sign in with your new password.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <AuthButton variant="primary" className="w-full" onClick={() => router.push("/signin")}>
              Go to Sign In
            </AuthButton>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
      <AuthHeader onClose={() => router.push("/signin")} />

      <div className="px-4 py-5 pb-10 space-y-4 sm:px-6 sm:py-7">
        {/* Header */}
        <motion.div
          className="mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-1">Forgot Password?</h1>
          <p className="text-sm text-muted-foreground">
            Verify your phone number to reset your password
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

        {/* ── Phone / OTP swap — identical structure to SignUp ── */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {/* Phone input — shown before OTP sent */}
            {!state.otpSent && !state.phoneVerified ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                className="space-y-2"
              >
                <PhoneInput
                  label="Phone Number"
                  phoneNumber={state.phoneNumber}
                  onPhoneNumberChange={v => {
                    updateState("phoneNumber", v);
                    if (state.error) updateState("error", null);
                  }}
                  required
                  maxLength={10}
                  className="w-full"
                />
                <AuthButton
                  variant="primary"
                  onClick={handleSendOTP}
                  disabled={state.phoneNumber.length !== 10 || state.isLoading}
                  className="w-full"
                >
                  {state.isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                  ) : (
                    "Send OTP"
                  )}
                </AuthButton>
              </motion.div>
            ) : (
              /* OTP section — replaces phone field */
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                className="space-y-3"
              >
                {/* Phone summary pill */}
                <motion.div
                  layout
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 border border-border"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">+91</span>
                    <span className="text-sm font-medium text-foreground">{state.phoneNumber}</span>
                    <AnimatePresence>
                      {state.phoneVerified && (
                        <motion.span
                          key="verified-badge"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="flex items-center gap-1 text-xs text-green-500 font-medium"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {!state.phoneVerified && (
                    <Button
                      variant="link"
                      className="text-xs p-0 h-auto text-primary font-medium"
                      onClick={() => setState(prev => ({
                        ...prev, otpSent: false, otpValue: "", error: null,
                      }))}
                    >
                      Edit
                    </Button>
                  )}
                </motion.div>

                {/* OTP input — hidden once verified */}
                <AnimatePresence>
                  {!state.phoneVerified && (
                    <motion.div
                      key="otp-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden space-y-3"
                    >
                      <div className="relative" style={{ isolation: "isolate" }}>
                        <OTPInput
                          length={6}
                          label="Verification Code"
                          required
                          value={state.otpValue}
                          onChange={v => {
                            updateState("otpValue", v);
                            if (state.error) updateState("error", null);
                          }}
                        />
                      </div>
                      <div className="relative space-y-2" style={{ zIndex: 10 }}>
                        {/* Timer / resend row */}
                        <div className="flex items-center justify-between">
                          <AnimatePresence mode="wait">
                            {!state.canResendOTP ? (
                              <motion.span
                                key="countdown"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="text-xs text-muted-foreground tabular-nums"
                              >
                                Resend in {formatCountdown(state.countdown)}
                              </motion.span>
                            ) : (
                              <motion.span
                                key="spacer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-xs text-transparent select-none"
                              >
                                &nbsp;
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <Button
                            variant="link"
                            className="text-xs p-0 h-auto text-primary font-medium"
                            onClick={handleResendOTP}
                            disabled={!state.canResendOTP || state.isLoading}
                          >
                            Resend code
                          </Button>
                        </div>
                        {/* Verify button */}
                        <AuthButton
                          variant="primary"
                          className="w-full"
                          onClick={handleVerifyOTP}
                          disabled={state.otpValue.length !== 6 || state.isLoading}
                        >
                          {state.isLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</>
                          ) : (
                            "Verify"
                          )}
                        </AuthButton>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── New Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <PasswordField
            label="New Password"
            required
            placeholder="Min 6 characters"
            value={state.newPasswordValue}
            onChange={e => {
              updateState("newPasswordValue", e.target.value);
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
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <PasswordField
            label="Confirm Password"
            required
            placeholder="Confirm new password"
            value={state.confirmPasswordValue}
            onChange={e => {
              updateState("confirmPasswordValue", e.target.value);
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
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <AuthButton
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
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
                  Resetting...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Reset Password
                </motion.span>
              )}
            </AnimatePresence>
          </AuthButton>
        </motion.div>

        {/* ── Back to Sign In ── */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Button
            variant="link"
            className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/signin")}
          >
            Back to Sign In
          </Button>
        </motion.div>
      </div>
    </div>
  );
}