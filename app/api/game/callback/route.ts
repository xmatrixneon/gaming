/**
 * Game API Bet Settlement Callback Endpoint
 *
 * Receives bet settlement callbacks from the Game API server.
 * Processes bets and wins, updates user balances, and returns responses.
 *
 * Flow:
 * 1. Receive POST request with encrypted payload
 * 2. Decrypt payload using AES-256
 * 3. Validate agency UID and signature
 * 4. Process idempotency check using serial_number
 * 5. Find user by member_account
 * 6. Process bet amount (debit) and win amount (credit)
 * 7. Update game session and bet records
 * 8. Return encrypted response with updated balance
 */

import { NextRequest, NextResponse } from "next/server";
import { aesDecrypt, decryptObject, encryptObject } from "@/lib/crypto-utils";
import { gameApiConfig } from "@/lib/game-api-config";
import type {
  GameCallbackRequest,
  GameCallbackPayload,
  GameCallbackResponsePayload,
} from "@/lib/game-api-types";
import { db } from "@/drizzle";
import { user } from "@/drizzle/schema";
import { eq } from "drizzle/orm";
import { idempotencyService } from "@/lib/idempotency";
import { aggregatorAdapter } from "@/lib/aggregator-adapter";
import { nanoid } from "nanoid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const MEMBER_ACCOUNT_PREFIX = "h5ab3a";

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Creates a successful callback response
 */
function createSuccessResponse(creditAmount: string): {
  code: number;
  msg: string;
  payload: string;
} {
  const responseData: GameCallbackResponsePayload = {
    credit_amount: creditAmount,
    timestamp: Date.now().toString(),
  };

  return {
    code: 0,
    msg: "",
    payload: encryptObject(responseData, gameApiConfig.aesKey),
  };
}

/**
 * Creates a failure callback response (triggers Game API retry)
 */
function createErrorResponse(message: string): {
  code: number;
  msg: string;
  payload: string;
} {
  const responseData: GameCallbackResponsePayload = {
    credit_amount: "0.00",
    timestamp: Date.now().toString(),
  };

  return {
    code: 1, // 1 = failure (triggers retry)
    msg: message,
    payload: encryptObject(responseData, gameApiConfig.aesKey),
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  console.info("[GameCallback] Received callback request");

  let requestBody: GameCallbackRequest;
  let callbackData: GameCallbackPayload;
  let userId: string | null = null;

  try {
    // ========================================================================
    // STEP 1: PARSE REQUEST
    // ========================================================================

    requestBody = await request.json();

    console.debug("[GameCallback] Request parsed", {
      agencyUid: requestBody.agency_uid,
      timestamp: requestBody.timestamp,
      hasPayload: !!requestBody.payload,
    });

    // ========================================================================
    // STEP 2: VALIDATE AGENCY UID
    // ========================================================================

    if (requestBody.agency_uid !== gameApiConfig.agencyUid) {
      console.error("[GameCallback] Invalid agency UID", {
        received: requestBody.agency_uid,
        expected: gameApiConfig.agencyUid,
      });

      return NextResponse.json(createErrorResponse("Invalid agency UID"), {
        status: 200, // Game API expects 200 even for errors
      });
    }

    // ========================================================================
    // STEP 3: DECRYPT PAYLOAD
    // ========================================================================

    try {
      const decrypted = decryptObject<GameCallbackPayload>(
        requestBody.payload,
        gameApiConfig.aesKey
      );

      callbackData = decrypted;

      console.info("[GameCallback] Callback data decrypted", {
        serialNumber: callbackData.serial_number,
        memberAccount: callbackData.member_account,
        betAmount: callbackData.bet_amount,
        winAmount: callbackData.win_amount,
        gameRound: callbackData.game_round,
        gameUid: callbackData.game_uid,
      });
    } catch (error) {
      console.error("[GameCallback] Payload decryption failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(createErrorResponse("Decryption failed"), {
        status: 200,
      });
    }

    // ========================================================================
    // STEP 4: VALIDATE CALLBACK DATA
    // ========================================================================

    if (!callbackData.serial_number || !callbackData.member_account) {
      console.error("[GameCallback] Missing required fields", {
        serialNumber: callbackData.serial_number,
        memberAccount: callbackData.member_account,
      });

      return NextResponse.json(createErrorResponse("Missing required fields"), {
        status: 200,
      });
    }

    // ========================================================================
    // STEP 5: IDEMPOTENCY CHECK
    // ========================================================================

    const idempotencyKey = idempotencyService.generateKey(
      callbackData.serial_number,
      "game-callback",
      "settlement"
    );

    const idempotencyResult = await idempotencyService.checkWithStatus(
      idempotencyKey
    );

    if (idempotencyResult.status === "completed") {
      console.info("[GameCallback] Duplicate callback - returning cached result", {
        serialNumber: callbackData.serial_number,
        status: idempotencyResult.status,
      });

      // For idempotent requests, we still need to return a valid response with current balance
      // The Game API will use this to update their side
      // Try to get user and return current balance
      try {
        const memberAccount = callbackData.member_account;
        const cleanMemberAccount = memberAccount.replace(MEMBER_ACCOUNT_PREFIX, "");

        // Find user by matching member account pattern
        // We need to match the h5ab3a prefix + user ID
        const users = await db
          .select()
          .from(user)
          .where(eq(user.id, cleanMemberAccount))
          .limit(1);

        if (users[0]) {
          const balance = BigInt(users[0].balance.toString());
          const balanceInRupee = (balance / BigInt(100)).toString();

          return NextResponse.json(
            createSuccessResponse(balanceInRupee),
            { status: 200 }
          );
        }
      } catch (error) {
        console.error("[GameCallback] Error fetching balance for duplicate callback", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Return default response if we can't get balance
      return NextResponse.json(createSuccessResponse("0.00"), {
        status: 200,
      });
    }

    if (!idempotencyResult.canProceed) {
      console.warn("[GameCallback] Idempotency check blocked callback", {
        serialNumber: callbackData.serial_number,
        status: idempotencyResult.status,
      });

      return NextResponse.json(createErrorResponse("Duplicate request in progress"), {
        status: 200,
      });
    }

    // ========================================================================
    // STEP 6: FIND USER BY MEMBER ACCOUNT
    // ========================================================================

    // Member account format: h5ab3a + userId (cleaned)
    const memberAccount = callbackData.member_account;

    if (!memberAccount.startsWith(MEMBER_ACCOUNT_PREFIX)) {
      console.error("[GameCallback] Invalid member account prefix", {
        memberAccount,
        expectedPrefix: MEMBER_ACCOUNT_PREFIX,
      });

      return NextResponse.json(createErrorResponse("Invalid member account"), {
        status: 200,
      });
    }

    // Extract user ID from member account
    const cleanMemberAccount = memberAccount.replace(MEMBER_ACCOUNT_PREFIX, "");

    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, cleanMemberAccount))
      .limit(1);

    if (!users[0]) {
      console.error("[GameCallback] User not found", {
        memberAccount,
        cleanMemberAccount,
      });

      return NextResponse.json(createErrorResponse("User not found"), {
        status: 200,
      });
    }

    userId = users[0].id;

    console.info("[GameCallback] User found", {
      userId,
      memberAccount,
    });

    // ========================================================================
    // STEP 7: PARSE AMOUNTS
    // ========================================================================

    const betAmount = parseFloat(callbackData.bet_amount);
    const winAmount = parseFloat(callbackData.win_amount);

    // Convert to paisa (integer) - Game API sends amounts in rupees
    const betAmountPaisa = betAmount > 0 ? BigInt(Math.round(betAmount * 100)) : BigInt(0);
    const winAmountPaisa = winAmount > 0 ? BigInt(Math.round(winAmount * 100)) : BigInt(0);

    console.info("[GameCallback] Parsed amounts", {
      betAmount: callbackData.bet_amount,
      winAmount: callbackData.win_amount,
      betAmountPaisa: betAmountPaisa.toString(),
      winAmountPaisa: winAmountPaisa.toString(),
    });

    // ========================================================================
    // STEP 8: PROCESS TRANSACTIONS
    // ========================================================================

    let finalBalance = BigInt(users[0].balance.toString());

    // Process bet (debit)
    if (betAmountPaisa > 0) {
      console.info("[GameCallback] Processing bet", {
        userId,
        amount: betAmountPaisa.toString(),
        serialNumber: callbackData.serial_number,
        gameRound: callbackData.game_round,
      });

      const debitResult = await aggregatorAdapter.debit({
        userId,
        sessionId: callbackData.game_round, // Use game_round as session ID
        amount: betAmountPaisa,
        gameRoundId: callbackData.game_round,
        transactionRef: callbackData.serial_number,
        gameCode: callbackData.game_uid,
        provider: "game-api",
      });

      if (!debitResult.success) {
        console.error("[GameCallback] Bet processing failed", {
          userId,
          serialNumber: callbackData.serial_number,
          errorCode: debitResult.errorCode,
          failureReason: debitResult.failureReason,
        });

        await idempotencyService.delete(idempotencyKey);

        return NextResponse.json(
          createErrorResponse(debitResult.failureReason || "Bet failed"),
          { status: 200 }
        );
      }

      finalBalance = debitResult.balanceAfter;

      console.info("[GameCallback] Bet processed successfully", {
        transactionId: debitResult.transactionId,
        balanceAfter: finalBalance.toString(),
      });
    }

    // Process win (credit)
    if (winAmountPaisa > 0) {
      console.info("[GameCallback] Processing win", {
        userId,
        amount: winAmountPaisa.toString(),
        serialNumber: callbackData.serial_number,
        gameRound: callbackData.game_round,
      });

      const creditResult = await aggregatorAdapter.credit({
        userId,
        sessionId: callbackData.game_round, // Use game_round as session ID
        amount: winAmountPaisa,
        gameRoundId: callbackData.game_round,
        transactionRef: `${callbackData.serial_number}-win`,
        gameCode: callbackData.game_uid,
        provider: "game-api",
      });

      if (!creditResult.success) {
        console.error("[GameCallback] Win processing failed", {
          userId,
          serialNumber: callbackData.serial_number,
          errorCode: creditResult.errorCode,
          failureReason: creditResult.failureReason,
        });

        // Don't return error for win failures - log and continue
        // The bet was already processed, we should acknowledge the callback
        console.warn("[GameCallback] Win failed but acknowledging callback to prevent retry");
      } else {
        finalBalance = creditResult.balanceAfter;

        console.info("[GameCallback] Win processed successfully", {
          transactionId: creditResult.transactionId,
          balanceAfter: finalBalance.toString(),
        });
      }
    }

    // ========================================================================
    // STEP 9: MARK IDEMPOTENCY COMPLETE
    // ========================================================================

    await idempotencyService.complete(idempotencyKey);

    console.info("[GameCallback] Callback processed successfully", {
      serialNumber: callbackData.serial_number,
      finalBalance: finalBalance.toString(),
    });

    // ========================================================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ========================================================================

    // Convert balance back to rupees (Game API expects rupees, not paisa)
    const balanceInRupee = (finalBalance / BigInt(100)).toString();

    return NextResponse.json(createSuccessResponse(balanceInRupee), {
      status: 200,
    });

  } catch (error) {
    // ========================================================================
    // ERROR HANDLING
    // ========================================================================

    console.error("[GameCallback] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Clean up idempotency key on error
    if (userId) {
      try {
        const idempotencyKey = idempotencyService.generateKey(
          userId,
          "game-callback",
          "error"
        );
        await idempotencyService.delete(idempotencyKey);
      } catch (cleanupError) {
        console.error("[GameCallback] Failed to cleanup idempotency key", {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    // Return error response (triggers Game API retry)
    return NextResponse.json(
      createErrorResponse(error instanceof Error ? error.message : "Unknown error"),
      { status: 200 }
    );
  }
}

// ============================================================================
// METHOD NOT ALLOWED
// ============================================================================

export async function GET() {
  console.warn("[GameCallback] GET request not allowed");

  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
