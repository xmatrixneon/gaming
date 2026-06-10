"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IoSearchOutline,
  IoMenuOutline,
  IoGameControllerOutline,
  IoFlashOutline,
  IoPeopleOutline,
  IoFlameOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
} from "react-icons/io5";
import { GiTrophy, GiRollingDices } from "react-icons/gi";
import { PromoCarousel, CategoryTabs, BottomNav, GameGrid, GradientCard, WinsTicker, AppHeader } from "@/components/game";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { useFeaturedGames, useHotGames, type Game } from "@/hooks/use-games";
import { Skeleton } from "@/components/ui/skeleton";

const GAME_CATEGORIES = [
  { id: "casino", label: "Casino", icon: GiRollingDices },
  { id: "sports", label: "Sports", icon: GiTrophy },
  { id: "slots", label: "Slots", icon: IoGameControllerOutline },
  { id: "live", label: "Live", icon: IoFlashOutline },
];

const PROMO_BANNERS = [
  {
    title: "FIFA World Cup 2026 Hub",
    subtitle: "$2M+ IN PRIZES",
    cta: "Join Now",
    bg: "linear-gradient(135deg, #1a3a8f 0%, #0d1f5c 50%, #1a3a8f 100%)",
    accent: "#00C851",
    emoji: "⚽",
  },
  {
    title: "Weekly Cashback",
    subtitle: "UP TO 25% BACK",
    cta: "Claim Now",
    bg: "linear-gradient(135deg, #8f1a3a 0%, #5c0d1f 50%, #8f1a3a 100%)",
    accent: "#FFB800",
    emoji: "💰",
  },
  {
    title: "VIP Rakeback",
    subtitle: "INSTANT REWARDS",
    cta: "Go VIP",
    bg: "linear-gradient(135deg, #3a1a8f 0%, #1f0d5c 50%, #3a1a8f 100%)",
    accent: "#9945FF",
    emoji: "👑",
  },
];

const BIG_WINS = [
  { user: "ncpbnu***", game: "Blackjack Luxury", amount: "1.361 BTC", color: "#F7931A", emoji: "₿" },
  { user: "CocoK***", game: "Big Bass", amount: "1,183 SOL", color: "#9945FF", emoji: "◎" },
  { user: "inspect***", game: "BC Outsourced", amount: "80.11K USDT", color: "#26A17B", emoji: "$" },
  { user: "Kontrol***", game: "Gator Hunters", amount: "79.75K USDT", color: "#26A17B", emoji: "$" },
  { user: "Btuxwe***", game: "Candy Bonanza", amount: "65.92K XRP", color: "#00AAE4", emoji: "✕" },
  { user: "CocoK***", game: "Crazy Time", amount: "1,082 SOL", color: "#9945FF", emoji: "◎" },
  { user: "Plex***", game: "Gold Olympics", amount: "5,953 USDT", color: "#26A17B", emoji: "$" },
];

// Convert API game to grid format
function gameToGridFormat(game: Game) {
  // Determine tag based on flags
  let tag = undefined;
  let tagColor = undefined;
  if (game.isHot) {
    tag = "HOT";
    tagColor = "#FF4444";
  } else if (game.isNew) {
    tag = "NEW";
    tagColor = "#FFB800";
  } else if (game.isFeatured) {
    tag = "FEATURED";
    tagColor = "#00C851";
  }

  // Get emoji based on game type (fallback for no image)
  const emoji = getGameEmoji(game.gameType);

  return {
    id: game.id,
    gameUid: game.gameUid,
    name: game.gameName,
    provider: game.provider.name,
    imageUrl: game.imageUrl,
    thumbnailUrl: game.thumbnailUrl,
    imageAlt: game.imageAlt || game.gameName,
    tag,
    tagColor,
    players: "1.2K", // TODO: Track player count
    emoji,
    background: getGameBackground(game.gameType),
  };
}

function getGameEmoji(gameType: string): string {
  const type = gameType.toLowerCase();
  if (type.includes("live")) return "🎥";
  if (type.includes("slot")) return "🎰";
  if (type.includes("card")) return "🃏";
  if (type.includes("table")) return "🎲";
  if (type.includes("sport")) return "⚽";
  if (type.includes("fish")) return "🐟";
  if (type.includes("crash") || type.includes("aviator")) return "🛩️";
  return "🎮";
}

function getGameBackground(gameType: string): string {
  const type = gameType.toLowerCase();
  if (type.includes("live")) return "#1a0a2e";
  if (type.includes("slot")) return "#0a1a2e";
  if (type.includes("card")) return "#1a2e0a";
  if (type.includes("sport")) return "#1a1a0d";
  if (type.includes("fish")) return "#0a2e1a";
  return "#0a0a0a";
}

// Map icon names to actual icon components for bottom nav
const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: IoHomeOutline,
  deposit: IoArrowDownCircleOutline,
  withdraw: IoArrowUpCircleOutline,
  profile: IoPersonOutline,
  menu: IoMenuOutline,
};

// Bottom navigation items with icons
const BOTTOM_NAV_ITEMS_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
  id: item.id,
  icon: NAV_ICONS[item.id],
  label: item.label,
}));

export default function CasinoHomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState("casino");
  const [mobileNav, setMobileNav] = useState("home");

  // Fetch games from database
  const { games: featuredGames, isLoading: isLoadingFeatured } = useFeaturedGames(12);
  const { games: hotGames, isLoading: isLoadingHot } = useHotGames(12);

  // Handle bottom navigation
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
  };

  // Handle game launch - navigate to full-page game play
  const handleGameClick = (game: ReturnType<typeof gameToGridFormat>) => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    // Navigate to full-page game play
    router.push(`/play/${game.gameUid}`);
  };

  // Convert games to grid format
  const featuredGridGames = featuredGames.map(gameToGridFormat);
  const hotGridGames = hotGames.map(gameToGridFormat);

  return (
    <div
      className={cn(
        "min-h-screen relative overflow-hidden",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}
    >
     

      {/* HEADER */}
      <AppHeader
        isAuthenticated={isAuthenticated}
        user={user ? {
          username: user.username,
          avatar: user.image,
          balance: user.balance ? parseFloat(user.balance) : 0,
          vipLevel: user.vipLevel,
        } : undefined}
        notificationCount={isAuthenticated ? 2 : 0}
      />

      {/* PROMO BANNER CAROUSEL */}
      <div className={cn("px-3 pt-3")}>
        <PromoCarousel
          banners={PROMO_BANNERS}
          autoRotateInterval={4000}
          className="rounded-xl"
        />
      </div>

      {/* RECENT BIG WINS TICKER */}
      <div className={cn("py-1 pb-2")}>
        <div className={cn("flex items-center gap-2 px-3 mb-2")}>
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              "bg-primary",
              "shadow-lg shadow-primary/50"
            )}
          />
          <span className={cn("font-bold text-sm tracking-wider")}>
            Recent Big Wins
          </span>
        </div>

        <WinsTicker
          wins={BIG_WINS}
          speed={-0.5}
          pauseOnHover
          className="px-3"
        />
      </div>

      {/* CATEGORY TABS */}
      <CategoryTabs
        categories={GAME_CATEGORIES}
        active={activeTab}
        onChange={setActiveTab}
        className="px-3 mb-3"
      />

      {/* CASINO / SPORTS CARDS */}
      <div className={cn("px-3 mb-4")}>
        <div className={cn("grid grid-cols-2 gap-2.5")}>
          <GradientCard
            label="CASINO"
            icon={GiRollingDices}
            gradient="linear-gradient(135deg, #0d2818 0%, #0a1f14 100%)"
            glow="#00C851"
            emoji="🎰"
          />
          <GradientCard
            label="SPORTS"
            icon={GiTrophy}
            gradient="linear-gradient(135deg, #1a1a0d 0%, #141400 100%)"
            glow="#FFB800"
            emoji="⚽"
          />
        </div>
      </div>

      {/* FEATURED GAMES */}
      <div className={cn("px-3 mb-4")}>
        <div className={cn("flex justify-between items-center mb-2.5")}>
          <div className={cn("flex items-center gap-1.5")}>
            <IoFlameOutline size={16} className="text-orange-500" />
            <span className={cn("font-bold text-sm tracking-wider")}>
              Popular Games
            </span>
          </div>
          <span
            className={cn("text-primary text-xs font-semibold cursor-pointer")}
            onClick={() => router.push("/games")}
          >
            See All
          </span>
        </div>

        {isLoadingFeatured ? (
          <div className={cn("grid grid-cols-3 gap-2")}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : featuredGridGames.length > 0 ? (
          <GameGrid
            games={featuredGridGames}
            columns={{ mobile: 3, tablet: 3, desktop: 3 }}
            gap={2}
            onGameClick={handleGameClick}
          />
        ) : (
          <div className={cn("text-center py-8 text-muted-foreground")}>
            No games available
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <BottomNav
        items={BOTTOM_NAV_ITEMS_WITH_ICONS}
        active={mobileNav}
        onChange={handleNavigate}
      />
    </div>
  );
}
