/**
 * OKPay Deposit Webhook Handler
 *
 * Validates signature, enqueues job, returns "success" immediately.
 * All DB writes happen in the payment worker with retry semantics.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { deposit } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { okpayGateway, type OkpayCallbackPayload } from "@/lib/okpay-gateway";
import { enqueuePaymentJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
  // Parse form data (OKPay sends application/x-www-form-urlencoded)
  const formData = await request.formData();
  const payload: OkpayCallbackPayload = {
    mchId:          formData.get("mchId") as string,
    out_trade_no:   formData.get("out_trade_no") as string,
    transaction_Id: formData.get("transaction_Id") as string,
    status:         formData.get("status") as string,
    money:          formData.get("money") as string,
    attach:         (formData.get("attach") as string) ?? undefined,
    sign:           formData.get("sign") as string,
  };

  // Signature check
  if (!okpayGateway.verifyCallbackSignature(payload)) {
    console.error("[webhook:okpay/deposit] invalid signature", { out_trade_no: payload.out_trade_no });
    return new NextResponse("FAILED", { status: 400 });
  }

  // Find deposit
  const [dep] = await db
    .select({ id: deposit.id, userId: deposit.userId })
    .from(deposit)
    .where(eq(deposit.id, payload.out_trade_no))
    .limit(1);

  if (!dep) {
    console.error("[webhook:okpay/deposit] deposit not found", payload.out_trade_no);
    return new NextResponse("FAILED", { status: 404 });
  }

  if (payload.status === "1") {
    // money is in INR (rupees), convert to paisa
    const amountPaisa = String(okpayGateway.inrToPaisa(payload.money));
    await enqueuePaymentJob(
      {
        gateway: "okpay",
        kind: "deposit_success",
        depositId: dep.id,
        userId: dep.userId,
        amountPaisa,
        transactionRef: payload.transaction_Id,
      },
      `okpay:deposit_success:${dep.id}`,
    );
  } else if (payload.status === "2") {
    await enqueuePaymentJob(
      { gateway: "okpay", kind: "deposit_failed", depositId: dep.id },
      `okpay:deposit_failed:${dep.id}`,
    );
  }
  // status codes other than 1/2 are informational — no action needed

  return new NextResponse("success", { status: 200 });
}
