"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  IoSearchOutline,
  IoFlameOutline,
  IoArrowForward,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { PromoCarousel, BottomNav, WinsTicker, AppHeader } from "@/components/game";
import { GameCard, GameCardSkeleton } from "@/components/game/home/GameCard";
import { CategoryTabs } from "@/components/game/home/CategoryTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { useGames, useProviders } from "@/hooks/use-games";

// ── Static content ──────────────────────────────────────────────────────────

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

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: IoHomeOutline,
  deposit: IoArrowDownCircleOutline,
  withdraw: IoArrowUpCircleOutline,
  profile: IoPersonOutline,
  menu: IoMenuOutline,
};

const BOTTOM_NAV_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
  id: item.id,
  icon: NAV_ICONS[item.id],
  label: item.label,
}));

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CasinoHomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const [activeProvider, setActiveProvider] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNav, setMobileNav] = useState("home");

  // Real provider list for filter tabs
  const { providers, isLoading: isLoadingProviders } = useProviders({ status: "active" });
  const providerTabs = useMemo(
    () => ["All", ...providers.map((p) => p.name)],
    [providers]
  );

  // Provider code for filter (null = all)
  const selectedProviderCode = useMemo(
    () => (activeProvider === "All" ? undefined : providers.find((p) => p.name === activeProvider)?.code),
    [activeProvider, providers]
  );

  const isFiltering = Boolean(searchQuery || activeProvider !== "All");

  // Popular games — hot games shown in a horizontal scroll when unfiltered
  const { games: popularGames, isLoading: isLoadingPopular } = useGames({
    status: "active",
    isHot: true,
    limit: 10,
  });

  // Main game grid — filters by provider/search, max 50 per request
  const { games, total, isLoading: isLoadingGames } = useGames({
    status: "active",
    providerCode: selectedProviderCode,
    search: searchQuery || undefined,
    limit: 50,
  });

  const handleGameClick = (gameUid: string) => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    router.push(`/play/${gameUid}`);
  };

  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) router.push(navItem.route);
  };

  const handleProviderChange = (name: string) => {
    setActiveProvider(name);
    setSearchQuery(""); // clear search when switching provider
  };

  const clearSearch = () => setSearchQuery("");

  return (
    <div
      className={cn(
        "min-h-screen relative overflow-hidden",
        "bg-background text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}
    >
      {/* ── Header ── */}
      <AppHeader
        isAuthenticated={isAuthenticated}
        user={
          user
            ? {
                username: user.username,
                avatar: user.image,
                balance: user.balance ? parseFloat(user.balance) : 0,
                vipLevel: user.vipLevel,
              }
            : undefined
        }
        notificationCount={isAuthenticated ? 2 : 0}
      />

      {/* ── Promo carousel ── */}
      <div className="px-3 pt-3">
        <PromoCarousel
          banners={PROMO_BANNERS}
          autoRotateInterval={4000}
          className="rounded-xl"
        />
      </div>

      {/* ── Recent big wins ticker ── */}
      <div className="py-1 pb-2">
        <div className="flex items-center gap-2 px-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50" />
          <span className="font-bold text-sm tracking-wider">Recent Big Wins</span>
        </div>
        <WinsTicker wins={BIG_WINS} speed={-0.5} pauseOnHover className="px-3" />
      </div>

      {/* ── Search + provider tabs ── */}
      <div className="px-3 mb-3 space-y-2.5">
        {/* Search bar */}
        <div className="relative">
          <IoSearchOutline
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 bg-card"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <IoCloseOutline size={18} />
            </button>
          )}
        </div>

        {/* Provider filter tabs */}
        {isLoadingProviders ? (
          <div className="flex gap-2 pb-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />
            ))}
          </div>
        ) : (
          <CategoryTabs
            categories={providerTabs}
            activeCategory={activeProvider}
            onCategoryChange={handleProviderChange}
          />
        )}
      </div>

      {/* ── Popular games (horizontal scroll, only when unfiltered) ── */}
      {!isFiltering && (
        <div className="mb-5">
          <div className="flex items-center justify-between px-3 mb-2.5">
            <div className="flex items-center gap-1.5">
              <IoFlameOutline size={16} className="text-orange-500" />
              <span className="font-bold text-sm tracking-wider">Popular Games</span>
            </div>
            <button
              className="flex items-center gap-1 text-primary text-xs font-semibold"
              onClick={() => router.push("/games")}
            >
              See All
              <IoArrowForward size={12} />
            </button>
          </div>

          {isLoadingPopular ? (
            <div className="flex gap-2.5 overflow-x-auto px-3 pb-2 scrollbar-hide">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-28 shrink-0">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-3 mt-1.5 rounded" />
                </div>
              ))}
            </div>
          ) : popularGames.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto px-3 pb-2 scrollbar-hide">
              {popularGames.map((game) => (
                <div key={game.id} className="w-28 shrink-0">
                  <GameCard
                    game={{
                      ...game,
                      thumbnailUrl: game.thumbnailUrl ?? undefined,
                      imageAlt: game.imageAlt ?? undefined,
                    }}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* ── All games grid ── */}
      <div className="px-3 mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wider">
              {isFiltering ? "Search Results" : "All Games"}
            </span>
            {!isLoadingGames && total > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {total}
              </span>
            )}
          </div>
          {total > 50 && (
            <button
              className="flex items-center gap-1 text-primary text-xs font-semibold"
              onClick={() =>
                router.push(
                  selectedProviderCode
                    ? `/games?provider=${selectedProviderCode}`
                    : searchQuery
                    ? `/games?search=${encodeURIComponent(searchQuery)}`
                    : "/games"
                )
              }
            >
              View all {total}
              <IoArrowForward size={12} />
            </button>
          )}
        </div>

        {isLoadingGames ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : games.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={{
                    ...game,
                    thumbnailUrl: game.thumbnailUrl ?? undefined,
                    imageAlt: game.imageAlt ?? undefined,
                  }}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
            {total > 50 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/games")}
                  className="gap-2"
                >
                  Browse all {total} games
                  <IoArrowForward size={14} />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-14">
            <div className="text-5xl mb-3">🎮</div>
            <p className="text-sm font-medium mb-1">
              {searchQuery ? "No games found" : "No games available"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : "Check back soon — games are being added"}
            </p>
            {isFiltering && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveProvider("All");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <BottomNav
        items={BOTTOM_NAV_WITH_ICONS}
        active={mobileNav}
        onChange={handleNavigate}
      />
    </div>
  );
}
