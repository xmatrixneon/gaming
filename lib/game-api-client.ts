/**
 * Game API HTTP Client
 *
 * Handles all HTTP communication with the Game API provider.
 * Features automatic request encryption, response decryption,
 * error handling, retry logic, and logging.
 */

import { aesEncrypt, aesDecrypt, encryptObject, decryptObject } from "./crypto-utils";
import { gameApiConfig, validateGameApiConfig } from "./game-api-config";
import type {
  GameApiResponse,
  LaunchGameRequest,
  LaunchGameResponse,
  LaunchGameTransferRequest,
  LaunchGameTransferResponse,
  GetTransactionsRequest,
  GetTransactionsResponse,
  GetProvidersResponse,
  GetGameListResponse,
  TransactionRecord,
  GameProvider,
  GameInfo,
} from "./game-api-types";

// ============================================================================
// GAME API CLIENT CLASS
// ============================================================================

/**
 * HTTP client for Game API integration
 *
 * Handles all communication with the Game API including:
 * - Game launch requests
 * - Provider and game list queries
 * - Transaction history retrieval
 * - Automatic encryption/decryption
 * - Error handling and retry logic
 */
export class GameApiClient {
  private readonly config = gameApiConfig;

  constructor() {
    // Validate configuration on client creation
    validateGameApiConfig();
  }

  // ==========================================================================
  // PUBLIC API METHODS
  // ==========================================================================

  /**
   * Launch a game in seamless mode
   *
   * @param params - Game launch parameters
   * @returns Game launch URL
   * @throws Error if launch fails
   */
  async launchGame(params: {
    memberAccount: string;
    gameUid: string;
    creditAmount: number; // in paisa
    language?: string;
    homeUrl?: string;
    platform?: 1 | 2;
  }): Promise<string> {
    const request: LaunchGameRequest = {
      timestamp: Date.now().toString(),
      agency_uid: this.config.agencyUid,
      member_account: params.memberAccount,
      game_uid: params.gameUid,
      credit_amount: this.paisaToRupee(params.creditAmount).toString(),
      currency_code: this.config.currency,
      language: params.language || "en",
      home_url: params.homeUrl,
      platform: params.platform || 2, // Default to H5 (mobile)
      callback_url: this.config.callbackUrl,
    };

    const response = await this.request<
      GameApiResponse<LaunchGameResponse>
    >("/game/v1", request);

    if (response.code !== 0) {
      throw new Error(`Game launch failed: ${response.msg}`);
    }

    if (!response.payload?.game_launch_url) {
      throw new Error("Game launch URL missing in response");
    }

    console.info("[GameAPI] Game launched successfully", {
      memberAccount: params.memberAccount,
      gameUid: params.gameUid,
      gameUrl: response.payload.game_launch_url,
    });

    return response.payload.game_launch_url;
  }

  /**
   * Get available game providers
   *
   * @param currency - Optional currency filter
   * @returns Array of game providers
   */
  async getProviders(currency?: string): Promise<GameProvider[]> {
    const queryParams = new URLSearchParams({
      agency_uid: this.config.agencyUid,
    });

    if (currency) {
      queryParams.append("currency", currency);
    }

    const url = `/game/providers?${queryParams.toString()}`;
    const response = await this.getRequest<GetProvidersResponse>(url);

    if (response.code !== 0) {
      throw new Error(`Failed to get providers: ${response.msg}`);
    }

    return response.data || [];
  }

  /**
   * Get games from a specific provider
   *
   * @param providerCode - Provider code (e.g., "pg", "evolution")
   * @param currency - Optional currency filter
   * @param lang - Optional language filter
   * @returns Array of games from the provider
   */
  async getGameList(
    providerCode: string,
    currency?: string,
    lang?: string
  ): Promise<GameInfo[]> {
    const queryParams = new URLSearchParams({
      agency_uid: this.config.agencyUid,
      code: providerCode,
    });

    if (currency) {
      queryParams.append("currency", currency);
    }

    if (lang) {
      queryParams.append("lang", lang);
    }

    const url = `/game/list?${queryParams.toString()}`;
    const response = await this.getRequest<GetGameListResponse>(url);

    if (response.code !== 0) {
      throw new Error(`Failed to get game list: ${response.msg}`);
    }

    return response.data || [];
  }

  /**
   * Get transaction records from Game API
   *
   * @param filters - Transaction filters
   * @returns Paginated transaction records
   */
  async getTransactions(filters: {
    fromDate: Date;
    toDate: Date;
    pageNo: number;
    pageSize: number;
  }): Promise<{
    totalCount: number;
    currentPage: number;
    records: TransactionRecord[];
  }> {
    const request: GetTransactionsRequest = {
      timestamp: Date.now().toString(),
      agency_uid: this.config.agencyUid,
      from_date: filters.fromDate.getTime().toString(),
      to_date: filters.toDate.getTime().toString(),
      page_no: filters.pageNo,
      page_size: filters.pageSize,
    };

    const response = await this.request<
      GameApiResponse<GetTransactionsResponse>
    >("/game/transaction/list", request);

    if (response.code !== 0) {
      throw new Error(`Failed to get transactions: ${response.msg}`);
    }

    return {
      totalCount: response.payload?.total_count || 0,
      currentPage: response.payload?.current_page || 1,
      records: response.payload?.records || [],
    };
  }

  // ==========================================================================
  // PRIVATE HTTP METHODS
  // ==========================================================================

  /**
   * Core HTTP request method with automatic encryption/decryption
   *
   * @param endpoint - API endpoint path
   * @param payload - Request payload to encrypt
   * @returns Decrypted response
   * @throws Error if request fails or decryption fails
   */
  private async request<T>(endpoint: string, payload: unknown): Promise<T> {
    const url = `${this.config.serverUrl}${endpoint}`;

    // Encrypt the payload
    const encryptedPayload = encryptObject(payload, this.config.aesKey);

    // Build request body
    const requestBody = {
      agency_uid: this.config.agencyUid,
      timestamp: Date.now().toString(),
      payload: encryptedPayload,
    };

    console.debug("[GameAPI] Sending request", {
      endpoint,
      timestamp: requestBody.timestamp,
    });

    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const responseBody = await response.json();
        console.debug("[GameAPI] Received response", {
          endpoint,
          code: responseBody.code,
          msg: responseBody.msg,
        });

        // Decrypt the response payload if present
        if (responseBody.payload) {
          if (typeof responseBody.payload === "string") {
            responseBody.payload = decryptObject(
              responseBody.payload,
              this.config.aesKey
            );
          }
        }

        return responseBody as T;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on authentication errors or client errors
        if (error instanceof Error && error.message.includes("HTTP 4")) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(
            `[GameAPI] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`,
            { error: lastError.message }
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    console.error("[GameAPI] Request failed after all retries", {
      endpoint,
      error: lastError?.message,
    });

    throw new Error(
      `Game API request failed: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * GET request for endpoints that don't require encryption
   * (e.g., provider list, game list)
   *
   * @param url - Full URL with query parameters
   * @returns Response object
   */
  private async getRequest<T>(url: string): Promise<T> {
    const fullUrl = `${this.config.serverUrl}${url}`;

    console.debug("[GameAPI] Sending GET request", { url: fullUrl });

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseBody = await response.json();
    console.debug("[GameAPI] GET response received", {
      code: responseBody.code,
      msg: responseBody.msg,
    });

    return responseBody as T;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Converts paisa to rupee (float division)
   *
   * @param paisa - Amount in paisa
   * @returns Amount in rupee
   */
  private paisaToRupee(paisa: number): number {
    return paisa / 100;
  }

  /**
   * Converts rupee to paisa (integer multiplication)
   *
   * @param rupee - Amount in rupee
   * @returns Amount in paisa
   */
  private rupeeToPaisa(rupee: number): number {
    return Math.round(rupee * 100);
  }

  /**
   * Sleep utility for retry delays
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global Game API client instance
 * Use this instead of creating new instances
 */
export const gameApiClient = new GameApiClient();
