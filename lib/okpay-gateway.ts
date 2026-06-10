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
