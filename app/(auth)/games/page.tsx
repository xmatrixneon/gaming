/**
 * Games Page
 *
 * Displays available casino games from Game API providers
 * Shows game cards with launch functionality
 */

"use client";

import { useState } from "react";
import { GameCard } from "@/components/game/home/GameCard";
import { CategoryTabs } from "@/components/game/home/CategoryTabs";

// Mock data to demonstrate the UI (will be replaced with real API data)
const mockProviders = [
  {
    code: "pg",
    name: "PG Soft",
    currency: "INR",
    lang: "en",
    status: 1,
  },
  {
    code: "evolution",
    name: "Evolution Gaming",
    currency: "INR",
    lang: "en",
    status: 1,
  },
  {
    code: " pragmatic",
    name: "Pragmatic Play",
    currency: "INR",
    lang: "en",
    status: 1,
  },
];

const mockGames = [
  {
    game_uid: "pg_mahjong_ways",
    game_name: "Mahjong Ways",
    game_type: "slot",
    image_url: "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=400",
    status: 1,
    provider_code: "pg",
  },
  {
    game_uid: "pg_wild_bandito",
    game_name: "Wild Bandito",
    game_type: "slot",
    image_url: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400",
    status: 1,
    provider_code: "pg",
  },
  {
    game_uid: "evo_live_blackjack",
    game_name: "Live Blackjack",
    game_type: "live_casino",
    image_url: "https://images.unsplash.com/photo-1605870445159-38928e339071?w=400",
    status: 1,
    provider_code: "evolution",
  },
  {
    game_uid: "evo_live_roulette",
    game_name: "Live Roulette",
    game_type: "live_casino",
    image_url: "https://images.unsplash.com/photo-1605870445159-38928e339071?w=400",
    status: 1,
    provider_code: "evolution",
  },
  {
    game_uid: "prag_gates_of_olympus",
    game_name: "Gates of Olympus",
    game_type: "slot",
    image_url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400",
    status: 1,
    provider_code: "pragmatic",
  },
  {
    game_uid: "prag_sugar_rush",
    game_name: "Sugar Rush",
    game_type: "slot",
    image_url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400",
    status: 1,
    provider_code: "pragmatic",
  },
];

export default function GamesPage() {
  const [activeCategory, setActiveCategory] = useState("All Games");
  const [isLoading, setIsLoading] = useState(false);

  function handleGameLaunch(game: any) {
    // This will be connected to the real API
    console.log("Launching game:", game.game_name);

    // Example API call (will be implemented):
    // const { data, error } = await api.game.launchGame.mutate({
    //   gameUid: game.game_uid,
    //   language: 'en'
    // });

    alert(`Launching: ${game.game_name}\n\nThis will open the game in a new window.`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            🎮 Casino Games
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Play exciting games from top providers
          </p>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="container max-w-md mx-auto px-4 py-4">
        <CategoryTabs
          categories={["All Games", ...mockProviders.map((p) => p.name)]}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Games Grid */}
      <div className="container max-w-md mx-auto px-4 pb-20">
        {isLoading ? (
          <GamesGridLoading />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {mockGames.map((game) => (
              <GameCard
                key={game.game_uid}
                game={game}
                onLaunch={() => handleGameLaunch(game)}
              />
            ))}
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

function GamesGridLoading() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg bg-muted animate-pulse"
        />
      ))}
    </div>
  );
}
