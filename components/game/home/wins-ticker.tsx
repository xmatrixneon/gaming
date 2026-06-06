"use client";

import * as React from "react";
import { TickerCard, type TickerCardProps } from "./ticker-card";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { cn } from "@/lib/utils";

export interface WinsTickerProps {
  /**
   * Array of win cards to display
   */
  wins: TickerCardProps[];

  /**
   * Scroll speed (negative for left, positive for right)
   * @default -0.5
   */
  speed?: number;

  /**
   * Pause on hover
   * @default true
   */
  pauseOnHover?: boolean;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Inner container class name
   */
  innerClassName?: string;
}

/**
 * Infinite scroll ticker for displaying recent big wins
 * Duplicates items for seamless looping animation
 *
 * @example
 * ```tsx
 * const wins = [
 *   {
 *     user: "ncpbnu***",
 *     game: "Blackjack Luxury",
 *     amount: "1.361 BTC",
 *     color: "#F7931A",
 *     emoji: "₿"
 *   },
 *   // ... more wins
 * ];
 *
 * <WinsTicker wins={wins} />
 * ```
 */
const WinsTicker = React.forwardRef<HTMLDivElement, WinsTickerProps>(
  (
    {
      wins,
      speed = -0.5,
      pauseOnHover = true,
      className,
      innerClassName,
    },
    ref
  ) => {
    const tickerRef = React.useRef<HTMLDivElement>(null);

    useAutoScroll(tickerRef, { speed, pauseOnHover, enabled: true });

    // Duplicate items for seamless infinite scroll
    const duplicatedWins = [...wins, ...wins];

    return (
      <div ref={ref} className={cn("overflow-hidden", className)}>
        <div
          ref={tickerRef}
          className={cn("flex gap-2", innerClassName)}
          style={{ width: "max-content" }}
        >
          {duplicatedWins.map((win, index) => (
            <TickerCard key={`${win.user}-${index}`} {...win} />
          ))}
        </div>
      </div>
    );
  }
);
WinsTicker.displayName = "WinsTicker";

export { WinsTicker };
