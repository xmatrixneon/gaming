"use client";

import * as React from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface OTPInputProps {
  /**
   * Number of OTP digits (default: 6)
   */
  length?: number;

  /**
   * Label text
   */
  label?: string;

  /**
   * Required indicator
   */
  required?: boolean;

  /**
   * Error message
   */
  error?: string;

  /**
   * Container class name
   */
  containerClassName?: string;

  /**
   * Class name (alias for containerClassName)
   */
  className?: string;

  /**
   * Callback when OTP value changes
   */
  onChange?: (value: string) => void;

  /**
   * Current OTP value
   */
  value?: string;

  /**
   * Maximum length
   */
  maxLength?: number;
}

/**
 * OTP input component for phone verification
 * Uses shadcn input-otp with game theme styling
 */
const OTPInput = React.forwardRef<HTMLDivElement, OTPInputProps>(
  ({ length = 6, label, required, error, containerClassName, className, onChange, value, maxLength }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "");

    // Handle value changes
    const handleChange = (newValue: string) => {
      const actualLength = maxLength || length;
      const truncatedValue = newValue.slice(0, actualLength);
      setInternalValue(truncatedValue);
      onChange?.(truncatedValue);
    };

    // Reset internal value when value prop changes
    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const actualLength = maxLength || length;

    return (
      <div ref={ref} className={cn("space-y-3", className, containerClassName)}>
        {label && (
          <Label className="text-muted-foreground text-sm font-medium">
            {label}{" "}
            {required && <span className="text-destructive text-xs">*</span>}
          </Label>
        )}
        <InputOTP
          value={internalValue}
          onChange={handleChange}
          maxLength={actualLength}
          className="justify-center gap-2"
        >
          <InputOTPGroup>
            {Array.from({ length: actualLength }).map((_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className={cn(
                  "h-12 w-12 sm:h-14 sm:w-14",
                  "text-base sm:text-lg",
                  "border-input/50",
                  "data-[active=true]:border-primary",
                  "data-[active=true]:ring-primary/30",
                  "transition-all duration-200"
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error && (
          <p className="text-destructive text-xs font-medium">{error}</p>
        )}
      </div>
    );
  }
);

OTPInput.displayName = "OTPInput";

export { OTPInput };
