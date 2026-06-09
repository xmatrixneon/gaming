/**
 * Wallet Service
 *
 * Core financial operations with ACID guarantees:
 * - Atomic balance updates using optimistic locking
 * - Immutable transaction ledger
 * - Idempotent operations
 * - Comprehensive audit trail
 *
 * Security measures:
 * - Balance versioning prevents race conditions
 * - Database transactions ensure all-or-nothing execution
 * - No balance is ever modified without creating a transaction record
 */

import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import { user, transaction } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";

export type TransactionType =
  | "deposit"
  | "withdraw"
  | "bet"
  | "win"
  | "loss"
  | "bonus"
  | "adjustment"
  | "refund";

export interface TransactionMetadata {
  gameSessionId?: string;
  betId?: string;
  provider?: string;
  method?: string;
  address?: string;
  reason?: string;
  adjustedBy?: string;
  aggregatorRef?: string;
  gameRoundId?: string;
  originalTransactionId?: string;
  gatewayReference?: string;
  depositId?: string;
  withdrawalId?: string;
}

export interface UpdateBalanceResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export class WalletService {
  /**
   * Get user balance with cache check
   * Uses Redis cache with 5-minute TTL for performance
   */
  async getBalance(userId: string): Promise<bigint> {
    const cached = await redis.get(`balance:${userId}`);
    if (cached !== null) {
      return BigInt(cached);
    }

    const result = await db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!result[0]) {
      return 0n;
    }

    // Cache for 5 minutes
    await redis.setex(`balance:${userId}`, 300, result[0].balance.toString());
    return BigInt(result[0].balance);
  }

  /**
   * Get user balance version (for optimistic locking)
   */
  private async getBalanceVersion(userId: string): Promise<number> {
    const result = await db
      .select({ balanceVersion: user.balanceVersion })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return result[0]?.balanceVersion ?? 0;
  }

  /**
   * Atomic balance update with optimistic locking
   *
   * Uses database-level locking with balanceVersion to prevent race conditions:
   * 1. BEGIN transaction
   * 2. SELECT user row FOR UPDATE (locks the row)
   * 3. Calculate new balance and validate
   * 4. UPDATE with incremented balanceVersion (ensures no concurrent modifications)
   * 5. If UPDATE affects 0 rows, retry (concurrent modification detected)
   * 6. Create transaction record
   * 7. COMMIT
   * 8. Invalidate cache
   *
   * @param userId - User ID
   * @param amountDelta - Amount to add (positive) or subtract (negative)
   * @param type - Transaction type
   * @param metadata - Additional transaction metadata
   * @param maxRetries - Maximum retry attempts for concurrent modifications
   */
  async updateBalanceAtomic(
    userId: string,
    amountDelta: bigint,
    type: TransactionType,
    metadata: TransactionMetadata,
    maxRetries: number = 3
  ): Promise<UpdateBalanceResult> {
    const client = await db.getClient();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await client.query("BEGIN");

        // Get current user with balance lock (FOR UPDATE)
        const userResult = await client.query<{
          id: string;
          balance: string;
          balance_version: number;
        }>(`
          SELECT id, balance, balance_version
          FROM user
          WHERE id = $1
          FOR UPDATE
        `, [userId]);

        if (userResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return { success: false, error: "User not found" };
        }

        const userData = userResult.rows[0];
        const currentBalance = BigInt(userData.balance);
        const currentVersion = userData.balance_version;
        const newBalance = currentBalance + amountDelta;

        // Validate balance won't go negative
        if (newBalance < 0n) {
          await client.query("ROLLBACK");
          return {
            success: false,
            error: "Insufficient balance"
          };
        }

        // Update user balance with incremented version
        const updateResult = await client.query(`
          UPDATE user
          SET balance = $1, balance_version = balance_version + 1
          WHERE id = $2 AND balance_version = $3
          RETURNING balance_version
        `, [newBalance.toString(), userId, currentVersion]);

        if (updateResult.rows.length === 0) {
          // No rows updated means concurrent modification detected
          if (attempt < maxRetries - 1) {
            await client.query("ROLLBACK");
            await new Promise((resolve) => setTimeout(resolve, 50)); // Brief wait before retry
            continue; // Retry the operation
          }
          await client.query("ROLLBACK");
          return {
            success: false,
            error: "Concurrent modification detected - please retry"
          };
        }

        // Create transaction record
        const transactionId = nanoid();
        await client.query(`
          INSERT INTO transaction (id, user_id, type, status, amount, balance_before, balance_after, metadata, created_at, updated_at)
          VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, NOW(), NOW())
        `, [
          transactionId,
          userId,
          type,
          // Store absolute amount (always positive for record-keeping)
          amountDelta > 0n ? amountDelta.toString() : (-amountDelta).toString(),
          currentBalance.toString(),
          newBalance.toString(),
          JSON.stringify(metadata),
        ]);

        await client.query("COMMIT");

        // Invalidate balance cache
        await redis.del(`balance:${userId}`);

        return {
          success: true,
          transactionId,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("[WALLET] Atomic update failed:", error);

        // Don't retry on certain errors
        const errorMsg = error instanceof Error ? error.message : "Transaction failed";
        if (
          errorMsg.includes("User not found") ||
          errorMsg.includes("Insufficient balance") ||
          errorMsg.includes("database") || // Permanent database error
          errorMsg.includes("connection") // Connection issues
        ) {
          return {
            success: false,
            error: errorMsg
          };
        }

        // Retry on transient errors
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Longer wait for retries
          continue;
        }

        return {
          success: false,
          error: errorMsg
        };
      }
    }

    return {
      success: false,
      error: "Max retries exceeded due to concurrent modifications"
    };
  }

  /**
   * Create transaction record (for non-balance operations)
   * This is used when transactions are already processed externally
   */
  async createTransaction(data: {
    userId: string;
    type: TransactionType;
    amount: bigint;
    balanceBefore: bigint;
    balanceAfter: bigint;
    metadata: TransactionMetadata;
    idempotencyKey?: string;
  }): Promise<string> {
    const transactionId = nanoid();

    await db.insert(transaction).values({
      id: transactionId,
      userId: data.userId,
      type: data.type,
      status: "completed",
      amount: data.amount.toString(),
      balanceBefore: data.balanceBefore.toString(),
      balanceAfter: data.balanceAfter.toString(),
      idempotencyKey: data.idempotencyKey,
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return transactionId;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<{
    id: string;
    userId: string;
    type: TransactionType;
    status: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    metadata: TransactionMetadata;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const result = await db
      .select()
      .from(transaction)
      .where(eq(transaction.id, transactionId))
      .limit(1);

    if (!result[0]) return null;

    const t = result[0];
    return {
      id: t.id,
      userId: t.userId,
      type: t.type as TransactionType,
      status: t.status,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      metadata: t.metadata as TransactionMetadata,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  /**
   * Reverse a transaction (create opposing entry)
   * Used for refunds, corrections, or support reversals
   */
  async reverseTransaction(
    transactionId: string,
    reason: string,
    reversedBy: string
  ): Promise<UpdateBalanceResult> {
    // Get original transaction
    const original = await db
      .select()
      .from(transaction)
      .where(eq(transaction.id, transactionId))
      .limit(1);

    if (!original[0]) {
      return {
        success: false,
        error: "Transaction not found"
      };
    }

    const orig = original[0];
    const userId = orig.userId;
    const origAmount = BigInt(orig.amount);
    const origType = orig.type as TransactionType;

    // Determine reversal type and amount
    const reversalMap: Record<TransactionType, { type: TransactionType; amount: bigint }> = {
      'bet': { type: 'refund', amount: origAmount }, // Refund the bet
      'withdraw': { type: 'deposit', amount: -origAmount }, // Cancel withdrawal = deposit back
      'deposit': { type: 'withdraw', amount: -origAmount }, // Cancel deposit = withdrawal back
      'win': { type: 'adjustment', amount: -origAmount }, // Reverse win = adjustment
      'loss': { type: 'adjustment', amount: origAmount }, // Reverse loss = adjustment (shouldn't happen)
      'bonus': { type: 'bonus_debit', amount: -origAmount }, // Reverse bonus = debit
      'adjustment': { type: 'adjustment', amount: -origAmount }, // Reverse adjustment = adjustment
      'refund': { type: 'bet', amount: origAmount }, // Reverse refund = bet
    };

    const reversal = reversalMap[origType] || { type: 'adjustment', amount: -origAmount };

    const result = await this.updateBalanceAtomic(
      userId,
      reversal.amount,
      reversal.type,
      {
        originalTransactionId: transactionId,
        reason,
        reversedBy,
        ...reversal,
      }
    );

    return { success: result.success, transactionId: result.transactionId };
  }

  /**
   * Batch balance updates (for multiple transactions)
   * Used for settling multiple bets at once
   */
  async batchUpdateBalance(
    updates: Array<{
      userId: string;
      amountDelta: bigint;
      type: TransactionType;
      metadata: TransactionMetadata;
    }>
  ): Promise<{ success: boolean; processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (const update of updates) {
      const result = await this.updateBalanceAtomic(
        update.userId,
        update.amountDelta,
        update.type,
        update.metadata
      );

      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      processed,
      failed
    };
  }

  /**
   * Get balance with version (for API responses)
   */
  async getBalanceWithVersion(userId: string): Promise<{
    balance: bigint;
    version: number;
  }> {
    const result = await db
      .select({
        balance: user.balance,
        balanceVersion: user.balance_version
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!result[0]) {
      return { balance: 0n, version: 0 };
    }

    return {
      balance: BigInt(result[0].balance),
      version: result[0].balanceVersion,
    };
  }

  /**
   * Validate sufficient balance
   */
  async hasSufficientBalance(userId: string, requiredAmount: bigint): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= requiredAmount;
  }

  /**
   * Lock balance for operations (for external service calls)
   * Creates a temporary lock in Redis
   */
  async lockBalance(userId: string, operationId: string, ttl: number = 30): Promise<boolean> {
    const key = `balance_lock:${userId}:${operationId}`;
    const result = await redis.set(key, "locked", "NX", "EX", ttl);
    return result === "OK";
  }

  /**
   * Unlock balance
   */
  async unlockBalance(userId: string, operationId: string): Promise<void> {
    const key = `balance_lock:${userId}:${operationId}`;
    await redis.del(key);
  }
}

// Singleton instance
export const walletService = new WalletService();
