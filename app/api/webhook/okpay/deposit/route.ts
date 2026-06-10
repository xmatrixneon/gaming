import { NextRequest, NextResponse } from 'next/server';
import { okpayGateway, OkpayCallbackPayload } from '@/lib/okpay-gateway';
import { db } from '@/drizzle';
import { deposit } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { walletService } from '@/lib/wallet-service';

/**
 * OKPay Deposit Callback Handler
 *
 * Processes OKPay deposit callbacks:
 * 1. Verifies signature
 * 2. Parses callback data
 * 3. Credits user balance (atomic update)
 * 4. Returns plain text "success"
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const payload: OkpayCallbackPayload = {
      mchId: formData.get('mchId') as string,
      out_trade_no: formData.get('out_trade_no') as string,
      transaction_Id: formData.get('transaction_Id') as string,
      status: formData.get('status') as string,
      money: formData.get('money') as string,
      attach: formData.get('attach') as string | undefined,
      sign: formData.get('sign') as string,
    };

    // Verify signature
    if (!okpayGateway.verifyCallbackSignature(payload)) {
      console.error('[OKPAY] Deposit callback: Invalid signature');
      return new NextResponse('FAILED', { status: 400 });
    }

    // Get deposit record
    const depositRecord = await db
      .select()
      .from(deposit)
      .where(eq(deposit.id, payload.out_trade_no))
      .limit(1);

    if (!depositRecord[0]) {
      console.error('[OKPAY] Deposit callback: Deposit not found', payload.out_trade_no);
      return new NextResponse('FAILED', { status: 404 });
    }

    const depositRec = depositRecord[0];

    // Check if already processed
    if (depositRec.status !== 'pending') {
      console.log('[OKPAY] Deposit callback: Already processed', depositRec.id);
      return new NextResponse('success', { status: 200 });
    }

    // Process based on status
    if (payload.status === '1') {
      // Payment successful - credit balance
      // Convert money from rupees to paisa
      const amountInPaisa = okpayGateway.inrToPaisa(payload.money);

      const result = await walletService.updateBalanceAtomic(
        depositRec.userId,
        BigInt(amountInPaisa),
        'deposit',
        {
          depositId: depositRec.id,
          gatewayReference: payload.transaction_Id,
          method: 'okpay-upi',
        }
      );

      if (!result.success) {
        console.error('[OKPAY] Deposit callback: Failed to credit balance', result.error);
        return new NextResponse('FAILED', { status: 500 });
      }

      // Update deposit status
      await db
        .update(deposit)
        .set({
          status: 'completed',
          gatewayReference: payload.transaction_Id,
          gatewayMetadata: payload,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositRec.id));

      console.log('[OKPAY] Deposit callback: Successfully processed', depositRec.id);
    } else if (payload.status === '2') {
      // Payment failed
      await db
        .update(deposit)
        .set({
          status: 'failed',
          gatewayMetadata: payload,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositRec.id));

      console.log('[OKPAY] Deposit callback: Payment failed', depositRec.id);
    }

    // CRITICAL: Return plain text "success" (not JSON, not the string "success")
    return new NextResponse('success', { status: 200 });

  } catch (error) {
    console.error('[OKPAY] Deposit callback error:', error);
    return new NextResponse('FAILED', { status: 500 });
  }
}
