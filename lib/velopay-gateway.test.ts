/**
 * VeloPay Gateway Service Tests
 * Run with: npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Mock the VeloPay gateway for testing
class TestVelopayGateway {
  private readonly config = {
    gatewayUrl: 'https://velopay.ptasm.online',
    merchantNo: '201',
    secretKey: '1f23c2295a08e214304bf09463d0fbcb',
  };

  generateSignature(params: Record<string, any>): string {
    const { sign, ...paramsToSign } = params;
    const filteredParams = Object.entries(paramsToSign)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    const sortedKeys = Object.keys(filteredParams).sort();
    const signatureString = sortedKeys
      .map((key) => `${key}=${filteredParams[key]}`)
      .join('&') + `&key=${this.config.secretKey}`;

    // Simple hash function for testing (in production, use MD5)
    let hash = 0;
    for (let i = 0; i < signatureString.length; i++) {
      const char = signatureString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }

  verifyCallbackSignature(payload: any): boolean {
    const { sign: receivedSign, ...paramsToVerify } = payload;
    const calculatedSign = this.generateSignature(paramsToVerify);
    return receivedSign === calculatedSign;
  }

  inrToPaisa(amountInINR: number | string): string {
    const amount = typeof amountInINR === 'string' ? parseFloat(amountInINR) : amountInINR;
    return Math.round(amount * 100).toString();
  }

  paisaToINR(amountInPaisa: number | string): number {
    const amount = typeof amountInPaisa === 'string' ? parseInt(amountInPaisa, 10) : amountInPaisa;
    return amount / 100;
  }

  validateIFSC(ifsc: string): boolean {
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscPattern.test(ifsc);
  }

  validateUPIId(upiId: string): boolean {
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{3,64}$/;
    return upiPattern.test(upiId);
  }

  validatePhone(phone: string): boolean {
    const phonePattern = /^[+]?91?[6-9]\d{9}$/;
    return phonePattern.test(phone.replace(/\s/g, ''));
  }
}

describe('VeloPay Gateway Service', () => {
  let gateway: TestVelopayGateway;

  beforeAll(() => {
    gateway = new TestVelopayGateway();
  });

  describe('Signature Generation', () => {
    it('should generate signature correctly with sorted parameters', () => {
      const params = {
        merchant_no: '201',
        txn_id: 'txn001',
        amount: '10000',
        type: 1,
        callback: 'https://test.com',
        currency: 'INR',
      };

      const signature = gateway.generateSignature(params);

      expect(signature).toBeTruthy();
      expect(signature.length).toBe(32);
    });

    it('should generate consistent signatures for same input', () => {
      const params = {
        merchant_no: '201',
        txn_id: 'txn001',
        amount: '10000',
      };

      const sig1 = gateway.generateSignature(params);
      const sig2 = gateway.generateSignature(params);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different parameters', () => {
      const params1 = { merchant_no: '201', txn_id: 'txn001', amount: '10000' };
      const params2 = { merchant_no: '201', txn_id: 'txn002', amount: '10000' };

      const sig1 = gateway.generateSignature(params1);
      const sig2 = gateway.generateSignature(params2);

      expect(sig1).not.toBe(sig2);
    });

    it('should handle parameters with different order correctly', () => {
      const params1 = { z: '1', a: '2', m: '3' };
      const params2 = { a: '2', m: '3', z: '1' };

      const sig1 = gateway.generateSignature(params1);
      const sig2 = gateway.generateSignature(params2);

      expect(sig1).toBe(sig2);
    });
  });

  describe('Amount Conversion', () => {
    it('should convert INR to paisa correctly', () => {
      expect(gateway.inrToPaisa(100)).toBe('10000');
      expect(gateway.inrToPaisa(50.5)).toBe('5050');
      expect(gateway.inrToPaisa('100')).toBe('10000');
      expect(gateway.inrToPaisa('0.01')).toBe('1');
    });

    it('should convert paisa to INR correctly', () => {
      expect(gateway.paisaToINR(10000)).toBe(100);
      expect(gateway.paisaToINR(5050)).toBe(50.5);
      expect(gateway.paisaToINR('10000')).toBe(100);
      expect(gateway.paisaToINR('1')).toBe(0.01);
    });

    it('should handle round-trip conversion', () => {
      const originalINR = 123.45;
      const paisa = gateway.inrToPaisa(originalINR);
      const convertedBack = gateway.paisaToINR(paisa);
      expect(convertedBack).toBeCloseTo(originalINR);
    });
  });

  describe('IFSC Validation', () => {
    it('should validate correct IFSC codes', () => {
      expect(gateway.validateIFSC('PYTM0123456')).toBe(true);
      expect(gateway.validateIFSC('HDFC0001234')).toBe(true);
      expect(gateway.validateIFSC('ICIC0001234')).toBe(true);
    });

    it('should reject invalid IFSC codes', () => {
      expect(gateway.validateIFSC('PYTM123456')).toBe(false); // Missing 0
      expect(gateway.validateIFSC('PYTM012345')).toBe(false); // Too short
      expect(gateway.validateIFSC('PYTM01234567')).toBe(false); // Too long
      expect(gateway.validateIFSC('pytm0123456')).toBe(false); // Lowercase
      expect(gateway.validateIFSC('12345678901')).toBe(false); // All numbers
    });
  });

  describe('UPI ID Validation', () => {
    it('should validate correct UPI IDs', () => {
      expect(gateway.validateUPIId('user@paytm')).toBe(true);
      expect(gateway.validateUPIId('john.doe@ybl')).toBe(true);
      expect(gateway.validateUPIId('user_name@okaxis')).toBe(true);
      expect(gateway.validateUPIId('1234567890@upi')).toBe(true);
    });

    it('should reject invalid UPI IDs', () => {
      expect(gateway.validateUPIId('user@')).toBe(false);
      expect(gateway.validateUPIId('@paytm')).toBe(false);
      expect(gateway.validateUPIId('user')).toBe(false);
      expect(gateway.validateUPIId('')).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate correct Indian phone numbers', () => {
      expect(gateway.validatePhone('911234567890')).toBe(true);
      expect(gateway.validatePhone('+919123456789')).toBe(true);
      expect(gateway.validatePhone('91234567890')).toBe(true);
      expect(gateway.validatePhone('+91 91234 56789')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(gateway.validatePhone('91123456789')).toBe(false); // Too short
      expect(gateway.validatePhone('81234567890')).toBe(false); // Doesn't start with 6-9
      expect(gateway.validatePhone('1234567890')).toBe(false); // Not Indian format
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid callback signature', () => {
      const originalParams = {
        merchant_no: '201',
        txn_id: 'txn001',
        amount: '10000',
      };

      const signature = gateway.generateSignature(originalParams);

      const callbackPayload = {
        ...originalParams,
        sign: signature,
      };

      expect(gateway.verifyCallbackSignature(callbackPayload)).toBe(true);
    });

    it('should reject invalid callback signature', () => {
      const callbackPayload = {
        merchant_no: '201',
        txn_id: 'txn001',
        amount: '10000',
        sign: 'invalid_signature_1234567890abcdef',
      };

      expect(gateway.verifyCallbackSignature(callbackPayload)).toBe(false);
    });

    it('should handle callback with additional fields', () => {
      const callbackPayload = {
        status: 'SUCCESS',
        txn_id: 'txn001',
        merchant_no: '201',
        message: 'TXN SUCCESS',
        id: '100',
        amount: '10000',
        utr: 'utr123',
        sign: '',
      };

      callbackPayload.sign = gateway.generateSignature(callbackPayload);

      expect(gateway.verifyCallbackSignature(callbackPayload)).toBe(true);
    });
  });
});
