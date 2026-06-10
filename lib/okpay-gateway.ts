import { createHash } from 'crypto';

export interface OkpayConfig {
  host: string;
  mchId: string;
  key: string;
  currency: string;
  callbackUrl: string;
}

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
}
