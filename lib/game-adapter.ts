/**
 * Game Operations Adapter
 *
 * Extends the aggregator adapter pattern for Game API operations.
 * Handles game launching, bet processing, and game session management.
 *
 * This adapter integrates with:
 * - Wallet service for balance operations
 * - Idempotency service for duplicate prevention
 * - Fraud detection for velocity checks
 * - Database for game session and bet records
 */

import { gameApiClient } from "./game-api-client";
import type {
  GameCallbackPayload,
  GameProvider,
  GameInfo,
  TransactionRecord,
} from "./game-api-types";

// ============================================================================
// GAME ADAPTER CLASS
// ============================================================================

/**
 * Game operations adapter for Game API integration
 *
 * Provides a high-level interface for game operations while handling
 * all the complexity of wallet integration, fraud detection, and database operations.
 */
export class GameAdapter {
  // TODO: Inject services when implemented
  // private walletService: WalletService;
  // private idempotencyService: IdempotencyService;
  // private fraudDetection: FraudDetectionService;
  // private db: Database;

  constructor() {
    // Services will be injected when fully implemented
    console.info("[GameAdapter] Initialized");
  }

  // ==========================================================================
  // GAME LAUNCH OPERATIONS
  // ==========================================================================

  /**
   * Launch a game for a player
   *
   * @param params - Game launch parameters
   * @returns Game launch URL and current balance
   * @throws Error if launch fails or balance insufficient
   */
  async launchGame(params: {
    userId: string;
    memberAccount: string; // Player account name for Game API
    gameUid: string;
    language?: string;
  }): Promise<{
    gameUrl: string;
    balance: number; // in paisa
  }> {
    console.info("[GameAdapter] Launching game", {
      userId: params.userId,
      memberAccount: params.memberAccount,
      gameUid: params.gameUid,
      language: params.language,
    });

    // TODO: Get user balance from wallet service
    // const balance = await this.walletService.getBalance(params.userId);
    const balance = 0; // Mock balance for now

    // TODO: Check if user has sufficient balance (minimum requirement?)
    // Game API doesn't specify minimum balance requirements,
    // but we might want to enforce a minimum (e.g., ₹10)

    // TODO: Validate user can play (account not frozen, etc.)
    // await this.validateUserCanPlay(params.userId);

    // Launch game via Game API client
    try {
      const gameUrl = await gameApiClient.launchGame({
        memberAccount: params.memberAccount,
        gameUid: params.gameUid,
        creditAmount: balance,
        language: params.language || "en",
        platform: 2, // H5 (mobile)
      });

      console.info("[GameAdapter] Game launched successfully", {
        userId: params.userId,
        gameUid: params.gameUid,
        gameUrl,
      });

      return {
        gameUrl,
        balance,
      };
    } catch (error) {
      console.error("[GameAdapter] Game launch failed", {
        userId: params.userId,
        gameUid: params.gameUid,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        `Failed to launch game: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ==========================================================================
  // CALLBACK PROCESSING (SEAMLESS MODE)
  // ==========================================================================

  /**
   * Handle bet settlement callback from Game API
   *
   * This is the main entry point for processing bet/win callbacks.
   * Handles idempotency, fraud detection, and wallet operations.
   *
   * @param callbackData - Decrypted callback payload from Game API
   * @returns Response data for Game API (balance after settlement)
   * @throws Error if processing fails (triggers Game API retry)
   */
  async handleCallback(
    callbackData: GameCallbackPayload
  ): Promise<{
    creditAmount: string; // Balance after settlement in rupees
    timestamp: string; // Current timestamp
  }> {
    console.info("[GameAdapter] Processing callback", {
      serialNumber: callbackData.serial_number,
      memberAccount: callbackData.member_account,
      betAmount: callbackData.bet_amount,
      winAmount: callbackData.win_amount,
      gameRound: callbackData.game_round,
    });

    // ========================================================================
    // STEP 1: IDEMPOTENCY CHECK
    // ========================================================================

    // TODO: Implement idempotency check
    // const existing = await this.idempotencyService.check(
    //   `game_api:${callbackData.serial_number}`
    // );
    //
    // if (existing) {
    //   console.info("[GameAdapter] Duplicate callback detected", {
    //     serialNumber: callbackData.serial_number,
    //   });
    //
    //   // Return existing balance (idempotent response)
    //   return {
    //     creditAmount: existing.balance.toString(),
    //     timestamp: Date.now().toString(),
    //   };
    // }

    // ========================================================================
    // STEP 2: FIND USER BY MEMBER ACCOUNT
    // ========================================================================

    // TODO: Look up user by member account
    // const user = await this.db.query.users.findFirst({
    //   where: eq(users.memberAccount, callbackData.member_account)
    // });
    //
    // if (!user) {
    //   console.error("[GameAdapter] User not found", {
    //     memberAccount: callbackData.member_account,
    //   });
    //
    //   throw new Error("User not found");
    // }

    const userId = "mock-user-id"; // Mock for now

    // ========================================================================
    // STEP 3: FRAUD DETECTION CHECKS
    // ========================================================================

    // TODO: Implement fraud detection
    // await this.fraudDetection.checkGameCallbackRate(userId);
    //
    // const betAmount = parseFloat(callbackData.bet_amount);
    // if (betAmount > 0) {
    //   await this.fraudDetection.checkBetAmountLimits(userId, betAmount);
    // }
    //
    // const winAmount = parseFloat(callbackData.win_amount);
    // if (winAmount > 0) {
    //   await this.fraudDetection.checkWinPatterns(userId, winAmount);
    // }

    // ========================================================================
    // STEP 4: PROCESS TRANSACTION (DATABASE + WALLET)
    // ========================================================================

    try {
      // TODO: Process transaction within database transaction
      // const result = await this.db.transaction(async (tx) => {
      //
      //   // Create idempotency record
      //   await this.idempotencyService.create(
      //     `game_api:${callbackData.serial_number}`,
      //     {
      //       amount: betAmount,
      //       winAmount: winAmount,
      //       userId: userId,
      //     },
      //     tx
      //   );
      //
      //   // Process bet amount (debit)
      //   if (betAmount > 0) {
      //     await this.walletService.updateBalanceAtomic(
      //       userId,
      //       -betAmount,
      //       'bet',
      //       tx,
      //       { gameApiSerial: callbackData.serial_number }
      //     );
      //   }
      //
      //   // Process win amount (credit)
      //   if (winAmount > 0) {
      //     await this.walletService.updateBalanceAtomic(
      //       userId,
      //       winAmount,
      //       'win',
      //       tx,
      //       { gameApiSerial: callbackData.serial_number }
      //     );
      //   }
      //
      //   // Create game session record
      //   await this.createGameSession(callbackData, userId, tx);
      //
      //   // Create bet record
      //   await this.createBetRecord(callbackData, userId, tx);
      //
      //   // Get final balance
      //   const balance = await this.walletService.getBalance(userId, tx);
      //
      //   return { balance };
      // });

      console.warn("[GameAdapter] Transaction processing not yet implemented", {
        serialNumber: callbackData.serial_number,
      });

      // Mock response for now
      return {
        creditAmount: "0.00",
        timestamp: Date.now().toString(),
      };

    } catch (error) {
      console.error("[GameAdapter] Transaction processing failed", {
        serialNumber: callbackData.serial_number,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error; // Re-throw to trigger Game API retry
    }
  }

  /**
   * Process a bet (called from handleCallback)
   *
   * @param params - Bet processing parameters
   * @throws Error if bet processing fails
   */
  private async processBet(params: {
    userId: string;
    amount: number;
    serialNumber: string;
    gameRound: string;
    gameUid: string;
  }): Promise<void> {
    console.info("[GameAdapter] Processing bet", {
      userId: params.userId,
      amount: params.amount,
      serialNumber: params.serialNumber,
    });

    // TODO: Implement bet processing
    // await this.walletService.updateBalanceAtomic(
    //   params.userId,
    //   -params.amount,
    //   'bet',
    //   tx,
    //   { gameApiSerial: params.serialNumber }
    // );
  }

  /**
   * Process a win (called from handleCallback)
   *
   * @param params - Win processing parameters
   * @throws Error if win processing fails
   */
  private async processWin(params: {
    userId: string;
    amount: number;
    serialNumber: string;
    gameRound: string;
    gameUid: string;
  }): Promise<void> {
    console.info("[GameAdapter] Processing win", {
      userId: params.userId,
      amount: params.amount,
      serialNumber: params.serialNumber,
    });

    // TODO: Implement win processing
    // await this.walletService.updateBalanceAtomic(
    //   params.userId,
    //   params.amount,
    //   'win',
    //   tx,
    //   { gameApiSerial: params.serialNumber }
    // );
  }

  // ==========================================================================
  // GAME SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Create or update game session record
   *
   * @param callbackData - Callback data from Game API
   * @param userId - User ID
   * @param tx - Database transaction
   */
  private async createGameSession(
    callbackData: GameCallbackPayload,
    userId: string,
    tx: any // TODO: Type properly when db is available
  ): Promise<void> {
    console.debug("[GameAdapter] Creating game session", {
      serialNumber: callbackData.serial_number,
      gameRound: callbackData.game_round,
    });

    // TODO: Implement game session creation
    // await tx.insert(gameSessions).values({
    //   provider: "game-api",
    //   providerGameId: callbackData.game_uid,
    //   providerSessionId: callbackData.game_round,
    //   gameApiSerial: callbackData.serial_number,
    //   userId: userId,
    //   status: "active",
    //   totalBet: parseFloat(callbackData.bet_amount) * 100, // Convert to paisa
    //   totalWin: parseFloat(callbackData.win_amount) * 100, // Convert to paisa
    //   gameData: {
    //     gameApi: {
    //       serial: callbackData.serial_number,
    //       gameRound: callbackData.game_round,
    //       callbackData: callbackData,
    //     },
    //   },
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    // });
  }

  /**
   * Create bet record
   *
   * @param callbackData - Callback data from Game API
   * @param userId - User ID
   * @param tx - Database transaction
   */
  private async createBetRecord(
    callbackData: GameCallbackPayload,
    userId: string,
    tx: any // TODO: Type properly when db is available
  ): Promise<void> {
    console.debug("[GameAdapter] Creating bet record", {
      serialNumber: callbackData.serial_number,
      gameRound: callbackData.game_round,
    });

    // TODO: Implement bet record creation
    // await tx.insert(bets).values({
    //   userId: userId,
    //   amount: parseFloat(callbackData.bet_amount) * 100, // Convert to paisa
    //   winAmount: parseFloat(callbackData.win_amount) * 100, // Convert to paisa
    //   gameApiSerial: callbackData.serial_number,
    //   gameRound: callbackData.game_round,
    //   result: parseFloat(callbackData.win_amount) > parseFloat(callbackData.bet_amount)
    //     ? "won"
    //     : parseFloat(callbackData.win_amount) > 0
    //     ? "partial_win"
    //     : "lost",
    //   gameData: {
    //     gameApi: {
    //       serial: callbackData.serial_number,
    //       gameRound: callbackData.game_round,
    //       providerData: callbackData.data,
    //     },
    //   },
    //   settledAt: new Date(),
    //   createdAt: new Date(),
    // });
  }

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  /**
   * Get available game providers
   *
   * @returns Array of game providers
   */
  async getProviders(): Promise<GameProvider[]> {
    console.info("[GameAdapter] Fetching game providers");

    try {
      return await gameApiClient.getProviders(this.config.currency);
    } catch (error) {
      console.error("[GameAdapter] Failed to fetch providers", {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get games from a specific provider
   *
   * @param providerCode - Provider code (e.g., "pg", "evolution")
   * @returns Array of games from the provider
   */
  async getGameList(providerCode: string): Promise<GameInfo[]> {
    console.info("[GameAdapter] Fetching game list", { providerCode });

    try {
      return await gameApiClient.getGameList(
        providerCode,
        this.config.currency
      );
    } catch (error) {
      console.error("[GameAdapter] Failed to fetch game list", {
        providerCode,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get transaction history from Game API
   *
   * @param filters - Transaction filters
   * @returns Paginated transaction records
   */
  async getTransactions(filters: {
    userId: string;
    fromDate: Date;
    toDate: Date;
    page: number;
    pageSize: number;
  }): Promise<{
    totalCount: number;
    currentPage: number;
    records: TransactionRecord[];
  }> {
    console.info("[GameAdapter] Fetching transactions", {
      userId: filters.userId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      page: filters.page,
    });

    try {
      return await gameApiClient.getTransactions({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        pageNo: filters.page,
        pageSize: filters.pageSize,
      });
    } catch (error) {
      console.error("[GameAdapter] Failed to fetch transactions", {
        userId: filters.userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get player balance (for transfer mode or balance queries)
   *
   * @param userId - User ID
   * @returns Current balance in paisa
   */
  async getBalance(userId: string): Promise<number> {
    console.debug("[GameAdapter] Fetching balance", { userId });

    // TODO: Implement balance fetch from wallet service
    // return await this.walletService.getBalance(userId);

    return 0; // Mock for now
  }

  /**
   * Rollback a transaction (if needed)
   *
   * @param serialNumber - Game API serial number to rollback
   * @throws Error if rollback fails
   */
  async rollbackTransaction(serialNumber: string): Promise<void> {
    console.warn("[GameAdapter] Rolling back transaction", {
      serialNumber,
    });

    // TODO: Implement transaction rollback
    // await this.db.transaction(async (tx) => {
    //   // Find transaction by serial number
    //   const transaction = await tx.query.transactions.findFirst({
    //     where: eq(transactions.gameApiSerial, serialNumber),
    //   });
    //
    //   if (!transaction) {
    //     throw new Error("Transaction not found");
    //   }
    //
    //   // Reverse the transaction
    //   await this.walletService.reverseTransaction(transaction.id, tx);
    //
    //   // Update game session
    //   await tx.update(gameSessions)
    //     .set({ status: "cancelled" })
    //     .where(eq(gameSessions.gameApiSerial, serialNumber));
    // });

    console.warn("[GameAdapter] Transaction rollback not yet implemented");
  }

  // Private getter for config (to avoid circular dependency)
  private get config() {
    return {
      currency: "INR", // Fixed to INR per requirements
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global Game adapter instance
 * Use this instead of creating new instances
 */
export const gameAdapter = new GameAdapter();
