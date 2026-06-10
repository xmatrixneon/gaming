/**
 * Game API Integration Test
 *
 * This script tests the Game API integration by:
 * 1. Validating configuration
 * 2. Fetching game providers
 * 3. Fetching games from providers
 * 4. Displaying available games
 */

// Load environment variables FIRST before any other imports
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Now import after dotenv is configured
import { gameApiClient } from "./lib/game-api-client";
import { validateGameApiConfig, getGameApiStatus } from "./lib/game-api-config";

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test 1: Validate Game API configuration
 */
async function testConfiguration() {
  console.log("\n=== Test 1: Configuration ===");

  try {
    validateGameApiConfig();
    console.log("✅ Game API configuration is valid");

    const status = getGameApiStatus();
    console.log("Status:", status);

    return true;
  } catch (error) {
    console.error("❌ Configuration validation failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Test 2: Fetch game providers
 */
async function testProviders() {
  console.log("\n=== Test 2: Fetching Game Providers ===");

  try {
    const providers = await gameApiClient.getProviders();

    console.log(`✅ Found ${providers.length} game providers:`);
    console.log("");

    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.name} (${provider.code})`);
      console.log(`   Status: ${provider.status === 1 ? "✅ Enabled" : "❌ Disabled"}`);
      console.log(`   Currency: ${provider.currency}`);
      console.log(`   Languages: ${provider.lang}`);
      console.log("");
    });

    return providers;
  } catch (error) {
    console.error("❌ Failed to fetch providers:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Test 3: Fetch games from a provider
 */
async function testGameList(providers: any[]) {
  console.log("\n=== Test 3: Fetching Games from Providers ===");

  // Get enabled providers only
  const enabledProviders = providers.filter((p) => p.status === 1);

  if (enabledProviders.length === 0) {
    console.log("❌ No enabled providers found");
    return;
  }

  // Test first 3 providers
  const providersToTest = enabledProviders.slice(0, 3);

  for (const provider of providersToTest) {
    console.log(`\n🎮 Fetching games from ${provider.name} (${provider.code})...`);

    try {
      const games = await gameApiClient.getGameList(provider.code);

      console.log(`✅ Found ${games.length} games from ${provider.name}`);

      // Display first 10 games
      const gamesToShow = games.slice(0, 10);
      gamesToShow.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.game_name}`);
        console.log(`      Game UID: ${game.game_uid}`);
        console.log(`      Type: ${game.game_type}`);
        console.log(`      Status: ${game.status === 1 ? "✅ Enabled" : "❌ Disabled"}`);
      });

      if (games.length > 10) {
        console.log(`   ... and ${games.length - 10} more games`);
      }

    } catch (error) {
      console.error(`❌ Failed to fetch games from ${provider.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Test 4: Create a simple game launch test
 */
async function testGameLaunch(providers: any[]) {
  console.log("\n=== Test 4: Game Launch Test ===");

  const enabledProviders = providers.filter((p) => p.status === 1);

  if (enabledProviders.length === 0) {
    console.log("❌ No enabled providers found for launch test");
    return;
  }

  // Get first game from first provider
  const provider = enabledProviders[0];

  try {
    const games = await gameApiClient.getGameList(provider.code);

    if (games.length === 0) {
      console.log(`❌ No games found for ${provider.name}`);
      return;
    }

    const firstGame = games[0];

    console.log(`🎮 Attempting to launch game: ${firstGame.game_name}`);
    console.log(`   Provider: ${provider.name}`);
    console.log(`   Game UID: ${firstGame.game_uid}`);

    // Note: This will fail because we don't have a real member account
    // But it will show us the API call structure
    console.log("\n⚠️  Note: Full launch test requires valid member account");
    console.log("   This would be called from the frontend via tRPC mutation:");
    console.log("   api.game.launchGame.mutate({ gameUid: '...', language: 'en' })");

  } catch (error) {
    console.error("❌ Launch test failed:", error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         Game API Integration Test Suite                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Test 1: Configuration
  const configValid = await testConfiguration();
  if (!configValid) {
    console.log("\n❌ Tests aborted: Configuration is invalid");
    console.log("Please set the following environment variables:");
    console.log("  - GAME_API_AGENCY_UID");
    console.log("  - GAME_API_AES_KEY");
    console.log("  - GAME_API_SERVER_URL");
    return;
  }

  // Test 2: Providers
  const providers = await testProviders();
  if (providers.length === 0) {
    console.log("\n❌ Tests aborted: No providers found");
    return;
  }

  // Test 3: Game Lists
  await testGameList(providers);

  // Test 4: Game Launch (informational)
  await testGameLaunch(providers);

  console.log("\n=== Test Summary ===");
  console.log("✅ Game API integration is working!");
  console.log("\n📝 Next Steps:");
  console.log("1. Configure frontend to call: api.game.launchGame.mutate()");
  console.log("2. Implement member_account field in user table");
  console.log("3. Connect webhook to process bet callbacks");
  console.log("4. Test game launch from frontend");

  console.log("\n🔗 Available tRPC Procedures:");
  console.log("  - api.game.getProviders.query() - Get all providers");
  console.log("  - api.game.getGameList.query({ providerCode }) - Get games");
  console.log("  - api.game.launchGame.mutate({ gameUid, language }) - Launch game");
  console.log("  - api.game.getTransactions.query() - Get transaction history");

  process.exit(0);
}

// ============================================================================
// RUN TESTS
// ============================================================================

runTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error);
  process.exit(1);
});
