/**
 * Game Launch Test
 *
 * Tests launching Chicky Run game
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getGameApiClient } from "../lib/game-api-client";

async function testLaunch() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              Game Launch Test - Chicky Run                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const client = getGameApiClient();

  // Test user
  const userId = "test001";
  const memberAccount = "h5ab3a_test001"; // Must start with h5ab3a
  const gameUid = "c3e600005f72f1d1cabe758e206daf57"; // Chicky Run
  const balance = 100000; // 1000.00 in paisa

  console.log("\n📋 Launch Parameters:");
  console.log("   User ID:", userId);
  console.log("   Member Account:", memberAccount);
  console.log("   Game UID:", gameUid);
  console.log("   Balance:", balance, "paisa (₹", balance / 100, ")");

  try {
    console.log("\n🎮 Launching game...");
    const gameUrl = await client.launchGame({
      memberAccount: memberAccount,
      gameUid: gameUid,
      creditAmount: balance,
      language: "en",
      platform: 2, // H5 mobile
    });

    console.log("\n✅ Game launched successfully!");
    console.log("\n🔗 Game URL:", gameUrl);
    console.log(
      "\n💡 You can open this URL in a browser to play the game."
    );

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Launch failed:", error.message);
    console.error("\nThis might be because:");
    console.error("  - Member account doesn't exist in Game API system");
    console.error("  - Game UID is invalid");
    console.error("  - Balance format issue");

    process.exit(1);
  }
}

testLaunch().catch(console.error);
