"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  /**
   * Current page title (optional - shows on inner pages)
   */
  title?: string;

  /**
   * Show back button instead of logo
   * @default false
   */
  showBackButton?: boolean;

  /**
   * Container class name
   */
  className?: string;

  /**
   * User is logged in
   * @default false
   */
  isAuthenticated?: boolean;

  /**
   * User profile data
   */
  user?: {
    username?: string;
    avatar?: string;
    balance?: number;
    vipLevel?: string;
  };

  /**
   * Notification count badge
   */
  notificationCount?: number;
}

/**
 * BC.Game app header with logo, user profile, balance, and notifications
 * Used across all pages for consistent navigation
 *
 * @example
 * ```tsx
 * <AppHeader
 *   isAuthenticated={true}
 *   user={{ username: "Player123", balance: 12500.50, avatar: "🎮" }}
 *   notificationCount={3}
 * />
 * ```
 */
const AppHeader = React.forwardRef<HTMLDivElement, AppHeaderProps>(
  (
    {
      title,
      showBackButton = false,
      className,
      isAuthenticated = false,
      user,
      notificationCount = 0,
    },
    ref
  ) => {
    const router = useRouter();
    const [avatarError, setAvatarError] = useState(false);

    // Get user initials for avatar fallback
    const getInitials = (name?: string) => {
      if (!name) return "👤";
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    };

    const handleBack = () => {
      router.back();
    };

    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 z-50",
          "bg-muted/80 backdrop-blur-md",
          "border-b border-border",
          "px-4 py-3",
          "flex items-center justify-between",
          className
        )}
      >
        {/* Left: Logo or Back Button */}
        <div className={cn("flex items-center gap-2")}>
          {showBackButton ? (
            <button
              onClick={handleBack}
              className={cn(
                "flex items-center justify-center",
                "w-8 h-8 rounded-lg",
                "bg-muted border border-border",
                "hover:border-primary/50",
                "transition-colors duration-200"
              )}
            >
              <ChevronDown className="rotate-90" size={16} />
            </button>
          ) : (
            <>
              {/* Logo */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg",
                  "bg-primary",
                  "flex items-center justify-center",
                  "font-bold text-base",
                  "text-primary-foreground"
                )}
              >
                B
              </div>
              <span className={cn("font-bold text-xl tracking-wider")}>
                <span className="text-foreground">BC</span>
                <span className="text-muted-foreground">.</span>
                <span className="text-primary">GAME</span>
              </span>
            </>
          )}
        </div>

        {/* Right: User Profile or Auth Buttons */}
        {isAuthenticated && user ? (
          <div className={cn("flex items-center gap-2")}>
            {/* Balance Display */}
            <div
              className={cn(
                "hidden sm:flex flex-col items-end",
                "px-3 py-1.5 rounded-lg",
                "bg-muted/50 border border-border",
                "cursor-pointer hover:border-primary/50",
                "transition-colors duration-200"
              )}
              onClick={() => router.push("/wallet")}
            >
              <span className={cn("text-[10px] text-muted-foreground uppercase tracking-wider")}>
                Balance
              </span>
              <span className={cn("text-sm font-bold text-foreground leading-tight")}>
                {user.balance !== undefined ? `$${user.balance.toLocaleString()}` : "---"}
              </span>
            </div>

            {/* Notification Bell */}
            <button
              className={cn(
                "relative flex items-center justify-center",
                "w-9 h-9 rounded-lg",
                "bg-muted border border-border",
                "hover:border-primary/50",
                "transition-colors duration-200"
              )}
              onClick={() => router.push("/notifications")}
            >
              <Bell size={16} className="text-muted-foreground" />
              {notificationCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-0.5",
                    "min-w-[14px] h-4",
                    "flex items-center justify-center",
                    "text-[10px] font-bold",
                    "bg-red-500 text-white rounded-full",
                    "px-1"
                  )}
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>

            {/* Profile Avatar */}
            <button
              className={cn(
                "relative",
                "hover:opacity-80",
                "transition-opacity duration-200"
              )}
              onClick={() => router.push("/profile")}
            >
              <Avatar size="lg" className="ring-2 ring-background">
                {user.avatar && !avatarError ? (
                  <AvatarImage
                    src={user.avatar}
                    alt={user.username}
                    onError={() => setAvatarError(true)}
                  />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs font-bold">
                  {getInitials(user.username)}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        ) : (
          <div className={cn("flex gap-2")}>
            <Link href="/signin">
              <button
                className={cn(
                  "bg-transparent border border-border",
                  "text-foreground",
                  "px-4 py-1.5 rounded-md",
                  "font-semibold text-sm",
                  "tracking-wider",
                  "transition-colors duration-200"
                )}
              >
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button
                className={cn(
                  "bg-primary border-0",
                  "text-primary-foreground",
                  "px-4 py-1.5 rounded-md",
                  "font-bold text-sm",
                  "tracking-wider"
                )}
              >
                Sign Up
              </button>
            </Link>
          </div>
        )}
      </div>
    );
  }
);

AppHeader.displayName = "AppHeader";

export { AppHeader };
