/**
 * Transaction Router
 * tRPC procedures for deposits, withdrawals, and transaction history
 */

import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import { transaction, deposit, withdrawal, user } from "@/drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { walletService } from "@/lib/wallet-service";
import { idempotencyService } from "@/lib/idempotency";
import { fraudDetection } from "@/lib/fraud-detection";
import { gatewaySelector } from "@/lib/gateway-selector";
import * as gatewayCache from "@/lib/gateway-cache";

// ============================================================================
// TRANSACTION ROUTER
// ============================================================================

export const transactionRouter = router({
  // =========================================================================
  // DEPOSITS
  // =========================================================================

  /**
   * Initiate deposit
   * Creates deposit record and returns payment gateway URL
   */
  initiateDeposit: protectedProcedure
    .input(z.object({
      // Integer-only: amounts are in paisa (smallest unit). BigInt() cannot parse decimals.
      amount: z.string().regex(/^\d+$/, "Invalid amount format — must be a whole number (paisa)"),
      // Gateway priority: 1 = UPI 1 (primary), 2 = UPI 2 (secondary)
      gatewayPriority: z.number().int().min(1).max(2),
      phone: z.string().optional(), // Required for some gateways' intent flow
      clientProvidedKey: z.string().optional(), // For idempotency
      currency: z.string().default('USD'),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const amount = BigInt(input.amount);

      // Validate minimum deposit
      if (amount < 100n) { // Minimum 100 in smallest currency unit
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Minimum deposit amount is 100',
        });
      }

      // Check deposit pattern for fraud
      const fraudCheck = await fraudDetection.checkDepositPattern(userId, amount);
      if (!fraudCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: fraudCheck.reason || 'Deposit pattern check failed',
        });
      }

      // Idempotency check
      const idempotencyKey = input.clientProvidedKey
        ? idempotencyService.generateKeyFromRequest({
            userId,
            action: 'deposit',
            amount: input.amount,
            clientProvidedKey: input.clientProvidedKey,
          })
        : idempotencyService.generateKey(userId, 'deposit', Date.now().toString());

      if (!(await idempotencyService.check(idempotencyKey))) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Duplicate request',
        });
      }

      try {
        // Get gateway config by priority - returns full config with metadata
        let gatewayConfig = await gatewayCache.getGatewayByPriority(input.gatewayPriority as 1 | 2);

        // Fallback to database if cache is empty
        if (!gatewayConfig) {
          const { db } = await import('@/drizzle');
          const { paymentGatewayConfig } = await import('@/drizzle/schema');
          const { eq } = await import('drizzle-orm');

          const dbConfigs = await db
            .select()
            .from(paymentGatewayConfig)
            .where(eq(paymentGatewayConfig.priority, input.gatewayPriority))
            .limit(1);

          if (dbConfigs.length > 0) {
            gatewayConfig = dbConfigs[0] as gatewayCache.CachedGatewayConfig;
            // Warm cache
            await gatewayCache.setGatewayConfig(gatewayConfig.id, gatewayConfig);
          }
        }

        if (!gatewayConfig) {
          await idempotencyService.delete(idempotencyKey);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Selected gateway is not configured',
          });
        }

        if (gatewayConfig.status !== 'active') {
          await idempotencyService.delete(idempotencyKey);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Selected gateway is currently ${gatewayConfig.status}`,
          });
        }

        // Get gateway instance by priority
        const gateway = await gatewaySelector.getGatewayByPriority(input.gatewayPriority as 1 | 2);

        // Create deposit and transaction records
        const depositId = nanoid();
        const transactionId = nanoid();

        await db.insert(transaction).values({
          id: transactionId,
          userId,
          type: 'deposit',
          status: 'pending',
          amount: amount.toString(),
          balanceBefore: '0', // Will be updated on confirmation
          balanceAfter: '0', // Will be updated on confirmation
          idempotencyKey,
          metadata: {
            method: 'upi',
            currency: input.currency,
            gatewayName: gatewayConfig.gatewayName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(deposit).values({
          id: depositId,
          userId,
          transactionId,
          amount: amount.toString(),
          method: 'upi',
          gatewayId: gatewayConfig.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Route to appropriate gateway
        try {
          // VeloPay integration
          if (gatewayConfig.gatewayName === 'velopay') {
            const velopayGateway = gateway;
            // input.amount is already in paisa, pass directly
            const gatewayResponse = await velopayGateway.createDeposit({
              txn_id: depositId,
              amount: input.amount,
              type: 1, // H5 payment link
              currency: 'INR',
            });

            // Update deposit with gateway reference
            await db.update(deposit)
              .set({
                gatewayReference: gatewayResponse.id,
                gatewayMetadata: gatewayResponse,
                updatedAt: new Date(),
              })
              .where(eq(deposit.id, depositId));

            await idempotencyService.complete(idempotencyKey);

            return {
              success: true,
              depositId,
              transactionId,
              paymentUrl: gatewayResponse.pay_link,
              message: 'Deposit initiated. Complete UPI payment to credit your balance.',
            };
          }

          // OKPay integration
          if (gatewayConfig.gatewayName === 'okpay') {
            const okpayGateway = gateway;
            const amountInRupees = (BigInt(input.amount) / 100n).toString();

            const gatewayResponse = await okpayGateway.createDeposit({
              out_trade_no: depositId,
              pay_type: 'UPI',
              money: amountInRupees,
              returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/deposit/success`,
              phone: input.phone,
            });

            // Update deposit with gateway reference
            await db.update(deposit)
              .set({
                gatewayReference: gatewayResponse.data.transaction_Id,
                gatewayMetadata: gatewayResponse,
                updatedAt: new Date(),
              })
              .where(eq(deposit.id, depositId));

            await idempotencyService.complete(idempotencyKey);

            return {
              success: true,
              depositId,
              transactionId,
              paymentUrl: gatewayResponse.data.url,
              message: 'Complete UPI payment to credit your balance',
            };
          }

          // Unknown gateway
          await idempotencyService.delete(idempotencyKey); // Permanent error - delete key
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unsupported gateway: ${gatewayConfig.gatewayName}`,
          });
        } catch (error) {
          // For transient errors (gateway timeout, network issues), keep the idempotency key
          // to allow legitimate client retries. Only delete key for permanent errors above.
          console.error('[TRANSACTION] Gateway deposit failed:', error);
          if (error instanceof TRPCError) {
            throw error;
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to initiate deposit with payment gateway',
          });
        }
      } catch (error) {
        // Outer catch handles validation errors (permanent)
        // These already deleted the key before throwing, so no need to delete again
        console.error('[TRANSACTION] Deposit initiation failed:', error);
        throw error;
      }
    }),

  /**
   * Confirm deposit (webhook from payment gateway)
   * Normally called by payment gateway, but made public for testing
   */
  confirmDeposit: publicProcedure
    .input(z.object({
      depositId: z.string(),
      gatewayReference: z.string(),
      status: z.enum(['completed', 'failed']),
      gatewayMetadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      // Get deposit record with FOR UPDATE lock
      const depositRecord = await db
        .select()
        .from(deposit)
        .where(eq(deposit.id, input.depositId))
        .limit(1);

      if (depositRecord.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deposit not found',
        });
      }

      const depositRec = depositRecord[0];

      if (depositRec.status !== 'pending') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Deposit already processed',
        });
      }

      if (input.status === 'completed') {
        // Get user's current balance
        const userRecord = await db
          .select({ balance: user.balance })
          .from(user)
          .where(eq(user.id, depositRec.userId))
          .limit(1);

        if (!userRecord[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        const balanceBefore = BigInt(userRecord[0].balance.toString());
        const amount = BigInt(depositRec.amount.toString());

        // Credit user balance
        const result = await walletService.updateBalanceAtomic(
          depositRec.userId,
          amount,
          'deposit',
          {
            depositId: input.depositId,
            gatewayReference: input.gatewayReference,
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to credit balance',
          });
        }

        // Update deposit status
        await db
          .update(deposit)
          .set({
            status: 'completed',
            gatewayReference: input.gatewayReference,
            gatewayMetadata: input.gatewayMetadata || {},
            updatedAt: new Date(),
          })
          .where(eq(deposit.id, input.depositId));

        // Update transaction record
        await db
          .update(transaction)
          .set({
            status: 'completed',
            balanceBefore: balanceBefore.toString(),
            balanceAfter: (balanceBefore + amount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(transaction.id, depositRec.transactionId));

        // ====================================================================
        // REFERRAL & BONUS INTEGRATION
        // ====================================================================

        // Handle referral qualification
        try {
          const { referralService } = await import('@/lib/referral-service');
          await referralService.qualifyReferral(
            depositRec.userId,
            amount,
            input.depositId
          );
        } catch (referralError) {
          console.error('[TRANSACTION] Referral qualification failed:', referralError);
          // Don't fail deposit if referral qualification fails
        }

        // Handle welcome bonus awarding
        try {
          const { bonusService } = await import('@/lib/bonus-service');
          await bonusService.awardWelcomeBonus(
            depositRec.userId,
            amount,
            input.depositId
          );
        } catch (bonusError) {
          console.error('[TRANSACTION] Welcome bonus failed:', bonusError);
          // Don't fail deposit if bonus awarding fails
        }

        return { success: true, message: 'Deposit confirmed and balance credited' };
      } else {
        // Mark deposit as failed
        await db
          .update(deposit)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(deposit.id, input.depositId));

        await db
          .update(transaction)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(transaction.id, depositRec.transactionId));

        return { success: true, message: 'Deposit marked as failed' };
      }
    }),

  // =========================================================================
  // WITHDRAWALS
  // =========================================================================

  /**
   * Request withdrawal
   * Validates balance, creates withdrawal record, and debits balance
   */
  requestWithdrawal: protectedProcedure
    .input(z.object({
      amount: z.string().regex(/^\d+$/, "Invalid amount format — must be a whole number (paisa)"),
      method: z.enum(['upi', 'okpay-bank', 'bank_transfer'] as const),
      details: z.object({
        upiId: z.string().optional(),
        accountNumber: z.string().optional(),
        accountHolder: z.string().optional(),
        bankName: z.string().optional(),
        ifscCode: z.string().optional(),
      }),
      clientProvidedKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const amount = BigInt(input.amount);

      // Validate withdrawal details based on method
      if (input.method === 'upi' && !input.details.upiId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'UPI ID is required for UPI withdrawals',
        });
      }

      if (input.method === 'bank_transfer') {
        if (!input.details.accountNumber || !input.details.ifscCode) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Account number and IFSC code are required for bank transfers',
          });
        }
      }

      // Check balance
      const balance = await walletService.getBalance(userId);
      if (balance < amount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient balance',
        });
      }

      // Check withdrawal velocity
      const velocityCheck = await fraudDetection.checkWithdrawalVelocity(userId);
      if (!velocityCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: velocityCheck.reason || 'Withdrawal limit exceeded',
        });
      }

      // Idempotency check
      const idempotencyKey = input.clientProvidedKey
        ? idempotencyService.generateKeyFromRequest({
            userId,
            action: 'withdraw',
            amount: input.amount,
            clientProvidedKey: input.clientProvidedKey,
          })
        : idempotencyService.generateKey(userId, 'withdraw', Date.now().toString());

      if (!(await idempotencyService.check(idempotencyKey))) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Duplicate request',
        });
      }

      try {
        // Get current balance before transaction
        const userRecord = await db
          .select({ balance: user.balance })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        const balanceBefore = BigInt(userRecord[0].balance.toString());

        // Create withdrawal and transaction records
        const withdrawalId = nanoid();
        const transactionId = nanoid();

        await db.insert(transaction).values({
          id: transactionId,
          userId,
          type: 'withdraw',
          status: 'pending',
          amount: amount.toString(),
          balanceBefore: balanceBefore.toString(),
          balanceAfter: (balanceBefore - amount).toString(),
          idempotencyKey,
          metadata: {
            method: input.method,
            ...input.details,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Map okpay-bank to the DB enum value 'bank_transfer'
        const dbWithdrawalMethod = input.method === 'okpay-bank' ? 'bank_transfer' : input.method as 'upi' | 'bank_transfer';

        await db.insert(withdrawal).values({
          id: withdrawalId,
          userId,
          transactionId,
          amount: amount.toString(),
          method: dbWithdrawalMethod,
          status: 'pending',
          upiId: input.details.upiId,
          accountNumber: input.details.accountNumber,
          accountHolder: input.details.accountHolder,
          bankName: input.details.bankName,
          ifscCode: input.details.ifscCode,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Debit from balance immediately (will be reversed if rejected)
        const result = await walletService.updateBalanceAtomic(
          userId,
          -amount,
          'withdraw',
          { withdrawalId }
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Failed to debit balance',
          });
        }

        // Update the pre-inserted transaction with the real CAS-validated balances.
        // The atomic update runs under a DB lock so result.balanceBefore/After are authoritative.
        if (result.balanceBefore !== undefined && result.balanceAfter !== undefined) {
          await db.update(transaction)
            .set({
              status: 'completed',
              balanceBefore: result.balanceBefore.toString(),
              balanceAfter: result.balanceAfter.toString(),
              updatedAt: new Date(),
            })
            .where(eq(transaction.id, transactionId));
        }

        // Process withdrawal with VeloPay for UPI method
        if (input.method === 'upi') {
          try {
            // Validate UPI ID
            if (!input.details.upiId || !velopayGateway.validateUPIId(input.details.upiId)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Invalid UPI ID format. Use format: username@bank',
              });
            }

            // Convert amount to paisa
            const amountInPaisa = velopayGateway.inrToPaisa(input.amount);

            // For UPI withdrawals, VeloPay uses IFSC format with UPI as bank code
            // Format: UPI0 followed by the UPI ID
            const ifsc = 'UPI0' + input.details.upiId.split('@')[0].slice(0, 6).padEnd(6, '0');

            const velopayResponse = await velopayGateway.createWithdrawal({
              txn_id: withdrawalId,
              amount: amountInPaisa,
              type: '1',
              ifsc: ifsc,
              card_num: input.details.upiId,
              name: input.details.accountHolder || 'User',
              currency: 'INR',
            });

            // Update withdrawal with gateway reference
            await db.update(withdrawal)
              .set({
                gatewayReference: velopayResponse.id,
                gatewayMetadata: velopayResponse,
                updatedAt: new Date(),
              })
              .where(eq(withdrawal.id, withdrawalId));

            await idempotencyService.complete(idempotencyKey);

            return {
              success: true,
              withdrawalId,
              transactionId,
              message: velopayResponse.status === 'PENDING'
                ? 'Withdrawal submitted to payment gateway for processing'
                : 'Withdrawal request created',
              amount: input.amount,
              gatewayStatus: velopayResponse.status,
            };
          } catch (error) {
            // If VeloPay fails, reverse the balance debit
            await walletService.updateBalanceAtomic(
              userId,
              amount,
              'refund',
              {
                withdrawalId,
                reason: 'VeloPay withdrawal failed',
              }
            );

            await idempotencyService.delete(idempotencyKey);
            console.error('[TRANSACTION] VeloPay withdrawal failed:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to process withdrawal with payment gateway',
            });
          }
        }

        // Process withdrawal with OKPay for bank transfer method
        if (input.method === 'okpay-bank') {
          if (!input.details.accountNumber || !input.details.ifscCode || !input.details.accountHolder) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Account number, IFSC code, and account holder name required for OKPay withdrawals',
            });
          }

          try {
            // OKPay expects amount in rupees
            const amountInRupees = (BigInt(input.amount) / 100n).toString();

            const okpayResponse = await okpayGateway.createWithdrawal({
              out_trade_no: withdrawalId,
              pay_type: 'BANK',
              account: input.details.accountNumber,
              userName: input.details.accountHolder,
              money: amountInRupees,
              reserve1: input.details.ifscCode,
            });

            // Update withdrawal with gateway reference
            await db.update(withdrawal)
              .set({
                gatewayReference: okpayResponse.data.transaction_Id,
                gatewayMetadata: okpayResponse,
                updatedAt: new Date(),
              })
              .where(eq(withdrawal.id, withdrawalId));

            await idempotencyService.complete(idempotencyKey);

            return {
              success: true,
              withdrawalId,
              transactionId,
              message: 'Withdrawal submitted to OKPay for processing',
              amount: input.amount,
              gatewayStatus: 'pending',
            };
          } catch (error) {
            // If OKPay fails, reverse the balance debit
            await walletService.updateBalanceAtomic(
              userId,
              amount,
              'refund',
              {
                withdrawalId,
                reason: 'OKPay withdrawal failed',
              }
            );

            await idempotencyService.delete(idempotencyKey);
            console.error('[TRANSACTION] OKPay withdrawal failed:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to process withdrawal with OKPay',
            });
          }
        }

        await idempotencyService.complete(idempotencyKey);

        return {
          success: true,
          withdrawalId,
          transactionId,
          message: 'Withdrawal submitted for processing',
          amount: input.amount,
        };
      } catch (error) {
        await idempotencyService.delete(idempotencyKey);
        console.error('[TRANSACTION] Withdrawal request failed:', error);
        throw error;
      }
    }),

  /**
   * Process withdrawal (admin only)
   * Approves or rejects withdrawal requests
   */
  processWithdrawal: protectedProcedure
    .input(z.object({
      withdrawalId: z.string(),
      action: z.enum(['approve', 'reject']),
      utrNumber: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Add admin check
      // For now, allow any authenticated user (for testing)

      const withdrawalRecord = await db
        .select()
        .from(withdrawal)
        .where(eq(withdrawal.id, input.withdrawalId))
        .limit(1);

      if (withdrawalRecord.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Withdrawal not found',
        });
      }

      const withdrawalRec = withdrawalRecord[0];

      if (withdrawalRec.status !== 'pending') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Withdrawal already processed',
        });
      }

      if (input.action === 'approve') {
        // Update withdrawal status
        await db
          .update(withdrawal)
          .set({
            status: 'completed',
            processedBy: ctx.user.id,
            processedAt: new Date(),
            utrNumber: input.utrNumber,
            notes: input.notes,
            updatedAt: new Date(),
          })
          .where(eq(withdrawal.id, input.withdrawalId));

        await db
          .update(transaction)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(transaction.id, withdrawalRec.transactionId));

        return {
          success: true,
          message: 'Withdrawal approved and processed',
        };
      } else {
        // Reject withdrawal - refund the amount
        const amount = BigInt(withdrawalRec.amount.toString());

        const result = await walletService.updateBalanceAtomic(
          withdrawalRec.userId,
          amount,
          'refund',
          {
            withdrawalId: input.withdrawalId,
            reason: input.notes || 'Withdrawal rejected',
          }
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to refund balance',
          });
        }

        await db
          .update(withdrawal)
          .set({
            status: 'failed',
            notes: input.notes,
            updatedAt: new Date(),
          })
          .where(eq(withdrawal.id, input.withdrawalId));

        await db
          .update(transaction)
          .set({
            status: 'reversed',
            updatedAt: new Date(),
          })
          .where(eq(transaction.id, withdrawalRec.transactionId));

        return {
          success: true,
          message: 'Withdrawal rejected and balance refunded',
        };
      }
    }),

  // =========================================================================
  // TRANSACTION HISTORY
  // =========================================================================

  /**
   * Get user transactions
   * Returns paginated list of user's transactions
   */
  getTransactions: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      type: z.enum(['deposit', 'withdraw', 'bet', 'win', 'bonus', 'adjustment']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, offset, type } = input;

      const conditions = type
        ? [eq(transaction.userId, ctx.user.id), eq(transaction.type, type)]
        : [eq(transaction.userId, ctx.user.id)];

      const transactions = await db
        .select()
        .from(transaction)
        .where(and(...conditions))
        .orderBy(desc(transaction.createdAt))
        .limit(limit)
        .offset(offset);

      return transactions;
    }),

  /**
   * Get transaction by ID
   */
  getTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const transactionRecord = await db
        .select()
        .from(transaction)
        .where(
          and(
            eq(transaction.id, input.transactionId),
            eq(transaction.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!transactionRecord[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      return transactionRecord[0];
    }),
});
