/**
 * VeloPay Webhook Handler
 *
 * Handles callbacks from VeloPay payment gateway:
 * - Deposit confirmations
 * - Withdrawal status updates
 *
 * Security:
 * - Verifies MD5 signature for all callbacks
 * - Only accepts requests from whitelisted IP (13.201.70.222)
 * - Returns "SUCCESS" after processing
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { deposit, withdrawal, transaction, user } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { walletService } from "@/lib/wallet-service";
import { velopayGateway, VelopayCallbackPayload } from "@/lib/velopay-gateway";

// Whitelist VeloPay callback IP
const VELOPAY_CALLBACK_IP = "13.201.70.222";

/**
 * Verify request comes from VeloPay
 * In production, you should configure your reverse proxy (nginx/CDN)
 * to only allow requests from this IP
 */
function verifyRequestIP(request: NextRequest): boolean {
  // Note: In serverless environments, getting the real client IP
  // requires checking X-Forwarded-For or other headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  const clientIP =
    realIP || forwarded?.split(",")[0]?.trim() || "unknown";

  // For development, allow all IPs
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return clientIP === VELOPAY_CALLBACK_IP;
}

/**
 * POST /api/webhook/velopay
 * Main webhook handler that routes to deposit or withdrawal handlers
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request IP
    if (!verifyRequestIP(request)) {
      console.warn("[VELOPAY] Unauthorized IP address");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: VelopayCallbackPayload = await request.json();

    // Verify signature
    if (!velopayGateway.verifyCallbackSignature(body)) {
      console.error("[VELOPAY] Invalid signature", body);
      return new NextResponse("Invalid signature", { status: 403 });
    }

    // Route based on transaction type
    // We determine this by checking if it's a deposit or withdrawal
    const txn_id = body.txn_id;

    // Check if this is a deposit
    const depositRecord = await db
      .select()
      .from(deposit)
      .where(eq(deposit.id, txn_id))
      .limit(1);

    if (depositRecord.length > 0) {
      return await handleDepositCallback(body, depositRecord[0]);
    }

    // Check if this is a withdrawal
    const withdrawalRecord = await db
      .select()
      .from(withdrawal)
      .where(eq(withdrawal.id, txn_id))
      .limit(1);

    if (withdrawalRecord.length > 0) {
      return await handleWithdrawalCallback(body, withdrawalRecord[0]);
    }

    // Transaction not found
    console.error("[VELOPAY] Transaction not found", txn_id);
    return new NextResponse("Transaction not found", { status: 404 });
  } catch (error) {
    console.error("[VELOPAY] Webhook processing error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

/**
 * Handle deposit callback
 */
async function handleDepositCallback(
  body: VelopayCallbackPayload,
  depositRecord: any
): Promise<NextResponse> {
  const { status, amount, utr, id: gatewayId } = body;

  // Check if already processed
  if (depositRecord.status !== "pending") {
    console.log("[VELOPAY] Deposit already processed", depositRecord.id);
    return new NextResponse("SUCCESS");
  }

  if (status === "SUCCESS") {
    // Convert amount from paisa to INR if needed
    const amountINR = velopayGateway.paisaToINR(amount);

    // Get user's current balance
    const userRecord = await db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, depositRecord.userId))
      .limit(1);

    if (!userRecord[0]) {
      console.error("[VELOPAY] User not found", depositRecord.userId);
      return new NextResponse("User not found", { status: 404 });
    }

    const balanceBefore = BigInt(userRecord[0].balance.toString());
    const depositAmount = BigInt(Math.round(amountINR * 100)); // Convert to smallest unit

    try {
      // Credit user balance
      const result = await walletService.updateBalanceAtomic(
        depositRecord.userId,
        depositAmount,
        "deposit",
        {
          depositId: depositRecord.id,
          gatewayReference: gatewayId,
          utr,
        }
      );

      if (!result.success) {
        console.error("[VELOPAY] Failed to credit balance", result.error);
        return new NextResponse("Failed to credit balance", { status: 500 });
      }

      // Update deposit status
      await db
        .update(deposit)
        .set({
          status: "completed",
          gatewayReference: gatewayId,
          gatewayMetadata: {
            utr,
            amount: amountINR.toString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositRecord.id));

      // Update transaction status
      await db
        .update(transaction)
        .set({
          status: "completed",
          balanceBefore: balanceBefore.toString(),
          balanceAfter: (balanceBefore + depositAmount).toString(),
          metadata: {
            utr,
            gatewayReference: gatewayId,
          },
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, depositRecord.transactionId));

      console.log("[VELOPAY] Deposit processed successfully", {
        depositId: depositRecord.id,
        amount: amountINR,
        utr,
      });

      return new NextResponse("SUCCESS");
    } catch (error) {
      console.error("[VELOPAY] Error processing deposit", error);
      return new NextResponse("Internal server error", { status: 500 });
    }
  } else {
    // Deposit failed
    await db
      .update(deposit)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(deposit.id, depositRecord.id));

    await db
      .update(transaction)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, depositRecord.transactionId));

    console.log("[VELOPAY] Deposit failed", {
      depositId: depositRecord.id,
      message: body.message,
    });

    return new NextResponse("SUCCESS");
  }
}

/**
 * Handle withdrawal callback
 */
async function handleWithdrawalCallback(
  body: VelopayCallbackPayload,
  withdrawalRecord: any
): Promise<NextResponse> {
  const { status, amount, utr, id: gatewayId } = body;

  // Check if already processed
  if (withdrawalRecord.status !== "pending") {
    console.log("[VELOPAY] Withdrawal already processed", withdrawalRecord.id);
    return new NextResponse("SUCCESS");
  }

  if (status === "SUCCESS") {
    // Withdrawal successful
    await db
      .update(withdrawal)
      .set({
        status: "completed",
        processedAt: new Date(),
        utrNumber: utr,
        gatewayMetadata: {
          gatewayReference: gatewayId,
          utr,
        },
        updatedAt: new Date(),
      })
      .where(eq(withdrawal.id, withdrawalRecord.id));

    await db
      .update(transaction)
      .set({
        status: "completed",
        metadata: {
          utr,
          gatewayReference: gatewayId,
        },
        updatedAt: new Date(),
      })
      .where(eq(transaction.id, withdrawalRecord.transactionId));

    console.log("[VELOPAY] Withdrawal processed successfully", {
      withdrawalId: withdrawalRecord.id,
      utr,
    });

    return new NextResponse("SUCCESS");
  } else {
    // Withdrawal failed - refund the amount
    const amountINR = velopayGateway.paisaToINR(amount);
    const refundAmount = BigInt(Math.round(amountINR * 100));

    try {
      const result = await walletService.updateBalanceAtomic(
        withdrawalRecord.userId,
        refundAmount,
        "refund",
        {
          withdrawalId: withdrawalRecord.id,
          reason: `Withdrawal failed: ${body.message}`,
          utr,
        }
      );

      if (!result.success) {
        console.error("[VELOPAY] Failed to refund balance", result.error);
      }

      await db
        .update(withdrawal)
        .set({
          status: "failed",
          notes: `Failed: ${body.message}`,
          updatedAt: new Date(),
        })
        .where(eq(withdrawal.id, withdrawalRecord.id));

      await db
        .update(transaction)
        .set({
          status: "reversed",
          metadata: {
            reason: `Withdrawal failed: ${body.message}`,
            utr,
          },
          updatedAt: new Date(),
        })
        .where(eq(transaction.id, withdrawalRecord.transactionId));

      console.log("[VELOPAY] Withdrawal failed and refunded", {
        withdrawalId: withdrawalRecord.id,
        amount: amountINR,
      });

      return new NextResponse("SUCCESS");
    } catch (error) {
      console.error("[VELOPAY] Error processing withdrawal failure", error);
      return new NextResponse("Internal server error", { status: 500 });
    }
  }
}
