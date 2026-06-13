/**
 * OKPay Withdrawal Webhook Handler
 *
 * Validates signature, enqueues job, returns "success" immediately.
 * All DB writes happen in the payment worker with retry semantics.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { withdrawal } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { okpayGateway, type OkpayCallbackPayload } from "@/lib/okpay-gateway";
import { enqueuePaymentJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
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

  if (!okpayGateway.verifyCallbackSignature(payload)) {
    console.error("[webhook:okpay/withdrawal] invalid signature", { out_trade_no: payload.out_trade_no });
    return new NextResponse("FAILED", { status: 400 });
  }

  const [wd] = await db
    .select({ id: withdrawal.id, userId: withdrawal.userId, amount: withdrawal.amount })
    .from(withdrawal)
    .where(eq(withdrawal.id, payload.out_trade_no))
    .limit(1);

  if (!wd) {
    console.error("[webhook:okpay/withdrawal] withdrawal not found", payload.out_trade_no);
    return new NextResponse("FAILED", { status: 404 });
  }

  if (payload.status === "1") {
    await enqueuePaymentJob(
      {
        gateway: "okpay",
        kind: "withdrawal_success",
        withdrawalId: wd.id,
        gatewayRef: payload.transaction_Id,
      },
      `okpay:withdrawal_success:${wd.id}`,
    );
  } else if (payload.status === "2") {
    await enqueuePaymentJob(
      {
        gateway: "okpay",
        kind: "withdrawal_failed",
        withdrawalId: wd.id,
        userId: wd.userId,
        amountDecimal: wd.amount.toString(),
      },
      `okpay:withdrawal_failed:${wd.id}`,
    );
  }

  return new NextResponse("success", { status: 200 });
}
