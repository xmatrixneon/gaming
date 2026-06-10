# OKPay India UPI Integration Design

**Date**: 2025-06-18
**Author**: Design Specification
**Status**: Approved

---

## Overview

Integration of OKPay payment gateway for UPI India deposits and withdrawals, complementing the existing VeloPay integration. OKPay provides two UPI payment modes: web-based redirect (UPI) and native mobile deep link (UPI_INTENT), plus bank transfer withdrawals.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Transaction Router                        │
│  (server/routers/transaction.ts)                           │
└──────────────┬────────────────────────┬─────────────────────┘
               │                        │
        ┌──────▼──────┐          ┌─────▼─────┐
        │   VeloPay   │          │   OKPay   │
        │   Gateway   │          │  Gateway  │
        └─────────────┘          └──────┬────┘
                                       │
                              ┌────────▼────────┐
                              │ OKPay Webhooks  │
                              │ /api/webhook/   │
                              │ okpay/{deposit  │
                              │ |withdrawal}    │
                              └─────────────────┘
```

### Design Principles

1. **Separation of Concerns**: Each gateway handles its own logic independently
2. **Consistency**: Database schema and wallet service remain unchanged
3. **User Control**: Users explicitly choose their preferred gateway
4. **Environment Flexibility**: Easy switching between sandbox and production
5. **Comprehensive Error Handling**: Clear error mapping for all OKPay error codes

---

## Implementation Details

### 1. OKPay Gateway Class

**File**: `lib/okpay-gateway.ts`

**Class Structure**:

```typescript
export class OkpayGateway {
  private readonly config = {
    host: string,           // Environment-dependent
    mchId: string,          // Merchant ID
    key: string,            // Secret key for signing
    currency: 'INR',        // Fixed currency
  };

  // Core Methods
  generateSignature(params: Record<string, any>): string;
  verifyCallbackSignature(payload: OkpayCallbackPayload): boolean;

  // Deposit Operations
  async createDeposit(request: OkpayDepositRequest): Promise<OkpayDepositResponse>;
  
  // Withdrawal Operations  
  async createWithdrawal(request: OkpayWithdrawalRequest): Promise<OkpayWithdrawalResponse>;

  // Utility Methods
  inrToPaisa(amountInINR: number): string;      // Multiply by 100
  paisaToINR(amountInPaisa: string): number;   // Divide by 100
}
```

**Key Differences from VeloPay**:

| Feature | VeloPay | OKPay |
|---------|---------|-------|
| Content-Type | JSON | application/x-www-form-urlencoded |
| Signing | MD5 only | MD5 + URL encoding + lowercase |
| Payment Types | UPI QR, H5 link | UPI (web), UPI_INTENT (native) |
| Amount Format | Paisa (10000 = ₹100) | Direct rupees (100 = ₹100) |
| Callback Response | JSON | Plain text "success" |

**Signature Algorithm**:

1. Filter out null/undefined/empty values
2. Sort parameters alphabetically (case-sensitive)
3. URL-encode each parameter
4. Join as `key1=value1&key2=value2`
5. Append `&key={secretKey}`
6. Generate MD5 hash
7. Convert to lowercase

**Example**:
```typescript
// Input: { mchId: "1000", money: "100", out_trade_no: "12345" }
// Step 1-3: mchId=1000&money=100&out_trade_no=12345
// Step 4: mchId=1000&money=100&out_trade_no=12345&key=eb6080...
// Step 5-6: MD5 hash → lowercase
```

### 2. Payment Methods

**Updated Methods** in `server/routers/transaction.ts`:

```typescript
method: z.enum([
  // Existing VeloPay methods
  'upi',           // VeloPay UPI
  'paytm',         // VeloPay Paytm
  'phonepe',       // VeloPay PhonePe
  
  // New OKPay methods
  'okpay-upi',     // OKPay web redirect
  'okpay-intent',  // OKPay native deep link
  
  // Other methods
  'bank_transfer', // Bank transfer
  'crypto'         // Crypto deposits
])
```

**Method Routing Logic**:

```typescript
// In initiateDeposit procedure
if (['okpay-upi', 'okpay-intent'].includes(input.method)) {
  // Route to OKPay gateway
  const payType = input.method === 'okpay-upi' ? 'UPI' : 'UPI_INTENT';
  // ... OKPay integration
}
```

### 3. Webhook Endpoints

**Files**:
- `app/api/webhook/okpay/deposit/route.ts`
- `app/api/webhook/okpay/withdrawal/route.ts`

**Deposit Webhook Implementation**:

```typescript
export async function POST(request: Request) {
  try {
    const payload = await request.formData();
    
    // 1. Verify signature
    const okpayGateway = new OkpayGateway();
    if (!okpayGateway.verifyCallbackSignature(payload)) {
      return new Response('FAILED', { status: 400 });
    }
    
    // 2. Extract data
    const { out_trade_no, transaction_Id, status, money } = payload;
    
    // 3. Update transaction
    await walletService.updateBalanceAtomic(userId, amount, 'deposit', metadata);
    
    // 4. Return plain text (CRITICAL - not JSON!)
    return new Response('success', { status: 200 });
    
  } catch (error) {
    console.error('[OKPAY] Deposit callback failed:', error);
    return new Response('FAILED', { status: 500 });
  }
}
```

**Critical Requirement**: Must return plain text `success` (not the string "success", not JSON object). OKPay will retry if response is not exactly "success".

### 4. Environment Configuration

**Environment Variables** (add to `.env.local`):

```bash
# OKPay Configuration
OKPAY_MODE=sandbox                                    # sandbox | production
OKPAY_HOST=https://okpay.com                          # Production host
OKPAY_MCH_ID=1000                                     # Merchant ID
OKPAY_KEY=eb6080dbc8dc429ab86a1cd1c337975d            # Secret key
OKPAY_CALLBACK_URL=https://clausbet.com/api/webhook/okpay  # Base callback URL
```

**Environment Switching Logic**:

```typescript
const OKPAY_CONFIG = {
  host: process.env.OKPAY_MODE === 'sandbox'
    ? 'https://sandbox.wpay.one'
    : process.env.OKPAY_HOST || 'https://okpay.com',
  // ... other config
};
```

### 5. Error Handling

**Comprehensive Error Code Mapping**:

```typescript
private mapOkpayError(code: number): { code: string; message: string } {
  const errorMap = {
    0:  { code: 'OK', message: 'Success' },
    1:  { code: 'INTERNAL_ERROR', message: 'General failure' },
    2:  { code: 'BAD_REQUEST', message: 'Invalid merchant ID' },
    3:  { code: 'NOT_FOUND', message: 'Account does not exist' },
    4:  { code: 'FORBIDDEN', message: 'Account status abnormal' },
    5:  { code: 'UNAUTHORIZED', message: 'Invalid signature' },
    6:  { code: 'CONFLICT', message: 'Order already exists' },
    7:  { code: 'NOT_FOUND', message: 'Order does not exist' },
    8:  { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    9:  { code: 'BAD_REQUEST', message: 'Insufficient gateway balance' },
    10: { code: 'BAD_REQUEST', message: 'Invalid amount format' },
    11: { code: 'SERVICE_UNAVAILABLE', message: 'Payment channel under maintenance' },
    12: { code: 'BAD_REQUEST', message: 'Currency not supported' },
    13: { code: 'NOT_FOUND', message: 'Payment channel does not exist' },
    15: { code: 'INTERNAL_ERROR', message: 'Payment channel failed' },
    16: { code: 'FORBIDDEN', message: 'IP not whitelisted - contact support' },
    17: { code: 'BAD_REQUEST', message: 'Bank does not exist' },
  };
  
  return errorMap[code] || { code: 'INTERNAL_ERROR', message: 'Unknown error' };
}
```

**Retry Strategy**:

- **Transient Errors** (network, timeout): Retry up to 3 times with exponential backoff (100ms → 500ms → 1000ms)
- **Permanent Errors** (signature, invalid amount): Fail immediately with clear user message
- **Critical Errors** (IP whitelist, account status): Alert admin, don't retry

### 6. Amount Conversion

**Conversion Logic**:

```typescript
// OKPay uses direct rupees: 100 = ₹100
// System uses paisa: 10000 = ₹100

inrToPaisa(amountInINR: number): string {
  // Convert ₹100 → 10000 paisa
  return Math.round(amountInINR * 100).toString();
}

paisaToINR(amountInPaisa: string): number {
  // Convert 10000 paisa → ₹100
  return parseInt(amountInPaisa, 10) / 100;
}
```

**Example Flow**:
```
User deposits ₹100
  → OKPay receives money=100
  → Gateway converts: 100 * 100 = 10000
  → Database stores: 10000 paisa
  → Wallet balance: +10000 paisa (₹100)
```

### 7. Database Schema

**No Schema Changes Required** ✅

**Usage**:
- Existing `deposit` and `withdrawal` tables work as-is
- OKPay-specific data stored in `gatewayMetadata` JSON field
- Amounts stored in paisa (multiplied by 100)

**Example `gatewayMetadata`**:
```json
{
  "gateway": "okpay",
  "transaction_Id": "f9292301eeb64a3eacd19bdc45ab3f37",
  "pay_type": "UPI",
  "okpay_response": { ... }
}
```

### 8. Transaction Flows

#### Deposit Flow

```
1. User initiates deposit with method='okpay-upi'
   ↓
2. Transaction router validates input and fraud checks
   ↓
3. Create deposit record (status='pending')
   ↓
4. OKPay Gateway creates order:
   - Generate signature
   - Call /v1/Collect endpoint
   - Receive payment URL
   ↓
5. Return payment URL to user
   ↓
6. User completes UPI payment
   ↓
7. OKPay sends callback to /api/webhook/okpay/deposit
   ↓
8. Webhook verifies signature
   ↓
9. Credit user balance (atomic update)
   ↓
10. Update deposit status to 'completed'
    ↓
11. Return plain text "success"
```

#### Withdrawal Flow

```
1. User requests withdrawal with method='okpay-bank'
   ↓
2. Transaction router validates balance and details
   ↓
3. Debit user balance (atomic update)
   ↓
4. Create withdrawal record (status='pending')
   ↓
5. OKPay Gateway creates payout:
   - Generate signature
   - Call /v1/Payout endpoint
   - Provide bank details (account, IFSC, name)
   ↓
6. OKPay processes bank transfer
   ↓
7. OKPay sends callback to /api/webhook/okpay/withdrawal
   ↓
8. Update withdrawal status to 'completed'
   ↓
9. Return plain text "success"
```

---

## API Specifications

### OKPay Deposit Request

**Endpoint**: `POST /v1/Collect`

**Parameters**:
```typescript
{
  mchId: string;           // Merchant ID
  currency: 'INR';         // Fixed currency
  out_trade_no: string;    // Unique order number
  pay_type: 'UPI' | 'UPI_INTENT';  // Payment type
  money: string;           // Amount in rupees (no decimals)
  attach?: string;         // Additional data (returned as-is)
  notify_url: string;      // Callback URL
  returnUrl: string;       // Success redirect URL
  phone?: string;          // Phone number (required for UPI_INTENT)
  sign: string;            // MD5 signature
}
```

**Response**:
```typescript
{
  code: number;            // 0 = success
  msg: string;             // "success"
  data: {
    url: string;           // Payment URL
    transaction_Id: string;// Platform transaction ID
  }
}
```

### OKPay Withdrawal Request

**Endpoint**: `POST /v1/Payout`

**Parameters**:
```typescript
{
  mchId: string;           // Merchant ID
  currency: 'INR';         // Fixed currency
  out_trade_no: string;    // Unique order number
  pay_type: 'BANK';        // Payment type
  account: string;         // Bank account number
  userName: string;        // Account holder name
  money: string;           // Amount in rupees
  attach?: string;         // Additional data
  notify_url: string;      // Callback URL
  reserve1: string;        // IFSC code
  sign: string;            // MD5 signature
}
```

**Response**:
```typescript
{
  code: number;            // 0 = success
  msg: string;             // "success"
  data: {
    transaction_Id: string;// Platform transaction ID
  }
}
```

---

## Testing Strategy

### Sandbox Configuration

**Test Credentials** (from OKPay docs):
```bash
OKPAY_MODE=sandbox
OKPAY_HOST=https://sandbox.wpay.one
OKPAY_MCH_ID=1000
OKPAY_KEY=eb6080dbc8dc429ab86a1cd1c337975d
```

### Test Scenarios

#### Deposit Tests

1. **Successful UPI Deposit**
   - Create deposit with `pay_type='UPI'`
   - Expect: Payment URL returned
   - Wait ~10 seconds
   - Verify: Balance credited, deposit status='completed'

2. **Successful UPI_INTENT Deposit**
   - Create deposit with `pay_type='UPI_INTENT'`
   - Include valid phone number
   - Expect: Deep link URL returned
   - Wait ~10 seconds
   - Verify: Balance credited, deposit status='completed'

3. **Invalid Signature**
   - Send request with incorrect signature
   - Expect: Error code 5, "Invalid signature"

4. **Duplicate Order**
   - Create two orders with same `out_trade_no`
   - Expect: Error code 6, "Order already exists"

#### Withdrawal Tests

1. **Successful Withdrawal (Even Order ID)**
   - Create withdrawal ending in even number
   - Expect: transaction_Id returned
   - Wait for callback
   - Verify: Withdrawal status='completed'

2. **Failed Withdrawal (Odd Order ID)**
   - Create withdrawal ending in odd number
   - Expect: transaction_Id returned
   - Wait for callback
   - Verify: Withdrawal status='failed', balance refunded

3. **Insufficient Balance**
   - Request withdrawal exceeding balance
   - Expect: Error before OKPay call

4. **Invalid IFSC**
   - Provide invalid IFSC code
   - Expect: Error code 17, "Bank does not exist"

---

## Security Considerations

### Signature Verification

- All callbacks must verify OKPay signature
- Reject callbacks with invalid signatures
- Log all signature verification failures

### IP Whitelist

- Production requires IP whitelisting (error code 16)
- Contact OKPay support to whitelist server IPs
- Test IP whitelist in sandbox if available

### Data Protection

- Never log full OKPay secret key
- Mask sensitive data in logs (account numbers)
- Store only transaction reference in database

### Idempotency

- Use `out_trade_no` as idempotency key
- Check for existing orders before creating new ones
- Handle error code 6 (order already exists) gracefully

---

## Rollout Plan

### Phase 1: Development (Sandbox)
- Implement OKPay gateway class
- Create webhook endpoints
- Test all scenarios in sandbox
- Verify signature generation/verification

### Phase 2: Integration Testing
- Test with existing transaction router
- Verify error handling
- Test amount conversion accuracy
- Check webhook response format

### Phase 3: Production Setup
- Obtain production credentials
- Whitelist production IP
- Update environment variables
- Deploy with `OKPAY_MODE=production`

### Phase 4: Monitoring
- Monitor transaction success rates
- Track error code frequencies
- Compare OKPay vs VeloPay performance
- Gather user feedback

---

## Success Criteria

✅ **Functional Requirements**:
- Users can select OKPay as payment method
- Deposits process correctly via UPI and UPI_INTENT
- Withdrawals process correctly via bank transfer
- Webhooks receive and process callbacks
- All OKPay error codes mapped correctly

✅ **Non-Functional Requirements**:
- Signature verification prevents fraud
- Amount conversion maintains precision
- Error messages are clear and actionable
- Gateway switch is seamless (sandbox ↔ production)
- Code follows existing VeloPay patterns

✅ **Testing Requirements**:
- All sandbox test scenarios pass
- Error handling verified for all 17 error codes
- Webhook returns exactly "success" (plain text)
- Amount conversion accuracy: ±0 paisa

---

## Future Enhancements

**Potential Future Features**:
1. **Analytics Dashboard**: Compare OKPay vs VeloPay performance
2. **Smart Routing**: Automatically route to best-performing gateway
3. **Additional Payment Types**: Add other OKPay-supported methods
4. **Webhook Retry Queue**: Handle delayed or failed webhook deliveries
5. **Real-time Status Updates**: WebSocket updates for payment status

---

## Appendix: OKPay API Reference

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 0 | Success | Proceed |
| 1 | Failure | Retry or log |
| 2 | mchId error | Check configuration |
| 3 | Account doesn't exist | Contact OKPay support |
| 4 | Account status abnormal | Contact OKPay support |
| 5 | Signature error | Fix signing logic |
| 6 | Order already exists | Use new order number |
| 7 | Order doesn't exist | Check order number |
| 8 | Insufficient permissions | Contact OKPay support |
| 9 | Insufficient balance | Add funds to OKPay account |
| 10 | Amount error | Check amount format |
| 11 | Channel maintenance | Wait or use alternative |
| 12 | Currency doesn't exist | Check currency code |
| 13 | Channel doesn't exist | Check pay_type |
| 15 | Channel failed | Retry or use alternative |
| 16 | IP error | Whitelist IP with support |
| 17 | Bank doesn't exist | Check IFSC code |

### Order Status Codes

| Status | Description |
|--------|-------------|
| 0 | Pending payment |
| 1 | Payment successful |
| 2 | Payment failed |

---

**End of Design Document**
