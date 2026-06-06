"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AuthInputProps extends React.ComponentProps<typeof Input> {
  label?: string;
  required?: boolean;
  error?: string;
  containerClassName?: string;
}

/**
 * Game-styled input component using global theme variables
 * Follows shadcn design system consistency
 */
const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, required, error, className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <Label className="text-muted-foreground text-sm font-medium">
            {label}{" "}
            {required && <span className="text-destructive text-xs">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          className={cn(
            // Using global theme via shadcn Input base styles
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-destructive text-xs">{error}</p>
        )}
      </div>
    );
  }
);
AuthInput.displayName = "AuthInput";

export { AuthInput };
