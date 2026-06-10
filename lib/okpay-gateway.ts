import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface OkpayConfig {
  host: string;
  mchId: string;
  key: string;
  currency: string;
  callbackUrl: string;
}

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

// ============================================================================
// GATEWAY CLASS
// ============================================================================

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
