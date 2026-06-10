/**
 * Sync Games Script
 *
 * Fetches games and providers from the Game API and syncs them to the database.
 * Games are synced with placeholder images that must be manually replaced.
 *
 * Usage:
 *   npx tsx scripts/sync-games.ts              # Sync all
 *   npx tsx scripts/sync-games.ts --providers PG,JL  # Sync specific providers
 *   npx tsx scripts/sync-games.ts --force        # Force re-sync all
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { gameService } from "../lib/game-service";
import { getGameApiClient } from "../lib/game-api-client";

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              Game Sync - Syncing from Game API                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const args = process.argv.slice(2);
  const options: { force?: boolean; providers?: string[] } = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--force") {
      options.force = true;
    } else if (args[i] === "--providers" && args[i + 1]) {
      options.providers = args[i + 1].split(",");
    }
  }

  console.log("\n📋 Sync options:", options);

  try {
    // First, check API connection
    console.log("\n🔗 Checking API connection...");
    const client = getGameApiClient();
    const providers = await client.getProviders();
    console.log(`✅ Connected! Found ${providers.length} providers in API`);

    // Get current stats
    console.log("\n📊 Current database stats:");
    const statsBefore = await gameService.getStats();
    console.log(`   Providers: ${statsBefore.activeProviders}/${statsBefore.totalProviders}`);
    console.log(`   Games: ${statsBefore.activeGames}/${statsBefore.totalGames}`);
    console.log(`   Games needing images: ${statsBefore.gamesNeedingImages}`);

    // Sync games
    console.log("\n🔄 Starting sync...");
    const result = await gameService.syncGames(options);

    console.log("\n✅ Sync complete!");
    console.log("\n📊 Results:");
    console.log(`   Providers added: ${result.providersAdded}`);
    console.log(`   Providers updated: ${result.providersUpdated}`);
    console.log(`   Games added: ${result.gamesAdded}`);
    console.log(`   Games updated: ${result.gamesUpdated}`);
    console.log(`   Games needing images: ${result.gamesSkipped}`);

    if (result.errors.length > 0) {
      console.log("\n⚠️  Errors:");
      result.errors.forEach((err) => console.log(`   - ${err}`));
    }

    // Get new stats
    console.log("\n📊 New database stats:");
    const statsAfter = await gameService.getStats();
    console.log(`   Providers: ${statsAfter.activeProviders}/${statsAfter.totalProviders}`);
    console.log(`   Games: ${statsAfter.activeGames}/${statsAfter.totalGames}`);
    console.log(`   Games needing images: ${statsAfter.gamesNeedingImages}`);

    if (statsAfter.gamesNeedingImages > 0) {
      console.log("\n⚠️  IMPORTANT:");
      console.log(`   ${statsAfter.gamesNeedingImages} games have placeholder images.`);
      console.log("   You MUST update image URLs before games can be displayed.");
      console.log("   Use the admin panel or call api.game.updateGameImages");
    }

    console.log("\n✨ Done!");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Sync failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
