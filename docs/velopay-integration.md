# VeloPay Payment Gateway Integration

## Overview

VeloPay is an Indian UPI-focused payment gateway that supports both deposits (payin) and withdrawals (payout). This integration enables ClausBet users to deposit and withdraw funds using UPI payment methods.

## Configuration

### Environment Variables (`.env.local`)

```bash
# VeloPay Payment Gateway
VELOPAY_GATEWAY_URL=https://velopay.ptasm.online
VELOPAY_MERCHANT_NO=201
VELOPAY_SECRET_KEY=1f23c2295a08e214304bf09463d0fbcb
VELOPAY_CALLBACK_URL=https://your-domain.com/api/webhook/velopay
```

### Test Account

- **Merchant Portal**: https://manage.vinkaj.world
- **Username**: uppay001
- **Password**: Aa12345678aa
- **Merchant Code**: 201
- **Secret Key**: 1f23c2295a08e214304bf09463d0fbcb

## Features Implemented

### 1. VeloPay Gateway Service (`lib/velopay-gateway.ts`)

**Features:**
- ✅ MD5 signature generation and verification
- ✅ Deposit request (H5 payment link)
- ✅ Withdrawal request (UPI/bank transfer)
- ✅ Amount conversion (INR ↔ Paisa)
- ✅ IFSC code validation
- ✅ UPI ID validation
- ✅ Phone number validation

**Key Functions:**
```typescript
// Create deposit
const response = await velopayGateway.createDeposit({
  txn_id: 'deposit_123',
  amount: '10000', // Amount in paisa (100 INR)
  type: 1, // 1=H5 link, 2=UPI account
});

// Create withdrawal
const response = await velopayGateway.createWithdrawal({
  txn_id: 'withdrawal_123',
  amount: '10000',
  type: '1',
  ifsc: 'PYTM0123456',
  card_num: '910123456789',
  name: 'Account Holder',
});
```

### 2. Transaction Router Updates (`server/routers/transaction.ts`)

**Deposit Flow:**
1. User initiates deposit with UPI method
2. System creates deposit record
3. VeloPay API called with deposit details
4. Returns H5 payment link for user to complete payment
5. Webhook callback confirms payment and credits balance

**Withdrawal Flow:**
1. User initiates withdrawal with UPI details
2. System validates UPI ID format
3. Balance debited immediately
4. VeloPay API called with withdrawal details
5. Webhook callback confirms processing
6. If failed, balance automatically refunded

### 3. Webhook Handlers (`app/api/webhook/velopay/route.ts`)

**Features:**
- ✅ IP whitelist verification (13.201.70.222)
- ✅ MD5 signature verification
- ✅ Deposit callback processing
- ✅ Withdrawal callback processing
- ✅ Automatic refund on withdrawal failure
- ✅ Transaction status updates

**Endpoints:**
- `POST /api/webhook/velopay` - Main webhook handler

## Security

### Signature Verification

All requests are signed using MD5:
1. Sort parameters alphabetically
2. Join as `key1=value1&key2=value2`
3. Append `&key={secretKey}`
4. Generate MD5 hash (32 characters)

### IP Whitelist

Only accept callbacks from: `13.201.70.222`

**Note:** Configure your reverse proxy/CDN to enforce IP restrictions.

## API Reference

### Deposit Request

```typescript
POST /api/payin/request
Content-Type: application/json

{
  "merchant_no": "201",
  "txn_id": "unique_deposit_id",
  "amount": "10000", // Amount in paisa
  "type": 1, // 1=H5 link, 2=UPI account
  "callback": "https://your-domain.com/api/webhook/velopay",
  "currency": "INR",
  "sign": "md5_hash"
}
```

### Withdrawal Request

```typescript
POST /api/payout/request
Content-Type: application/json

{
  "merchant_no": "201",
  "txn_id": "unique_withdrawal_id",
  "amount": "10000",
  "type": "1",
  "ifsc": "PYTM0123456",
  "card_num": "910123456789",
  "name": "Account Holder",
  "email": "user@email.com",
  "mobile": "911234567890",
  "callback": "https://your-domain.com/api/webhook/velopay",
  "currency": "INR",
  "sign": "md5_hash"
}
```

### Callback Format

```typescript
POST {callback_url}
Content-Type: application/json

{
  "status": "SUCCESS",
  "txn_id": "deposit_id",
  "merchant_no": "201",
  "message": "TXN SUCCESS",
  "id": "platform_txn_id",
  "amount": "10000",
  "utr": "utr_number",
  "sign": "md5_hash"
}
```

**Response:** Must return `"SUCCESS"`

## Testing

### Test Deposit Flow

```bash
# Using tRPC client
await transaction.initiateDeposit.mutate({
  amount: '100',
  method: 'upi',
});
```

### Test Withdrawal Flow

```bash
await transaction.requestWithdrawal.mutate({
  amount: '50',
  method: 'upi',
  details: {
    upiId: 'user@paytm',
    accountHolder: 'Test User',
  },
});
```

## Amount Conversion

VeloPay uses **paisa** (1 INR = 100 paisa):

```typescript
// Convert INR to paisa
const paisa = velopayGateway.inrToPaisa(100); // "10000"

// Convert paisa to INR
const inr = velopayGateway.paisaToINR(10000); // 100
```

## Error Handling

### Common Errors

| Error | Description | Solution |
|-------|-------------|----------|
| Invalid signature | MD5 signature mismatch | Check secret key and signing process |
| Invalid UPI ID | UPI ID format incorrect | Use format: username@bank |
| Insufficient balance | User balance too low | Ensure sufficient funds before withdrawal |
| Transaction not found | Deposit/withdrawal not found | Verify transaction ID exists |

## Production Checklist

Before going live:

- [ ] Update `VELOPAY_SECRET_KEY` with production key
- [ ] Configure `VELOPAY_CALLBACK_URL` with production domain
- [ ] Whitelist callback IP (13.201.70.222) in your firewall/reverse proxy
- [ ] Test deposit flow with real UPI payment
- [ ] Test withdrawal flow with real bank transfer
- [ ] Test failed withdrawal refund flow
- [ ] Monitor webhook logs for signature verification failures
- [ ] Set up monitoring for transaction status updates

## Support

- **VeloPay Dashboard**: https://manage.vinkaj.world
- **API Documentation**: https://1k5lw3f9bz.apifox.cn/llms.txt (Password: FG0e3NSy)
- **Callback IP**: 13.201.70.222

## Files Modified

1. `lib/velopay-gateway.ts` - VeloPay gateway service
2. `server/routers/transaction.ts` - Updated deposit/withdrawal flows
3. `app/api/webhook/velopay/route.ts` - Webhook handlers
4. `.env.example` - Added VeloPay configuration

## Next Steps

1. Update frontend deposit page to use VeloPay payment link
2. Update frontend withdrawal page to collect UPI details
3. Add payment status polling for better UX
4. Implement admin panel for withdrawal approval
5. Add transaction reconciliation job
