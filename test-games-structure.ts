/**
 * Test to get full game structure including images
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getGameApiClient } from "./lib/game-api-client";

async function testGameList() {
  const client = getGameApiClient();
  
  // Test a few providers to see the full game structure
  const providers = ['PG', 'JL', 'PPLIVE', 'SPRIBE'];
  
  for (const code of providers) {
    console.log('\n=====' + code + '=====');
    try {
      const games = await client.getGameList(code, 'INR', 'en');
      console.log('Total games:', games.length);
      if (games.length > 0) {
        console.log('\nSample game:');
        console.log(JSON.stringify(games[0], null, 2));
      }
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

testGameList().catch(console.error);
