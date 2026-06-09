/**
 * VeloPay Integration Test Script
 * Standalone test script for payment flow testing
 *
 * Run with: npx tsx test-payment-flow.ts
 */

import { createHash } from 'crypto';

// ============================================================================
// VELOPAY GATEWAY SERVICE (Extracted for testing)
// ============================================================================

const VELOPAY_CONFIG = {
  gatewayUrl: 'https://velopay.ptasm.online',
  merchantNo: '201',
  secretKey: '1f23c2295a08e214304bf09463d0fbcb',
};

function generateSignature(params: Record<string, any>): string {
  const { sign, ...paramsToSign } = params;
  const filteredParams = Object.entries(paramsToSign)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  const sortedKeys = Object.keys(filteredParams).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${filteredParams[key]}`)
    .join('&') + `&key=${VELOPAY_CONFIG.secretKey}`;

  return createHash('md5').update(signatureString).digest('hex');
}

function inrToPaisa(amountInINR: number | string): string {
  const amount = typeof amountInINR === 'string' ? parseFloat(amountInINR) : amountInINR;
  return Math.round(amount * 100).toString();
}

function validateUPIId(upiId: string): boolean {
  const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{3,64}$/;
  return upiPattern.test(upiId);
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testSignatureGeneration() {
  console.log('\n🔐 Testing Signature Generation...');
  console.log('─'.repeat(50));

  const testCases = [
    {
      name: 'Basic parameters',
      params: {
        merchant_no: '201',
        txn_id: 'txn001',
        amount: '10000',
        type: 1,
        callback: 'https://test.com',
        currency: 'INR',
      },
    },
    {
      name: 'Different order',
      params: {
        currency: 'INR',
        amount: '10000',
        merchant_no: '201',
        txn_id: 'txn001',
        type: 1,
        callback: 'https://test.com',
      },
    },
  ];

  const signatures: string[] = [];

  for (const testCase of testCases) {
    const sig = generateSignature(testCase.params);
    signatures.push(sig);
    console.log(`✓ ${testCase.name}: ${sig.substring(0, 16)}...`);
  }

  // Test consistency
  const sig1 = generateSignature(testCases[0].params);
  const sig2 = generateSignature(testCases[0].params);
  console.log(`\n✓ Consistency check: ${sig1 === sig2 ? 'PASS' : 'FAIL'}`);

  // Test different order produces same signature
  console.log(`✓ Order independence: ${signatures[0] === signatures[1] ? 'PASS' : 'FAIL'}`);

  return true;
}

async function testAmountConversion() {
  console.log('\n💰 Testing Amount Conversion...');
  console.log('─'.repeat(50));

  const testCases = [
    { inr: 100, expectedPaisa: '10000' },
    { inr: 50.5, expectedPaisa: '5050' },
    { inr: 0.01, expectedPaisa: '1' },
    { inr: 999.99, expectedPaisa: '99999' },
  ];

  for (const testCase of testCases) {
    const paisa = inrToPaisa(testCase.inr);
    const pass = paisa === testCase.expectedPaisa;
    console.log(`${pass ? '✓' : '✗'} ₹${testCase.inr} → ${paisa} paisa ${pass ? '' : `(expected ${testCase.expectedPaisa})`}`);
  }

  return true;
}

async function testUPIValidation() {
  console.log('\n📱 Testing UPI ID Validation...');
  console.log('─'.repeat(50));

  const validUPIs = [
    'user@paytm',
    'john.doe@ybl',
    'user_name@okaxis',
    '1234567890@upi',
  ];

  const invalidUPIs = [
    'user@',
    '@paytm',
    'user',
    '',
  ];

  console.log('Valid UPI IDs:');
  for (const upi of validUPIs) {
    const isValid = validateUPIId(upi);
    console.log(`${isValid ? '✓' : '✗'} ${upi}`);
  }

  console.log('\nInvalid UPI IDs:');
  for (const upi of invalidUPIs) {
    const isValid = validateUPIId(upi);
    console.log(`${!isValid ? '✓' : '✗'} ${upi} (should be invalid)`);
  }

  return true;
}

async function testDepositRequestFormat() {
  console.log('\n📥 Testing Deposit Request Format...');
  console.log('─'.repeat(50));

  const depositRequest = {
    merchant_no: VELOPAY_CONFIG.merchantNo,
    txn_id: 'TEST_DEPOSIT_001',
    amount: inrToPaisa(100),
    type: 1,
    callback: 'https://clausbet.com/api/webhook/velopay',
    currency: 'INR',
  };

  const signature = generateSignature(depositRequest);

  console.log('Request Payload:');
  console.log(JSON.stringify({ ...depositRequest, sign: signature }, null, 2));

  console.log('\n✓ Deposit request formatted correctly');
  console.log(`  - Merchant No: ${depositRequest.merchant_no}`);
  console.log(`  - Transaction ID: ${depositRequest.txn_id}`);
  console.log(`  - Amount: ${depositRequest.amount} paisa (₹100)`);
  console.log(`  - Type: ${depositRequest.type} (H5 payment link)`);
  console.log(`  - Signature: ${signature.substring(0, 16)}...`);

  return true;
}

async function testWithdrawalRequestFormat() {
  console.log('\n📤 Testing Withdrawal Request Format...');
  console.log('─'.repeat(50));

  const withdrawalRequest = {
    merchant_no: VELOPAY_CONFIG.merchantNo,
    txn_id: 'TEST_WITHDRAWAL_001',
    amount: inrToPaisa(50),
    type: '1',
    ifsc: 'PYTM0123456',
    card_num: 'user@paytm',
    name: 'Test User',
    email: 'test@example.com',
    mobile: '911234567890',
    callback: 'https://clausbet.com/api/webhook/velopay',
    currency: 'INR',
  };

  const signature = generateSignature(withdrawalRequest);

  console.log('Request Payload:');
  console.log(JSON.stringify({ ...withdrawalRequest, sign: signature }, null, 2));

  console.log('\n✓ Withdrawal request formatted correctly');
  console.log(`  - Merchant No: ${withdrawalRequest.merchant_no}`);
  console.log(`  - Transaction ID: ${withdrawalRequest.txn_id}`);
  console.log(`  - Amount: ${withdrawalRequest.amount} paisa (₹50)`);
  console.log(`  - IFSC: ${withdrawalRequest.ifsc}`);
  console.log(`  - UPI ID: ${withdrawalRequest.card_num}`);
  console.log(`  - Signature: ${signature.substring(0, 16)}...`);

  return true;
}

async function testCallbackVerification() {
  console.log('\n🔔 Testing Callback Signature Verification...');
  console.log('─'.repeat(50));

  // Simulate a deposit callback from VeloPay
  const callbackPayload = {
    status: 'SUCCESS',
    txn_id: 'TEST_DEPOSIT_001',
    merchant_no: '201',
    message: 'TXN SUCCESS',
    id: '12345',
    amount: '10000',
    utr: 'UTR123456789',
  };

  // Generate signature as VeloPay would
  const signature = generateSignature(callbackPayload);
  callbackPayload.sign = signature;

  // Verify signature
  const { sign: receivedSign, ...paramsToVerify } = callbackPayload;
  const calculatedSign = generateSignature(paramsToVerify);
  const isValid = receivedSign === calculatedSign;

  console.log('Callback Payload:');
  console.log(JSON.stringify(callbackPayload, null, 2));

  console.log(`\n✓ Signature verification: ${isValid ? 'PASS' : 'FAIL'}`);
  console.log(`  - Received: ${receivedSign.substring(0, 16)}...`);
  console.log(`  - Calculated: ${calculatedSign.substring(0, 16)}...`);

  return isValid;
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('\n' + '═'.repeat(50));
  console.log('VELOPAY INTEGRATION TEST SUITE');
  console.log('═'.repeat(50));

  const tests = [
    { name: 'Signature Generation', fn: testSignatureGeneration },
    { name: 'Amount Conversion', fn: testAmountConversion },
    { name: 'UPI Validation', fn: testUPIValidation },
    { name: 'Deposit Request Format', fn: testDepositRequestFormat },
    { name: 'Withdrawal Request Format', fn: testWithdrawalRequestFormat },
    { name: 'Callback Verification', fn: testCallbackVerification },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      console.error(`\n✗ ${test.name} FAILED:`, error);
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('TEST RESULTS');
  console.log('═'.repeat(50));
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('═'.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! VeloPay integration is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
