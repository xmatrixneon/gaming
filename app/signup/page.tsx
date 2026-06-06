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
  OTPInput,
  AuthCheckbox,
  CollapsibleField,
  Divider,
} from "@/components/game";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Step = 1 | 2;
type TabValue = "signin" | "signup";

export default function SignUpPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [tab, setTab] = useState<TabValue>("signup");
  const [step, setStep] = useState<Step>(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!phoneNumber || !passwordValue || !agreed) return;

    setIsLoading(true);

    const fullPhone = `+91${phoneNumber}`;

    // TODO: Trigger OTP send to phone
    console.log("Request OTP for phone:", fullPhone);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);
    setStep(2);
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) return;

    setIsLoading(true);

    const fullPhone = `+91${phoneNumber}`;

    // TODO: Verify OTP and create account
    console.log("Verify OTP and create account:", {
      phone: fullPhone,
      password: passwordValue,
      otp: otpValue,
    });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Set authentication state after successful signup
    login();

    setIsLoading(false);

    // On success, redirect to home or dashboard
    router.push("/");
  };

  const handleGoogleSignUp = () => {
    console.log("Sign up with Google");
    // TODO: Integrate with Google OAuth
  };

  const handleResendOTP = () => {
    const fullPhone = `+91${phoneNumber}`;
    console.log("Resend OTP to:", fullPhone);
    // TODO: Trigger OTP resend
  };

  // Step 1: Phone + Password
  const isStep1Disabled = !phoneNumber || !passwordValue || !agreed || isLoading;

  // Step 2: OTP verification
  const isStep2Disabled = otpValue.length !== 6 || isLoading;

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
          if (v === "signin") {
            router.push("/signin");
          }
        }}
        tabs={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <Step1
            key="step1"
            phoneNumber={phoneNumber}
            passwordValue={passwordValue}
            showPassword={showPassword}
            promoOpen={promoOpen}
            agreed={agreed}
            isLoading={isLoading}
            isDisabled={isStep1Disabled}
            onPhoneNumberChange={setPhoneNumber}
            onPasswordChange={setPasswordValue}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onPromoOpenChange={setPromoOpen}
            onAgreedChange={setAgreed}
            onSignUp={handleSignUp}
            onGoogleSignUp={handleGoogleSignUp}
          />
        ) : (
          <Step2
            key="step2"
            phoneValue={`+91${phoneNumber}`}
            otpValue={otpValue}
            isLoading={isLoading}
            isDisabled={isStep2Disabled}
            onOtpChange={setOtpValue}
            onVerify={handleVerifyOTP}
            onResend={handleResendOTP}
            onBack={() => setStep(1)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Step 1: Phone + Password + Terms
function Step1({
  phoneNumber,
  passwordValue,
  showPassword,
  promoOpen,
  agreed,
  isLoading,
  isDisabled,
  onPhoneNumberChange,
  onPasswordChange,
  onTogglePassword,
  onPromoOpenChange,
  onAgreedChange,
  onSignUp,
  onGoogleSignUp,
}: {
  phoneNumber: string;
  passwordValue: string;
  showPassword: boolean;
  promoOpen: boolean;
  agreed: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onPhoneNumberChange: (number: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onPromoOpenChange: (open: boolean) => void;
  onAgreedChange: (checked: boolean) => void;
  onSignUp: () => void;
  onGoogleSignUp: () => void;
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
          Create Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign up to get started with your account
        </p>
      </div>

      {/* Phone Number Input with India Code (+91) */}
      <PhoneInput
        label="Phone Number"
        phoneNumber={phoneNumber}
        onPhoneNumberChange={onPhoneNumberChange}
        required
        maxLength={10}
        className="mb-4"
      />

      {/* Password Input */}
      <PasswordField
        label="Password"
        required
        placeholder="Create a strong password"
        value={passwordValue}
        onChange={(e) => onPasswordChange(e.target.value)}
        showPassword={showPassword}
        onTogglePassword={onTogglePassword}
        containerClassName="mb-4"
      />

      {/* Referral / Promo Code */}
      <CollapsibleField
        label="Enter Referral / Promo Code (Optional)"
        open={promoOpen}
        onOpenChange={onPromoOpenChange}
        placeholder="Referral / Promo Code"
        className="mb-5"
      />

      {/* Terms Checkbox */}
      <AuthCheckbox
        label={
          <>
            I am 18+ and agree to the{" "}
            <span className="text-foreground font-semibold underline hover:underline cursor-pointer">
              Terms and Conditions
            </span>
          </>
        }
        checked={agreed}
        onCheckedChange={onAgreedChange}
        className="mb-7"
      />

      {/* Sign Up Button */}
      <AuthButton
        variant="primary"
        className="w-full mb-6"
        onClick={onSignUp}
        disabled={isDisabled}
      >
        {isLoading ? "Sending code..." : "Continue"}
      </AuthButton>

      {/* Divider */}
      <Divider text="Or continue with" className="mb-4" />

      {/* Google Sign-Up */}
      <SocialButtons
        layout="full"
        providers={[
          {
            name: "Google",
            icon: <FcGoogle size={18} />,
            onClick: onGoogleSignUp,
          },
        ]}
      />

      {/* Sign In Link */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-semibold text-foreground hover:underline"
            onClick={() => setTab("signin")}
          >
            Sign In
          </Button>
        </p>
      </div>
    </motion.div>
  );
}

// Step 2: OTP Verification
function Step2({
  phoneValue,
  otpValue,
  isLoading,
  isDisabled,
  onOtpChange,
  onVerify,
  onResend,
  onBack,
}: {
  phoneValue: string;
  otpValue: string;
  isLoading: boolean;
  isDisabled: boolean;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
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
          Verify your phone
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to {phoneValue}
        </p>
      </div>

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
        {isLoading ? "Verifying..." : "Verify & Create Account"}
      </AuthButton>

      {/* Resend Code */}
      <Button
        variant="link"
        className="text-sm mb-6 w-full"
        onClick={onResend}
      >
        Didn't receive code? Resend
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
