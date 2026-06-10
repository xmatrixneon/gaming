/**
 * Game Card Component
 *
 * Displays individual game with image, name, and launch button
 */

"use client";

import { motion } from "motion/react";

interface GameCardProps {
  game: {
    game_uid: string;
    game_name: string;
    game_type: string;
    image_url?: string;
    status: number;
    provider_code?: string;
  };
  onLaunch: () => void;
}

export function GameCard({ game, onLaunch }: GameCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative group cursor-pointer"
      onClick={onLaunch}
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg">
        {/* Game Image */}
        {game.image_url ? (
          <img
            src={game.image_url}
            alt={game.game_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10">
            <span className="text-4xl">🎮</span>
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Game Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1">
            {game.game_name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 capitalize">{game.game_type}</span>
            {game.provider_code && (
              <span className="text-xs text-white/60">{game.provider_code}</span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {game.status === 1 && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
            Active
          </div>
        )}
      </div>

      {/* Play Button - Visible on Hover */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileHover={{ opacity: 1, y: 0 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm shadow-lg">
          Play Now
        </div>
      </motion.div>
    </motion.div>
  );
}
