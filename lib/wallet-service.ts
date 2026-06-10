/**
 * Wallet Service
 *
 * Fixes applied:
 * - db.getClient() removed — Drizzle has no such API; replaced with db.transaction()
 * - Raw SQL "user" table name quoted in sql`` (reserved word in PostgreSQL)
 * - bonus_debit removed from reversalMap — not in enum; replaced with adjustment
 * - reverseTransaction returns newTransactionId matching AggregatorAdapter.rollback caller
 * - getBalance() bypasses cache when skipCache=true (aggregator path)
 * - batchUpdateBalance documented as best-effort sequential (not atomic across users)
 * - getBalanceWithVersion uses camelCase balanceVersion (Drizzle accessor)
 * - redis.del() moved after commit, not inside transaction (fire-and-forget)
 * - updateBalanceAtomic: added optional idempotencyKey param — stored on the transaction
 *   row so the DB unique constraint deduplicates retries that arrive after Redis TTL expires
 */

import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import { user, transaction } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
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
  gameCode?: string;
  method?: string;
  address?: string;
  reason?: string;
  adjustedBy?: string;
  reversedBy?: string;
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
  balanceBefore?: bigint;
  balanceAfter?: bigint;
  newTransactionId?: string;
}

export class WalletService {
  /**
   * Get user balance.
   * @param skipCache - Pass true when accuracy is critical (aggregator getBalance,
   *   bet eligibility). Stale cache is fine for display only.
   */
  async getBalance(userId: string, skipCache = false): Promise<bigint> {
    if (!skipCache) {
      const cached = await redis.get(`balance:${userId}`);
      if (cached !== null) return BigInt(cached);
    }

    const result = await db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!result[0]) return BigInt(0);

    await redis.setex(`balance:${userId}`, 300, result[0].balance.toString());
    return BigInt(result[0].balance);
  }

  /**
   * Atomic balance update with optimistic locking via db.transaction().
   *
   * Flow per attempt:
   * 1. BEGIN
   * 2. SELECT ... FOR UPDATE  (row-level lock)
   * 3. Validate new balance >= 0
   * 4. UPDATE WHERE balance_version = currentVersion (CAS)
   * 5. INSERT transaction record (with idempotencyKey for DB-level dedup)
   * 6. COMMIT
   * 7. Invalidate Redis cache (fire-and-forget after commit)
   *
   * Retries on "Concurrent modification" only; hard-fails on domain errors.
   *
   * @param idempotencyKey - When provided, stored on the transaction row.
   *   The unique constraint on transaction.idempotency_key ensures that even
   *   if the Redis idempotency key has expired, a DB-level duplicate is rejected.
   */
  async updateBalanceAtomic(
    userId: string,
    amountDelta: bigint,
    type: TransactionType,
    metadata: TransactionMetadata,
    maxRetries = 3,
    idempotencyKey?: string,
  ): Promise<UpdateBalanceResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let committedResult: UpdateBalanceResult | null = null;

      try {
        committedResult = await db.transaction(async (tx) => {
          // "user" is a PostgreSQL reserved word — must be quoted in raw sql``
          const userResult = await tx.execute(sql`
            SELECT id, balance, balance_version
            FROM "user"
            WHERE id = ${userId}
            FOR UPDATE
          `);

          // postgres.js driver: execute() returns a RowList which IS the array
          const userRows = userResult as unknown as Array<{
            id: string;
            balance: string;
            balance_version: number;
          }>;

          if (userRows.length === 0) throw new Error("User not found");

          const row = userRows[0];
          const currentBalance = BigInt(row.balance);
          const currentVersion = row.balance_version;
          const newBalance = currentBalance + amountDelta;

          if (newBalance < BigInt(0)) throw new Error("Insufficient balance");

          // CAS — if balance_version changed between SELECT and UPDATE, retry
          const updateResult = await tx.execute(sql`
            UPDATE "user"
            SET balance = ${newBalance.toString()},
                balance_version = balance_version + 1
            WHERE id = ${userId}
              AND balance_version = ${currentVersion}
            RETURNING balance_version
          `);

          const updatedRows = updateResult as unknown as unknown[];
          if (updatedRows.length === 0) throw new Error("Concurrent modification detected");

          const transactionId = nanoid();
          await tx.insert(transaction).values({
            id: transactionId,
            userId,
            type,
            status: "completed",
            amount: (amountDelta > BigInt(0) ? amountDelta : -amountDelta).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            idempotencyKey: idempotencyKey ?? null,
            metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return {
            success: true,
            transactionId,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
          };
        });

        // Cache invalidation AFTER commit — fire-and-forget
        if (committedResult?.success) {
          redis.del(`balance:${userId}`).catch((err) =>
            console.error("[WALLET] Cache invalidation failed:", err),
          );
          return committedResult;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Transaction failed";

        // DB-level idempotency key collision — return the existing transaction.
        // Use Postgres SQLSTATE 23505 (unique_violation) rather than message-string
        // matching, which is fragile across Postgres versions and connection poolers.
        const pgCode = (error as any)?.code ?? (error as any)?.cause?.code;
        if (
          idempotencyKey &&
          (pgCode === '23505' || errorMsg.includes("idempotency_key"))
        ) {
          const existing = await db
            .select()
            .from(transaction)
            .where(eq(transaction.idempotencyKey, idempotencyKey))
            .limit(1);

          if (existing[0]) {
            return {
              success: true,
              transactionId: existing[0].id,
              balanceBefore: BigInt(existing[0].balanceBefore),
              balanceAfter: BigInt(existing[0].balanceAfter),
            };
          }
        }

        if (errorMsg === "Concurrent modification detected") {
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
            continue;
          }
          return {
            success: false,
            error: "Max retries exceeded due to concurrent modifications",
          };
        }

        console.error("[WALLET] Atomic update failed:", error);
        return { success: false, error: errorMsg };
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }

  /**
   * Create a transaction record without modifying balance.
   * Used when the balance change was handled externally (gateway-confirmed deposit).
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
   * Reverse a transaction by creating an opposing balance entry.
   * Returns newTransactionId — AggregatorAdapter.rollback reads this field.
   */
  async reverseTransaction(
    transactionId: string,
    reason: string,
    reversedBy: string,
  ): Promise<UpdateBalanceResult> {
    const original = await db
      .select()
      .from(transaction)
      .where(eq(transaction.id, transactionId))
      .limit(1);

    if (!original[0]) return { success: false, error: "Transaction not found" };

    const orig = original[0];
    const userId = orig.userId;
    const origAmount = BigInt(orig.amount);
    const origType = orig.type as TransactionType;

    const reversalMap: Record<TransactionType, { type: TransactionType; amount: bigint }> = {
      bet:        { type: "refund",     amount:  origAmount },
      withdraw:   { type: "deposit",    amount:  origAmount },
      deposit:    { type: "withdraw",   amount: -origAmount },
      win:        { type: "adjustment", amount: -origAmount },
      loss:       { type: "adjustment", amount:  origAmount },
      bonus:      { type: "adjustment", amount: -origAmount },
      adjustment: { type: "adjustment", amount: -origAmount },
      refund:     { type: "adjustment", amount: -origAmount },
    };

    const reversal = reversalMap[origType] ?? { type: "adjustment", amount: -origAmount };

    const result = await this.updateBalanceAtomic(
      userId,
      reversal.amount,
      reversal.type,
      { originalTransactionId: transactionId, reason, reversedBy },
    );

    return {
      success: result.success,
      error: result.error,
      newTransactionId: result.transactionId,
    };
  }

  /**
   * Best-effort sequential batch balance updates.
   * NOT atomic across users — partial success is possible.
   * For all-or-nothing semantics, wrap in a single db.transaction() at the call site.
   */
  async batchUpdateBalance(
    updates: Array<{
      userId: string;
      amountDelta: bigint;
      type: TransactionType;
      metadata: TransactionMetadata;
    }>,
  ): Promise<{ success: boolean; processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (const update of updates) {
      const result = await this.updateBalanceAtomic(
        update.userId,
        update.amountDelta,
        update.type,
        update.metadata,
      );

      if (result.success) {
        processed++;
      } else {
        failed++;
        console.error(
          `[WALLET] Batch update failed for user ${update.userId}:`,
          result.error,
        );
      }
    }

    return { success: failed === 0, processed, failed };
  }

  /**
   * Get balance with version. Always reads from DB — version must be fresh.
   */
  async getBalanceWithVersion(userId: string): Promise<{
    balance: bigint;
    version: number;
  }> {
    const result = await db
      .select({
        balance: user.balance,
        balanceVersion: user.balanceVersion,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!result[0]) return { balance: BigInt(0), version: 0 };

    return {
      balance: BigInt(result[0].balance),
      version: result[0].balanceVersion,
    };
  }

  async hasSufficientBalance(userId: string, requiredAmount: bigint): Promise<boolean> {
    const balance = await this.getBalance(userId, true);
    return balance >= requiredAmount;
  }

  async lockBalance(userId: string, operationId: string, ttl = 30): Promise<boolean> {
    const key = `balance_lock:${userId}:${operationId}`;
    const result = await redis.set(key, "locked", "EX", ttl, "NX");
    return result === "OK";
  }

  async unlockBalance(userId: string, operationId: string): Promise<void> {
    const key = `balance_lock:${userId}:${operationId}`;
    await redis.del(key);
  }
}

export const walletService = new WalletService();