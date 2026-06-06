"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TickerCardProps {
  /**
   * Username (masked)
   */
  user: string;

  /**
   * Win amount with currency
   */
  amount: string;

  /**
   * Color for the amount and icon
   */
  color: string;

  /**
   * Emoji/icon for the currency
   */
  emoji: string;

  /**
   * Icon to display (overrides emoji if provided)
   */
  icon?: React.ReactNode;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Card class name
   */
  className?: string;

  /**
   * Minimum width
   * @default 130
   */
  minWidth?: number;
}

/**
 * Individual ticker card for big win display
 * Shows user, game, and win amount with colored accents
 *
 * @example
 * ```tsx
 * <TickerCard
 *   user="ncpbnu***"
 *   game="Blackjack Luxury"
 *   amount="1.361 BTC"
 *   color="#F7931A"
 *   emoji="₿"
 * />
 * ```
 */
const TickerCard = React.forwardRef<HTMLDivElement, TickerCardProps>(
  (
    {
      user,
      amount,
      color,
      emoji,
      icon,
      onClick,
      className,
      minWidth = 130,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          "bg-muted border border-border rounded-xl p-3",
          "flex-shrink-0 cursor-pointer transition-colors duration-200",
          "hover:bg-muted/80 hover:border-border/80",
          className
        )}
        style={{ minWidth: `${minWidth}px` }}
      >
        {/* Icon/emoji container */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg mb-1.5 flex items-center justify-center text-2xl"
          )}
          style={{
            background: `${color}22`,
            border: `1px solid ${color}44`,
          }}
        >
          {icon || emoji}
        </div>

        {/* User */}
        <div className={cn("text-[11px] text-muted-foreground mb-0.5")}>
          {user}
        </div>

        {/* Win amount */}
        <div
          className={cn("text-[13px] font-bold")}
          style={{ color }}
        >
          {amount}
        </div>
      </div>
    );
  }
);
TickerCard.displayName = "TickerCard";

export { TickerCard };
