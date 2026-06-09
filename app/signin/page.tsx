"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { Loader2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthHeader,
  AuthTabs,
  PhoneInput,
  PasswordField,
  AuthButton,
  SocialButtons,
  Divider,
  OTPInput,
} from "@/components/game";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type TabValue = "signin" | "signup";
type SignInMethod = "phone" | "email" | "otp";

interface SignInState {
  tab: TabValue;
  method: SignInMethod;
  phoneNumber: string;
  email: string;
  passwordValue: string;
  showPassword: boolean;
  otpCode: string;
  isLoading: boolean;
  error: string | null;
  countdown: number;
  canResendOTP: boolean;
}

const initialState: SignInState = {
  tab: "signin",
  method: "phone",
  phoneNumber: "",
  email: "",
  passwordValue: "",
  showPassword: false,
  otpCode: "",
  isLoading: false,
  error: null,
  countdown: 0,
  canResendOTP: true,
};

/**
 * Sign In Page - Better Auth with Phone/SMS and Redis OTP
 *
 * Features:
 * - Phone number + password sign in
 * - Email + password sign in
 * - Phone OTP sign in
 * - Google OAuth
 * - Real-time validation
 * - Redis-backed OTP storage
 */
export default function SignInPage() {
  const router = useRouter();
  const { signInWithPhone, sendPhoneOTP, verifyPhoneNumber, signIn, signInWithGoogle } = useAuth();
  const [state, setState] = useState<SignInState>(initialState);

  // Update state helper
  const updateState = useCallback(<K extends keyof SignInState>(
    key: K,
    value: SignInState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Navigation handlers
  const handleTabChange = useCallback((value: string) => {
    const tabValue = value as TabValue;
    updateState("tab", tabValue);
    if (tabValue === "signup") {
      router.push("/signup");
    }
  }, [router, updateState]);

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  // Method toggle
  const handleMethodChange = useCallback((method: SignInMethod) => {
    updateState("method", method);
    updateState("error", null);
    updateState("otpCode", "");
  }, [updateState]);

  // Clear error when user starts typing
  const handlePhoneNumberChange = useCallback((value: string) => {
    updateState("phoneNumber", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  const handleEmailChange = useCallback((value: string) => {
    updateState("email", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  const handlePasswordChange = useCallback((value: string) => {
    updateState("passwordValue", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  const handleOTPCodeChange = useCallback((value: string) => {
    updateState("otpCode", value);
    if (state.error) updateState("error", null);
  }, [updateState, state.error]);

  // Phone + Password Sign In
  const handlePhonePasswordSignIn = useCallback(async () => {
    if (!state.phoneNumber || !state.passwordValue) {
      updateState("error", "Please fill in all fields");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      const result = await signInWithPhone({
        phoneNumber: fullPhone,
        password: state.passwordValue,
        rememberMe: true,
      });

      if (result && !result.success) {
        updateState("error", result.error || "Sign in failed");
        updateState("isLoading", false);
        return;
      }

      // Success - redirect to home
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.passwordValue, signInWithPhone, router, updateState]);

  // Email + Password Sign In
  const handleEmailPasswordSignIn = useCallback(async () => {
    if (!state.email || !state.passwordValue) {
      updateState("error", "Please fill in all fields");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    try {
      const result = await signIn({
        email: state.email,
        password: state.passwordValue,
        rememberMe: true,
      });

      if (result && !result.success) {
        updateState("error", result.error || "Sign in failed");
        updateState("isLoading", false);
        return;
      }

      // Success - redirect to home
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.email, state.passwordValue, signIn, router, updateState]);

  // Send OTP for Phone Sign In
  const handleSendOTP = useCallback(async () => {
    if (state.phoneNumber.length !== 10) {
      updateState("error", "Please enter a valid phone number");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      // Pass isSignin: true to indicate this is for signin, not signup
      const result = await sendPhoneOTP(fullPhone, undefined, true);

      if (result && !result.success) {
        updateState("error", result.error || "Failed to send OTP");
        updateState("isLoading", false);
        return;
      }

      // Move to OTP input step
      updateState("isLoading", false);
      updateState("method", "otp");

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
  }, [state.phoneNumber, sendPhoneOTP, updateState]);

  // Verify OTP and Sign In
  const handleVerifyOTP = useCallback(async () => {
    if (state.otpCode.length !== 6) {
      updateState("error", "Please enter a valid 6-digit OTP");
      return;
    }

    updateState("isLoading", true);
    updateState("error", null);

    const fullPhone = `+91${state.phoneNumber}`;

    try {
      const result = await verifyPhoneNumber({
        phoneNumber: fullPhone,
        code: state.otpCode,
        disableSession: false,
      });

      if (result && !result.success) {
        updateState("error", result.error || "Invalid OTP");
        updateState("isLoading", false);
        return;
      }

      // Success - redirect to home
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      updateState("error", message);
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.otpCode, verifyPhoneNumber, router, updateState]);

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
      updateState("otpCode", "");
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

  // Google Sign In
  const handleGoogleSignIn = useCallback(() => {
    signInWithGoogle();
  }, [signInWithGoogle]);

  const togglePassword = useCallback(() => {
    updateState("showPassword", !state.showPassword);
  }, [state.showPassword, updateState]);

  const handleForgotPassword = useCallback(() => {
    router.push("/forgot-password");
  }, [router]);

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
        {state.tab === "signin" && (
          <motion.div
            key="signin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="px-5 py-7 pb-10"
          >
            <SignInForm
              state={state}
              onStateChange={updateState}
              onMethodChange={handleMethodChange}
              onPhoneNumberChange={handlePhoneNumberChange}
              onEmailChange={handleEmailChange}
              onPasswordChange={handlePasswordChange}
              onOTPCodeChange={handleOTPCodeChange}
              onTogglePassword={togglePassword}
              onPhonePasswordSignIn={handlePhonePasswordSignIn}
              onEmailPasswordSignIn={handleEmailPasswordSignIn}
              onSendOTP={handleSendOTP}
              onVerifyOTP={handleVerifyOTP}
              onResendOTP={handleResendOTP}
              onGoogleSignIn={handleGoogleSignIn}
              onForgotPassword={handleForgotPassword}
              formatCountdown={formatCountdown}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </AuthTabs>
    </div>
  );
}

/**
 * Sign In Form Component
 */
interface SignInFormProps {
  state: SignInState;
  onStateChange: <K extends keyof SignInState>(key: K, value: SignInState[K]) => void;
  onMethodChange: (method: SignInMethod) => void;
  onPhoneNumberChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOTPCodeChange: (value: string) => void;
  onTogglePassword: () => void;
  onPhonePasswordSignIn: () => void;
  onEmailPasswordSignIn: () => void;
  onSendOTP: () => void;
  onVerifyOTP: () => void;
  onResendOTP: () => void;
  onGoogleSignIn: () => void;
  onForgotPassword: () => void;
  formatCountdown: (seconds: number) => string;
}

function SignInForm({
  state,
  onMethodChange,
  onPhoneNumberChange,
  onEmailChange,
  onPasswordChange,
  onOTPCodeChange,
  onTogglePassword,
  onPhonePasswordSignIn,
  onEmailPasswordSignIn,
  onSendOTP,
  onVerifyOTP,
  onResendOTP,
  onGoogleSignIn,
  onForgotPassword,
  formatCountdown,
}: SignInFormProps) {
  return (
    <>
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome Back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your account
        </p>
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{state.error}</p>
        </div>
      )}

      {/* Method Toggle */}
      <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => onMethodChange("phone")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
            state.method === "phone" || state.method === "otp"
              ? "bg-primary text-primary-foreground"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Phone className="w-4 h-4" />
          Phone
        </button>
        <button
          type="button"
          onClick={() => onMethodChange("email")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
            state.method === "email"
              ? "bg-primary text-primary-foreground"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
      </div>

      {/* Phone + Password Method */}
      {state.method === "phone" && (
        <>
          <PhoneInput
            label="Phone Number"
            phoneNumber={state.phoneNumber}
            onPhoneNumberChange={onPhoneNumberChange}
            required
            maxLength={10}
            className="mb-4"
          />

          <PasswordField
            label="Password"
            required
            placeholder="Enter your password"
            value={state.passwordValue}
            onChange={(e) => onPasswordChange(e.target.value)}
            showPassword={state.showPassword}
            onTogglePassword={onTogglePassword}
            containerClassName="mb-4"
          />

          <div className="flex justify-end mb-4">
            <Button
              variant="link"
              className="text-sm h-auto p-0 text-muted-foreground hover:text-foreground"
              onClick={onForgotPassword}
            >
              Forgot password?
            </Button>
          </div>

          <AuthButton
            variant="primary"
            className="w-full mb-4"
            onClick={onPhonePasswordSignIn}
            disabled={!state.phoneNumber || !state.passwordValue || state.isLoading}
          >
            {state.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </AuthButton>

          <div className="text-center mb-4">
            <button
              type="button"
              onClick={onSendOTP}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in with OTP instead
            </button>
          </div>
        </>
      )}

      {/* Email + Password Method */}
      {state.method === "email" && (
        <>
          <div className="mb-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Email Address
            </label>
            <input
              type="email"
              value={state.email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="your@email.com"
              className={cn(
                "w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-lg",
                "focus:outline-none focus:border-primary transition-all",
                "placeholder:text-gray-500"
              )}
            />
          </div>

          <PasswordField
            label="Password"
            required
            placeholder="Enter your password"
            value={state.passwordValue}
            onChange={(e) => onPasswordChange(e.target.value)}
            showPassword={state.showPassword}
            onTogglePassword={onTogglePassword}
            containerClassName="mb-4"
          />

          <AuthButton
            variant="primary"
            className="w-full mb-4"
            onClick={onEmailPasswordSignIn}
            disabled={!state.email || !state.passwordValue || state.isLoading}
          >
            {state.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </AuthButton>
        </>
      )}

      {/* OTP Method */}
      {state.method === "otp" && (
        <>
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300 text-center">
              OTP sent to <span className="font-semibold">+91 {state.phoneNumber}</span>
            </p>
          </div>

          <OTPInput
            length={6}
            label="Enter OTP"
            value={state.otpCode}
            onChange={onOTPCodeChange}
            required
            className="mb-4"
          />

          <div className="text-center mb-4">
            <button
              type="button"
              onClick={onResendOTP}
              disabled={!state.canResendOTP}
              className={cn(
                "text-sm transition-colors",
                state.canResendOTP
                  ? "text-muted-foreground hover:text-foreground cursor-pointer"
                  : "text-gray-500 cursor-not-allowed"
              )}
            >
              {state.canResendOTP ? "Resend OTP" : `Resend in ${formatCountdown(state.countdown)}`}
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <Button
              onClick={() => onMethodChange("phone")}
              variant="outline"
              className="flex-1 h-12 border-white/10 hover:bg-white/5"
            >
              Back
            </Button>
            <AuthButton
              variant="primary"
              className="flex-1"
              onClick={onVerifyOTP}
              disabled={state.otpCode.length !== 6 || state.isLoading}
            >
              {state.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </AuthButton>
          </div>
        </>
      )}

      {/* Divider */}
      <Divider text="Or continue with" className="mb-4" />

      {/* Google Sign-In */}
      <SocialButtons
        layout="full"
        providers={[
          {
            name: "Google",
            icon: <FcGoogle size={18} />,
            onClick: onGoogleSignIn,
          },
        ]}
      />

      {/* Sign Up Link */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-semibold text-foreground hover:underline"
          >
            Sign Up
          </Button>
        </p>
      </div>
    </>
  );
}
