"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// India only - simplified for India-only support
const INDIA_CODE = { code: "+91", country: "India" };

export interface PhoneInputProps {
  /**
   * Label for the phone input
   */
  label?: string;

  /**
   * Current phone number value
   */
  phoneNumber?: string;

  /**
   * Callback when phone number changes
   */
  onPhoneNumberChange?: (number: string) => void;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Is the field required
   */
  required?: boolean;

  /**
   * Is the field disabled
   */
  disabled?: boolean;

  /**
   * Error message
   */
  error?: string;

  /**
   * Maximum length for phone number (default 10 for India)
   */
  maxLength?: number;
}

/**
 * Phone input component with India country code (+91)
 * Optimized for Indian phone numbers (10 digits)
 *
 * @example
 * ```tsx
 * <PhoneInput
 *   label="Phone Number"
 *   phoneNumber="9876543210"
 *   onPhoneNumberChange={(number) => setPhoneNumber(number)}
 *   required
 * />
 * ```
 */
export const PhoneInput = React.forwardRef<HTMLDivElement, PhoneInputProps>(
  (
    {
      label,
      phoneNumber = "",
      onPhoneNumberChange,
      className,
      required = false,
      disabled = false,
      error,
      maxLength = 10,
    },
    ref
  ) => {
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow numbers
      const value = e.target.value.replace(/\D/g, "");
      onPhoneNumberChange?.(value);
    };

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Phone Input Container */}
        <div
          className={cn(
            "flex items-center gap-2",
            "bg-background",
            "border-2",
            error ? "border-red-500" : "border-input",
            "rounded-lg",
            "transition-colors duration-200",
            "focus-within:border-primary",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* India Country Code - Static Display */}
          <div
            className={cn(
              "flex items-center",
              "px-3 py-2.5",
              "border-r border-border",
              "bg-muted/30",
              "text-foreground"
            )}
          >
            <span className="text-sm font-medium">{INDIA_CODE.code}</span>
          </div>

          {/* Phone Number Input */}
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="9876543210"
            maxLength={maxLength}
            disabled={disabled}
            className={cn(
              "flex-1 bg-transparent border-0 outline-none",
              "text-foreground placeholder:text-muted-foreground",
              "py-2.5 pr-3",
              "disabled:cursor-not-allowed"
            )}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}

        {/* Helper Text */}
        {!error && (
          <p className="text-xs text-muted-foreground">
            Enter your 10-digit Indian phone number
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
