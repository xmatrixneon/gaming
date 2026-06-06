"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PasswordFieldProps extends React.ComponentProps<typeof Input> {
  label?: string;
  required?: boolean;
  error?: string;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  containerClassName?: string;
  iconClassName?: string;
}

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      label,
      required,
      error,
      showPassword = false,
      onTogglePassword,
      className,
      containerClassName,
      iconClassName,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("relative space-y-2", containerClassName)}>
        {label && (
          <Label className="text-muted-foreground text-sm font-medium">
            {label}{" "}
            {required && <span className="text-destructive text-xs">*</span>}
          </Label>
        )}
        <div className="relative flex items-center">
          <Input
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={cn("pr-10", className)}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "absolute right-1.5",
              "h-7 w-7 p-0",
              "hover:bg-muted",
              "z-10",
              "flex items-center justify-center",
              iconClassName
            )}
            onClick={onTogglePassword}
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={2} />
            ) : (
              <Eye size={16} strokeWidth={2} />
            )}
          </Button>
        </div>
        {error && (
          <p className="text-destructive text-xs">{error}</p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";
export { PasswordField };