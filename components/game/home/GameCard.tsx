/**
 * Game Card Component (Games Page)
 *
 * Displays individual game with image, name, and launch button
 * Used on the games listing page
 */

"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Play } from "lucide-react";

interface GameCardProps {
  game: {
    id: string;
    gameUid: string;
    gameName: string;
    gameType: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    imageAlt?: string;
    status: "active" | "disabled" | "maintenance";
    provider: {
      code: string;
      name: string;
    };
    isHot?: boolean;
    isNew?: boolean;
    isFeatured?: boolean;
  };
  isAuthenticated?: boolean;
}

export function GameCard({ game, isAuthenticated = false }: GameCardProps) {
  const router = useRouter();

  const handleLaunch = () => {
    if (!isAuthenticated) {
      // Redirect to signin
      router.push("/signin");
      return;
    }

    if (game.status !== "active") {
      return;
    }

    // Navigate to full-page game play
    router.push(`/play/${game.gameUid}`);
  };

  const hasImage = Boolean(game.imageUrl || game.thumbnailUrl);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative group cursor-pointer"
      onClick={handleLaunch}
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border/50 shadow-lg">
        {/* Game Image */}
        {hasImage ? (
          <img
            src={game.thumbnailUrl || game.imageUrl}
            alt={game.imageAlt || game.gameName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <span className="text-4xl">🎮</span>
          </div>
        )}

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Tags */}
        <div className="absolute top-2 right-2 flex gap-1">
          {game.isHot && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
              Hot
            </span>
          )}
          {game.isNew && (
            <span className="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
              New
            </span>
          )}
          {game.isFeatured && (
            <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
              Featured
            </span>
          )}
        </div>

        {/* Game Info - Always Visible */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1 drop-shadow-md">
            {game.gameName}
          </h3>
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-[10px] capitalize">{game.gameType}</span>
            <span className="text-[10px]">•</span>
            <span className="text-[10px]">{game.provider.name}</span>
          </div>
        </div>

        {/* Maintenance/Disabled Badge */}
        {game.status === "maintenance" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <span className="text-yellow-400 text-sm font-semibold px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
              Under Maintenance
            </span>
          </div>
        )}
        {game.status === "disabled" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <span className="text-red-400 text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-400/10 border border-red-400/30">
              Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Play Button - Visible on Hover */}
      {game.status === "active" && (
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm shadow-lg flex items-center gap-2">
            <Play size={14} />
            Play Now
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Loading Skeleton for Game Card
 */
export function GameCardSkeleton() {
  return (
    <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border/50">
      <div className="w-full h-full animate-pulse bg-muted" />
    </div>
  );
}
