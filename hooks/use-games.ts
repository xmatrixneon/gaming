/**
 * useGames Hook
 *
 * Custom hook for fetching games and launching games.
 * Provides type-safe game operations via tRPC.
 */

import { toast } from "sonner";
import { api } from "@/lib/trpc/client";

// ============================================================================
// TYPES
// ============================================================================

export interface Game {
  id: string;
  gameUid: string;
  gameName: string;
  gameType: string;
  imageUrl: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  backgroundUrl?: string;
  imageAlt?: string;
  displayOrder: number;
  isFeatured: boolean;
  isNew: boolean;
  isHot: boolean;
  status: "active" | "disabled" | "maintenance";
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  provider: {
    id: string;
    code: string;
    name: string;
    category: string;
    imageUrl: string;
  };
}

export interface GameListResponse {
  games: Game[];
  total: number;
  limit: number;
  offset: number;
}

export interface GameFilters {
  status?: "active" | "disabled" | "maintenance";
  gameType?: string;
  providerCode?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isHot?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LaunchGameParams {
  gameUid: string;
  language?: string;
  onSuccess?: (data: { gameUrl: string; balance: number }) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch games from database with optional filters
 */
export function useGames(filters: GameFilters = {}) {
  const query = api.game.getDbGames.useQuery(filters);

  return {
    games: query.data?.games || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Fetch featured games for home page
 */
export function useFeaturedGames(limit = 12) {
  const query = api.game.getDbGames.useQuery({
    status: "active",
    isFeatured: true,
    limit,
  });

  return {
    games: query.data?.games || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Fetch hot games
 */
export function useHotGames(limit = 12) {
  return useGames({
    status: "active",
    isHot: true,
    limit,
  });
}

/**
 * Fetch new games
 */
export function useNewGames(limit = 12) {
  return useGames({
    status: "active",
    isNew: true,
    limit,
  });
}

/**
 * Fetch games by provider
 */
export function useGamesByProvider(providerCode: string, limit = 50) {
  return useGames({
    status: "active",
    providerCode,
    limit,
  });
}

/**
 * Fetch games by type
 */
export function useGamesByType(gameType: string, limit = 50) {
  return useGames({
    status: "active",
    gameType,
    limit,
  });
}

/**
 * Search games
 */
export function useSearchGames(searchQuery: string, limit = 50) {
  return useGames({
    status: "active",
    search: searchQuery,
    limit,
  });
}

/**
 * Get a single game by ID or slug
 */
export function useGame(params: { id?: string; slug?: string }) {
  const query = api.game.getGame.useQuery(params);

  return {
    game: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get game statistics
 */
export function useGameStats() {
  const query = api.game.getStats.useQuery();

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Get providers from database
 */
export function useProviders(filters?: { status?: "active" | "disabled" | "maintenance"; category?: string }) {
  const query = api.game.getDbProviders.useQuery(filters);

  return {
    providers: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Launch game mutation
 *
 * Note: For launching games, navigate directly to /play/[gameUid] route.
 * This hook is kept for direct API access if needed.
 */
export function useLaunchGame() {
  const mutation = api.game.launchGame.useMutation();

  const launchGame = (params: LaunchGameParams) => {
    mutation.mutate(
      {
        gameUid: params.gameUid,
        language: params.language || "en",
      },
      {
        onSuccess: (data) => {
          // Show success message
          toast.success("Game launched!", {
            description: "Opening game...",
          });

          // Call custom success handler
          params.onSuccess?.(data);
        },
        onError: (error) => {
          console.error("Failed to launch game:", error);

          toast.error("Failed to launch game", {
            description: error.message || "Please try again later",
          });

          // Call custom error handler
          params.onError?.(error as Error);
        },
      }
    );
  };

  return {
    launchGame,
    launchGameAsync: mutation.mutateAsync,
    isLaunching: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Prefetch games for smooth navigation
 */
export function usePrefetchGames() {
  const utils = api.useContext();

  const prefetchGames = async (filters: GameFilters = {}) => {
    utils.game.getDbGames.prefetch(filters);
  };

  const prefetchFeaturedGames = async (limit = 12) => {
    utils.game.getDbGames.prefetch({
      status: "active",
      isFeatured: true,
      limit,
    });
  };

  const prefetchGame = async (params: { id?: string; slug?: string }) => {
    if (params.id || params.slug) {
      utils.game.getGame.prefetch(params);
    }
  };

  return {
    prefetchGames,
    prefetchFeaturedGames,
    prefetchGame,
  };
}
