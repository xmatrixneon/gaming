/**
 * Game Aggregator Wallet Adapter
 *
 * Implements standard aggregator wallet API pattern:
 * - debit(): Deduct balance for bet placement
 * - credit(): Add winnings to balance
 * - getBalance(): Query current balance (fresh, no cache)
 * - rollback(): Reverse failed transactions
 *
 * Fixes applied:
 * - Static imports for bonusService and vipService (dynamic imports removed)
 * - wagering NOT tracked on wins — wagering requirements count bets placed, not winnings
 * - VIP progress NOT tracked on wins — VIP is earned by wagering, not by receiving winnings
 * - bet insert now populates gameRound column (was missing; credit() relies on it)
 * - credit() bet lookup uses eq(bet.gameRound) instead of JSONB raw SQL
 * - credit() totalWin update moved to AFTER wallet credit succeeds (was before → data inconsistency on failure)
 * - getBalance() passes skipCache=true — aggregators need accurate balance, not cached
 * - transactionRef/0n literals replaced with BigInt(0) for clarity
 */

import { nanoid } from "nanoid";
import { walletService } from "./wallet-service";
import { idempotencyService } from "./idempotency";
import { enqueueGameEvent } from "@/lib/queue";
import { db } from "@/drizzle";
import { gameSession, bet, transaction, user } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface DebitParams {
  userId: string;
  sessionId: string;
  amount: bigint;
  gameRoundId: string;
  transactionRef: string;
  gameCode?: string;
  provider?: string;
}

export interface DebitResult {
  success: boolean;
  transactionId: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  failureReason?: string;
  errorCode?: "INSUFFICIENT_FUNDS" | "DUPLICATE_TRANSACTION" | "USER_NOT_FOUND" | "INTERNAL_ERROR";
}

export interface CreditParams {
  userId: string;
  sessionId: string;
  amount: bigint;
  gameRoundId: string;
  transactionRef: string;
  gameCode?: string;
  provider?: string;
}

export interface CreditResult {
  success: boolean;
  transactionId: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  failureReason?: string;
  errorCode?: "DUPLICATE_TRANSACTION" | "USER_NOT_FOUND" | "INTERNAL_ERROR";
}

export interface RollbackParams {
  transactionId: string;
  reason: string;
  rolledBackBy: string;
}

export class AggregatorAdapter {
  private readonly PROVIDER = "clausbet";

  /**
   * Debit (bet) — called by game aggregator when a round starts.
   *
   * Flow:
   * 1. Validate user exists
   * 2. Pre-check balance (fast rejection — the atomic step re-validates under lock)
   * 3. Atomic idempotency check
   * 4. Find or create game session
   * 5. Atomic debit with optimistic locking
   * 6. Create bet record (with gameRound populated for credit() lookup)
   * 7. Track wagering for active bonuses (non-critical, swallowed errors)
   * 8. Track VIP progress (non-critical, swallowed errors)
   * 9. Mark idempotency complete
   */
  async debit(params: DebitParams): Promise<DebitResult> {
    const { userId, sessionId, amount, gameRoundId, transactionRef, gameCode, provider } = params;

    const userRecord = await db
      .select({ balance: user.balance, balanceVersion: user.balanceVersion })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord[0]) {
      return {
        success: false,
        transactionId: "",
        balanceBefore: BigInt(0),
        balanceAfter: BigInt(0),
        failureReason: "User not found",
        errorCode: "USER_NOT_FOUND",
      };
    }

    const balanceBefore = BigInt(userRecord[0].balance.toString());

    if (balanceBefore < amount) {
      return {
        success: false,
        transactionId: "",
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: "Insufficient balance",
        errorCode: "INSUFFICIENT_FUNDS",
      };
    }

    const idempotencyKey = idempotencyService.generateKey(userId, "bet", transactionRef);
    const idempotencyResult = await idempotencyService.checkWithStatus(idempotencyKey);

    if (!idempotencyResult.canProceed) {
      if (idempotencyResult.status === "completed") {
        const existingTx = await db
          .select()
          .from(transaction)
          .where(eq(transaction.idempotencyKey, idempotencyKey))
          .limit(1);

        if (existingTx[0]) {
          return {
            success: true,
            transactionId: existingTx[0].id,
            balanceBefore: BigInt(existingTx[0].balanceBefore.toString()),
            balanceAfter: BigInt(existingTx[0].balanceAfter.toString()),
          };
        }
      }

      return {
        success: false,
        transactionId: "",
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: "Duplicate transaction",
        errorCode: "DUPLICATE_TRANSACTION",
      };
    }

    try {
      // Find or create game session
      const sessionRecord = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.providerSessionId, sessionId))
        .limit(1);

      let gameSessionId: string;

      if (sessionRecord.length === 0) {
        gameSessionId = nanoid();
        await db.insert(gameSession).values({
          id: gameSessionId,
          userId,
          provider: provider ?? this.PROVIDER,
          providerGameId: gameCode ?? "unknown",
          providerSessionId: sessionId,
          status: "active",
          totalBet: amount.toString(),
          totalWin: "0",
          createdAt: new Date(),
        });
      } else {
        gameSessionId = sessionRecord[0].id;
        await db
          .update(gameSession)
          .set({
            totalBet: (BigInt(sessionRecord[0].totalBet.toString()) + amount).toString(),
          })
          .where(eq(gameSession.id, gameSessionId));
      }

      const result = await walletService.updateBalanceAtomic(
        userId,
        -amount,
        "bet",
        {
          gameSessionId,
          gameRoundId,
          aggregatorRef: transactionRef,
          gameCode,
          provider,
        },
      );

      if (!result.success) {
        await idempotencyService.delete(idempotencyKey);
        return {
          success: false,
          transactionId: "",
          balanceBefore: result.balanceBefore ?? balanceBefore,
          balanceAfter: result.balanceAfter ?? balanceBefore,
          failureReason: result.error ?? "Failed to debit balance",
          // Map the wallet-layer error to the correct aggregator error code.
          // "Insufficient balance" can occur here even after the pre-check if a
          // concurrent debit drained the account between the check and the atomic op.
          errorCode: result.error === "Insufficient balance" ? "INSUFFICIENT_FUNDS" : "INTERNAL_ERROR",
        };
      }

      // FIX: populate gameRound — credit() uses eq(bet.gameRound, gameRoundId) for
      // precise per-round bet lookup. Without this, credit() can't match the right bet.
      await db.insert(bet).values({
        id: nanoid(),
        userId,
        transactionId: result.transactionId!,
        gameSessionId,
        gameRound: gameRoundId,
        amount: amount.toString(),
        gameData: {
          gameType: gameCode ?? "unknown",
          provider: provider ?? this.PROVIDER,
        },
        result: "pending",
        winAmount: "0",
      });

      // Non-critical side effects — enqueued so failures retry automatically.
      // Wagering + VIP are tracked on BETS only (not wins).
      await enqueueGameEvent({ kind: "bonus_wagering", userId, betAmountPaisa: amount.toString() });
      await enqueueGameEvent({ kind: "vip_progress",   userId, betAmountPaisa: amount.toString() });

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        transactionId: result.transactionId!,
        balanceBefore: result.balanceBefore ?? balanceBefore,
        balanceAfter: result.balanceAfter ?? balanceBefore - amount,
      };
    } catch (error) {
      console.error("[AGGREGATOR] Debit failed:", error);
      await idempotencyService.delete(idempotencyKey);
      return {
        success: false,
        transactionId: "",
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: "Internal error",
        errorCode: "INTERNAL_ERROR",
      };
    }
  }

  /**
   * Credit (win) — called by game aggregator when a round settles.
   *
   * Some aggregators (Pragmatic, Evolution) send credits for bonus rounds without a
   * prior debit in the same session — session is auto-created in that case.
   *
   * Flow:
   * 1. Validate user exists
   * 2. Atomic idempotency check
   * 3. Find or create game session
   * 4. Atomic credit with optimistic locking
   * 5. Update session totalWin AFTER credit succeeds
   * 6. Update bet record using gameRound for precise matching
   * 7. Mark idempotency complete
   *
   * Note: wagering and VIP are NOT tracked here — both are based on bets placed, not winnings.
   */
  async credit(params: CreditParams): Promise<CreditResult> {
    const { userId, sessionId, amount, gameRoundId, transactionRef, gameCode, provider } = params;

    const userRecord = await db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord[0]) {
      return {
        success: false,
        transactionId: "",
        balanceBefore: BigInt(0),
        balanceAfter: BigInt(0),
        failureReason: "User not found",
        errorCode: "USER_NOT_FOUND",
      };
    }

    const balanceBefore = BigInt(userRecord[0].balance.toString());

    const idempotencyKey = idempotencyService.generateKey(userId, "win", transactionRef);
    const idempotencyResult = await idempotencyService.checkWithStatus(idempotencyKey);

    if (!idempotencyResult.canProceed) {
      if (idempotencyResult.status === "completed") {
        const existingTx = await db
          .select()
          .from(transaction)
          .where(eq(transaction.idempotencyKey, idempotencyKey))
          .limit(1);

        if (existingTx[0]) {
          return {
            success: true,
            transactionId: existingTx[0].id,
            balanceBefore: BigInt(existingTx[0].balanceBefore.toString()),
            balanceAfter: BigInt(existingTx[0].balanceAfter.toString()),
          };
        }
      }

      return {
        success: false,
        transactionId: "",
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: "Duplicate transaction",
        errorCode: "DUPLICATE_TRANSACTION",
      };
    }

    try {
      // Find or create session — some aggregators send credits without prior debits
      const sessionRecord = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.providerSessionId, sessionId))
        .limit(1);

      let gameSessionId: string;
      let existingTotalWin = BigInt(0);

      if (sessionRecord.length === 0) {
        gameSessionId = nanoid();
        await db.insert(gameSession).values({
          id: gameSessionId,
          userId,
          provider: provider ?? this.PROVIDER,
          providerGameId: gameCode ?? "unknown",
          providerSessionId: sessionId,
          status: "active",
          totalBet: "0",
          totalWin: "0", // updated after credit succeeds
          createdAt: new Date(),
        });
      } else {
        gameSessionId = sessionRecord[0].id;
        existingTotalWin = BigInt(sessionRecord[0].totalWin.toString());
      }

      // Atomic credit
      const result = await walletService.updateBalanceAtomic(
        userId,
        amount,
        "win",
        {
          gameSessionId,
          gameRoundId,
          aggregatorRef: transactionRef,
          gameCode,
          provider,
        },
      );

      if (!result.success) {
        await idempotencyService.delete(idempotencyKey);
        return {
          success: false,
          transactionId: "",
          balanceBefore: result.balanceBefore ?? balanceBefore,
          balanceAfter: result.balanceAfter ?? balanceBefore,
          failureReason: result.error ?? "Failed to credit balance",
          errorCode: "INTERNAL_ERROR",
        };
      }

      // FIX: totalWin updated AFTER credit succeeds — previous version updated it
      // during session find/create, before knowing if the credit would succeed.
      // If credit failed, session total would be inflated with no rollback.
      await db
        .update(gameSession)
        .set({ totalWin: (existingTotalWin + amount).toString() })
        .where(eq(gameSession.id, gameSessionId));

      // FIX: use bet.gameRound column (typed, indexed) instead of JSONB raw SQL.
      // bet.gameRound is populated at debit() insert time with gameRoundId.
      const betRecord = await db
        .select()
        .from(bet)
        .where(
          and(
            eq(bet.userId, userId),
            eq(bet.gameSessionId, gameSessionId),
            eq(bet.gameRound, gameRoundId),
          ),
        )
        .limit(1);

      if (betRecord[0]) {
        await db
          .update(bet)
          .set({
            result: "won",
            winAmount: amount.toString(),
            settledAt: new Date(),
          })
          .where(eq(bet.id, betRecord[0].id));
      }

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        transactionId: result.transactionId!,
        balanceBefore: result.balanceBefore ?? balanceBefore,
        balanceAfter: result.balanceAfter ?? balanceBefore + amount,
      };
    } catch (error) {
      console.error("[AGGREGATOR] Credit failed:", error);
      await idempotencyService.delete(idempotencyKey);
      return {
        success: false,
        transactionId: "",
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: "Internal error",
        errorCode: "INTERNAL_ERROR",
      };
    }
  }

  /**
   * Get balance for aggregator.
   * FIX: skipCache=true — aggregators use this to validate bet eligibility;
   * a stale cache could allow a bet on an already-empty balance.
   */
  async getBalance(userId: string): Promise<bigint> {
    return walletService.getBalance(userId, true);
  }

  /**
   * Rollback a transaction — creates an opposing entry to reverse the effect.
   * FIX: reads result.newTransactionId (walletService.reverseTransaction now populates it).
   */
  async rollback(
    params: RollbackParams,
  ): Promise<{ success: boolean; rollbackTransactionId?: string }> {
    const { transactionId, reason, rolledBackBy } = params;

    const result = await walletService.reverseTransaction(transactionId, reason, rolledBackBy);

    return {
      success: result.success,
      // FIX: was result.newTransactionId but reverseTransaction previously returned
      // transactionId; both sides now agree on newTransactionId
      rollbackTransactionId: result.newTransactionId,
    };
  }

  /**
   * End game session — marks it completed.
   */
  async endSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sessionRecord = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.providerSessionId, sessionId))
        .limit(1);

      if (!sessionRecord[0]) {
        return { success: false, error: "Session not found" };
      }

      await db
        .update(gameSession)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(gameSession.id, sessionRecord[0].id));

      return { success: true };
    } catch (error) {
      console.error("[AGGREGATOR] End session failed:", error);
      return { success: false, error: "Internal error" };
    }
  }
}

export const aggregatorAdapter = new AggregatorAdapter();