/**
 * Create Test Deposit Link
 * Generates a real deposit request to VeloPay gateway
 *
 * Run with: npx tsx create-deposit-link.ts
 */

import { createHash } from 'crypto';

// ============================================================================
// VELOPAY CONFIG
// ============================================================================

const VELOPAY_CONFIG = {
  gatewayUrl: 'https://velopay.ptasm.online',
  merchantNo: '201',
  secretKey: '1f23c2295a08e214304bf09463d0fbcb',
  currency: 'INR',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// CREATE DEPOSIT LINK
// ============================================================================

async function createDepositLink() {
  console.log('\n' + '═'.repeat(60));
  console.log('CREATE TEST DEPOSIT LINK - VELOPAY');
  console.log('═'.repeat(60));

  // Get deposit amount from command line args or use default
  const amountINR = process.argv[2] ? parseFloat(process.argv[2]) : 10;
  const depositId = `TEST_${Date.now()}`;
  const callbackUrl = 'https://clausbet.com/api/webhook/velopay';

  // Prepare deposit request
  const depositRequest = {
    merchant_no: VELOPAY_CONFIG.merchantNo,
    txn_id: depositId,
    amount: inrToPaisa(amountINR),
    type: 1, // 1 = H5 payment link, 2 = UPI account
    callback: callbackUrl,
    currency: VELOPAY_CONFIG.currency,
  };

  console.log('\n📝 Deposit Request Details:');
  console.log('─'.repeat(60));
  console.log(`  Amount: ₹${amountINR} INR`);
  console.log(`  Amount in Paisa: ${depositRequest.amount}`);
  console.log(`  Merchant No: ${depositRequest.merchant_no}`);
  console.log(`  Transaction ID: ${depositRequest.txn_id}`);
  console.log(`  Type: ${depositRequest.type} (H5 Payment Link)`);
  console.log(`  Callback URL: ${depositRequest.callback}`);
  console.log(`  Currency: ${depositRequest.currency}`);

  // Generate signature
  const signature = generateSignature(depositRequest);
  depositRequest.sign = signature;

  console.log('\n🔐 Generated Signature:');
  console.log('─'.repeat(60));
  console.log(`  ${signature}`);
  console.log('\n📋 Full Request Payload:');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(depositRequest, null, 2));

  // Make API request to VeloPay
  console.log('\n🌐 Calling VeloPay API...');
  console.log('─'.repeat(60));

  try {
    const response = await fetch(`${VELOPAY_CONFIG.gatewayUrl}/api/payin/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(depositRequest),
    });

    const data = await response.json();

    console.log('\n✅ API Response:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.status === 'SUCCESS') {
      console.log('\n🎉 Deposit Link Created Successfully!');
      console.log('═'.repeat(60));
      console.log(`\n📱 Payment Link: ${data.pay_link}`);
      console.log(`\n🔗 Platform Transaction ID: ${data.id}`);
      console.log(`📋 Merchant Transaction ID: ${data.txn_id}`);
      console.log(`💰 Amount: ₹${amountINR} INR`);
      console.log('\n📝 Instructions:');
      console.log('  1. Open the payment link above');
      console.log('  2. Complete the UPI payment');
      console.log('  3. Wait for callback to credit your balance');
      console.log('  4. Check transaction status in your database');
      console.log('\n⚠️  Note: This is a TEST deposit');
      console.log('  - Use minimum ₹10 for testing');
      console.log('  - Callback will be sent to: ' + callbackUrl);
      console.log('  - Transaction ID: ' + depositId);
      console.log('\n' + '═'.repeat(60));
    } else {
      console.log('\n❌ Deposit Request Failed');
      console.log('═'.repeat(60));
      console.log(`Status: ${data.status}`);
      console.log(`Message: ${data.message}`);
      console.log('\nPossible Reasons:');
      console.log('  - Invalid merchant credentials');
      console.log('  - Invalid amount (minimum ₹10)');
      console.log('  - Network error');
      console.log('  - VeloPay server error');
    }

    return data;
  } catch (error) {
    console.error('\n❌ Error Calling VeloPay API');
    console.log('═'.repeat(60));
    console.error(error);
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Check your internet connection');
    console.log('  2. Verify VeloPay server is accessible');
    console.log('  3. Check merchant credentials');
    throw error;
  }
}

// ============================================================================
// RUN
// ============================================================================

createDepositLink().catch(console.error);
