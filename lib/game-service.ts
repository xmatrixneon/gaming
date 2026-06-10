/**
 * Game Service
 *
 * Handles syncing and managing games and providers from the Game API.
 * Supports admin overrides for images, categories, and metadata.
 */

import { db } from "@/drizzle";
import { gameProvider, game } from "@/drizzle/schema";
import type { GameProvider, Game } from "@/drizzle/schema";
import { getGameApiClient } from "./game-api-client";
import { nanoid } from "nanoid";
import { eq, and, sql } from "drizzle-orm";
import postgres from "postgres";

// ============================================================================
// TYPES
// ============================================================================

export interface SyncOptions {
  force?: boolean;
  providers?: string[]; // Specific provider codes to sync
  skipImages?: boolean;
}

export interface SyncResult {
  providersAdded: number;
  providersUpdated: number;
  gamesAdded: number;
  gamesUpdated: number;
  gamesSkipped: number; // Skipped due to missing images
  errors: string[];
}

export interface AdminGameInput {
  providerId: string;
  gameUid: string;
  gameName: string;
  gameType: string;
  supportedCurrencies: string;
  supportedLanguages: string;
  imageUrl: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  backgroundUrl?: string;
  imageAlt?: string;
  status?: "active" | "disabled" | "maintenance";
  displayOrder?: number;
  isFeatured?: boolean;
  isNew?: boolean;
  isHot?: boolean;
  metadata?: Record<string, unknown>;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  notes?: string;
}

export interface AdminProviderInput {
  code: string;
  name: string;
  supportedCurrencies: string;
  supportedLanguages: string;
  status?: "active" | "disabled" | "maintenance";
  imageUrl?: string;
  thumbnailUrl?: string;
  displayOrder?: number;
  category?: string;
  features?: Record<string, unknown>;
  notes?: string;
}

// ============================================================================
// GAME SERVICE CLASS
// ============================================================================

class GameService {
  private get client() {
    return getGameApiClient();
  }

  // ==========================================================================
  // SYNC METHODS
  // ==========================================================================

  /**
   * Sync all providers from the Game API
   */
  async syncProviders(options: SyncOptions = {}): Promise<{
    added: number;
    updated: number;
    errors: string[];
  }> {
    const result = { added: 0, updated: 0, errors: [] };

    try {
      const apiProviders = await this.client.getProviders();

      // Create a direct postgres connection for raw queries
      const connectionString = process.env.DATABASE_URL!;
      const sql = postgres(connectionString);

      try {
        for (const apiProvider of apiProviders) {
          // Filter by specific providers if requested
          if (
            options.providers &&
            options.providers.length > 0 &&
            !options.providers.includes(apiProvider.code)
          ) {
            continue;
          }

          try {
            // Check if provider exists using raw SQL
            const existing = await sql`
              SELECT id, code, name, image_url, thumbnail_url, category, features, notes
              FROM game_provider
              WHERE code = ${apiProvider.code}
              LIMIT 1
            `;

            const providerData = {
              code: apiProvider.code,
              name: apiProvider.name,
              supportedCurrencies: apiProvider.currency || "",
              supportedLanguages: apiProvider.lang || "",
              status: apiProvider.status === 1 ? "active" : "disabled",
              lastSyncedAt: new Date(),
              isSynced: true,
            };

            if (existing.length > 0) {
              // Update existing provider (preserve admin fields like images)
              await sql`
                UPDATE game_provider
                SET
                  code = ${providerData.code},
                  name = ${providerData.name},
                  supported_currencies = ${providerData.supportedCurrencies},
                  supported_languages = ${providerData.supportedLanguages},
                  status = ${providerData.status}::game_provider_status,
                  last_synced_at = ${providerData.lastSyncedAt},
                  is_synced = ${providerData.isSynced},
                  updated_at = NOW()
                WHERE id = ${existing[0].id}
              `;
              result.updated++;
            } else {
              // Create new provider
              const id = nanoid();
              const category = this.categorizeProvider(apiProvider.name, apiProvider.code);
              await sql`
                INSERT INTO game_provider (
                  id, code, name, supported_currencies, supported_languages,
                  status, display_order, category, last_synced_at, is_synced,
                  created_at, updated_at
                )
                VALUES (
                  ${id}, ${providerData.code}, ${providerData.name},
                  ${providerData.supportedCurrencies}, ${providerData.supportedLanguages},
                  ${providerData.status}::game_provider_status, 0, ${category},
                  ${providerData.lastSyncedAt}, ${providerData.isSynced}, NOW(), NOW()
                )
              `;
              result.added++;
            }
          } catch (e: any) {
            result.errors.push(`Provider ${apiProvider.code}: ${e.message}`);
          }
        }
      } finally {
        await sql.end();
      }
    } catch (e: any) {
      result.errors.push(`Failed to fetch providers: ${e.message}`);
    }

    return result;
  }

  /**
   * Sync games from the Game API
   *
   * IMPORTANT: This syncs game metadata but NOT images.
   * Images must be added manually by admin or through a separate image sync process.
   */
  async syncGames(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      providersAdded: 0,
      providersUpdated: 0,
      gamesAdded: 0,
      gamesUpdated: 0,
      gamesSkipped: 0,
      errors: [],
    };

    try {
      // First, sync providers
      const providerResult = await this.syncProviders(options);
      result.providersAdded = providerResult.added;
      result.providersUpdated = providerResult.updated;
      result.errors.push(...providerResult.errors);

      // Get all active providers using raw SQL
      const connectionString = process.env.DATABASE_URL!;
      const sql = postgres(connectionString);

      try {
        const providers = await sql`
          SELECT id, code, name
          FROM game_provider
          WHERE status = 'active'
        `;

        for (const provider of providers) {
          // Filter by specific providers if requested
          if (
            options.providers &&
            options.providers.length > 0 &&
            !options.providers.includes(provider.code)
          ) {
            continue;
          }

          try {
            const apiGames = await this.client.getGameList(
              provider.code,
              "INR",
              "en"
            );

            for (const apiGame of apiGames) {
              try {
                // Check if game exists
                const existing = await sql`
                  SELECT id, game_uid, image_url
                  FROM game
                  WHERE game_uid = ${apiGame.game_uid}
                  LIMIT 1
                `;

                const gameData = {
                  providerId: provider.id,
                  gameUid: apiGame.game_uid,
                  gameName: apiGame.game_name,
                  gameType: apiGame.game_type,
                  supportedCurrencies: apiGame.currency || "",
                  supportedLanguages: apiGame.lang || "",
                  status: apiGame.status === 1 ? "active" : "disabled",
                  lastSyncedAt: new Date(),
                  isSynced: true,
                  slug: this.slugifyGameName(apiGame.game_name, apiGame.game_uid),
                };

                if (existing.length > 0) {
                  const existingGame = existing[0];
                  const placeholderImage = this.getPlaceholderImage(apiGame.game_type);
                  const shouldUpdateImage = existingGame.image_url?.startsWith("placeholder:");

                  // Update existing game
                  await sql`
                    UPDATE game
                    SET
                      provider_id = ${gameData.providerId},
                      game_name = ${gameData.gameName},
                      game_type = ${gameData.gameType},
                      supported_currencies = ${gameData.supportedCurrencies},
                      supported_languages = ${gameData.supportedLanguages},
                      status = ${gameData.status}::game_status,
                      last_synced_at = ${gameData.lastSyncedAt},
                      is_synced = ${gameData.isSynced},
                      slug = ${gameData.slug},
                      image_url = ${shouldUpdateImage ? placeholderImage : existingGame.image_url},
                      updated_at = NOW()
                    WHERE id = ${existingGame.id}
                  `;
                  result.gamesUpdated++;
                } else {
                  // Create new game with placeholder image
                  const placeholderImage = this.getPlaceholderImage(apiGame.game_type);
                  const gameId = nanoid();

                  await sql`
                    INSERT INTO game (
                      id, provider_id, game_uid, game_name, game_type,
                      supported_currencies, supported_languages, status,
                      image_url, display_order, is_featured, is_new, is_hot,
                      last_synced_at, is_synced, slug, created_at, updated_at
                    )
                    VALUES (
                      ${gameId}, ${gameData.providerId}, ${gameData.gameUid},
                      ${gameData.gameName}, ${gameData.gameType},
                      ${gameData.supportedCurrencies}, ${gameData.supportedLanguages},
                      ${gameData.status}::game_status,
                      ${placeholderImage}, 0, false, false, false,
                      ${gameData.lastSyncedAt}, ${gameData.isSynced},
                      ${gameData.slug}, NOW(), NOW()
                    )
                  `;

                  // Track that this game needs an image
                  result.gamesSkipped++;
                  result.gamesAdded++;
                }
              } catch (e: any) {
                result.errors.push(`Game ${apiGame.game_uid}: ${e.message}`);
              }
            }
          } catch (e: any) {
            result.errors.push(`Provider ${provider.code}: ${e.message}`);
          }
        }
      } finally {
        await sql.end();
      }
    } catch (e: any) {
      result.errors.push(`Failed to sync games: ${e.message}`);
    }

    return result;
  }

  // ==========================================================================
  // ADMIN METHODS
  // ==========================================================================

  /**
   * Add or update a game manually
   */
  async upsertGame(input: AdminGameInput): Promise<Game> {
    // Verify provider exists
    const provider = await db
      .select()
      .from(gameProvider)
      .where(eq(gameProvider.id, input.providerId))
      .limit(1);

    if (provider.length === 0) {
      throw new Error("Provider not found");
    }

    // Check if game exists by gameUid
    const existing = await db
      .select()
      .from(game)
      .where(eq(game.gameUid, input.gameUid))
      .limit(1);

    const gameData = {
      providerId: input.providerId,
      gameUid: input.gameUid,
      gameName: input.gameName,
      gameType: input.gameType,
      supportedCurrencies: input.supportedCurrencies,
      supportedLanguages: input.supportedLanguages,
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl,
      bannerUrl: input.bannerUrl,
      backgroundUrl: input.backgroundUrl,
      imageAlt: input.imageAlt,
      status: input.status || "active",
      displayOrder: input.displayOrder ?? 0,
      isFeatured: input.isFeatured ?? false,
      isNew: input.isNew ?? false,
      isHot: input.isHot ?? false,
      metadata: input.metadata,
      slug: input.slug || this.slugifyGameName(input.gameName, input.gameUid),
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      notes: input.notes,
      isSynced: false, // Manually added
    };

    if (existing.length > 0) {
      await db
        .update(game)
        .set({
          ...gameData,
          updatedAt: new Date(),
        })
        .where(eq(game.id, existing[0].id));

      const updated = await db
        .select()
        .from(game)
        .where(eq(game.id, existing[0].id))
        .limit(1);

      return updated[0];
    } else {
      const id = nanoid();
      await db.insert(game).values({
        id,
        ...gameData,
      });

      const created = await db
        .select()
        .from(game)
        .where(eq(game.id, id))
        .limit(1);

      return created[0];
    }
  }

  /**
   * Update game image URLs
   */
  async updateGameImages(
    gameId: string,
    images: {
      imageUrl?: string;
      thumbnailUrl?: string;
      bannerUrl?: string;
      backgroundUrl?: string;
      imageAlt?: string;
    }
  ): Promise<Game> {
    const existing = await db
      .select()
      .from(game)
      .where(eq(game.id, gameId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Game not found");
    }

    await db
      .update(game)
      .set({
        ...(images.imageUrl && { imageUrl: images.imageUrl }),
        ...(images.thumbnailUrl !== undefined && { thumbnailUrl: images.thumbnailUrl }),
        ...(images.bannerUrl !== undefined && { bannerUrl: images.bannerUrl }),
        ...(images.backgroundUrl !== undefined && { backgroundUrl: images.backgroundUrl }),
        ...(images.imageAlt !== undefined && { imageAlt: images.imageAlt }),
        updatedAt: new Date(),
      })
      .where(eq(game.id, gameId));

    const updated = await db
      .select()
      .from(game)
      .where(eq(game.id, gameId))
      .limit(1);

    return updated[0];
  }

  /**
   * Add or update a provider manually
   */
  async upsertProvider(input: AdminProviderInput): Promise<GameProvider> {
    const existing = await db
      .select()
      .from(gameProvider)
      .where(eq(gameProvider.code, input.code))
      .limit(1);

    const providerData = {
      code: input.code,
      name: input.name,
      supportedCurrencies: input.supportedCurrencies,
      supportedLanguages: input.supportedLanguages,
      status: input.status || "active",
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl,
      displayOrder: input.displayOrder ?? 0,
      category: input.category || "slots",
      features: input.features,
      notes: input.notes,
      isSynced: false, // Manually added
    };

    if (existing.length > 0) {
      await db
        .update(gameProvider)
        .set({
          ...providerData,
          updatedAt: new Date(),
        })
        .where(eq(gameProvider.id, existing[0].id));

      const updated = await db
        .select()
        .from(gameProvider)
        .where(eq(gameProvider.id, existing[0].id))
        .limit(1);

      return updated[0];
    } else {
      const id = nanoid();
      await db.insert(gameProvider).values({
        id,
        ...providerData,
      });

      const created = await db
        .select()
        .from(gameProvider)
        .where(eq(gameProvider.id, id))
        .limit(1);

      return created[0];
    }
  }

  /**
   * Get games needing images
   */
  async getGamesNeedingImages(): Promise<Game[]> {
    const games = await db
      .select()
      .from(game)
      .where(
        and(
          eq(game.status, "active"),
          sql`${game.imageUrl} LIKE 'placeholder:%'`
        )
      );

    return games;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalProviders: number;
    activeProviders: number;
    totalGames: number;
    activeGames: number;
    gamesNeedingImages: number;
    gamesByType: Record<string, number>;
  }> {
    // Create a direct postgres connection for raw queries (bypasses prepared statement issues)
    const connectionString = process.env.DATABASE_URL!;
    const sql = postgres(connectionString);

    try {
      const [
        providerCount,
        activeProviderCount,
        gameCount,
        activeGameCount,
        needingImages,
        byTypeRows,
      ] = await Promise.all([
        sql`SELECT count(*)::int as count FROM game_provider`,
        sql`SELECT count(*)::int as count FROM game_provider WHERE status = 'active'`,
        sql`SELECT count(*)::int as count FROM game`,
        sql`SELECT count(*)::int as count FROM game WHERE status = 'active'`,
        sql`SELECT count(*)::int as count FROM game WHERE image_url LIKE 'placeholder:%'`,
        sql`SELECT game_type, count(*)::int as count FROM game WHERE status = 'active' GROUP BY game_type`,
      ]);

      const gamesByType: Record<string, number> = {};
      for (const row of byTypeRows) {
        if (row && row.game_type) {
          gamesByType[row.game_type || "unknown"] = Number(row.count);
        }
      }

      return {
        totalProviders: Number(providerCount?.count || 0),
        activeProviders: Number(activeProviderCount?.count || 0),
        totalGames: Number(gameCount?.count || 0),
        activeGames: Number(activeGameCount?.count || 0),
        gamesNeedingImages: Number(needingImages?.count || 0),
        gamesByType,
      };
    } finally {
      await sql.end();
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Categorize provider based on name/code
   */
  private categorizeProvider(name: string, code: string): string {
    const lowerName = name.toLowerCase();
    const lowerCode = code.toLowerCase();

    // Live casino providers
    if (
      lowerName.includes("live") ||
      lowerName.includes("evolution") ||
      lowerName.includes("ezugi") ||
      lowerCode.includes("evo") ||
      lowerCode.includes("live")
    ) {
      return "live_casino";
    }

    // Sports betting
    if (
      lowerName.includes("sport") ||
      lowerName.includes("saba") ||
      lowerCode.includes("sport")
    ) {
      return "sports";
    }

    // Fishing games
    if (
      lowerName.includes("fish") ||
      lowerCode.includes("fg") ||
      lowerCode.includes("fish")
    ) {
      return "fishing";
    }

    // Default to slots
    return "slots";
  }

  /**
   * Generate URL-friendly slug from game name
   */
  private slugifyGameName(gameName: string, gameUid: string): string {
    if (!gameName) {
      return gameUid.slice(0, 16);
    }

    const slug = gameName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens
      .trim();

    // Ensure uniqueness by appending part of gameUid if needed
    return slug ? `${slug}-${gameUid.slice(0, 8)}` : gameUid.slice(0, 16);
  }

  /**
   * Get placeholder image URL for game type
   */
  private getPlaceholderImage(gameType: string | null | undefined): string {
    if (!gameType) {
      return "placeholder:slots";
    }

    const type = gameType.toLowerCase();

    if (type.includes("live")) {
      return "placeholder:live_casino";
    }
    if (type.includes("fish")) {
      return "placeholder:fishing";
    }
    if (type.includes("sport")) {
      return "placeholder:sports";
    }
    if (type.includes("card") || type.includes("table")) {
      return "placeholder:table";
    }

    return "placeholder:slots";
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const gameService = new GameService();
