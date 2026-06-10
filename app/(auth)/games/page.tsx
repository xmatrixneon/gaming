/**
 * Games Page
 *
 * Displays available casino games from Game API providers
 * Shows game cards with launch functionality
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IoSearchOutline } from "react-icons/io5";
import { GameCard, GameCardSkeleton } from "@/components/game/home/GameCard";
import { CategoryTabs } from "@/components/game/home/CategoryTabs";
import { useAuth } from "@/hooks/use-auth";
import { useGames, useProviders, type Game } from "@/hooks/use-games";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function GamesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Get initial filter from URL
  const initialGame = searchParams.get("game");
  const initialProvider = searchParams.get("provider");

  // State
  const [activeCategory, setActiveCategory] = useState("All Games");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Fetch providers
  const { providers, isLoading: isLoadingProviders } = useProviders({ status: "active" });

  // Fetch games with filters
  const filterParams = {
    status: "active" as const,
    ...(selectedProvider ? { providerCode: selectedProvider } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
    limit: 100,
  };

  const { games, isLoading: isLoadingGames, refetch } = useGames(filterParams);

  // Category options: All Games + Providers
  const categories = ["All Games", ...providers.map((p) => p.name)];

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);

    if (category === "All Games") {
      setSelectedProvider(null);
    } else {
      const provider = providers.find((p) => p.name === category);
      if (provider) {
        setSelectedProvider(provider.code);
      }
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  // Launch specific game if provided in URL (redirect to play page)
  useEffect(() => {
    if (initialGame && isAuthenticated) {
      router.push(`/play/${initialGame}`);
    }
  }, [initialGame, isAuthenticated, router]);

  // Set initial provider from URL
  useEffect(() => {
    if (initialProvider && providers.length > 0) {
      const provider = providers.find((p) => p.code === initialProvider);
      if (provider) {
        setActiveCategory(provider.name);
        setSelectedProvider(provider.code);
      }
    }
  }, [initialProvider, providers]);

  // Convert games to the format expected by GameCard
  const gameCards = games.map((game) => ({
    id: game.id,
    gameUid: game.gameUid,
    gameName: game.gameName,
    gameType: game.gameType,
    imageUrl: game.imageUrl,
    thumbnailUrl: game.thumbnailUrl,
    imageAlt: game.imageAlt,
    status: game.status,
    provider: game.provider,
    isHot: game.isHot,
    isNew: game.isNew,
    isFeatured: game.isFeatured,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                🎮 Casino Games
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isLoadingGames ? "Loading..." : `${games.length} games available`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="container max-w-md mx-auto px-4 py-4">
        <form onSubmit={handleSearch} className="relative">
          <IoSearchOutline
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 h-10 bg-card"
          />
        </form>
      </div>

      {/* Provider Tabs */}
      <div className="container max-w-md mx-auto px-4 py-2">
        {isLoadingProviders ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-lg" />
            ))}
          </div>
        ) : (
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        )}
      </div>

      {/* Games Grid */}
      <div className="container max-w-md mx-auto px-4 pb-20">
        {isLoadingGames ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(8)].map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : gameCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {gameCards.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-lg font-semibold mb-2">No games found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Try a different search term"
                : "No games available for this category"}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  refetch();
                }}
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="container max-w-md mx-auto px-4 py-6">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">🔒 Secure & Fair Gaming</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Licensed & regulated games</li>
            <li>• Real-time bet settlement</li>
            <li>• Instant withdrawals</li>
            <li>• 24/7 customer support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
