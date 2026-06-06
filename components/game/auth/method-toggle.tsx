"use client";

import * as React from "react";
import { Lock, Smartphone } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SignInMethod = "password" | "otp";

export interface MethodToggleProps {
  value: SignInMethod;
  onChange: (value: SignInMethod) => void;
  className?: string;
  buttonClassName?: string;
  labels?: {
    password?: string;
    otp?: string;
  };
}

/**
 * Pill-shaped toggle using global theme
 * Follows shadcn toggle-group patterns
 */
const MethodToggle = React.forwardRef<HTMLDivElement, MethodToggleProps>(
  (
    {
      value,
      onChange,
      className,
      buttonClassName,
      labels = { password: "Password", otp: "One-time Code" },
    },
    ref
  ) => {
    return (
      <ToggleGroup
        ref={ref}
        type="single"
        value={value}
        onValueChange={(val) => onChange(val as SignInMethod)}
        className={cn(
          "w-full inline-flex",
          "bg-muted rounded-[30px]",
          "p-1 mb-7",
          className
        )}
      >
        <ToggleGroupItem
          value="password"
          aria-label="Sign in with password"
          className={cn(
            "flex-1 h-10 px-0",
            "rounded-[24px]",
            "font-semibold text-sm",
            "transition-all duration-200",
            // Using shadcn toggle states
            "data-[state=on]:bg-background data-[state=on]:text-foreground",
            "data-[state=off]:text-muted-foreground hover:bg-background/50",
            "focus-visible:ring-0 focus-visible:outline-none",
            "gap-1.5",
            buttonClassName
          )}
        >
          <Lock size={13} className="flex-shrink-0" />
          <span>{labels.password}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="otp"
          aria-label="Sign in with one-time code"
          className={cn(
            "flex-1 h-10 px-0",
            "rounded-[24px]",
            "font-semibold text-sm",
            "transition-all duration-200",
            "data-[state=on]:bg-background data-[state=on]:text-foreground",
            "data-[state=off]:text-muted-foreground hover:bg-background/50",
            "focus-visible:ring-0 focus-visible:outline-none",
            "gap-1.5",
            buttonClassName
          )}
        >
          <Smartphone size={15} className="flex-shrink-0" />
          <span>{labels.otp}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }
);
MethodToggle.displayName = "MethodToggle";

export { MethodToggle };
