/**
 * VeloPay Webhook Handler
 *
 * Security: IP allowlist + MD5 signature verification.
 * Processing: validate here, enqueue to BullMQ, return "SUCCESS" immediately.
 * The payment worker handles all DB writes with retry semantics.
 *
 * Returning "SUCCESS" to the gateway before DB writes is safe because:
 * - BullMQ persists the job in Redis (survives worker restarts)
 * - The job is idempotent — BullMQ deduplicates by jobId on re-delivery
 * - Retry with exponential backoff handles transient DB failures
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { deposit, withdrawal } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { velopayGateway, type VelopayCallbackPayload } from "@/lib/velopay-gateway";
import { enqueuePaymentJob } from "@/lib/queue";

const VELOPAY_CALLBACK_IP = "13.201.70.222";

function isAllowedIP(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return ip === VELOPAY_CALLBACK_IP;
}

export async function POST(request: NextRequest) {
  // 1. IP check
  if (!isAllowedIP(request)) {
    console.warn("[webhook:velopay] rejected non-whitelisted IP");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: VelopayCallbackPayload;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // 2. Signature check
  if (!velopayGateway.verifyCallbackSignature(body)) {
    console.error("[webhook:velopay] invalid signature", { txn_id: body.txn_id });
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const txnId = body.txn_id;

  // 3. Route to deposit or withdrawal
  const [dep] = await db.select({ id: deposit.id, userId: deposit.userId, amount: deposit.amount, status: deposit.status })
    .from(deposit).where(eq(deposit.id, txnId)).limit(1);

  if (dep) {
    if (body.status === "SUCCESS") {
      const amountPaisa = String(BigInt(Math.round(velopayGateway.paisaToINR(body.amount) * 100)));
      await enqueuePaymentJob(
        {
          gateway: "velopay",
          kind: "deposit_success",
          depositId: dep.id,
          userId: dep.userId,
          amountPaisa,
          gatewayRef: body.id,
          utr: body.utr,
        },
        `velopay:deposit_success:${dep.id}`,
      );
    } else {
      await enqueuePaymentJob(
        { gateway: "velopay", kind: "deposit_failed", depositId: dep.id, message: body.message },
        `velopay:deposit_failed:${dep.id}`,
      );
    }
    return new NextResponse("SUCCESS");
  }

  const [wd] = await db.select({ id: withdrawal.id, userId: withdrawal.userId, amount: withdrawal.amount, status: withdrawal.status })
    .from(withdrawal).where(eq(withdrawal.id, txnId)).limit(1);

  if (wd) {
    if (body.status === "SUCCESS") {
      await enqueuePaymentJob(
        {
          gateway: "velopay",
          kind: "withdrawal_success",
          withdrawalId: wd.id,
          utr: body.utr,
          gatewayRef: body.id,
        },
        `velopay:withdrawal_success:${wd.id}`,
      );
    } else {
      await enqueuePaymentJob(
        {
          gateway: "velopay",
          kind: "withdrawal_failed",
          withdrawalId: wd.id,
          userId: wd.userId,
          amountDecimal: wd.amount.toString(),
          message: body.message,
        },
        `velopay:withdrawal_failed:${wd.id}`,
      );
    }
    return new NextResponse("SUCCESS");
  }

  console.error("[webhook:velopay] txn_id not found", txnId);
  return new NextResponse("Transaction not found", { status: 404 });
}
