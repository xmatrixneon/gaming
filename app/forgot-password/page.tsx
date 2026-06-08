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
  Divider,
} from "@/components/game";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Step = 1 | 2 | 3 | 4;

interface ForgotPasswordState {
  step: Step;
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
}

const initialState: ForgotPasswordState = {
  step: 1,
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
};

/**
 * Forgot Password Page - Better Auth with Redis OTP
 *
 * Features:
 * - Phone number OTP verification
 * - Redis-backed OTP storage
 * - Password reset
 * - Multi-step process
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestPasswordResetPhone, resetPasswordPhone, sendPhoneOTP } = useAuth();
  const [state, setState] = useState<ForgotPasswordState>(initialState);

  // Update state helper
  const updateState = useCallback(<K extends keyof ForgotPasswordState>(
    key: K,
    value: ForgotPasswordState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Step 1 - Request Password Reset OTP
  const handleSendOTP = useCallback(async () => {
    if (!state.phoneNumber || state.phoneNumber.length !== 10) {
      updateState("error", "Please enter a valid phone number");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      const result = await requestPasswordResetPhone(fullPhone);

      if (result && !result.success) {
        updateState("error", result.error || "Failed to send OTP");
        updateState("isLoading", false);
        return;
      }

      // Move to OTP verification step
      updateState("isLoading", false);
      updateState("step", 2);

      // Start countdown
      updateState("countdown", 60);
      updateState("canResendOTP", false);

      const interval = setInterval(() => {
        setState((prev) => {
          const newCountdown = prev.countdown - 1;
          if (newCountdown <= 0) {
            clearInterval(interval);
            return { ...prev, countdown: 0, canResendOTP: true };
          }
          return { ...prev, countdown: newCountdown };
        });
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, requestPasswordResetPhone, updateState]);

  // Step 2 - Verify OTP
  const handleVerifyOTP = useCallback(async () => {
    if (state.otpValue.length !== 6) {
      updateState("error", "Please enter a valid 6-digit OTP");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    // Move to reset password step (OTP will be verified in final step)
    updateState("isLoading", false);
    updateState("step", 3);
  }, [state.otpValue, updateState]);

  // Step 3 - Reset Password
  const handleResetPassword = useCallback(async () => {
    if (!state.newPasswordValue || !state.confirmPasswordValue) {
      updateState("error", "Please fill in all fields");
      return;
    }

    if (state.newPasswordValue.length < 6) {
      updateState("error", "Password must be at least 6 characters");
      return;
    }

    if (state.newPasswordValue !== state.confirmPasswordValue) {
      updateState("error", "Passwords do not match");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      const result = await resetPasswordPhone({
        phoneNumber: fullPhone,
        otp: state.otpValue,
        newPassword: state.newPasswordValue,
      });

      if (result && !result.success) {
        updateState("error", result.error || "Failed to reset password");
        updateState("isLoading", false);
        return;
      }

      // Success - show success screen
      updateState("isLoading", false);
      updateState("step", 4);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.otpValue, state.newPasswordValue, state.confirmPasswordValue, resetPasswordPhone, updateState]);

  // Resend OTP
  const handleResendOTP = useCallback(async () => {
    if (!state.canResendOTP) return;

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      const result = await sendPhoneOTP(fullPhone);

      if (result && !result.success) {
        updateState("error", result.error || "Failed to resend OTP");
        updateState("isLoading", false);
        return;
      }

      updateState("isLoading", false);
      updateState("otpValue", "");
      updateState("countdown", 60);
      updateState("canResendOTP", false);

      const interval = setInterval(() => {
        setState((prev) => {
          const newCountdown = prev.countdown - 1;
          if (newCountdown <= 0) {
            clearInterval(interval);
            return { ...prev, countdown: 0, canResendOTP: true };
          }
          return { ...prev, countdown: newCountdown };
        });
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.canResendOTP, sendPhoneOTP, updateState]);

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
      )}
    >
      <AuthHeader onClose={() => router.push("/signin")} />

      <AnimatePresence mode="wait" initial={false}>
        {state.step === 1 && (
          <Step1Phone
            key="step1"
            phoneNumber={state.phoneNumber}
            error={state.error}
            isLoading={state.isLoading}
            isDisabled={!state.phoneNumber || state.isLoading}
            onPhoneNumberChange={(value) => updateState("phoneNumber", value)}
            onSubmit={handleSendOTP}
          />
        )}
        {state.step === 2 && (
          <Step2OTP
            key="step2"
            phoneValue={`+91${state.phoneNumber}`}
            otpValue={state.otpValue}
            error={state.error}
            countdown={state.countdown}
            canResendOTP={state.canResendOTP}
            isLoading={state.isLoading}
            isDisabled={state.otpValue.length !== 6 || state.isLoading}
            onOtpChange={(value) => updateState("otpValue", value)}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            onBack={() => updateState("step", 1)}
            formatCountdown={formatCountdown}
          />
        )}
        {state.step === 3 && (
          <Step3Password
            key="step3"
            newPasswordValue={state.newPasswordValue}
            confirmPasswordValue={state.confirmPasswordValue}
            showNewPassword={state.showNewPassword}
            showConfirmPassword={state.showConfirmPassword}
            error={state.error}
            isLoading={state.isLoading}
            isDisabled={!state.newPasswordValue || !state.confirmPasswordValue || state.isLoading}
            onNewPasswordChange={(value) => updateState("newPasswordValue", value)}
            onConfirmPasswordChange={(value) => updateState("confirmPasswordValue", value)}
            onToggleNewPassword={() => updateState("showNewPassword", !state.showNewPassword)}
            onToggleConfirmPassword={() => updateState("showConfirmPassword", !state.showConfirmPassword)}
            onSubmit={handleResetPassword}
            onBack={() => updateState("step", 2)}
          />
        )}
        {state.step === 4 && (
          <Step4Success
            key="step4"
            onSignIn={() => router.push("/signin")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Step 1: Enter Phone Number
function Step1Phone({
  phoneNumber,
  error,
  isLoading,
  isDisabled,
  onPhoneNumberChange,
  onSubmit,
}: {
  phoneNumber: string;
  error: string | null;
  isLoading: boolean;
  isDisabled: boolean;
  onPhoneNumberChange: (number: string) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Forgot Password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your phone number to receive a verification code
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Phone Number Input */}
      <PhoneInput
        label="Phone Number"
        phoneNumber={phoneNumber}
        onPhoneNumberChange={onPhoneNumberChange}
        required
        maxLength={10}
        className="mb-6"
      />

      {/* Send Code Button */}
      <AuthButton
        variant="primary"
        className="w-full"
        onClick={onSubmit}
        disabled={isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Verification Code"
        )}
      </AuthButton>

      {/* Back to Sign In */}
      <div className="mt-6 text-center">
        <Button
          variant="link"
          className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => (window.location.href = "/signin")}
        >
          ← Back to Sign In
        </Button>
      </div>
    </motion.div>
  );
}

// Step 2: Verify OTP
function Step2OTP({
  phoneValue,
  otpValue,
  error,
  countdown,
  canResendOTP,
  isLoading,
  isDisabled,
  onOtpChange,
  onVerify,
  onResend,
  onBack,
  formatCountdown,
}: {
  phoneValue: string;
  otpValue: string;
  error: string | null;
  countdown: number;
  canResendOTP: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  formatCountdown: (seconds: number) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Verify your phone
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <span className="text-green-400">{phoneValue}</span>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* OTP Input */}
      <OTPInput
        length={6}
        label="Enter verification code"
        required
        value={otpValue}
        onChange={onOtpChange}
        className="mb-7"
      />

      {/* Verify Button */}
      <AuthButton
        variant="primary"
        className="w-full mb-4"
        onClick={onVerify}
        disabled={isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify Code"
        )}
      </AuthButton>

      {/* Resend Code */}
      <Button
        variant="link"
        className="text-sm mb-6 w-full"
        onClick={onResend}
        disabled={!canResendOTP}
      >
        {canResendOTP ? (
          "Didn't receive code? Resend"
        ) : (
          `Resend in ${formatCountdown(countdown)}`
        )}
      </Button>

      {/* Back Button */}
      <AuthButton
        variant="secondary"
        className="w-full"
        onClick={onBack}
        disabled={isLoading}
      >
        Back
      </AuthButton>
    </motion.div>
  );
}

// Step 3: Reset Password
function Step3Password({
  newPasswordValue,
  confirmPasswordValue,
  showNewPassword,
  showConfirmPassword,
  error,
  isLoading,
  isDisabled,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSubmit,
  onBack,
}: {
  newPasswordValue: string;
  confirmPasswordValue: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  error: string | null;
  isLoading: boolean;
  isDisabled: boolean;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleNewPassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Reset Password
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a new password for your account
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* New Password Input */}
      <PasswordField
        label="New Password"
        required
        placeholder="Enter new password (min 6 characters)"
        value={newPasswordValue}
        onChange={(e) => onNewPasswordChange(e.target.value)}
        showPassword={showNewPassword}
        onTogglePassword={onToggleNewPassword}
        containerClassName="mb-4"
      />

      {/* Confirm Password Input */}
      <PasswordField
        label="Confirm Password"
        required
        placeholder="Confirm new password"
        value={confirmPasswordValue}
        onChange={(e) => onConfirmPasswordChange(e.target.value)}
        showPassword={showConfirmPassword}
        onTogglePassword={onToggleConfirmPassword}
        containerClassName="mb-6"
      />

      {/* Reset Button */}
      <AuthButton
        variant="primary"
        className="w-full"
        onClick={onSubmit}
        disabled={isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Resetting...
          </>
        ) : (
          "Reset Password"
        )}
      </AuthButton>

      {/* Back Button */}
      <div className="mt-4">
        <AuthButton
          variant="secondary"
          className="w-full"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </AuthButton>
      </div>
    </motion.div>
  );
}

// Step 4: Success
function Step4Success({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-5 py-7 pb-10 text-center"
    >
      <div className="mb-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Password Reset Successful!
        </h1>
        <p className="text-sm text-muted-foreground">
          Your password has been successfully reset. You can now sign in with your new password.
        </p>
      </div>

      <AuthButton
        variant="primary"
        className="w-full"
        onClick={onSignIn}
      >
        Go to Sign In
      </AuthButton>
    </motion.div>
  );
}
