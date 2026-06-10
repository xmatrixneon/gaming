/**
 * Game API Test Runner
 *
 * This script ensures environment variables are loaded before running tests
 */

// Load environment variables FIRST (before any imports)
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Verify environment variables are loaded
console.log("Environment variables loaded:");
console.log("GAME_API_AGENCY_UID:", process.env.GAME_API_AGENCY_UID ? "✅ SET" : "❌ NOT SET");
console.log("GAME_API_AES_KEY:", process.env.GAME_API_AES_KEY ? "✅ SET" : "❌ NOT SET");
console.log("GAME_API_SERVER_URL:", process.env.GAME_API_SERVER_URL ? "✅ SET" : "❌ NOT SET");
console.log("GAME_API_CALLBACK_URL:", process.env.GAME_API_CALLBACK_URL ? "✅ SET" : "❌ NOT SET");

// Now dynamically import and run the test script
async function runTests() {
  const { runTests: testGameApi } = await import("./test-game-api.js");
  await testGameApi();
}

runTests().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
