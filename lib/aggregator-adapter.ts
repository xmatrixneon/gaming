/**
 * Game Aggregator Wallet Adapter
 *
 * Implements standard aggregator wallet API pattern:
 * - debit(): Deduct balance for bet placement
 * - credit(): Add winnings to balance
 * - getBalance(): Query current balance
 * - rollback(): Reverse failed transactions
 *
 * Integrates with game aggregators (Pragmatic, Evolution, etc.)
 * for real-time balance synchronization during gameplay.
 */

import { nanoid } from "nanoid";
import { walletService } from "./wallet-service";
import { idempotencyService } from "./idempotency";
import { db } from "@/drizzle";
import { gameSession, bet, transaction, user } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface DebitParams {
  userId: string;
  sessionId: string;
  amount: bigint;
  gameRoundId: string;
  transactionRef: string; // Idempotency key from aggregator
  gameCode?: string;
  provider?: string;
}

export interface DebitResult {
  success: boolean;
  transactionId: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  failureReason?: string;
  errorCode?: 'INSUFFICIENT_FUNDS' | 'DUPLICATE_TRANSACTION' | 'USER_NOT_FOUND' | 'INTERNAL_ERROR';
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
  errorCode?: 'DUPLICATE_TRANSACTION' | 'USER_NOT_FOUND' | 'INTERNAL_ERROR';
}

export interface RollbackParams {
  transactionId: string;
  reason: string;
  rolledBackBy: string;
}

export class AggregatorAdapter {
  private readonly PROVIDER = 'clausbet';

  /**
   * Debit (bet) - called by game aggregator
   * Follows standard aggregator wallet API pattern
   *
   * Flow:
   * 1. Check idempotency (prevent duplicate bets)
   * 2. Validate user exists and has sufficient balance
   * 3. Find or create game session
   * 4. Execute atomic debit with optimistic locking
   * 5. Create bet record
   * 6. Return transaction details with balance snapshot
   */
  async debit(params: DebitParams): Promise<DebitResult> {
    const { userId, sessionId, amount, gameRoundId, transactionRef, gameCode, provider } = params;

    // Validate user exists
    const userRecord = await db
      .select({ balance: user.balance, balanceVersion: user.balanceVersion })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord[0]) {
      return {
        success: false,
        transactionId: '',
        balanceBefore: 0n,
        balanceAfter: 0n,
        failureReason: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      };
    }

    const balanceBefore = BigInt(userRecord[0].balance.toString());

    // Check sufficient balance
    if (balanceBefore < amount) {
      return {
        success: false,
        transactionId: '',
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: 'Insufficient balance',
        errorCode: 'INSUFFICIENT_FUNDS',
      };
    }

    // Idempotency check
    const idempotencyKey = idempotencyService.generateKey(
      userId,
      'bet',
      transactionRef
    );

    if (!(await idempotencyService.check(idempotencyKey))) {
      // Check if this was already processed
      const status = await idempotencyService.getStatus(idempotencyKey);
      if (status === 'completed') {
        // Return existing transaction (idempotent response)
        const existingTransaction = await db
          .select()
          .from(transaction)
          .where(eq(transaction.idempotencyKey, idempotencyKey))
          .limit(1);

        if (existingTransaction[0]) {
          return {
            success: true,
            transactionId: existingTransaction[0].id,
            balanceBefore: BigInt(existingTransaction[0].balanceBefore.toString()),
            balanceAfter: BigInt(existingTransaction[0].balanceAfter.toString()),
          };
        }
      }

      return {
        success: false,
        transactionId: '',
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: 'Duplicate transaction',
        errorCode: 'DUPLICATE_TRANSACTION',
      };
    }

    try {
      // Find or create game session
      let sessionRecord = await db
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
          provider: provider || this.PROVIDER,
          providerGameId: gameCode || 'unknown',
          providerSessionId: sessionId,
          status: 'active',
          totalBet: amount.toString(),
          totalWin: '0',
          createdAt: new Date(),
        });
      } else {
        gameSessionId = sessionRecord[0].id;
        // Update session total bet
        await db
          .update(gameSession)
          .set({
            totalBet: (
              BigInt(sessionRecord[0].totalBet.toString()) + amount
            ).toString(),
          })
          .where(eq(gameSession.id, gameSessionId));
      }

      // Atomic debit using wallet service
      const result = await walletService.updateBalanceAtomic(
        userId,
        -amount,
        'bet',
        {
          gameSessionId,
          gameRoundId,
          aggregatorRef: transactionRef,
          gameCode,
          provider,
        }
      );

      if (!result.success) {
        await idempotencyService.delete(idempotencyKey);
        return {
          success: false,
          transactionId: '',
          balanceBefore,
          balanceAfter: balanceBefore,
          failureReason: result.error || 'Failed to debit balance',
          errorCode: 'INTERNAL_ERROR',
        };
      }

      // Create bet record
      const betId = nanoid();
      await db.insert(bet).values({
        id: betId,
        userId,
        transactionId: result.transactionId,
        gameSessionId,
        amount: amount.toString(),
        gameData: {
          gameType: gameCode || 'unknown',
          gameRoundId,
          provider: provider || this.PROVIDER,
        },
        result: 'pending',
        winAmount: '0',
        createdAt: new Date(),
      });

      // Calculate new balance
      const balanceAfter = balanceBefore - amount;

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        transactionId: result.transactionId,
        balanceBefore,
        balanceAfter,
      };
    } catch (error) {
      console.error('[AGGREGATOR] Debit failed:', error);
      await idempotencyService.delete(idempotencyKey);
      return {
        success: false,
        transactionId: '',
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: 'Internal error',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Credit (win) - called by game aggregator
   * Adds winnings to user balance
   *
   * Flow:
   * 1. Check idempotency (prevent duplicate credits)
   * 2. Execute atomic credit
   * 3. Update bet record if found
   * 4. Update session total win
   * 5. Return transaction details with balance snapshot
   */
  async credit(params: CreditParams): Promise<CreditResult> {
    const { userId, sessionId, amount, gameRoundId, transactionRef, gameCode, provider } = params;

    // Validate user exists
    const userRecord = await db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRecord[0]) {
      return {
        success: false,
        transactionId: '',
        balanceBefore: 0n,
        balanceAfter: 0n,
        failureReason: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      };
    }

    const balanceBefore = BigInt(userRecord[0].balance.toString());

    // Idempotency check
    const idempotencyKey = idempotencyService.generateKey(
      userId,
      'win',
      transactionRef
    );

    if (!(await idempotencyService.check(idempotencyKey))) {
      // Check if this was already processed
      const status = await idempotencyService.getStatus(idempotencyKey);
      if (status === 'completed') {
        // Return existing transaction (idempotent response)
        const existingTransaction = await db
          .select()
          .from(transaction)
          .where(eq(transaction.idempotencyKey, idempotencyKey))
          .limit(1);

        if (existingTransaction[0]) {
          return {
            success: true,
            transactionId: existingTransaction[0].id,
            balanceBefore: BigInt(existingTransaction[0].balanceBefore.toString()),
            balanceAfter: BigInt(existingTransaction[0].balanceAfter.toString()),
          };
        }
      }

      return {
        success: false,
        transactionId: '',
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: 'Duplicate transaction',
        errorCode: 'DUPLICATE_TRANSACTION',
      };
    }

    try {
      // Find game session
      const sessionRecord = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.providerSessionId, sessionId))
        .limit(1);

      if (!sessionRecord[0]) {
        await idempotencyService.delete(idempotencyKey);
        return {
          success: false,
          transactionId: '',
          balanceBefore,
          balanceAfter: balanceBefore,
          failureReason: 'Session not found',
          errorCode: 'INTERNAL_ERROR',
        };
      }

      const gameSessionId = sessionRecord[0].id;

      // Atomic credit using wallet service
      const result = await walletService.updateBalanceAtomic(
        userId,
        amount,
        'win',
        {
          gameSessionId,
          gameRoundId,
          aggregatorRef: transactionRef,
          gameCode,
          provider,
        }
      );

      if (!result.success) {
        await idempotencyService.delete(idempotencyKey);
        return {
          success: false,
          transactionId: '',
          balanceBefore,
          balanceAfter: balanceBefore,
          failureReason: result.error || 'Failed to credit balance',
          errorCode: 'INTERNAL_ERROR',
        };
      }

      // Update session total win
      await db
        .update(gameSession)
        .set({
          totalWin: (
            BigInt(sessionRecord[0].totalWin.toString()) + amount
          ).toString(),
        })
        .where(eq(gameSession.id, gameSessionId));

      // Try to find and update bet record
      const betRecord = await db
        .select()
        .from(bet)
        .where(
          and(
            eq(bet.userId, userId),
            eq(bet.gameSessionId, gameSessionId)
          )
        )
        .limit(1);

      if (betRecord[0]) {
        await db
          .update(bet)
          .set({
            result: 'won',
            winAmount: amount.toString(),
            settledAt: new Date(),
          })
          .where(eq(bet.id, betRecord[0].id));
      }

      const balanceAfter = balanceBefore + amount;

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        transactionId: result.transactionId,
        balanceBefore,
        balanceAfter,
      };
    } catch (error) {
      console.error('[AGGREGATOR] Credit failed:', error);
      await idempotencyService.delete(idempotencyKey);
      return {
        success: false,
        transactionId: '',
        balanceBefore,
        balanceAfter: balanceBefore,
        failureReason: 'Internal error',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get balance for aggregator
   * Returns current balance snapshot
   */
  async getBalance(userId: string): Promise<bigint> {
    return await walletService.getBalance(userId);
  }

  /**
   * Rollback a failed transaction
   * Creates opposing transaction to reverse the effect
   */
  async rollback(params: RollbackParams): Promise<{ success: boolean; rollbackTransactionId?: string }> {
    const { transactionId, reason, rolledBackBy } = params;

    const result = await walletService.reverseTransaction(
      transactionId,
      reason,
      rolledBackBy
    );

    return {
      success: result.success,
      rollbackTransactionId: result.newTransactionId,
    };
  }

  /**
   * End game session
   * Marks session as completed and updates final totals
   */
  async endSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sessionRecord = await db
        .select()
        .from(gameSession)
        .where(eq(gameSession.providerSessionId, sessionId))
        .limit(1);

      if (!sessionRecord[0]) {
        return { success: false, error: 'Session not found' };
      }

      await db
        .update(gameSession)
        .set({
          status: 'completed',
          endedAt: new Date(),
        })
        .where(eq(gameSession.id, sessionRecord[0].id));

      return { success: true };
    } catch (error) {
      console.error('[AGGREGATOR] End session failed:', error);
      return { success: false, error: 'Internal error' };
    }
  }
}

// Export singleton instance
export const aggregatorAdapter = new AggregatorAdapter();
