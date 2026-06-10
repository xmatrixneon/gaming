/**
 * Game API Configuration
 *
 * Loads and validates environment variables for Game API integration.
 * Configuration includes credentials, URLs, and security settings.
 */

// ============================================================================
// GAME API CONFIGURATION
// ============================================================================

/**
 * Game API configuration loaded from environment variables
 *
 * Required environment variables:
 * - GAME_API_AGENCY_UID: Agency identification code
 * - GAME_API_AES_KEY: 32-byte AES encryption key
 * - GAME_API_SERVER_URL: Game API server URL
 * - GAME_API_CALLBACK_URL: Callback URL for bet settlement
 * - GAME_API_PLAYER_PREFIX: Prefix for all player accounts (e.g., "h5ab3a")
 * - GAME_API_IP_WHITELIST: Comma-separated list of allowed IPs (optional)
 *
 * Fixed configuration (based on requirements):
 * - mode: "seamless" - Industry standard seamless wallet mode
 * - currency: "INR" - INR currency support only
 *
 * NOTE: Configuration is evaluated on each access to ensure
 * environment variables are loaded (e.g., after dotenv.config())
 */
export const gameApiConfig = {
  get agencyUid(): string {
    return process.env.GAME_API_AGENCY_UID || "";
  },
  get aesKey(): string {
    return process.env.GAME_API_AES_KEY || "";
  },
  get serverUrl(): string {
    return process.env.GAME_API_SERVER_URL || "https://jsgame.live";
  },
  get callbackUrl(): string {
    return process.env.GAME_API_CALLBACK_URL || "";
  },
  get playerPrefix(): string {
    return process.env.GAME_API_PLAYER_PREFIX || "";
  },
  mode: "seamless" as const,
  currency: "INR",
  get ipWhitelist(): readonly string[] {
    return parseIpWhitelist(process.env.GAME_API_IP_WHITELIST);
  },
  timeout: 30000,
  maxRetries: 3,
  maxCallbacksPerMinute: 100,
  maxBetAmount: 50000,
  maxHourlyBets: 500000,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GameApiConfig {
  agencyUid: string;
  aesKey: string;
  serverUrl: string;
  callbackUrl: string;
  mode: "seamless" | "transfer";
  currency: string;
  ipWhitelist: readonly string[];
  timeout: number;
  maxRetries: number;
  maxCallbacksPerMinute: number;
  maxBetAmount: number;
  maxHourlyBets: number;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that all required Game API configuration is present and valid
 *
 * @throws Error if configuration is invalid
 * @returns true if configuration is valid
 */
export function validateGameApiConfig(): true {
  const errors: string[] = [];

  // Validate agency UID
  if (!gameApiConfig.agencyUid) {
    errors.push("GAME_API_AGENCY_UID is required");
  } else if (gameApiConfig.agencyUid.length < 10) {
    errors.push("GAME_API_AGENCY_UID must be at least 10 characters");
  }

  // Validate AES key
  if (!gameApiConfig.aesKey) {
    errors.push("GAME_API_AES_KEY is required");
  } else if (gameApiConfig.aesKey.length !== 32) {
    errors.push(`GAME_API_AES_KEY must be exactly 32 bytes, got ${gameApiConfig.aesKey.length} bytes`);
  }

  // Validate server URL
  if (!gameApiConfig.serverUrl) {
    errors.push("GAME_API_SERVER_URL is required");
  } else if (!isValidUrl(gameApiConfig.serverUrl)) {
    errors.push("GAME_API_SERVER_URL must be a valid URL");
  }

  // Validate callback URL
  if (!gameApiConfig.callbackUrl) {
    errors.push("GAME_API_CALLBACK_URL is required");
  } else if (!isValidUrl(gameApiConfig.callbackUrl)) {
    errors.push("GAME_API_CALLBACK_URL must be a valid URL");
  } else if (
    !gameApiConfig.callbackUrl.startsWith("https://") &&
    !gameApiConfig.callbackUrl.startsWith("http://localhost") &&
    !gameApiConfig.callbackUrl.startsWith("http://127.0.0.1")
  ) {
    errors.push("GAME_API_CALLBACK_URL must use HTTPS (or HTTP for localhost)");
  }

  // Validate player prefix
  if (!gameApiConfig.playerPrefix) {
    errors.push("GAME_API_PLAYER_PREFIX is required");
  } else if (gameApiConfig.playerPrefix.length < 3) {
    errors.push("GAME_API_PLAYER_PREFIX must be at least 3 characters");
  }

  // Validate IP whitelist (optional but recommended)
  if (gameApiConfig.ipWhitelist.length === 0) {
    console.warn(
      "[GameAPI] Warning: GAME_API_IP_WHITELIST is empty. This is a security risk for production."
    );
  }

  // If there are errors, throw
  if (errors.length > 0) {
    throw new Error(
      `Game API configuration invalid:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  return true;
}

/**
 * Gets configuration for logging (redacts sensitive data)
 *
 * @returns Safe configuration object for logging
 */
export function getGameApiConfigForLogging(): Partial<GameApiConfig> {
  return {
    agencyUid: gameApiConfig.agencyUid,
    serverUrl: gameApiConfig.serverUrl,
    callbackUrl: gameApiConfig.callbackUrl,
    mode: gameApiConfig.mode,
    currency: gameApiConfig.currency,
    ipWhitelist: gameApiConfig.ipWhitelist,
    timeout: gameApiConfig.timeout,
    maxRetries: gameApiConfig.maxRetries,
    // aesKey is redacted for security
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parses IP whitelist from environment variable
 *
 * @param whitelistStr - Comma-separated string of IPs
 * @returns Array of IP addresses
 */
function parseIpWhitelist(whitelistStr?: string): readonly string[] {
  if (!whitelistStr) {
    return [];
  }

  return whitelistStr
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);
}

/**
 * Validates URL format
 *
 * @param url - URL string to validate
 * @returns true if valid URL, false otherwise
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// DEVELOPMENT/PRODUCTION HELPERS
// ============================================================================

/**
 * Checks if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Checks if Game API is properly configured
 *
 * @returns true if configured, false otherwise
 */
export function isGameApiConfigured(): boolean {
  try {
    validateGameApiConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets Game API status for health checks
 */
export function getGameApiStatus(): {
  configured: boolean;
  mode: string;
  currency: string;
  hasIpWhitelist: boolean;
} {
  return {
    configured: isGameApiConfigured(),
    mode: gameApiConfig.mode,
    currency: gameApiConfig.currency,
    hasIpWhitelist: gameApiConfig.ipWhitelist.length > 0,
  };
}
