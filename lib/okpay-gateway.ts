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
