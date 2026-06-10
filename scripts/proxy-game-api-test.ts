/**
 * Game API Test via Proxy Server
 *
 * This script forwards Game API requests through a proxy server
 * that has the whitelisted IP address.
 *
 * Usage:
 *   npx tsx scripts/proxy-game-api-test.ts
 *
 * Set the proxy server URL in .env.local:
 *   GAME_API_PROXY_URL=http://your-proxy-server:port
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import http from "http";
import https from "https";

const PROXY_URL = process.env.GAME_API_PROXY_URL;
if (!PROXY_URL) {
  console.error("❌ GAME_API_PROXY_URL not set in .env.local");
  console.error("\nAdd this line to your .env.local:");
  console.error("  GAME_API_PROXY_URL=http://your-proxy-server:port");
  process.exit(1);
}

console.log(`Using proxy: ${PROXY_URL}`);
console.log("");

// Test request to Game API
const targetUrl = "https://huidu.bet/game/providers?agency_uid=b75fbd22d0684c450192df017ddfcfe6";

const proxyUrl = new URL(PROXY_URL);

const options = {
  hostname: proxyUrl.hostname,
  port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
  path: targetUrl,
  method: "GET",
  headers: {
    "Host": new URL(targetUrl).hostname,
  },
};

if (proxyUrl.protocol === 'https:') {
  options.protocol = 'https:';
}

console.log(`Fetching: ${targetUrl}`);
console.log(`Via proxy: ${proxyUrl.hostname}:${proxyUrl.port || 443}`);
console.log("");

const protocol = proxyUrl.protocol === 'https:' ? https : http;

const req = protocol.request(options, (res) => {
  console.log(`Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log("");

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("Response:");
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log("Raw response:");
      console.log(data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request failed:", error.message);
  process.exit(1);
});

req.end();
