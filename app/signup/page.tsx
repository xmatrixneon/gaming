"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthHeader,
  AuthTabs,
  PhoneInput,
  PasswordField,
  AuthButton,
  OTPInput,
} from "@/components/game";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/trpc/client";

type TabValue = "signin" | "signup";

interface SignUpState {
  tab: TabValue;
  phoneNumber: string;
  passwordValue: string;
  otpValue: string;
  showPassword: boolean;
  agreed: boolean;
  isLoading: boolean;
  error: string | null;
  countdown: number;
  canResendOTP: boolean;
  // Controls OTP section visibility
  otpSent: boolean;
  // Controls final submit availability
  phoneVerified: boolean;
}

const initialState: SignUpState = {
  tab: "signup",
  phoneNumber: "",
  passwordValue: "",
  otpValue: "",
  showPassword: false,
  agreed: false,
  isLoading: false,
  error: null,
  countdown: 0,
  canResendOTP: true,
  otpSent: false,
  phoneVerified: false,
};

function SignUpPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCodeRef = React.useRef<string | null>(searchParams.get('ref'));
  const applyReferralCode = api.referral.applyReferralCode.useMutation();
  const { checkPhoneNumber, sendPhoneOTP, setUserPassword } = useAuth();
  const [state, setState] = useState<SignUpState>(initialState);

  const updateState = useCallback(<K extends keyof SignUpState>(
    key: K,
    value: SignUpState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleTabChange = useCallback((value: string) => {
    if (value === "signin") router.push("/signin");
  }, [router]);

  const handleClose = useCallback(() => router.push("/"), [router]);

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

  // Send OTP — reveals OTP input, does NOT block password field
  const handleSendOTP = useCallback(async () => {
    if (state.phoneNumber.length !== 10) {
      updateState("error", "Enter a valid 10-digit phone number");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    const fullPhone = `+91${state.phoneNumber}`;
    try {
      const checkResult = await checkPhoneNumber(fullPhone);
      if (checkResult.exists) {
        updateState("error", "Phone number already registered. Sign in instead.");
        return;
      }
      const result = await sendPhoneOTP(fullPhone);
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
  }, [state.phoneNumber, checkPhoneNumber, sendPhoneOTP, updateState, startCountdown]);

  // Verify OTP inline — marks phone as verified, OTP section collapses
  const handleVerifyOTP = useCallback(async () => {
    if (state.otpValue.length !== 6) {
      updateState("error", "Enter the 6-digit code");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    const fullPhone = `+91${state.phoneNumber}`;
    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,
        code: state.otpValue,
        disableSession: false,
      });
      if (result.error) {
        updateState("error", result.error.message || "Invalid OTP");
        return;
      }
      // Collapse OTP section, mark verified
      setState(prev => ({ ...prev, phoneVerified: true, otpSent: false }));
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Verification failed");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.otpValue, updateState]);

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

  // Final submit — requires phone verified
  const handleSubmit = useCallback(async () => {
    if (!state.phoneVerified) {
      updateState("error", "Please verify your phone number first");
      return;
    }
    if (state.passwordValue.length < 6) {
      updateState("error", "Password must be at least 6 characters");
      return;
    }
    if (!state.agreed) {
      updateState("error", "Please agree to the Terms and Conditions");
      return;
    }
    updateState("isLoading", true);
    updateState("error", null);
    try {
      const result = await setUserPassword(state.passwordValue);
      if (!result.success) {
        updateState("error", result.error || "Failed to set password");
        return;
      }

      // Apply referral code silently — never block signup
      if (referralCodeRef.current) {
        try {
          await applyReferralCode.mutateAsync({ referralCode: referralCodeRef.current });
        } catch {
          // swallow — referral errors must never block account creation
        }
      }

      router.push("/");
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Failed to create account");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.phoneVerified, state.passwordValue, state.agreed, setUserPassword, router, updateState, applyReferralCode]);

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const canSubmit =
    state.phoneVerified &&
    state.passwordValue.length >= 6 &&
    state.agreed &&
    !state.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
      <AuthHeader onClose={handleClose} />

      <AuthTabs
        value={state.tab}
        onValueChange={handleTabChange}
        tabs={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
        ]}
      >
        <div className="px-4 py-5 pb-10 space-y-4 sm:px-6 sm:py-7">
          {/* Header */}
          <motion.div
            className="mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-1">Create Account</h1>
            <p className="text-sm text-muted-foreground">
              Sign up to get started with your account
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

          {/* ── Phone / OTP swap ── */}
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
                          {/* Timer / resend row above button */}
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
                          {/* Verify button — full width like Send OTP */}
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

          {/* ── Password ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <PasswordField
              label="Password"
              required
              placeholder="Min 6 characters"
              value={state.passwordValue}
              onChange={e => {
                updateState("passwordValue", e.target.value);
                if (state.error) updateState("error", null);
              }}
              showPassword={state.showPassword}
              onTogglePassword={() => updateState("showPassword", !state.showPassword)}
            />
          </motion.div>

          {/* ── T&C ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            <button
              type="button"
              onClick={() => updateState("agreed", !state.agreed)}
              className="flex items-start gap-3 w-full text-left cursor-pointer group"
            >
              <span className={[
                "mt-0.5 flex-shrink-0 h-5 w-5 rounded border transition-colors duration-200",
                "flex items-center justify-center",
                state.agreed
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-transparent dark:bg-input/30",
              ].join(" ")}>
                {state.agreed && (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors duration-200 min-w-0">
                I am 18+ and agree to the{" "}
                <span className="text-foreground font-semibold underline">
                  Terms and Conditions
                </span>
              </span>
            </button>
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
                    Creating Account...
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Create Account
                  </motion.span>
                )}
              </AnimatePresence>
            </AuthButton>
          </motion.div>

          {/* ── Already have an account ── */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-semibold text-foreground hover:underline"
                onClick={() => router.push("/signin")}
              >
                Sign In
              </Button>
            </p>
          </motion.div>
        </div>
      </AuthTabs>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpPageInner />
    </Suspense>
  );
}
