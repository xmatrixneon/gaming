"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hoverScale, hoverTransition } from "@/components/lib/game-animations";

export interface GameCardProps {
  /**
   * Game name
   */
  name: string;

  /**
   * Provider name
   */
  provider: string;

  /**
   * Tag label (e.g., "HOT", "ORIGINAL", "NEW")
   */
  tag?: string;

  /**
   * Tag background color
   */
  tagColor?: string;

  /**
   * Player count display (e.g., "12.4K")
   */
  players?: string;

  /**
   * Emoji or icon for the game
   */
  emoji: string;

  /**
   * Background color for the card
   */
  background: string;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Card class name
   */
  className?: string;
}

/**
 * Individual game card with hover effects
 * Extends shadcn Card with gaming platform styling
 *
 * @example
 * ```tsx
 * <GameCard
 *   name="Aviator"
 *   provider="Spribe"
 *   tag="HOT"
 *   tagColor="#FF4444"
 *   players="12.4K"
 *   emoji="🛩️"
 *   background="#1a0a2e"
 *   onClick={() => navigate(`/games/aviator`)}
 * />
 * ```
 */
const GameCard = React.forwardRef<HTMLDivElement, GameCardProps>(
  (
    {
      name,
      provider,
      tag,
      tagColor = "#00C851",
      players,
      emoji,
      background,
      onClick,
      className,
    },
    ref
  ) => {
    const isDarkTag = tagColor === "#FFB800";

    return (
      <motion.div
        ref={ref}
        whileHover="hover"
        whileTap="press"
        variants={hoverScale}
        transition={hoverTransition}
        className={cn("relative", className)}
      >
        <Card
          onClick={onClick}
          className={cn(
            "overflow-hidden cursor-pointer",
            "border border rounded-xl",
            "transition-colors duration-200",
            "hover:border-border/80"
          )}
          style={{ background }}
        >
          {/* Game icon/emoji area */}
          <div
            className={cn(
              "relative h-20 flex items-center justify-center text-9xl"
            )}
          >
            {emoji}
            {tag && (
              <div
                className={cn(
                  "absolute top-1 right-1",
                  "px-1 py-0.5 rounded text-[8px] font-bold",
                  "tracking-wider uppercase"
                )}
                style={{
                  background: tagColor,
                  color: isDarkTag ? "#000" : "#fff",
                }}
              >
                {tag}
              </div>
            )}
          </div>

          {/* Game info */}
          <div className={cn("px-2 pb-2 pt-1.5")}>
            <div
              className={cn(
                "text-xs font-bold text-white leading-tight mb-0.5"
              )}
            >
              {name}
            </div>
            <div className={cn("text-[10px] text-muted-foreground mb-1")}>
              {provider}
            </div>
            {players && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-[10px] text-primary font-semibold"
                )}
              >
                <Users size={9} className="flex-shrink-0" />
                <span>{players}</span>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }
);
GameCard.displayName = "GameCard";

export { GameCard };
