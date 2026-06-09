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
  Divider,
} from "@/components/game";
import { useAuth } from "@/hooks/use-auth";

type TabValue = "signin" | "signup";

interface SignInState {
  tab: TabValue;
  phoneNumber: string;
  passwordValue: string;
  showPassword: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: SignInState = {
  tab: "signin",
  phoneNumber: "",
  passwordValue: "",
  showPassword: false,
  isLoading: false,
  error: null,
};

/**
 * Sign In Page - Phone + Password Only
 *
 * Cost-optimized signin using only phone + password authentication:
 * - Phone number + password sign in (for users with password set)
 * - Google OAuth (alternative)
 *
 * Removed OTP-based signin to reduce SMS costs and encourage password reuse
 */
export default function SignInPage() {
  const router = useRouter();
  const { signInWithPhone, signInWithGoogle } = useAuth();
  const [state, setState] = useState<SignInState>(initialState);

  const updateState = useCallback(<K extends keyof SignInState>(
    key: K,
    value: SignInState[K]
  ) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleTabChange = useCallback((value: string) => {
    if (value === "signup") router.push("/signup");
  }, [router]);

  const handleClose = useCallback(() => router.push("/"), [router]);

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
        return;
      }
      router.push("/");
    } catch (err) {
      updateState("error", err instanceof Error ? err.message : "Sign in failed");
    } finally {
      updateState("isLoading", false);
    }
  }, [state.phoneNumber, state.passwordValue, signInWithPhone, router, updateState]);

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
          {/* Header — matches SignUp motion entrance */}
          <motion.div
            className="mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your account
            </p>
          </motion.div>

          {/* Error — animated, matches SignUp */}
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

          {/* Phone field — stagger delay matches SignUp field order */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
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
          </motion.div>

          {/* Password field */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <PasswordField
              label="Password"
              required
              placeholder="Enter your password"
              value={state.passwordValue}
              onChange={e => {
                updateState("passwordValue", e.target.value);
                if (state.error) updateState("error", null);
              }}
              showPassword={state.showPassword}
              onTogglePassword={() => updateState("showPassword", !state.showPassword)}
            />
          </motion.div>

          {/* Forgot password */}
          <motion.div
            className="flex justify-end"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            <Button
              variant="link"
              className="text-sm h-auto p-0 text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/forgot-password")}
            >
              Forgot password?
            </Button>
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <AuthButton
              variant="primary"
              className="w-full"
              onClick={handlePhonePasswordSignIn}
              disabled={!state.phoneNumber || !state.passwordValue || state.isLoading}
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
                    Signing in...
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Sign In
                  </motion.span>
                )}
              </AnimatePresence>
            </AuthButton>
          </motion.div>

          {/* Social — matches SignUp */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Divider text="Or continue with" />
            <div className="mt-4">
              <SocialButtons
                layout="full"
                providers={[
                  {
                    name: "Google",
                    icon: <FcGoogle size={18} />,
                    onClick: () => signInWithGoogle(),
                  },
                ]}
              />
            </div>
          </motion.div>

          {/* Sign Up link */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-semibold text-foreground hover:underline"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </p>
          </motion.div>
        </div>
      </AuthTabs>
    </div>
  );
}