"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthHeader,
  AuthTabs,
  PhoneInput,
  PasswordField,
  AuthButton,
  SocialButtons,
  OTPInput,
  AuthCheckbox,
  CollapsibleField,
  Divider,
} from "@/components/game";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

type TabValue = "signin" | "signup";
type Step = 1 | 2 | 3;

interface SignUpState {
  tab: TabValue;
  step: Step;
  phoneNumber: string;
  passwordValue: string;
  otpValue: string;
  showPassword: boolean;
  agreed: boolean;
  promoOpen: boolean;
  isLoading: boolean;
  error: string | null;
  countdown: number;
  canResendOTP: boolean;
}

const initialState: SignUpState = {
  tab: "signup",
  step: 1,
  phoneNumber: "",
  passwordValue: "",
  otpValue: "",
  showPassword: false,
  agreed: false,
  promoOpen: false,
  isLoading: false,
  error: null,
  countdown: 0,
  canResendOTP: true,
};

/**
 * Sign Up Page - Better Auth with Phone/SMS and Redis OTP
 *
 * Features:
 * - Phone number registration with OTP verification
 * - Password creation
 * - Google OAuth signup
 * - Redis-backed OTP storage
 * - Real-time validation
 */
export default function SignUpPage() {
  const router = useRouter();
  const { checkPhoneNumber, sendPhoneOTP, signUp, signInWithGoogle, setUserPassword } = useAuth();
  const [state, setState] = useState<SignUpState>(initialState);

  // Update state helper
  const updateState = useCallback(<K extends keyof SignUpState>(
    key: K,
    value: SignUpState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Navigation handlers
  const handleTabChange = useCallback((value: string) => {
    const tabValue = value as TabValue;
    updateState("tab", tabValue);
    if (tabValue === "signin") {
      router.push("/signin");
    }
  }, [router, updateState]);

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  // Clear error when user starts typing
  const handlePhoneNumberChange = useCallback((value: string) => {
    updateState("phoneNumber", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  const handlePasswordChange = useCallback((value: string) => {
    updateState("passwordValue", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  const handleOtpChange = useCallback((value: string) => {
    updateState("otpValue", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  // Step 1 - Send OTP (phone number only)
  const handleSignUp = useCallback(async () => {
    if (!state.phoneNumber) {
      updateState("error", "Please enter your phone number");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      // Check if phone number is already registered (saves SMS costs)
      const checkResult = await checkPhoneNumber(fullPhone);

      if (checkResult.exists) {
        updateState("error", "This phone number is already registered. Please sign in instead.");
        updateState("isLoading", false);
        return;
      }

      const result = await sendPhoneOTP(fullPhone);

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
  }, [state.phoneNumber, checkPhoneNumber, sendPhoneOTP, updateState]);

  // Step 2 - Verify OTP (phone number verification)
  const handleVerifyOTP = useCallback(async () => {
    if (state.otpValue.length !== 6) {
      updateState("error", "Please enter a valid 6-digit OTP");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      // Verify phone number using Better Auth client directly
      // This calls the Better Auth HTTP handler which sets session cookies properly
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,
        code: state.otpValue,
        disableSession: false, // Ensure session is created
      });

      if (result.error) {
        updateState("error", result.error.message || "Invalid OTP");
        updateState("isLoading", false);
        return;
      }

      console.log("[SIGNUP] Phone verified successfully, session created");

      // Move to password setting step
      updateState("isLoading", false);
      updateState("step", 3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.otpValue, updateState]);

  // Step 3 - Set Password and Complete Account Creation
  const handleSetPassword = useCallback(async () => {
    if (!state.passwordValue) {
      updateState("error", "Please enter a password");
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
      // Set password using Better Auth's setPassword API
      // The session is already active from Step 2 verification
      const setPasswordResult = await setUserPassword(state.passwordValue);

      if (!setPasswordResult.success) {
        updateState("error", setPasswordResult.error || "Failed to set password");
        updateState("isLoading", false);
        return;
      }

      console.log("[SIGNUP] Password set successfully via Better Auth API");

      // Success - redirect to home
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set password";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.passwordValue, state.agreed, setUserPassword, router, updateState]);

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

  const handleGoogleSignUp = useCallback(() => {
    signInWithGoogle();
  }, [signInWithGoogle]);

  const goBackToStep1 = useCallback(() => {
    updateState("step", 1);
    updateState("error", null);
  }, [updateState]);

  const goBackToStep2 = useCallback(() => {
    updateState("step", 2);
    updateState("error", null);
  }, [updateState]);

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Combined handlers object
  const step1Handlers = {
    onPhoneNumberChange: handlePhoneNumberChange,
    onSignUp: handleSignUp,
    onGoogleSignUp: handleGoogleSignUp,
  };

  const step2Handlers = {
    onOtpChange: handleOtpChange,
    onVerify: handleVerifyOTP,
    onResend: handleResendOTP,
    onBack: goBackToStep1,
  };

  const step3Handlers = {
    onPasswordChange: handlePasswordChange,
    onTogglePassword: () => updateState("showPassword", !state.showPassword),
    onAgreedChange: (checked: boolean) => updateState("agreed", checked),
    onSetPassword: handleSetPassword,
    onBack: goBackToStep2,
  };

  const step1Data = {
    phoneNumber: state.phoneNumber,
    error: state.error,
  };

  const step2Data = {
    phoneNumber: state.phoneNumber,
    otpValue: state.otpValue,
    countdown: state.countdown,
    canResendOTP: state.canResendOTP,
    isLoading: state.isLoading,
    error: state.error,
  };

  const step3Data = {
    passwordValue: state.passwordValue,
    showPassword: state.showPassword,
    agreed: state.agreed,
    isLoading: state.isLoading,
    error: state.error,
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
      <AuthHeader onClose={handleClose} />

      <AuthTabs
        value={state.tab}
        onValueChange={handleTabChange}
        tabs={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
        ]}
      >
        <AnimatePresence mode="wait" initial={false}>
        {state.step === 1 ? (
          <SignUpStep1
            key="step1"
            data={step1Data}
            handlers={step1Handlers}
            isLoading={state.isLoading}
            isDisabled={!state.phoneNumber || state.isLoading}
          />
        ) : state.step === 2 ? (
          <SignUpStep2
            key="step2"
            data={step2Data}
            handlers={step2Handlers}
            isLoading={state.isLoading}
            isDisabled={state.otpValue.length !== 6 || state.isLoading}
            formatCountdown={formatCountdown}
          />
        ) : (
          <SignUpStep3
            key="step3"
            data={step3Data}
            handlers={step3Handlers}
            isLoading={state.isLoading}
            isDisabled={!state.passwordValue || state.passwordValue.length < 6 || !state.agreed || state.isLoading}
          />
        )}
      </AnimatePresence>
      </AuthTabs>
    </div>
  );
}

/**
 * Step 1 Component - Phone Number Only
 */
interface SignUpStep1Props {
  data: {
    phoneNumber: string;
    error: string | null;
  };
  handlers: {
    onPhoneNumberChange: (value: string) => void;
    onSignUp: () => void;
    onGoogleSignUp: () => void;
  };
  isLoading: boolean;
  isDisabled: boolean;
}

function SignUpStep1({ data, handlers, isLoading, isDisabled }: SignUpStep1Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Create Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign up to get started with your account
        </p>
      </div>

      {/* Error Message */}
      {data.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}

      <PhoneInput
        label="Phone Number"
        phoneNumber={data.phoneNumber}
        onPhoneNumberChange={handlers.onPhoneNumberChange}
        required
        maxLength={10}
        className="mb-4"
      />

      <AuthButton
        variant="primary"
        className="w-full mb-6"
        onClick={handlers.onSignUp}
        disabled={isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending code...
          </>
        ) : (
          "Continue"
        )}
      </AuthButton>

      <Divider text="Or continue with" className="mb-4" />

      <SocialButtons
        layout="full"
        providers={[
          {
            name: "Google",
            icon: <FcGoogle size={18} />,
            onClick: handlers.onGoogleSignUp,
          },
        ]}
      />
    </motion.div>
  );
}

/**
 * Step 2 Component - OTP Verification
 */
interface SignUpStep2Props {
  data: {
    phoneNumber: string;
    otpValue: string;
    countdown: number;
    canResendOTP: boolean;
    isLoading: boolean;
    error: string | null;
  };
  handlers: {
    onOtpChange: (value: string) => void;
    onVerify: () => void;
    onResend: () => void;
    onBack: () => void;
  };
  isLoading: boolean;
  isDisabled: boolean;
  formatCountdown: (seconds: number) => string;
}

function SignUpStep2({ data, handlers, isLoading, isDisabled, formatCountdown }: SignUpStep2Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Verify your phone
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <span className="text-green-400">+91{data.phoneNumber}</span>
        </p>
      </div>

      {/* Error Message */}
      {data.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}

      <OTPInput
        length={6}
        label="Enter verification code"
        required
        value={data.otpValue}
        onChange={handlers.onOtpChange}
        className="mb-7"
      />

      <AuthButton
        variant="primary"
        className="w-full mb-4"
        onClick={handlers.onVerify}
        disabled={isDisabled}
      >
        {data.isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </AuthButton>

      <Button
        variant="link"
        className="text-sm mb-6 w-full"
        onClick={handlers.onResend}
        disabled={!data.canResendOTP}
      >
        {data.canResendOTP ? (
          "Didn't receive code? Resend"
        ) : (
          `Resend in ${formatCountdown(data.countdown)}`
        )}
      </Button>

      <AuthButton
        variant="secondary"
        className="w-full"
        onClick={handlers.onBack}
        disabled={isLoading}
      >
        Back
      </AuthButton>
    </motion.div>
  );
}

/**
 * Step 3 Component - Set Password
 */
interface SignUpStep3Props {
  data: {
    passwordValue: string;
    showPassword: boolean;
    agreed: boolean;
    isLoading: boolean;
    error: string | null;
  };
  handlers: {
    onPasswordChange: (value: string) => void;
    onTogglePassword: () => void;
    onAgreedChange: (checked: boolean) => void;
    onSetPassword: () => void;
    onBack: () => void;
  };
  isLoading: boolean;
  isDisabled: boolean;
}

function SignUpStep3({ data, handlers, isLoading, isDisabled }: SignUpStep3Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-7 pb-10"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Create Password
        </h1>
        <p className="text-sm text-muted-foreground">
          Set a password to secure your account
        </p>
      </div>

      {/* Error Message */}
      {data.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{data.error}</p>
        </div>
      )}

      <PasswordField
        label="Password"
        required
        placeholder="Create a strong password (min 6 characters)"
        value={data.passwordValue}
        onChange={(e) => handlers.onPasswordChange(e.target.value)}
        showPassword={data.showPassword}
        onTogglePassword={handlers.onTogglePassword}
        containerClassName="mb-4"
      />

      <AuthCheckbox
        label={
          <>
            I am 18+ and agree to the{" "}
            <span className="text-foreground font-semibold underline hover:underline cursor-pointer">
              Terms and Conditions
            </span>
          </>
        }
        checked={data.agreed}
        onCheckedChange={handlers.onAgreedChange}
        className="mb-7"
      />

      <AuthButton
        variant="primary"
        className="w-full mb-4"
        onClick={handlers.onSetPassword}
        disabled={isDisabled}
      >
        {data.isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          "Create Account"
        )}
      </AuthButton>

      <AuthButton
        variant="secondary"
        className="w-full"
        onClick={handlers.onBack}
        disabled={isLoading}
      >
        Back
      </AuthButton>
    </motion.div>
  );
}
