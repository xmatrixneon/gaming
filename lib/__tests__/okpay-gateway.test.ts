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
