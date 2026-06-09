/**
 * Create Test Deposit Link - Multiple Variations
 * Tests different configurations with VeloPay gateway
 *
 * Run with: npx tsx create-deposit-link-variants.ts
 */

import { createHash } from 'crypto';

const VELOPAY_CONFIG = {
  gatewayUrl: 'https://velopay.ptasm.online',
  merchantNo: '201',
  secretKey: '1f23c2295a08e214304bf09463d0fbcb',
  currency: 'INR',
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

async function testDepositVariant(variant: string, config: any) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST VARIANT: ${variant}`);
  console.log('='.repeat(70));

  const depositId = `TEST_${variant}_${Date.now()}`;

  const depositRequest = {
    merchant_no: VELOPAY_CONFIG.merchantNo,
    txn_id: depositId,
    amount: inrToPaisa(config.amount),
    type: config.type,
    callback: config.callback || 'https://clausbet.com/api/webhook/velopay',
    currency: VELOPAY_CONFIG.currency,
  };

  console.log(`\n📝 Configuration:`);
  console.log(`  Amount: ₹${config.amount} INR (${depositRequest.amount} paisa)`);
  console.log(`  Type: ${depositRequest.type} (${config.type === 1 ? 'H5 Link' : 'UPI Account'})`);
  console.log(`  Transaction ID: ${depositId}`);

  const signature = generateSignature(depositRequest);
  depositRequest.sign = signature;

  console.log(`  Signature: ${signature.substring(0, 16)}...`);

  try {
    const response = await fetch(`${VELOPAY_CONFIG.gatewayUrl}/api/payin/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depositRequest),
    });

    const data = await response.json();

    console.log(`\n📊 API Response Status: ${response.status}`);
    console.log(`Response Code: ${data.code}`);
    console.log(`Response Status: ${data.status}`);
    console.log(`Response Message: ${data.message}`);

    if (data.pay_link) {
      console.log(`\n🎉 SUCCESS! Payment Link Generated:`);
      console.log(`  ${data.pay_link}`);
    }

    if (data.upi_account) {
      console.log(`\n🎉 SUCCESS! UPI Account:`);
      console.log(`  ${data.upi_account}`);
    }

    if (response.ok && (data.pay_link || data.upi_account)) {
      console.log(`\n✅ Variant ${variant}: PASSED`);
      return { success: true, data };
    } else {
      console.log(`\n❌ Variant ${variant}: FAILED`);
      return { success: false, data };
    }
  } catch (error) {
    console.error(`\n❌ Variant ${variant}: ERROR`, error);
    return { success: false, error };
  }
}

async function runAllVariants() {
  console.log('\n' + '═'.repeat(70));
  console.log('VELOPAY DEPOSIT LINK GENERATION - MULTIPLE VARIANTS');
  console.log('═'.repeat(70));

  const variants = [
    {
      name: 'Type 1 - ₹100 (H5 Link)',
      config: { amount: 100, type: 1 },
    },
    {
      name: 'Type 1 - ₹500 (H5 Link)',
      config: { amount: 500, type: 1 },
    },
    {
      name: 'Type 1 - ₹1000 (H5 Link)',
      config: { amount: 1000, type: 1 },
    },
    {
      name: 'Type 2 - ₹100 (UPI Account)',
      config: { amount: 100, type: 2 },
    },
    {
      name: 'Type 2 - ₹500 (UPI Account)',
      config: { amount: 500, type: 2 },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const variant of variants) {
    const result = await testDepositVariant(variant.name, variant.config);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }

    // Wait between requests
    if (variants.indexOf(variant) < variants.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next variant...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('VARIANTS TEST SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('═'.repeat(70));

  if (passed > 0) {
    console.log('\n🎉 At least one variant worked!');
    console.log('💡 Tip: Use the successful variant for your integration.');
  } else if (failed === variants.length) {
    console.log('\n⚠️  All variants failed.');
    console.log('\n🔧 Possible solutions:');
    console.log('  1. Test environment may be rate-limited');
    console.log('  2. Merchant credentials may need verification');
    console.log('  3. Contact VeloPay support for test account activation');
    console.log('  4. Check VeloPay dashboard for account status');
    console.log('\n📞 Support:');
    console.log('  - Dashboard: https://manage.vinkaj.world');
    console.log('  - Test Account: uppay001 / Aa12345678aa');
  }
}

runAllVariants().catch(console.error);
