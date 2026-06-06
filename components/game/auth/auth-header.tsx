"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AuthHeaderProps {
  /**
   * Callback when close button is clicked
   */
  onClose?: () => void;

  /**
   * Optional title to display
   */
  title?: string;

  /**
   * Optional logo/icon to display
   */
  logo?: React.ReactNode;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Show close button
   * @default true
   */
  showClose?: boolean;
}

/**
 * Authentication header with close button
 * Standalone component for auth screens
 *
 * @example
 * ```tsx
 * <AuthHeader
 *   onClose={() => router.push("/")}
 *   title="Welcome Back"
 * />
 * ```
 */
const AuthHeader = React.forwardRef<HTMLDivElement, AuthHeaderProps>(
  ({ onClose, title, logo, className, showClose = true }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between",
          "bg-background border-b border-border",
          "px-5 py-3",
          className
        )}
      >
        {/* Logo/Title section */}
        <div className={cn("flex items-center gap-2")}>
          {logo && <div className="flex-shrink-0">{logo}</div>}
          {title && (
            <h1 className="text-base font-semibold text-foreground">
              {title}
            </h1>
          )}
        </div>

        {/* Close button */}
        {showClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={cn(
              "flex-shrink-0",
              "h-9 w-9 p-0 rounded-lg",
              "hover:bg-muted"
            )}
          >
            <X size={13} strokeWidth={2} />
          </Button>
        )}
      </div>
    );
  }
);

AuthHeader.displayName = "AuthHeader";

export { AuthHeader };
