# Payment Flow Quick Reference

## Common Operations

### Initiate Deposit

```typescript
const deposit = await transaction.initiateDeposit.mutate({
  amount: '100',        // INR
  method: 'upi',        // 'upi', 'paytm', 'phonepe', 'bank_transfer', 'crypto'
  currency: 'INR',
});

// Response
{
  success: true,
  depositId: "abc123",
  transactionId: "xyz789",
  paymentUrl: "https://velopay.ptasm.online/pay/...",
  message: "Deposit initiated. Complete UPI payment to credit your balance."
}
```

### Request Withdrawal

```typescript
const withdrawal = await transaction.requestWithdrawal.mutate({
  amount: '50',
  method: 'upi',
  details: {
    upiId: 'user@paytm',
    accountHolder: 'John Doe',
  },
});

// Response
{
  success: true,
  withdrawalId: "abc123",
  transactionId: "xyz789",
  message: "Withdrawal submitted to payment gateway for processing",
  amount: "50",
  gatewayStatus: "PENDING"
}
```

### Get User Balance

```typescript
const wallet = await wallet.getBalance.query();
// { balance: "12458.50", counters: {...} }
```

### Get Transaction History

```typescript
const transactions = await transaction.getTransactions.query({
  limit: 20,
  offset: 0,
  type: 'deposit', // Optional: 'deposit', 'withdraw', 'bet', 'win', etc.
});
```

---

## VeloPay Gateway

### Convert Amounts

```typescript
import { velopayGateway } from '@/lib/velopay-gateway';

// INR to Paisa (for API requests)
const paisa = velopayGateway.inrToPaisa(100); // "10000"

// Paisa to INR (from callbacks)
const inr = velopayGateway.paisaToINR(10000); // 100
```

### Validate Inputs

```typescript
// UPI ID
velopayGateway.validateUPIId('user@paytm'); // true
velopayGateway.validateUPIId('invalid'); // false

// IFSC Code
velopayGateway.validateIFSC('PYTM0123456'); // true
velopayGateway.validateIFSC('INVALID'); // false

// Phone Number
velopayGateway.validatePhone('911234567890'); // true
velopayGateway.validatePhone('12345'); // false
```

### Generate Signature

```typescript
const params = {
  merchant_no: '201',
  txn_id: 'txn001',
  amount: '10000',
  type: 1,
  callback: 'https://example.com',
  currency: 'INR',
};

const signature = velopayGateway.generateSignature(params);
```

---

## Database Queries

### Check Deposit Status

```sql
SELECT id, amount, status, gateway_reference, created_at
FROM deposit
WHERE id = 'deposit_id';
```

### Check Withdrawal Status

```sql
SELECT id, amount, status, utr_number, processed_at
FROM withdrawal
WHERE id = 'withdrawal_id';
```

### Get User Transaction History

```sql
SELECT
  id,
  type,
  amount,
  status,
  balance_before,
  balance_after,
  metadata,
  created_at
FROM transaction
WHERE user_id = 'user_id'
ORDER BY created_at DESC
LIMIT 20;
```

### Verify Balance Integrity

```sql
SELECT
  u.id,
  u.username,
  u.balance,
  u.balance_version,
  (
    SELECT COALESCE(SUM(
      CASE
        WHEN t.type IN ('deposit', 'win', 'bonus', 'refund') THEN t.amount::numeric
        WHEN t.type IN ('withdraw', 'bet', 'adjustment') THEN -t.amount::numeric
      END
    ), 0)
    FROM transaction t
    WHERE t.user_id = u.id AND t.status = 'completed'
  ) as calculated_balance
FROM user u
WHERE u.id = 'user_id';
```

---

## Webhook Handling

### Deposit Callback

The webhook automatically:
1. Verifies signature
2. Checks if deposit exists
3. Credits user balance
4. Updates transaction records
5. Returns "SUCCESS"

### Withdrawal Callback

The webhook automatically:
1. Verifies signature
2. Checks if withdrawal exists
3. Updates withdrawal status
4. Refunds balance if failed
5. Returns "SUCCESS"

### Manual Webhook Test

```bash
# Generate signature first, then:
curl -X POST https://your-domain.com/api/webhook/velopay \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS",
    "txn_id": "test_deposit_id",
    "merchant_no": "201",
    "message": "TXN SUCCESS",
    "id": "12345",
    "amount": "10000",
    "utr": "UTR123",
    "sign": "generated_md5_signature"
  }'
```

---

## Error Handling

### Common Error Responses

| Error | Code | Description |
|-------|------|-------------|
| Insufficient balance | BAD_REQUEST | User balance too low for withdrawal |
| Invalid UPI ID | BAD_REQUEST | UPI ID format incorrect |
| Duplicate request | CONFLICT | Idempotency key already used |
| Deposit pattern check failed | TOO_MANY_REQUESTS | Too many deposits (anti-fraud) |
| Withdrawal limit exceeded | TOO_MANY_REQUESTS | Velocity limit exceeded |

### Try-Catch Pattern

```typescript
try {
  const deposit = await transaction.initiateDeposit.mutate({
    amount: '100',
    method: 'upi',
  });
  // Handle success
} catch (error) {
  if (error.data?.code === 'BAD_REQUEST') {
    // Handle validation errors
  } else if (error.data?.code === 'TOO_MANY_REQUESTS') {
    // Handle rate limiting
  }
}
```

---

## Environment Variables

```bash
# VeloPay Gateway
VELOPAY_GATEWAY_URL=https://velopay.ptasm.online
VELOPAY_MERCHANT_NO=201
VELOPAY_SECRET_KEY=1f23c2295a08e214304bf09463d0fbcb
VELOPAY_CALLBACK_URL=https://your-domain.com/api/webhook/velopay

# Database
DATABASE_URL=postgres://user:pass@host:port/db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Testing

### Run Unit Tests

```bash
npx tsx test-payment-flow.ts
```

### Test With Real Payment

1. Create deposit for ₹10 (minimum)
2. Open returned payment URL
3. Complete UPI payment
4. Verify balance credited in database

### Test Withdrawal

1. Ensure sufficient balance
2. Create withdrawal request
3. Verify balance debited
4. Wait for processing (usually instant)
5. Verify withdrawal status

---

## Monitoring

### Key Metrics to Monitor

- Deposit success rate
- Withdrawal success rate
- Average processing time
- Webhook failure rate
- Balance reconciliation
- Fraud detection triggers

### Logs to Monitor

```bash
# Deposit flows
grep "VELOPAY" /var/log/app.log | grep "deposit"

# Withdrawal flows
grep "VELOPAY" /var/log/app.log | grep "withdraw"

# Webhook callbacks
grep "webhook" /var/log/app.log

# Errors
grep "ERROR.*VELOPAY" /var/log/app.log
```

---

## Troubleshooting

### Deposit Not Credited

1. Check deposit status: `SELECT * FROM deposit WHERE id = 'xxx'`
2. Check webhook received: Look for "VELOPAY" in logs
3. Verify signature: Check if verification passed
4. Check transaction record: `SELECT * FROM transaction WHERE id = 'xxx'`

### Withdrawal Stuck

1. Check status: `SELECT * FROM withdrawal WHERE id = 'xxx'`
2. If PENDING > 5 min: Check VeloPay dashboard
3. If FAILED: Verify balance was refunded
4. Check for webhook callback in logs

### Signature Verification Failing

1. Verify secret key matches dashboard
2. Check parameter order (must be alphabetical)
3. Ensure all non-empty params included
4. Test with known values: Use test script

---

## Quick Commands

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Run tests
npx tsx test-payment-flow.ts

# Start dev server
npm run dev

# Check Redis
redis-cli ping

# View recent transactions
psql $DATABASE_URL -c "SELECT * FROM transaction ORDER BY created_at DESC LIMIT 10;"
```

---

## File Locations

| File | Path |
|------|------|
| VeloPay Gateway | `lib/velopay-gateway.ts` |
| Transaction Router | `server/routers/transaction.ts` |
| Wallet Router | `server/routers/wallet.rs` |
| Webhook Handler | `app/api/webhook/velopay/route.ts` |
| Database Schema | `drizzle/schema.ts` |
| Tests | `test-payment-flow.ts` |

---

## Support

- **VeloPay Dashboard**: https://manage.vinkaj.world
- **API Docs**: https://1k5lw3f9bz.apifox.cn/llms.txt
- **Test Account**: uppay001 / Aa12345678aa
- **Callback IP**: 13.201.70.222
