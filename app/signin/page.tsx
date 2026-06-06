"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { FcGoogle } from "react-icons/fc";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type TabValue = "signin" | "signup";

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [tab, setTab] = useState<TabValue>("signin");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!phoneNumber || !passwordValue) return;

    setIsLoading(true);

    // Full phone number with India country code
    const fullPhone = `+91${phoneNumber}`;

    // TODO: Integrate with actual sign-in API
    console.log("Sign in with phone:", fullPhone, "password:", "***");

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Set authentication state
    login();

    setIsLoading(false);

    // On success, redirect to home or dashboard
    router.push("/");
  };

  const handleGoogleSignIn = () => {
    console.log("Sign in with Google");
    // TODO: Integrate with Google OAuth
    // Redirect to Google OAuth flow
  };

  const isDisabled = !phoneNumber || !passwordValue || isLoading;

  return (
    <div
      className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
      )}
    >
      <AuthHeader onClose={() => router.push("/")} />

      <AuthTabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabValue);
          if (v === "signup") {
            router.push("/signup");
          }
        }}
        tabs={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        {tab === "signin" && (
          <motion.div
            key="signin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="px-5 py-7 pb-10"
          >
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to your account
          </p>
        </div>

        {/* Phone Number Input with India Code (+91) */}
        <PhoneInput
          label="Phone Number"
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          required
          maxLength={10}
          className="mb-4"
        />

        {/* Password Input */}
        <PasswordField
          label="Password"
          required
          placeholder="Enter your password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          containerClassName="mb-6"
        />

        {/* Forgot Password Link */}
        <div className="flex justify-end mb-7">
          <Button
            variant="link"
            className="text-sm h-auto p-0 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/forgot-password")}
          >
            Forgot password?
          </Button>
        </div>

        {/* Sign In Button */}
        <AuthButton
          variant="primary"
          className="w-full mb-6"
          onClick={handleSignIn}
          disabled={isDisabled}
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </AuthButton>

        {/* Divider */}
        <Divider text="Or continue with" className="mb-4" />

        {/* Google Sign-In */}
        <SocialButtons
          layout="full"
          providers={[
            {
              name: "Google",
              icon: <FcGoogle size={18} />,
              onClick: handleGoogleSignIn,
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
              onClick={() => setTab("signup")}
            >
              Sign Up
            </Button>
          </p>
        </div>
      </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
