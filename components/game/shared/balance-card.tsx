"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BalanceCardProps {
  /**
   * Currency name or symbol
   */
  currency: string;

  /**
   * Balance amount to display
   */
  balance: string;

  /**
   * Currency icon (emoji or react-icon)
   */
  icon: React.ReactNode;

  /**
   * Optional click handler
   */
  onClick?: () => void;

  /**
   * Card class name
   */
  className?: string;

  /**
   * Balance text class name
   */
  balanceClassName?: string;

  /**
   * Subtitle text (e.g., "Available")
   */
  subtitle?: string;

  /**
   * Show gradient background
   */
  gradient?: string;

  /**
   * Glow/border color
   */
  glow?: string;
}

/**
 * Balance display card
 * Shows user balance with optional interactivity
 *
 * @example
 * ```tsx
 * <BalanceCard
 *   currency="BTC"
 *   balance="1.2345"
 *   icon="₿"
 *   subtitle="Available"
 * />
 * ```
 */
const BalanceCard = React.forwardRef<HTMLDivElement, BalanceCardProps>(
  (
    {
      currency,
      balance,
      icon,
      onClick,
      className,
      balanceClassName,
      subtitle = "Available",
      gradient,
      glow,
    },
    ref
  ) => {
    return (
      <Card
        onClick={onClick}
        className={cn(
          "overflow-hidden cursor-pointer rounded-xl p-4",
          "flex flex-col items-start gap-2",
          "border border-border",
          "transition-colors duration-200",
          "hover:border-primary/50",
          className
        )}
        style={{
          background: gradient || undefined,
          ...(glow && { borderColor: `${glow}44` }),
        }}
      >
        {/* Icon and Currency */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
              glow && "bg-opacity-20",
              "bg-muted"
            )}
            style={glow ? { backgroundColor: `${glow}20` } : undefined}
          >
            {icon}
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              {currency}
            </div>
            {subtitle && (
              <div className="text-xs text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Balance Amount */}
        <div className={cn("text-xl font-bold text-foreground", balanceClassName)}>
          {balance}
        </div>

        {/* Optional glow indicator */}
        {glow && (
          <div
            className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: glow }}
          />
        )}
      </Card>
    );
  }
);

BalanceCard.displayName = "BalanceCard";

export { BalanceCard };
