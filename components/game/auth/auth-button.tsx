"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Game platform button variants using global theme
 */
const authButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: [
          // Using shadcn primary button style
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "h-11 px-4",
          "font-bold text-base",
          "rounded-lg",
          "shadow-sm",
        ],
        secondary: [
          // Using shadcn secondary/outline style
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          "border border-border",
          "h-11 px-4",
          "font-semibold text-sm",
          "rounded-lg",
        ],
        social: [
          // Muted background for social buttons
          "bg-muted text-muted-foreground hover:bg-muted/80",
          "border border-border",
          "h-11 px-4",
          "font-semibold text-sm",
          "rounded-lg",
          "gap-2",
        ],
        "social-icon": [
          // Icon-only social buttons
          "bg-muted text-muted-foreground hover:bg-muted/80",
          "border border-border",
          "p-3 aspect-square",
          "rounded-lg",
          "flex items-center justify-center",
        ],
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface AuthButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof authButtonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Game-styled button using global theme
 * Follows shadcn button patterns
 */
const AuthButton = React.forwardRef<HTMLButtonElement, AuthButtonProps>(
  (
    {
      variant,
      className,
      loading = false,
      icon,
      iconRight,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn(authButtonVariants({ variant }), className)}
        variant={variant === "primary" ? "default" : "outline"}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
        {!loading && iconRight && (
          <span className="flex-shrink-0">{iconRight}</span>
        )}
      </Button>
    );
  }
);
AuthButton.displayName = "AuthButton";

export { AuthButton, authButtonVariants };
