"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AuthCheckboxProps extends Omit<
  React.ComponentProps<typeof Checkbox>,
  "id" | "checked" | "onCheckedChange"
> {
  label: React.ReactNode;
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  containerClassName?: string;
}

/**
 * Checkbox using global theme
 * Follows shadcn checkbox patterns
 */
const AuthCheckbox = React.forwardRef<HTMLButtonElement, AuthCheckboxProps>(
  (
    {
      label,
      id,
      checked = false,
      onCheckedChange,
      disabled,
      containerClassName,
      className,
      ...props
    },
    ref
  ) => {
    const checkboxId = React.useId();
    const finalId = id || checkboxId;

    const handleChange = (newChecked: boolean) => {
      onCheckedChange?.(newChecked);
    };

    return (
      <div
        className={cn(
          "flex items-start gap-3 cursor-pointer",
          disabled && "cursor-not-allowed opacity-50",
          containerClassName
        )}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('[role="checkbox"]') && !disabled) {
            handleChange(!checked);
          }
        }}
      >
        <Checkbox
          ref={ref}
          id={finalId}
          checked={checked}
          onCheckedChange={handleChange}
          disabled={disabled}
          className={cn(
            "h-5 w-5 rounded",
            // Using global theme for checkbox
            className
          )}
          {...props}
        >
          {checked && (
            <Check
              className="text-primary"
              size={12}
              strokeWidth={2.5}
            />
          )}
        </Checkbox>
        <Label
          htmlFor={finalId}
          className={cn(
            "text-muted-foreground text-sm leading-relaxed font-normal cursor-pointer",
            "hover:text-foreground transition-colors duration-200",
            disabled && "pointer-events-none"
          )}
        >
          {label}
        </Label>
      </div>
    );
  }
);
AuthCheckbox.displayName = "AuthCheckbox";

export { AuthCheckbox };
