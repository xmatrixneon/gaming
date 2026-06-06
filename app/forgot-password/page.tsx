"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phoneNumber) return;

    setIsLoading(true);

    const fullPhone = `+91${phoneNumber}`;

    // TODO: Send OTP to phone number
    console.log("Send OTP to phone:", fullPhone);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);
    setStep(2);
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) return;

    setIsLoading(true);

    const fullPhone = `+91${phoneNumber}`;

    // TODO: Verify OTP
    console.log("Verify OTP for:", fullPhone);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);
    setStep(3);
  };

  const handleResetPassword = async () => {
    if (!newPasswordValue || !confirmPasswordValue) return;

    if (newPasswordValue !== confirmPasswordValue) {
      alert("Passwords do not match!");
      return;
    }

    setIsLoading(true);

    const fullPhone = `+91${phoneNumber}`;

    // TODO: Reset password with new password
    console.log("Reset password for phone:", fullPhone);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);

    // On success, redirect to sign in
    router.push("/signin");
  };

  const handleResendOTP = () => {
    const fullPhone = `+91${phoneNumber}`;
    console.log("Resend OTP to:", fullPhone);
    // TODO: Resend OTP
  };

  // Step 1: Enter phone
  const isStep1Disabled = !phoneNumber || isLoading;

  // Step 2: Verify OTP
  const isStep2Disabled = otpValue.length !== 6 || isLoading;

  // Step 3: Reset password
  const isStep3Disabled =
    !newPasswordValue || !confirmPasswordValue || isLoading;

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
        {step === 1 ? (
          <Step1Phone
            key="step1"
            phoneNumber={phoneNumber}
            isLoading={isLoading}
            isDisabled={isStep1Disabled}
            onPhoneNumberChange={setPhoneNumber}
            onSubmit={handleSendOTP}
          />
        ) : step === 2 ? (
          <Step2OTP
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
        ) : (
          <Step3Password
            key="step3"
            newPasswordValue={newPasswordValue}
            confirmPasswordValue={confirmPasswordValue}
            showNewPassword={showNewPassword}
            showConfirmPassword={showConfirmPassword}
            isLoading={isLoading}
            isDisabled={isStep3Disabled}
            onNewPasswordChange={setNewPasswordValue}
            onConfirmPasswordChange={setConfirmPasswordValue}
            onToggleNewPassword={() => setShowNewPassword(!showNewPassword)}
            onToggleConfirmPassword={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
            onSubmit={handleResetPassword}
            onBack={() => setStep(2)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Step 1: Enter Phone Number
function Step1Phone({
  phoneNumber,
  isLoading,
  isDisabled,
  onPhoneNumberChange,
  onSubmit,
}: {
  phoneNumber: string;
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

      {/* Phone Number Input with India Code (+91) */}
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
        {isLoading ? "Sending..." : "Send Verification Code"}
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
        {isLoading ? "Verifying..." : "Verify Code"}
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

// Step 3: Reset Password
function Step3Password({
  newPasswordValue,
  confirmPasswordValue,
  showNewPassword,
  showConfirmPassword,
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

      {/* New Password Input */}
      <PasswordField
        label="New Password"
        required
        placeholder="Enter new password"
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
        {isLoading ? "Resetting..." : "Reset Password"}
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
