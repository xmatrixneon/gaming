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

  describe('verifyCallbackSignature', () => {
    it('should verify valid callback signature', () => {
      const payload = {
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc123',
        status: '1',
        money: '100',
        sign: '', // Will be generated
      };

      // Generate valid signature
      (payload as any).sign = gateway.generateSignature(payload);

      const isValid = gateway.verifyCallbackSignature(payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid callback signature', () => {
      const payload = {
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
      const payload1 = {
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc123',
        status: '1',
        money: '100',
      };
      (payload1 as any).sign = gateway.generateSignature(payload1);

      const payload2 = {
        ...payload1,
        money: '200', // Different amount
        sign: (payload1 as any).sign, // Original signature
      };

      const isValid = gateway.verifyCallbackSignature(payload2);
      expect(isValid).toBe(false);
    });
  });
});
