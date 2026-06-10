# OKPay India UPI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate OKPay payment gateway for UPI India deposits and withdrawals, providing users with an alternative to VeloPay.

**Architecture:** Create a dedicated OKPay gateway class following the VeloPay pattern, with separate webhook endpoints for deposits/withdrawals. Amount conversion handled in gateway (INR → paisa). Users explicitly select OKPay payment methods.

**Tech Stack:** TypeScript, Next.js 16, tRPC, Drizzle ORM, MD5 signature generation, URL encoding

---

## File Structure

**New Files:**
- `lib/okpay-gateway.ts` - OKPay gateway class with signature generation, deposit/withdrawal methods
- `app/api/webhook/okpay/deposit/route.ts` - Deposit callback handler
- `app/api/webhook/okpay/withdrawal/route.ts` - Withdrawal callback handler
- `lib/__tests__/okpay-gateway.test.ts` - Gateway unit tests

**Modified Files:**
- `server/routers/transaction.ts` - Add OKPay payment methods and routing logic
- `.env.example` - Add OKPay environment variables

---

## Task 1: Add OKPay Environment Variables to Example File

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add OKPay environment variables**

```bash
# OKPay Configuration
# Mode: sandbox for testing, production for live
OKPAY_MODE=sandbox

# OKPay Gateway Host (production URL)
OKPAY_HOST=https://okpay.com

# Merchant Credentials (obtain from OKPay)
OKPAY_MCH_ID=your_merchant_id
OKPAY_KEY=your_secret_key

# Base callback URL
OKPAY_CALLBACK_URL=https://yourdomain.com/api/webhook/okpay
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add OKPay environment variables to example file"
```

---

## Task 2: Create OKPay Gateway Class Structure

**Files:**
- Create: `lib/okpay-gateway.ts`

- [ ] **Step 1: Write failing test for gateway initialization**

```typescript
// lib/__tests__/okpay-gateway.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OkpayGateway } from '../okpay-gateway';

describe('OkpayGateway', () => {
  let gateway: OkpayGateway;

  beforeEach(() => {
    // Set test environment variables
    process.env.OKPAY_MODE = 'sandbox';
    process.env.OKPAY_HOST = 'https://okpay.com';
    process.env.OKPAY_MCH_ID = '1000';
    process.env.OKPAY_KEY = 'eb6080dbc8dc429ab86a1cd1c337975d';
    process.env.OKPAY_CALLBACK_URL = 'https://test.com/api/webhook/okpay';
    
    gateway = new OkpayGateway();
  });

  it('should initialize with correct config', () => {
    const config = gateway.getConfig();
    
    expect(config.host).toBe('https://sandbox.wpay.one');
    expect(config.mchId).toBe('1000');
    expect(config.currency).toBe('INR');
  });

  it('should use production host when OKPAY_MODE=production', () => {
    process.env.OKPAY_MODE = 'production';
    const prodGateway = new OkpayGateway();
    const config = prodGateway.getConfig();
    
    expect(config.host).toBe('https://okpay.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts`
Expected: FAIL with "Cannot find module '../okpay-gateway'"

- [ ] **Step 3: Create minimal gateway class to pass initialization test**

```typescript
// lib/okpay-gateway.ts

export interface OkpayConfig {
  host: string;
  mchId: string;
  key: string;
  currency: string;
  callbackUrl: string;
}

export class OkpayGateway {
  private readonly config: OkpayConfig;

  constructor() {
    this.config = {
      host: this.getHost(),
      mchId: process.env.OKPAY_MCH_ID || '',
      key: process.env.OKPAY_KEY || '',
      currency: 'INR',
      callbackUrl: process.env.OKPAY_CALLBACK_URL || '',
    };
  }

  private getHost(): string {
    const mode = process.env.OKPAY_MODE || 'sandbox';
    if (mode === 'sandbox') {
      return 'https://sandbox.wpay.one';
    }
    return process.env.OKPAY_HOST || 'https://okpay.com';
  }

  getConfig() {
    return {
      host: this.config.host,
      mchId: this.config.mchId,
      currency: this.config.currency,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: create OKPay gateway class structure with environment-based config"
```

---

## Task 3: Implement MD5 Signature Generation

**Files:**
- Modify: `lib/okpay-gateway.ts`
- Test: `lib/__tests__/okpay-gateway.test.ts`

- [ ] **Step 1: Write failing test for signature generation**

```typescript
// lib/__tests__/okpay-gateway.test.ts

describe('generateSignature', () => {
  it('should generate correct MD5 signature', () => {
    const params = {
      mchId: '1000',
      currency: 'INR',
      out_trade_no: '20211012151100001',
      pay_type: 'UPI',
      money: '100',
    };
    
    // Known test signature from OKPay docs
    const signature = gateway.generateSignature(params);
    
    // Should be 32 character lowercase hex string
    expect(signature).toMatch(/^[a-f0-9]{32}$/);
    expect(signature.length).toBe(32);
  });

  it('should sort parameters alphabetically before signing', () => {
    const params = {
      z: 'last',
      a: 'first',
      m: 'middle',
    };
    
    const signature1 = gateway.generateSignature(params);
    const signature2 = gateway.generateSignature({ ...params }); // Different order
    
    expect(signature1).toBe(signature2);
  });

  it('should filter out null and undefined values', () => {
    const params1 = { a: '1', b: '2', c: null };
    const params2 = { a: '1', b: '2' };
    
    const sig1 = gateway.generateSignature(params1);
    const sig2 = gateway.generateSignature(params2);
    
    expect(sig1).toBe(sig2);
  });

  it('should filter out empty strings', () => {
    const params1 = { a: '1', b: '2', c: '' };
    const params2 = { a: '1', b: '2' };
    
    const sig1 = gateway.generateSignature(params1);
    const sig2 = gateway.generateSignature(params2);
    
    expect(sig1).toBe(sig2);
  });

  it('should exclude sign parameter from signature calculation', () => {
    const params = {
      a: '1',
      b: '2',
      sign: 'should_be_ignored',
    };
    
    const sig1 = gateway.generateSignature(params);
    const sig2 = gateway.generateSignature({ a: '1', b: '2' });
    
    expect(sig1).toBe(sig2);
  });

  it('should URL-encode parameters before signing', () => {
    const params = {
      name: 'Zhang San', // Space should be encoded
      email: 'test@example.com',
    };
    
    const signature = gateway.generateSignature(params);
    
    // Should not fail and should be deterministic
    expect(signature).toMatch(/^[a-f0-9]{32}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="generateSignature"`
Expected: FAIL with "gateway.generateSignature is not a function"

- [ ] **Step 3: Implement signature generation**

```typescript
// lib/okpay-gateway.ts

import { createHash } from 'crypto';

export class OkpayGateway {
  // ... existing code ...

  /**
   * Generate MD5 signature for OKPay API requests
   * 
   * Process:
   * 1. Filter out null/undefined/empty values
   * 2. Remove 'sign' parameter if present
   * 3. Sort keys alphabetically (case-sensitive)
   * 4. URL-encode each parameter
   * 5. Join as key1=value1&key2=value2
   * 6. Append &key={secretKey}
   * 7. Generate MD5 hash
   * 8. Convert to lowercase
   */
  generateSignature(params: Record<string, any>): string {
    // Remove sign from params if present
    const { sign, ...paramsToSign } = params;

    // Filter out null/undefined/empty values
    const filteredParams = Object.entries(paramsToSign)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // Sort keys alphabetically (case-sensitive)
    const sortedKeys = Object.keys(filteredParams).sort();

    // URL-encode and build signature string
    const signatureString = sortedKeys
      .map((key) => {
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(filteredParams[key]);
        return `${encodedKey}=${encodedValue}`;
      })
      .join('&') + `&key=${this.config.key}`;

    // Generate MD5 hash and convert to lowercase
    return createHash('md5').update(signatureString).digest('hex').toLowerCase();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="generateSignature"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: implement OKPay MD5 signature generation with URL encoding"
```

---

## Task 4: Implement Signature Verification

**Files:**
- Modify: `lib/okpay-gateway.ts`
- Test: `lib/__tests__/okpay-gateway.test.ts`

- [ ] **Step 1: Write failing test for signature verification**

```typescript
// lib/__tests__/okpay-gateway.test.ts

import { OkpayCallbackPayload } from '../okpay-gateway';

describe('verifyCallbackSignature', () => {
  it('should verify valid callback signature', () => {
    const payload: OkpayCallbackPayload = {
      mchId: '1000',
      out_trade_no: '12345',
      transaction_Id: 'abc123',
      status: '1',
      money: '100',
      sign: '', // Will be generated
    };
    
    // Generate valid signature
    payload.sign = gateway.generateSignature(payload);
    
    const isValid = gateway.verifyCallbackSignature(payload);
    expect(isValid).toBe(true);
  });

  it('should reject invalid callback signature', () => {
    const payload: OkpayCallbackPayload = {
      mchId: '1000',
      out_trade_no: '12345',
      transaction_Id: 'abc123',
      status: '1',
      money: '100',
      sign: 'invalid_signature_0123456789abcdef',
    };
    
    const isValid = gateway.verifyCallbackSignature(payload);
    expect(isValid).toBe(false);
  });

  it('should reject signature with different parameters', () => {
    const payload1: OkpayCallbackPayload = {
      mchId: '1000',
      out_trade_no: '12345',
      transaction_Id: 'abc123',
      status: '1',
      money: '100',
    };
    payload1.sign = gateway.generateSignature(payload1);
    
    const payload2: OkpayCallbackPayload = {
      ...payload1,
      money: '200', // Different amount
      sign: payload1.sign, // Original signature
    };
    
    const isValid = gateway.verifyCallbackSignature(payload2);
    expect(isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="verifyCallbackSignature"`
Expected: FAIL with "gateway.verifyCallbackSignature is not a function"

- [ ] **Step 3: Add type and implement signature verification**

```typescript
// lib/okpay-gateway.ts

export interface OkpayCallbackPayload {
  mchId: string;
  out_trade_no: string;
  transaction_Id: string;
  status: string;
  money: string;
  attach?: string;
  sign: string;
}

export class OkpayGateway {
  // ... existing code ...

  /**
   * Verify callback signature
   * @param payload - Callback payload with sign
   * @returns True if signature is valid
   */
  verifyCallbackSignature(payload: OkpayCallbackPayload): boolean {
    const { sign: receivedSign, ...paramsToVerify } = payload;
    const calculatedSign = this.generateSignature(paramsToVerify);
    return receivedSign === calculatedSign;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="verifyCallbackSignature"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: implement OKPay callback signature verification"
```

---

## Task 5: Implement Amount Conversion (INR ↔ Paisa)

**Files:**
- Modify: `lib/okpay-gateway.ts`
- Test: `lib/__tests__/okpay-gateway.test.ts`

- [ ] **Step 1: Write failing tests for amount conversion**

```typescript
// lib/__tests__/okpay-gateway.test.ts

describe('Amount Conversion', () => {
  it('should convert INR to paisa correctly', () => {
    expect(gateway.inrToPaisa(100)).toBe('10000');
    expect(gateway.inrToPaisa(1)).toBe('100');
    expect(gateway.inrToPaisa(0.5)).toBe('50');
    expect(gateway.inrToPaisa(999.99)).toBe('99999');
  });

  it('should convert paisa to INR correctly', () => {
    expect(gateway.paisaToINR('10000')).toBe(100);
    expect(gateway.paisaToINR('100')).toBe(1);
    expect(gateway.paisaToINR('50')).toBe(0.5);
    expect(gateway.paisaToINR('99999')).toBe(999.99);
  });

  it('should handle string input for INR conversion', () => {
    expect(gateway.inrToPaisa('100')).toBe('10000');
    expect(gateway.inrToPaisa('99.99')).toBe('9999');
  });

  it('should round to nearest paisa', () => {
    expect(gateway.inrToPaisa(100.999)).toBe('10100'); // Rounds up
    expect(gateway.inrToPaisa(100.494)).toBe('10049'); // Rounds down
    expect(gateway.inrToPaisa(100.495)).toBe('10050'); // Rounds up (half-up)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="Amount Conversion"`
Expected: FAIL with method not found errors

- [ ] **Step 3: Implement amount conversion methods**

```typescript
// lib/okpay-gateway.ts

export class OkpayGateway {
  // ... existing code ...

  /**
   * Convert amount from INR to paisa (OKPay format to system format)
   * OKPay uses rupees: 100 = ₹100
   * System uses paisa: 10000 = ₹100
   * @param amountInINR - Amount in INR (number or string)
   * @returns Amount in paisa as string
   */
  inrToPaisa(amountInINR: number | string): string {
    const amount = typeof amountInINR === 'string'
      ? parseFloat(amountInINR)
      : amountInINR;
    return Math.round(amount * 100).toString();
  }

  /**
   * Convert amount from paisa to INR (system format to OKPay format)
   * @param amountInPaisa - Amount in paisa (string)
   * @returns Amount in INR as number
   */
  paisaToINR(amountInPaisa: string): number {
    const amount = parseInt(amountInPaisa, 10);
    return amount / 100;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="Amount Conversion"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: implement INR to paisa amount conversion for OKPay"
```

---

## Task 6: Define API Types for OKPay

**Files:**
- Modify: `lib/okpay-gateway.ts`

- [ ] **Step 1: Add TypeScript types for OKPay API**

```typescript
// lib/okpay-gateway.ts

// ============================================================================
// TYPES
// ============================================================================

export interface OkpayDepositRequest {
  out_trade_no: string;      // Unique merchant order number
  pay_type: 'UPI' | 'UPI_INTENT';  // Payment type
  money: string;              // Amount in rupees (no decimals)
  attach?: string;            // Additional data (returned as-is)
  notify_url?: string;        // Callback URL (optional, uses default)
  returnUrl: string;         // Success redirect URL
  phone?: string;             // Phone number (required for UPI_INTENT)
}

export interface OkpayDepositResponse {
  code: number;               // 0 = success
  msg: string;                // "success"
  data: {
    url: string;              // Payment URL
    transaction_Id: string;  // Platform transaction ID
  };
}

export interface OkpayWithdrawalRequest {
  out_trade_no: string;       // Unique merchant order number
  pay_type: 'BANK';          // Payment type
  account: string;            // Bank account number
  userName: string;           // Account holder name
  money: string;              // Amount in rupees
  attach?: string;            // Additional data
  notify_url?: string;        // Callback URL (optional, uses default)
  reserve1: string;           // IFSC code
}

export interface OkpayWithdrawalResponse {
  code: number;               // 0 = success
  msg: string;                // "success"
  data: {
    transaction_Id: string;  // Platform transaction ID
  };
}

export interface OkpayCallbackPayload {
  mchId: string;
  out_trade_no: string;
  transaction_Id: string;
  status: string;             // 0=pending, 1=success, 2=failed
  money: string;
  attach?: string;
  sign: string;
}

// Keep existing types...
```

- [ ] **Step 2: Commit**

```bash
git add lib/okpay-gateway.ts
git commit -m "types: add OKPay API request/response types"
```

---

## Task 7: Implement Deposit Request Creation

**Files:**
- Modify: `lib/okpay-gateway.ts`
- Test: `lib/__tests__/okpay-gateway.test.ts`

- [ ] **Step 1: Write failing test for deposit creation**

```typescript
// lib/__tests__/okpay-gateway.test.ts

import { vi } from 'vitest';

describe('createDeposit', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it('should create UPI deposit request successfully', async () => {
    const mockResponse = {
      code: 0,
      msg: 'success',
      data: {
        url: 'https://domain/Cashier/Index/test123',
        transaction_Id: 'f9292301eeb64a3eacd19bdc45ab3f37',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await gateway.createDeposit({
      out_trade_no: '12345',
      pay_type: 'UPI',
      money: '100',
      returnUrl: 'https://example.com/success',
    });

    expect(result.code).toBe(0);
    expect(result.data.url).toBe(mockResponse.data.url);
    expect(result.data.transaction_Id).toBe(mockResponse.data.transaction_Id);
  });

  it('should create UPI_INTENT deposit request with phone', async () => {
    const mockResponse = {
      code: 0,
      msg: 'success',
      data: {
        url: 'https://domain/Cashier/Index/test123',
        transaction_Id: 'f9292301eeb64a3eacd19bdc45ab3f37',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await gateway.createDeposit({
      out_trade_no: '12345',
      pay_type: 'UPI_INTENT',
      money: '100',
      phone: '9876543210',
      returnUrl: 'https://example.com/success',
    });

    expect(result.code).toBe(0);
    expect(result.data.url).toBeDefined();
  });

  it('should include signature in request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, msg: 'success', data: { url: 'test', transaction_Id: 'abc' } }),
    });

    await gateway.createDeposit({
      out_trade_no: '12345',
      pay_type: 'UPI',
      money: '100',
      returnUrl: 'https://example.com/success',
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = fetchCall[1].body;
    
    expect(requestBody).toContain('sign=');
  });

  it('should throw error on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
    });

    await expect(gateway.createDeposit({
      out_trade_no: '12345',
      pay_type: 'UPI',
      money: '100',
      returnUrl: 'https://example.com/success',
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="createDeposit"`
Expected: FAIL with "gateway.createDeposit is not a function"

- [ ] **Step 3: Implement deposit creation**

```typescript
// lib/okpay-gateway.ts

export class OkpayGateway {
  // ... existing code ...

  /**
   * Create deposit request (payin)
   * @param depositRequest - Deposit parameters
   * @returns Deposit response with payment URL
   */
  async createDeposit(
    depositRequest: OkpayDepositRequest
  ): Promise<OkpayDepositResponse> {
    const params = {
      mchId: this.config.mchId,
      currency: this.config.currency,
      out_trade_no: depositRequest.out_trade_no,
      pay_type: depositRequest.pay_type,
      money: depositRequest.money,
      attach: depositRequest.attach || '',
      notify_url: depositRequest.notify_url || `${this.config.callbackUrl}/deposit`,
      returnUrl: depositRequest.returnUrl,
      phone: depositRequest.phone || '',
    };

    const sign = this.generateSignature(params);

    try {
      const response = await fetch(`${this.config.host}/v1/Collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ ...params, sign }).toString(),
      });

      if (!response.ok) {
        throw new Error(`OKPay deposit failed: ${response.statusText}`);
      }

      const data: OkpayDepositResponse = await response.json();

      if (data.code !== 0) {
        throw new Error(`OKPay deposit error ${data.code}: ${data.msg}`);
      }

      return data;
    } catch (error) {
      console.error('[OKPAY] Deposit request failed:', error);
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="createDeposit"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: implement OKPay deposit request creation"
```

---

## Task 8: Implement Withdrawal Request Creation

**Files:**
- Modify: `lib/okpay-gateway.ts`
- Test: `lib/__tests__/okpay-gateway.test.ts`

- [ ] **Step 1: Write failing test for withdrawal creation**

```typescript
// lib/__tests__/okpay-gateway.test.ts

describe('createWithdrawal', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should create withdrawal request successfully', async () => {
    const mockResponse = {
      code: 0,
      msg: 'success',
      data: {
        transaction_Id: 'aca1ce79d1f64d29ac9d7f3b964d88fb',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await gateway.createWithdrawal({
      out_trade_no: '12345',
      pay_type: 'BANK',
      account: '0235456782',
      userName: 'Zhang San',
      money: '100',
      reserve1: 'IFSC0000000',
    });

    expect(result.code).toBe(0);
    expect(result.data.transaction_Id).toBe(mockResponse.data.transaction_Id);
  });

  it('should include signature in withdrawal request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, msg: 'success', data: { transaction_Id: 'abc' } }),
    });

    await gateway.createWithdrawal({
      out_trade_no: '12345',
      pay_type: 'BANK',
      account: '0235456782',
      userName: 'Zhang San',
      money: '100',
      reserve1: 'IFSC0000000',
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = fetchCall[1].body;
    
    expect(requestBody).toContain('sign=');
  });

  it('should throw error on failed response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 9, msg: 'Insufficient balance' }),
    });

    await expect(gateway.createWithdrawal({
      out_trade_no: '12345',
      pay_type: 'BANK',
      account: '0235456782',
      userName: 'Zhang San',
      money: '100',
      reserve1: 'IFSC0000000',
    })).rejects.toThrow('Insufficient balance');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="createWithdrawal"`
Expected: FAIL with "gateway.createWithdrawal is not a function"

- [ ] **Step 3: Implement withdrawal creation**

```typescript
// lib/okpay-gateway.ts

export class OkpayGateway {
  // ... existing code ...

  /**
   * Create withdrawal request (payout)
   * @param withdrawalRequest - Withdrawal parameters
   * @returns Withdrawal response with transaction ID
   */
  async createWithdrawal(
    withdrawalRequest: OkpayWithdrawalRequest
  ): Promise<OkpayWithdrawalResponse> {
    const params = {
      mchId: this.config.mchId,
      currency: this.config.currency,
      out_trade_no: withdrawalRequest.out_trade_no,
      pay_type: withdrawalRequest.pay_type,
      account: withdrawalRequest.account,
      userName: withdrawalRequest.userName,
      money: withdrawalRequest.money,
      attach: withdrawalRequest.attach || '',
      notify_url: withdrawalRequest.notify_url || `${this.config.callbackUrl}/withdrawal`,
      reserve1: withdrawalRequest.reserve1,
    };

    const sign = this.generateSignature(params);

    try {
      const response = await fetch(`${this.config.host}/v1/Payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ ...params, sign }).toString(),
      });

      if (!response.ok) {
        throw new Error(`OKPay withdrawal failed: ${response.statusText}`);
      }

      const data: OkpayWithdrawalResponse = await response.json();

      if (data.code !== 0) {
        throw new Error(`OKPay withdrawal error ${data.code}: ${data.msg}`);
      }

      return data;
    } catch (error) {
      console.error('[OKPAY] Withdrawal request failed:', error);
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts --testNamePattern="createWithdrawal"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/okpay-gateway.ts lib/__tests__/okpay-gateway.test.ts
git commit -m "feat: implement OKPay withdrawal request creation"
```

---

## Task 9: Export OKPay Gateway Singleton

**Files:**
- Modify: `lib/okpay-gateway.ts`

- [ ] **Step 1: Add singleton export**

```typescript
// lib/okpay-gateway.ts

// At the end of the file:

// ============================================================================
// EXPORTS
// ============================================================================

export const okpayGateway = new OkpayGateway();
```

- [ ] **Step 2: Commit**

```bash
git add lib/okpay-gateway.ts
git commit -m "feat: export OKPay gateway singleton instance"
```

---

## Task 10: Create Deposit Webhook Endpoint

**Files:**
- Create: `app/api/webhook/okpay/deposit/route.ts`

- [ ] **Step 1: Write test for deposit webhook**

```typescript
// app/api/webhook/okpay/__tests__/deposit.test.ts

import { POST } from '../deposit/route';
import { okpayGateway } from '@/lib/okpay-gateway';
import { db } from '@/drizzle';
import { walletService } from '@/lib/wallet-service';

// Mock dependencies
vi.mock('@/lib/okpay-gateway');
vi.mock('@/drizzle');
vi.mock('@/lib/wallet-service');

describe('OKPay Deposit Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request with invalid signature', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(false);

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'invalid',
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('FAILED');
  });

  it('should process successful deposit', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (walletService.updateBalanceAtomic as any).mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('success');
    expect(walletService.updateBalanceAtomic).toHaveBeenCalled();
  });

  it('should return plain text success (not JSON)', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (walletService.updateBalanceAtomic as any).mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);
    const text = await response.text();
    
    expect(text).toBe('success');
    expect(text).not.toBe('{"status":"success"}');
    expect(response.headers.get('content-type')).not.toContain('application/json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest app/api/webhook/okpay/__tests__/deposit.test.ts`
Expected: FAIL with "Cannot find module '../deposit/route'"

- [ ] **Step 3: Implement deposit webhook**

```typescript
// app/api/webhook/okpay/deposit/route.ts

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest app/api/webhook/okpay/__tests__/deposit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/webhook/okpay/deposit/route.ts app/api/webhook/okpay/__tests__/deposit.test.ts
git commit -m "feat: implement OKPay deposit webhook endpoint"
```

---

## Task 11: Create Withdrawal Webhook Endpoint

**Files:**
- Create: `app/api/webhook/okpay/withdrawal/route.ts`

- [ ] **Step 1: Write test for withdrawal webhook**

```typescript
// app/api/webhook/okpay/__tests__/withdrawal.test.ts

import { POST } from '../withdrawal/route';
import { okpayGateway } from '@/lib/okpay-gateway';
import { db } from '@/drizzle';

// Mock dependencies
vi.mock('@/lib/okpay-gateway');
vi.mock('@/drizzle');

describe('OKPay Withdrawal Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request with invalid signature', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(false);

    const request = new Request('https://example.com/api/webhook/okpay/withdrawal', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'invalid',
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
  });

  it('should process successful withdrawal', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (db.select as any).mockResolvedValue([
      {
        id: '12345',
        status: 'pending',
        userId: 'user_123',
        amount: '10000',
      },
    ]);
    (db.update as any).mockResolvedValue({});

    const request = new Request('https://example.com/api/webhook/okpay/withdrawal', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('success');
  });

  it('should return plain text success (not JSON)', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (db.select as any).mockResolvedValue([{ id: '12345', status: 'pending' }]);
    (db.update as any).mockResolvedValue({});

    const request = new Request('https://example.com/api/webhook/okpay/withdrawal', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);
    const text = await response.text();
    
    expect(text).toBe('success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest app/api/webhook/okpay/__tests__/withdrawal.test.ts`
Expected: FAIL with "Cannot find module '../withdrawal/route'"

- [ ] **Step 3: Implement withdrawal webhook**

```typescript
// app/api/webhook/okpay/withdrawal/route.ts

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest app/api/webhook/okpay/__tests__/withdrawal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/webhook/okpay/withdrawal/route.ts app/api/webhook/okpay/__tests__/withdrawal.test.ts
git commit -m "feat: implement OKPay withdrawal webhook endpoint"
```

---

## Task 12: Update Transaction Router for OKPay Deposits

**Files:**
- Modify: `server/routers/transaction.ts`

- [ ] **Step 1: Add OKPay import**

```typescript
// server/routers/transaction.ts

// Add to existing imports:
import { okpayGateway } from "@/lib/okpay-gateway";
```

- [ ] **Step 2: Update payment method enum**

```typescript
// server/routers/transaction.ts

// In initiateDeposit input validation:
method: z.enum(['upi', 'paytm', 'phonepe', 'okpay-upi', 'okpay-intent', 'bank_transfer', 'crypto']),
```

- [ ] **Step 3: Add OKPay routing in initiateDeposit**

```typescript
// server/routers/transaction.ts

// In initiateDeposit mutation, after the VeloPay section, add OKPay routing:

// Integrate with OKPay for UPI deposits
if (input.method === 'okpay-upi' || input.method === 'okpay-intent') {
  try {
    const payType = input.method === 'okpay-upi' ? 'UPI' : 'UPI_INTENT';
    
    // OKPay expects amount in rupees (no decimals)
    const amountInRupees = (BigInt(input.amount) / 100n).toString();
    
    const okpayResponse = await okpayGateway.createDeposit({
      out_trade_no: depositId,
      pay_type: payType,
      money: amountInRupees,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/deposit/success`,
      phone: input.method === 'okpay-intent' ? input.phone : undefined,
    });

    // Update deposit with gateway reference
    await db.update(deposit)
      .set({
        gatewayReference: okpayResponse.data.transaction_Id,
        gatewayMetadata: okpayResponse,
        updatedAt: new Date(),
      })
      .where(eq(deposit.id, depositId));

    await idempotencyService.complete(idempotencyKey);

    return {
      success: true,
      depositId,
      transactionId,
      paymentUrl: okpayResponse.data.url,
      message: input.method === 'okpay-intent' 
        ? 'Open UPI app to complete payment'
        : 'Complete UPI payment to credit your balance',
    };
  } catch (error) {
    await idempotencyService.delete(idempotencyKey);
    console.error('[TRANSACTION] OKPay deposit failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to initiate deposit with OKPay gateway',
    });
  }
}
```

- [ ] **Step 4: Update initiateDeposit input schema for phone**

```typescript
// server/routers/transaction.ts

// Update initiateDeposit input to include phone for UPI_INTENT:
input: z.object({
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, "Invalid amount format"),
  method: z.enum(['upi', 'paytm', 'phonepe', 'okpay-upi', 'okpay-intent', 'bank_transfer', 'crypto']),
  phone: z.string().optional(), // Required for okpay-intent
  clientProvidedKey: z.string().optional(),
  currency: z.string().default('USD'),
})
```

- [ ] **Step 5: Commit**

```bash
git add server/routers/transaction.ts
git commit -m "feat: add OKPay deposit methods to transaction router"
```

---

## Task 13: Update Transaction Router for OKPay Withdrawals

**Files:**
- Modify: `server/routers/transaction.ts`

- [ ] **Step 1: Update withdrawal method enum**

```typescript
// server/routers/transaction.ts

// In requestWithdrawal input validation:
method: z.enum(['upi', 'okpay-bank', 'bank_transfer']),
```

- [ ] **Step 2: Add OKPay bank withdrawal routing**

```typescript
// server/routers/transaction.ts

// In requestWithdrawal mutation, add OKPay routing:

if (input.method === 'okpay-bank') {
  if (!input.details.accountNumber || !input.details.ifscCode || !input.details.accountHolder) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Account number, IFSC code, and account holder name required for OKPay withdrawals',
    });
  }

  try {
    // OKPay expects amount in rupees
    const amountInRupees = (BigInt(input.amount) / 100n).toString();
    
    const okpayResponse = await okpayGateway.createWithdrawal({
      out_trade_no: withdrawalId,
      pay_type: 'BANK',
      account: input.details.accountNumber,
      userName: input.details.accountHolder,
      money: amountInRupees,
      reserve1: input.details.ifscCode,
    });

    // Update withdrawal with gateway reference
    await db.update(withdrawal)
      .set({
        gatewayReference: okpayResponse.data.transaction_Id,
        gatewayMetadata: okpayResponse,
        updatedAt: new Date(),
      })
      .where(eq(withdrawal.id, withdrawalId));

    await idempotencyService.complete(idempotencyKey);

    return {
      success: true,
      withdrawalId,
      transactionId,
      message: 'Withdrawal submitted to OKPay for processing',
      amount: input.amount,
      gatewayStatus: 'pending',
    };
  } catch (error) {
    // If OKPay fails, reverse the balance debit
    await walletService.updateBalanceAtomic(
      userId,
      amount,
      'refund',
      {
        withdrawalId,
        reason: 'OKPay withdrawal failed',
      }
    );

    await idempotencyService.delete(idempotencyKey);
    console.error('[TRANSACTION] OKPay withdrawal failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process withdrawal with OKPay',
    });
  }
}
```

- [ ] **Step 3: Update withdrawal details schema**

```typescript
// server/routers/transaction.ts

// Update requestWithdrawal input to include bank details:
details: z.object({
  upiId: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
})
```

- [ ] **Step 4: Commit**

```bash
git add server/routers/transaction.ts
git commit -m "feat: add OKPay bank withdrawal to transaction router"
```

---

## Task 14: Run Integration Tests

**Files:**
- Test: All OKPay tests

- [ ] **Step 1: Run all OKPay gateway tests**

Run: `npx vitest lib/__tests__/okpay-gateway.test.ts`
Expected: All tests PASS

- [ ] **Step 2: Run all webhook tests**

Run: `npx vitest app/api/webhook/okpay/__tests__/`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `npx vitest`
Expected: All existing tests still pass + new OKPay tests pass

- [ ] **Step 4: Check TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 5: Commit test results**

```bash
git add .
git commit -m "test: all OKPay integration tests passing"
```

---

## Task 15: Update .env.local with OKPay Configuration

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add OKPay sandbox configuration**

```bash
# .env.local

# OKPay Configuration (Sandbox)
OKPAY_MODE=sandbox
OKPAY_HOST=https://okpay.com
OKPAY_MCH_ID=1000
OKPAY_KEY=eb6080dbc8dc429ab86a1cd1c337975d
OKPAY_CALLBACK_URL=https://yourdomain.com/api/webhook/okpay
```

**Note:** This file should already exist from your existing setup. Add the OKPay section to it.

- [ ] **Step 2: Commit**

```bash
git add .env.local
git commit -m "config: add OKPay sandbox credentials"
```

---

## Task 16: Manual Testing with OKPay Sandbox

**Files:**
- Manual testing

- [ ] **Step 1: Test OKPay deposit flow**

1. Start dev server: `npm run dev`
2. Login to app
3. Navigate to deposit page
4. Select "OKPay UPI" as payment method
5. Enter amount: ₹100
6. Submit deposit
7. Verify: Payment URL returned
8. Wait ~10 seconds for sandbox auto-success
9. Verify: Balance credited (+₹100)
10. Check: Deposit status = 'completed'

- [ ] **Step 2: Test OKPay withdrawal flow**

1. Navigate to withdrawal page
2. Select "OKPay Bank" as method
3. Enter amount: ₹100
4. Enter bank details:
   - Account: 0235456782
   - IFSC: IFSC0000000
   - Name: Test User
5. Submit withdrawal
6. Verify: Balance debited (-₹100)
7. Wait for callback (sandbox: even = success, odd = fail)
8. Verify: Withdrawal status updated

- [ ] **Step 3: Test signature verification**

1. Manually send invalid signature to webhook
2. Verify: Returns "FAILED" with 400 status
3. Check console for signature error logs

- [ ] **Step 4: Document test results**

Create a brief test report documenting:
- Sandbox deposit success
- Sandbox withdrawal success
- Signature verification working
- Amount conversion accurate

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: OKPay sandbox manual testing complete"
```

---

## Task 17: Create Documentation for OKPay Integration

**Files:**
- Create: `docs/okpay-integration.md`

- [ ] **Step 1: Create OKPay integration documentation**

```markdown
# OKPay Integration Guide

## Overview

OKPay provides UPI payment processing for Indian users. This integration supports:
- **UPI (Web)**: Redirect-based checkout
- **UPI_INTENT (Native)**: Deep link to UPI apps
- **Bank Transfer**: Withdrawals to Indian bank accounts

## Configuration

### Environment Variables

```bash
OKPAY_MODE=sandbox              # sandbox | production
OKPAY_HOST=https://okpay.com    # Production host
OKPAY_MCH_ID=your_merchant_id   # From OKPay dashboard
OKPAY_KEY=your_secret_key       # From OKPay dashboard
OKPAY_CALLBACK_URL=https://yourdomain.com/api/webhook/okpay
```

### Sandbox Testing

Use sandbox credentials from OKPay documentation:
- mchId: 1000
- key: eb6080dbc8dc429ab86a1cd1c337975d
- host: sandbox.wpay.one

**Behavior**:
- Deposits auto-success in ~10 seconds
- Withdrawals succeed if order ID ends with even digit

## API Usage

### Deposit Example

```typescript
const response = await okpayGateway.createDeposit({
  out_trade_no: 'unique_order_id',
  pay_type: 'UPI',
  money: '100', // Amount in rupees
  returnUrl: 'https://example.com/success',
});
```

### Withdrawal Example

```typescript
const response = await okpayGateway.createWithdrawal({
  out_trade_no: 'unique_order_id',
  pay_type: 'BANK',
  account: '1234567890',
  userName: 'John Doe',
  money: '100',
  reserve1: 'IFSC0000000',
});
```

## Webhooks

### Deposit Webhook
- **Endpoint**: `/api/webhook/okpay/deposit`
- **Method**: POST
- **Format**: application/x-www-form-urlencoded

### Withdrawal Webhook
- **Endpoint**: `/api/webhook/okpay/withdrawal`
- **Method**: POST
- **Format**: application/x-www-form-urlencoded

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 0 | Success | Proceed |
| 5 | Invalid signature | Check signing logic |
| 9 | Insufficient balance | Add OKPay funds |
| 16 | IP not whitelisted | Contact OKPay support |

See full error code reference in design doc.

## Troubleshooting

### Common Issues

**Problem**: Webhook returns FAILED
- Check signature verification
- Verify callback URL is accessible
- Check OKPay dashboard for IP whitelist status

**Problem**: Deposit not credited
- Verify status in callback (should be "1" for success)
- Check wallet service logs
- Verify deposit record status

**Problem**: Amount mismatch
- Remember: OKPay uses rupees, system uses paisa
- Gateway handles conversion automatically
- Check database stores paisa (₹100 = 10000)

## Production Checklist

- [ ] Update `OKPAY_MODE=production`
- [ ] Add production credentials
- [ ] Whitelist production IP with OKPay
- [ ] Test production deposit/withdrawal
- [ ] Monitor transaction success rates
- [ ] Set up alerting for webhook failures
```

- [ ] **Step 2: Commit**

```bash
git add docs/okpay-integration.md
git commit -m "docs: add OKPay integration guide"
```

---

## Task 18: Final Review and Cleanup

**Files:**
- Review all changes

- [ ] **Step 1: Review all commits**

```bash
git log --oneline --graph
```

Verify commit history is clean and logical.

- [ ] **Step 2: Check for TODO/FIXME comments**

Run: `grep -r "TODO\|FIXME" lib/okpay-gateway.ts app/api/webhook/okpay/ server/routers/transaction.ts`

Remove or address any TODOs found.

- [ ] **Step 3: Verify all tests pass**

Run: `npx vitest --run`

Expected: All tests PASS

- [ ] **Step 4: Run ESLint**

Run: `npm run lint`

Expected: No linting errors

- [ ] **Step 5: Build production bundle**

Run: `npm run build`

Expected: Build succeeds without errors

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final cleanup for OKPay integration"
```

---

## Summary

This implementation plan creates a complete OKPay integration with:

✅ **OKPay Gateway Class** (`lib/okpay-gateway.ts`)
- Environment-based configuration (sandbox/production)
- MD5 signature generation with URL encoding
- Signature verification for callbacks
- Amount conversion (INR ↔ paisa)
- Deposit and withdrawal methods

✅ **Webhook Endpoints**
- Deposit callback: `/api/webhook/okpay/deposit`
- Withdrawal callback: `/api/webhook/okpay/withdrawal`
- Plain text "success" response (OKPay requirement)

✅ **Transaction Router Updates**
- New payment methods: `okpay-upi`, `okpay-intent`, `okpay-bank`
- Automatic routing to OKPay gateway
- Amount conversion before API calls

✅ **Testing**
- Unit tests for all gateway methods
- Webhook endpoint tests
- Integration tests
- Manual sandbox testing

✅ **Documentation**
- Integration guide
- Troubleshooting tips
- Production checklist

---

**End of Implementation Plan**
