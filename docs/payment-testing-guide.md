# VeloPay Payment Flow Testing Guide

## Automated Tests ✅

All automated tests pass! Run with:
```bash
npx tsx test-payment-flow.ts
```

### Test Results:
- ✅ Signature Generation
- ✅ Amount Conversion (INR ↔ Paisa)
- ✅ UPI ID Validation
- ✅ Deposit Request Format
- ✅ Withdrawal Request Format
- ✅ Callback Signature Verification

---

## Manual Testing Steps

### 1. Test Deposit Flow

#### Step 1: Start the Development Server
```bash
npm run dev
```

#### Step 2: Create a Test Deposit Request

Using the tRPC client or API:

```typescript
// Via tRPC client
const result = await transaction.initiateDeposit.mutate({
  amount: '100', // INR
  method: 'upi',
  currency: 'INR',
});

// Expected response:
{
  "success": true,
  "depositId": "xxxxx",
  "transactionId": "xxxxx",
  "paymentUrl": "https://velopay.ptasm.online/payment/...",
  "message": "Deposit initiated. Complete UPI payment to credit your balance."
}
```

#### Step 3: Complete Payment

1. Open the `paymentUrl` from the response
2. Complete the UPI payment using test UPI credentials
3. Wait for webhook callback

#### Step 4: Verify Deposit

Check database for deposit status:
```sql
SELECT * FROM deposit WHERE id = 'your_deposit_id';
SELECT * FROM transaction WHERE id = 'your_transaction_id';
```

Expected:
- `deposit.status` = 'completed'
- `transaction.status` = 'completed'
- User balance increased by deposit amount

---

### 2. Test Withdrawal Flow

#### Step 1: Ensure Sufficient Balance

Make sure you have enough balance (at least ₹50 for testing).

#### Step 2: Create Withdrawal Request

```typescript
// Via tRPC client
const result = await transaction.requestWithdrawal.mutate({
  amount: '50', // INR
  method: 'upi',
  details: {
    upiId: 'testuser@paytm', // Use test UPI ID
    accountHolder: 'Test User',
  },
});

// Expected response:
{
  "success": true,
  "withdrawalId": "xxxxx",
  "transactionId": "xxxxx",
  "message": "Withdrawal submitted to payment gateway for processing",
  "amount": "50",
  "gatewayStatus": "PENDING"
}
```

#### Step 3: Verify Balance Debit

```sql
SELECT * FROM user WHERE id = 'your_user_id';
```

Expected: Balance decreased by ₹50

#### Step 4: Wait for Callback

VeloPay will process the withdrawal and send a callback.

#### Step 5: Verify Withdrawal Status

```sql
SELECT * FROM withdrawal WHERE id = 'your_withdrawal_id';
```

If successful:
- `status` = 'completed'
- `utr_number` populated

If failed:
- `status` = 'failed'
- User balance refunded automatically

---

### 3. Test Webhook Handling

#### Test Deposit Callback

Use curl or Postman to simulate a deposit callback:

```bash
curl -X POST https://your-domain.com/api/webhook/velopay \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 13.201.70.222" \
  -d '{
    "status": "SUCCESS",
    "txn_id": "your_deposit_id",
    "merchant_no": "201",
    "message": "TXN SUCCESS",
    "id": "12345",
    "amount": "10000",
    "utr": "UTR123456789",
    "sign": "generated_signature_here"
  }'
```

**Expected Response:** `SUCCESS`

#### Test Withdrawal Callback

```bash
curl -X POST https://your-domain.com/api/webhook/velopay \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS",
    "txn_id": "your_withdrawal_id",
    "merchant_no": "201",
    "message": "TXN SUCCESS",
    "id": "12346",
    "amount": "5000",
    "utr": "UTR987654321",
    "sign": "generated_signature_here"
  }'
```

**Expected Response:** `SUCCESS`

---

### 4. Test Error Scenarios

#### Insufficient Balance

```typescript
// Attempt withdrawal larger than balance
await transaction.requestWithdrawal.mutate({
  amount: '999999',
  method: 'upi',
  details: { upiId: 'user@paytm', accountHolder: 'User' },
});
```

**Expected:** Error "Insufficient balance"

#### Invalid UPI ID

```typescript
await transaction.requestWithdrawal.mutate({
  amount: '50',
  method: 'upi',
  details: { upiId: 'invalid_upi', accountHolder: 'User' },
});
```

**Expected:** Error "Invalid UPI ID format"

#### Duplicate Request

```typescript
// Use same clientProvidedKey
await transaction.initiateDeposit.mutate({
  amount: '100',
  method: 'upi',
  clientProvidedKey: 'test-key-123',
});

// Try again with same key
await transaction.initiateDeposit.mutate({
  amount: '100',
  method: 'upi',
  clientProvidedKey: 'test-key-123',
});
```

**Expected:** Error "Duplicate request"

---

### 5. Test Signature Verification

Generate a test signature using the gateway service:

```typescript
import { velopayGateway } from '@/lib/velopay-gateway';

const params = {
  merchant_no: '201',
  txn_id: 'test_001',
  amount: '10000',
  status: 'SUCCESS',
};

const signature = velopayGateway.generateSignature(params);
console.log('Generated signature:', signature);

// Verify
const isValid = velopayGateway.verifyCallbackSignature({
  ...params,
  sign: signature,
});
console.log('Valid:', isValid); // Should be true
```

---

## Test Data

### Valid Test Values

| Field | Valid Example |
|-------|---------------|
| UPI ID | `user@paytm`, `john.doe@ybl`, `test@okicici` |
| IFSC Code | `PYTM0123456`, `HDFC0001234`, `ICIC0001234` |
| Phone | `911234567890`, `919876543210` |
| Amount | `100` (₹100 = 10000 paisa) |

### Invalid Test Values (should be rejected)

| Field | Invalid Example |
|-------|----------------|
| UPI ID | `user@`, `@paytm`, `user` |
| IFSC Code | `PYTM123456`, `pytm0123456`, `12345678901` |
| Phone | `12345`, `91234567890` |

---

## Database Verification Queries

```sql
-- Check all deposits
SELECT id, user_id, amount, status, gateway_reference
FROM deposit
ORDER BY created_at DESC
LIMIT 10;

-- Check all withdrawals
SELECT id, user_id, amount, status, utr_number
FROM withdrawal
ORDER BY created_at DESC
LIMIT 10;

-- Check transaction history
SELECT id, user_id, type, amount, status, balance_before, balance_after
FROM transaction
ORDER BY created_at DESC
LIMIT 10;

-- Check user balances
SELECT id, username, balance, balance_version
FROM user
ORDER BY balance DESC
LIMIT 10;

-- Verify transaction integrity
SELECT
  t.id,
  t.type,
  t.amount,
  t.balance_before,
  t.balance_after,
  (t.balance_after::numeric - t.balance_before::numeric) as expected_delta,
  CASE
    WHEN t.type IN ('deposit', 'win', 'bonus', 'refund') THEN t.amount
    WHEN t.type IN ('withdraw', 'bet', 'adjustment') THEN (-t.amount::numeric)
  END as signed_amount
FROM transaction t
WHERE t.status = 'completed'
LIMIT 10;
```

---

## Troubleshooting

### Deposit Not Credited

1. Check webhook logs: `grep VELOPAY /path/to/logs`
2. Verify signature is correct
3. Check deposit status in database
4. Verify transaction record exists

### Withdrawal Failed

1. Check VeloPay dashboard for error
2. Verify UPI ID is valid
3. Check if balance was refunded
4. Review withdrawal status in database

### Signature Verification Failing

1. Verify secret key matches VeloPay dashboard
2. Check parameter sorting is correct
3. Ensure all non-empty parameters are included
4. Verify MD5 hash generation

---

## Performance Testing

### Load Test Deposits

```bash
# Simulate 100 deposit requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/trpc/transaction.initiateDeposit \
    -H "Content-Type: application/json" \
    -d "{\"amount\":\"100\",\"method\":\"upi\",\"clientProvidedKey\":\"test-$i\"}"
  echo "Request $i sent"
done
```

### Check Idempotency

All 100 requests should use unique keys. If you repeat with same key, only first should succeed.

---

## Security Checklist

- [ ] IP whitelist configured (13.201.70.222)
- [ ] Signature verification working
- [ ] Callback returns "SUCCESS"
- [ ] No sensitive data in logs
- [ ] Rate limiting enabled
- [ ] Idempotency working
- [ ] Balance atomic updates
- [ ] Transaction audit trail complete

---

## Production Testing Checklist

Before going live:

- [ ] Test with real UPI payment (₹10 minimum)
- [ ] Test withdrawal to real bank account
- [ ] Verify callback works from production domain
- [ ] Test SSL certificate is valid
- [ ] Monitor webhook logs for 1 hour
- [ ] Verify all test transactions are recorded
- [ ] Check balance calculations are correct
- [ ] Test refund on withdrawal failure
- [ ] Verify idempotency prevents duplicates
- [ ] Load test with 100 concurrent requests

---

## Test Results Summary

### Automated Tests: ✅ 6/6 Passed

| Test | Status |
|------|--------|
| Signature Generation | ✅ Pass |
| Amount Conversion | ✅ Pass |
| UPI Validation | ✅ Pass |
| Deposit Format | ✅ Pass |
| Withdrawal Format | ✅ Pass |
| Callback Verification | ✅ Pass |

### Manual Tests: Pending

- [ ] Real deposit with UPI
- [ ] Real withdrawal to bank
- [ ] Webhook from production IP
- [ ] Error handling scenarios
- [ ] Load testing

---

## Next Steps

1. ✅ Automated tests passing
2. ⏳ Configure production environment variables
3. ⏳ Set up production domain and SSL
4. ⏳ Whitelist callback IP
5. ⏳ Perform real payment tests
6. ⏳ Monitor production logs
7. ⏳ Go live! 🚀
