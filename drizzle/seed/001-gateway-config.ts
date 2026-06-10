import { db } from "@/drizzle";
import { paymentGatewayConfig } from "@/drizzle/schema";
import { nanoid } from "nanoid";

export async function seedGatewayConfigs() {
  console.log('Seeding payment gateway configurations...');

  const configs = [
    {
      id: nanoid(),
      gatewayName: 'velopay',
      displayName: 'UPI 1',
      enabled: true,
      priority: 1,
      status: 'active' as const,
      configMetadata: {
        host: process.env.VELOPAY_GATEWAY_URL || 'https://velopay.ptasm.online',
        merchantId: process.env.VELOPAY_MERCHANT_NO || '201',
        secret: process.env.VELOPAY_SECRET_KEY || '',
        callbackUrl: process.env.VELOPAY_CALLBACK_URL || '',
        mode: 'production' as const,
      },
    },
    {
      id: nanoid(),
      gatewayName: 'okpay',
      displayName: 'UPI 2',
      enabled: true,
      priority: 2,
      status: 'active' as const,
      configMetadata: {
        host: process.env.OKPAY_HOST || 'https://okpay.com',
        merchantId: process.env.OKPAY_MCH_ID || '',
        secret: process.env.OKPAY_KEY || '',
        callbackUrl: process.env.OKPAY_CALLBACK_URL || '',
        mode: (process.env.OKPAY_MODE as 'sandbox' | 'production') || 'sandbox',
      },
    },
  ];

  for (const config of configs) {
    await db.insert(paymentGatewayConfig).values(config).onConflictDoNothing();
  }

  console.log('Payment gateway configurations seeded successfully.');
}

// Run if called directly
if (require.main === module) {
  seedGatewayConfigs().then(() => process.exit(0));
}
