"use client";

import * as React from "react";
import { GameCard, type GameCardProps } from "./game-card";
import { cn } from "@/lib/utils";

export interface GameGridProps {
  /**
   * Array of game cards to display
   */
  games: GameCardProps[];

  /**
   * Grid columns (responsive)
   * @default 3
   */
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };

  /**
   * Gap between cards
   * @default 2
   */
  gap?: number;

  /**
   * Game click handler (optional, overrides individual onClick)
   */
  onGameClick?: (game: GameCardProps) => void;

  /**
   * Container class name
   */
  className?: string;
}

/**
 * Responsive game card grid layout
 * Handles different column counts for screen sizes
 *
 * @example
 * ```tsx
 * const games = [
 *   { name: "Aviator", provider: "Spribe", emoji: "🛩️", background: "#1a0a2e" },
 *   { name: "Limbo", provider: "BC.Game", emoji: "🎯", background: "#0a1a2e" },
 *   // ... more games
 * ];
 *
 * <GameGrid games={games} />
 *
 * // With custom columns
 * <GameGrid
 *   games={games}
 *   columns={{ mobile: 2, tablet: 4, desktop: 6 }}
 *   onGameClick={(game) => navigate(`/games/${game.id}`)}
 * />
 * ```
 */
const GameGrid = React.forwardRef<HTMLDivElement, GameGridProps>(
  ({ games, columns = {}, gap = 2, onGameClick, className }, ref) => {
    const {
      mobile: mobileCols = 3,
      tablet: tabletCols = 4,
      desktop: desktopCols = 6,
    } = columns;

    const handleGameClick = React.useCallback(
      (game: GameCardProps) => {
        if (onGameClick) {
          onGameClick(game);
        } else if (game.onClick) {
          game.onClick();
        }
      },
      [onGameClick]
    );

    return (
      <div
        ref={ref}
        className={cn(
          "grid",
          `grid-cols-${mobileCols}`,
          `md:grid-cols-${tabletCols}`,
          `lg:grid-cols-${desktopCols}`,
          `gap-${gap}`,
          className
        )}
      >
        {games.map((game, index) => (
          <GameCard
            key={game.id || game.gameUid || game.name + index}
            {...game}
            onClick={() => handleGameClick(game)}
          />
        ))}
      </div>
    );
  }
);
GameGrid.displayName = "GameGrid";

export { GameGrid };
