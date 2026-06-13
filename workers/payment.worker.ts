/**
 * Payment Worker
 *
 * Processes deposit and withdrawal webhook events from VeloPay and OKPay.
 * Webhook handlers validate the signature and enqueue; this worker does all DB writes.
 *
 * Idempotency: BullMQ job IDs are set to "{gateway}:{kind}:{id}" so duplicate
 * webhook deliveries produce duplicate job submissions — BullMQ deduplicates by jobId.
 *
 * Financial correctness:
 * - Deposits: walletService.updateBalanceAtomic() creates the completed transaction.
 *   The pending transaction created at deposit initiation stays as-is (audit record).
 * - Withdrawals confirmed: only status/metadata updated on withdrawal record.
 * - Withdrawals failed: walletService credits refund (new refund transaction).
 * - All DB writes are idempotent — checking deposit/withdrawal.status before acting.
 */

import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle";
import { deposit, withdrawal } from "@/drizzle/schema";
import { walletService } from "@/lib/wallet-service";
import {
  bullmqConnection,
  type PaymentJobData,
  enqueueNotification,
} from "@/lib/queue";
import { bonusService } from "@/lib/bonus-service";
import { referralService } from "@/lib/referral-service";

async function processPaymentJob(job: Job<PaymentJobData>): Promise<void> {
  const data = job.data;

  // ── VeloPay deposit success ─────────────────────────────────────────────
  if (data.gateway === "velopay" && data.kind === "deposit_success") {
    const { depositId, userId, amountPaisa, gatewayRef, utr } = data;

    // Idempotency: skip if already processed
    const [rec] = await db.select().from(deposit).where(eq(deposit.id, depositId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    const amount = BigInt(amountPaisa);

    const result = await walletService.updateBalanceAtomic(
      userId,
      amount,
      "deposit",
      { depositId, gatewayReference: gatewayRef },
    );
    if (!result.success) throw new Error(`Balance credit failed: ${result.error}`);

    await db
      .update(deposit)
      .set({
        status: "completed",
        gatewayReference: gatewayRef,
        gatewayMetadata: { gatewayRef, utr },
        updatedAt: new Date(),
      })
      .where(eq(deposit.id, depositId));

    // Welcome bonus + referral qualification on first deposit
    try {
      await bonusService.awardWelcomeBonus(userId, amount, depositId);
    } catch (err) {
      console.error("[worker:payment] welcome bonus failed:", err);
    }
    try {
      await referralService.qualifyReferral(userId, amount, depositId);
    } catch (err) {
      console.error("[worker:payment] referral qualify failed:", err);
    }

    await enqueueNotification({
      userId,
      type: "deposit_confirmed",
      title: "Deposit Confirmed",
      body: `Your deposit of ₹${(amount / 100n).toString()} has been credited to your account.`,
      metadata: { depositId, transactionId: result.transactionId ?? undefined },
    });

    console.log(`[worker:payment] velopay deposit_success ${depositId}`);
    return;
  }

  // ── VeloPay deposit failed ──────────────────────────────────────────────
  if (data.gateway === "velopay" && data.kind === "deposit_failed") {
    const { depositId } = data;

    const [rec] = await db.select().from(deposit).where(eq(deposit.id, depositId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    await db
      .update(deposit)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(deposit.id, depositId));

    console.log(`[worker:payment] velopay deposit_failed ${depositId}`);
    return;
  }

  // ── VeloPay withdrawal success ──────────────────────────────────────────
  if (data.gateway === "velopay" && data.kind === "withdrawal_success") {
    const { withdrawalId, utr, gatewayRef } = data;

    const [rec] = await db.select().from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    await db
      .update(withdrawal)
      .set({
        status: "completed",
        processedAt: new Date(),
        utrNumber: utr ?? null,
        gatewayReference: gatewayRef ?? null,
        gatewayMetadata: { utr, gatewayRef },
        updatedAt: new Date(),
      })
      .where(eq(withdrawal.id, withdrawalId));

    await enqueueNotification({
      userId: rec.userId,
      type: "withdrawal_processed",
      title: "Withdrawal Processed",
      body: `Your withdrawal of ₹${(BigInt(rec.amount.toString()) / 100n).toString()} has been sent.${utr ? ` UTR: ${utr}` : ""}`,
      metadata: { withdrawalId },
    });

    console.log(`[worker:payment] velopay withdrawal_success ${withdrawalId}`);
    return;
  }

  // ── VeloPay withdrawal failed — refund ─────────────────────────────────
  if (data.gateway === "velopay" && data.kind === "withdrawal_failed") {
    const { withdrawalId, userId, amountDecimal, message } = data;

    const [rec] = await db.select().from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    // Amount stored as decimal (₹), convert to paisa
    const amountPaisa = BigInt(Math.round(parseFloat(amountDecimal)));

    const result = await walletService.updateBalanceAtomic(
      userId,
      amountPaisa,
      "refund",
      { withdrawalId, reason: `Withdrawal failed: ${message ?? "gateway error"}` },
    );
    if (!result.success) throw new Error(`Refund failed: ${result.error}`);

    await db
      .update(withdrawal)
      .set({
        status: "failed",
        notes: message ? `Failed: ${message}` : "Payment gateway rejected",
        updatedAt: new Date(),
      })
      .where(eq(withdrawal.id, withdrawalId));

    await enqueueNotification({
      userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Failed",
      body: `Your withdrawal was unsuccessful. ₹${(amountPaisa / 100n).toString()} has been refunded to your account.`,
      metadata: { withdrawalId, transactionId: result.transactionId ?? undefined },
    });

    console.log(`[worker:payment] velopay withdrawal_failed ${withdrawalId} — refunded`);
    return;
  }

  // ── OKPay deposit success ───────────────────────────────────────────────
  if (data.gateway === "okpay" && data.kind === "deposit_success") {
    const { depositId, userId, amountPaisa, transactionRef } = data;

    const [rec] = await db.select().from(deposit).where(eq(deposit.id, depositId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    const amount = BigInt(amountPaisa);

    const result = await walletService.updateBalanceAtomic(
      userId,
      amount,
      "deposit",
      { depositId, gatewayReference: transactionRef, method: "okpay-upi" },
    );
    if (!result.success) throw new Error(`Balance credit failed: ${result.error}`);

    await db
      .update(deposit)
      .set({
        status: "completed",
        gatewayReference: transactionRef,
        gatewayMetadata: { transactionRef },
        updatedAt: new Date(),
      })
      .where(eq(deposit.id, depositId));

    try {
      await bonusService.awardWelcomeBonus(userId, amount, depositId);
    } catch (err) {
      console.error("[worker:payment] welcome bonus failed:", err);
    }
    try {
      await referralService.qualifyReferral(userId, amount, depositId);
    } catch (err) {
      console.error("[worker:payment] referral qualify failed:", err);
    }

    await enqueueNotification({
      userId,
      type: "deposit_confirmed",
      title: "Deposit Confirmed",
      body: `Your deposit of ₹${(amount / 100n).toString()} has been credited to your account.`,
      metadata: { depositId, transactionId: result.transactionId ?? undefined },
    });

    console.log(`[worker:payment] okpay deposit_success ${depositId}`);
    return;
  }

  // ── OKPay deposit failed ────────────────────────────────────────────────
  if (data.gateway === "okpay" && data.kind === "deposit_failed") {
    const { depositId } = data;

    const [rec] = await db.select().from(deposit).where(eq(deposit.id, depositId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    await db
      .update(deposit)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(deposit.id, depositId));

    console.log(`[worker:payment] okpay deposit_failed ${depositId}`);
    return;
  }

  // ── OKPay withdrawal success ────────────────────────────────────────────
  if (data.gateway === "okpay" && data.kind === "withdrawal_success") {
    const { withdrawalId, gatewayRef } = data;

    const [rec] = await db.select().from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    await db
      .update(withdrawal)
      .set({
        status: "completed",
        gatewayReference: gatewayRef,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawal.id, withdrawalId));

    await enqueueNotification({
      userId: rec.userId,
      type: "withdrawal_processed",
      title: "Withdrawal Processed",
      body: `Your withdrawal of ₹${(BigInt(rec.amount.toString()) / 100n).toString()} has been sent.`,
      metadata: { withdrawalId },
    });

    console.log(`[worker:payment] okpay withdrawal_success ${withdrawalId}`);
    return;
  }

  // ── OKPay withdrawal failed — refund ───────────────────────────────────
  if (data.gateway === "okpay" && data.kind === "withdrawal_failed") {
    const { withdrawalId, userId, amountDecimal } = data;

    const [rec] = await db.select().from(withdrawal).where(eq(withdrawal.id, withdrawalId)).limit(1);
    if (!rec || rec.status !== "pending") return;

    const amountPaisa = BigInt(Math.round(parseFloat(amountDecimal)));

    const result = await walletService.updateBalanceAtomic(
      userId,
      amountPaisa,
      "refund",
      { withdrawalId, reason: "OKPay withdrawal failed" },
    );
    if (!result.success) throw new Error(`Refund failed: ${result.error}`);

    await db
      .update(withdrawal)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(withdrawal.id, withdrawalId));

    await enqueueNotification({
      userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Failed",
      body: `Your withdrawal was unsuccessful. ₹${(amountPaisa / 100n).toString()} has been refunded.`,
      metadata: { withdrawalId, transactionId: result.transactionId ?? undefined },
    });

    console.log(`[worker:payment] okpay withdrawal_failed ${withdrawalId} — refunded`);
    return;
  }

  // TypeScript narrows data to never here — cast for the error message only
  const d = data as { gateway: string; kind: string };
  throw new Error(`Unknown payment job: ${d.gateway}:${d.kind}`);
}

export function createPaymentWorker(): Worker<PaymentJobData> {
  const worker = new Worker<PaymentJobData>(
    "payment",
    processPaymentJob,
    {
      connection: bullmqConnection,
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker:payment] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[worker:payment] job ${job.id} completed`);
  });

  return worker;
}
