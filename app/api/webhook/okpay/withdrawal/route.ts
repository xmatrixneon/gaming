import { NextRequest, NextResponse } from 'next/server';
import { okpayGateway, OkpayCallbackPayload } from '@/lib/okpay-gateway';
import { db } from '@/drizzle';
import { withdrawal } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * OKPay Withdrawal Callback Handler
 *
 * Processes OKPay withdrawal callbacks:
 * 1. Verifies signature
 * 2. Parses callback data
 * 3. Updates withdrawal status
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
      console.error('[OKPAY] Withdrawal callback: Invalid signature');
      return new NextResponse('FAILED', { status: 400 });
    }

    // Get withdrawal record
    const withdrawalRecord = await db
      .select()
      .from(withdrawal)
      .where(eq(withdrawal.id, payload.out_trade_no))
      .limit(1);

    if (!withdrawalRecord[0]) {
      console.error('[OKPAY] Withdrawal callback: Withdrawal not found', payload.out_trade_no);
      return new NextResponse('FAILED', { status: 404 });
    }

    const withdrawalRec = withdrawalRecord[0];

    // Check if already processed
    if (withdrawalRec.status !== 'pending') {
      console.log('[OKPAY] Withdrawal callback: Already processed', withdrawalRec.id);
      return new NextResponse('success', { status: 200 });
    }

    // Process based on status
    if (payload.status === '1') {
      // Withdrawal successful
      await db
        .update(withdrawal)
        .set({
          status: 'completed',
          gatewayReference: payload.transaction_Id,
          gatewayMetadata: payload,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(withdrawal.id, withdrawalRec.id));

      console.log('[OKPAY] Withdrawal callback: Successfully processed', withdrawalRec.id);
    } else if (payload.status === '2') {
      // Withdrawal failed - refund user
      const { walletService } = await import('@/lib/wallet-service');

      const result = await walletService.updateBalanceAtomic(
        withdrawalRec.userId,
        BigInt(withdrawalRec.amount),
        'refund',
        {
          withdrawalId: withdrawalRec.id,
          reason: 'OKPay withdrawal failed',
        }
      );

      if (!result.success) {
        console.error('[OKPAY] Withdrawal callback: Failed to refund balance', result.error);
        return new NextResponse('FAILED', { status: 500 });
      }

      // Update withdrawal status
      await db
        .update(withdrawal)
        .set({
          status: 'failed',
          gatewayMetadata: payload,
          updatedAt: new Date(),
        })
        .where(eq(withdrawal.id, withdrawalRec.id));

      console.log('[OKPAY] Withdrawal callback: Failed, refunded balance', withdrawalRec.id);
    }

    // CRITICAL: Return plain text "success"
    return new NextResponse('success', { status: 200 });

  } catch (error) {
    console.error('[OKPAY] Withdrawal callback error:', error);
    return new NextResponse('FAILED', { status: 500 });
  }
}
