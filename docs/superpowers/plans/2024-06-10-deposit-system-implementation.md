# UPI-Only Deposit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UPI-only deposit system with dynamic Velopay/OKPay gateway configuration, remove crypto options, add admin gateway management UI.

**Architecture:** Database-driven gateway config table with Redis caching, gateway selector service that routes UPI 1/2 requests to configured backends, admin UI for real-time gateway management.

**Tech Stack:** Next.js 16, tRPC, Drizzle ORM, PostgreSQL, Redis, Velopay/OKPay payment gateways

---

## File Structure Overview

### New Files
- `lib/gateway-selector.ts` - Service for gateway selection and config caching
- `lib/gateway-cache.ts` - Redis caching layer for gateway configs
- `server/routers/admin-gateway.ts` - Admin procedures for gateway management
- `server/routers/deposit.ts` - Public procedures for gateway availability
- `app/admin/gateways/page.tsx` - Admin gateway management UI
- `app/admin/gateways/components/gateway-list.tsx` - Gateway list component
- `app/admin/gateways/components/gateway-editor.tsx` - Gateway config editor
- `app/admin/layout.tsx` - Admin layout with auth check

### Modified Files
- `drizzle/schema.ts` - Add paymentGatewayConfig table, remove crypto from depositMethodEnum
- `server/routers/transaction.ts` - Update initiateDeposit to use gateway selection
- `server/routers/index.ts` - Register new routers
- `app/deposit/page.tsx` - Dynamic gateway loading from API
- `lib/trpc/client.ts` - Ensure new procedures are typed

---

## Task 1: Database Schema - Payment Gateway Config Table

**Files:**
- Modify: `drizzle/schema.ts`

- [ ] **Step 1: Add payment gateway config table and update enums**

In `drizzle/schema.ts`, after the withdrawal method enum (around line 136), add:

```typescript
// ============================================================================
// PAYMENT GATEWAY CONFIG TABLE
// ============================================================================

export const gatewayStatusEnum = pgEnum("gateway_status", [
  "active",
  "maintenance",
  "disabled",
]);

export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: text("id").primaryKey(),
  gatewayName: text("gateway_name").notNull(), // 'velopay' or 'okpay'
  displayName: text("display_name").notNull(), // 'UPI 1' or 'UPI 2'
  enabled: boolean("enabled").default(true).notNull(),
  priority: integer("priority").notNull().default(1), // 1 = primary (UPI 1), 2 = secondary (UPI 2)
  configMetadata: jsonb("config_metadata").$type<{
    apiKey?: string;
    secret?: string;
    merchantId?: string;
    host?: string;
    callbackUrl?: string;
    mode?: 'sandbox' | 'production';
  }>(),
  status: text("status").$type<'active' | 'maintenance' | 'disabled'>().default('active').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("gateway_config_priority_idx").on(table.priority),
  index("gateway_config_enabled_idx").on(table.enabled),
  index("gateway_config_name_idx").on(table.gatewayName),
]);
```

In the same file, after the `paymentGatewayConfig` table definition, add relations:

```typescript
// ============================================================================
// RELATIONS
// ============================================================================

export const paymentGatewayConfigRelations = relations(paymentGatewayConfig, ({ many }) => ({
  deposits: many(deposit),
}));
```

Also in `drizzle/schema.ts`, find the deposit table relations (around line 450+ in the deposit relations section) and add:

```typescript
export const depositRelations = relations(deposit, ({ one, many }) => ({
  // ... existing relations ...
  gatewayConfig: one(paymentGatewayConfig, {
    fields: [deposit.gatewayId],
    references: [paymentGatewayConfig.id],
  }),
}));
```

- [ ] **Step 2: Add gatewayId column to deposit table**

In the deposit table definition (find the `export const deposit = pgTable` block), add the gatewayId column after the amount column:

```typescript
gatewayId: text("gateway_id").references(() => paymentGatewayConfig.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected output: Migration file created with new table, enum, and column changes.

- [ ] **Step 4: Commit schema changes**

```bash
git add drizzle/schema.ts drizzle/migrations
git commit -m "feat: add payment_gateway_config table and gatewayId to deposit

- New paymentGatewayConfig table for dynamic gateway configuration
- gatewayStatusEnum: active, maintenance, disabled
- Gateway priority field for UPI 1 / UPI 2 mapping
- Added gatewayId foreign key to deposit table
- Redis caching will be implemented in gateway-selector service"
```

---

## Task 2: Database Seed Data

**Files:**
- Create: `drizzle/seed/001-gateway-config.ts`

- [ ] **Step 1: Create seed file**

Create `drizzle/seed/001-gateway-config.ts`:

```typescript
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
```

- [ ] **Step 2: Create seed script entry point**

Create `drizzle/seed/index.ts`:

```typescript
import { seedGatewayConfigs } from './001-gateway-config';

async function runSeeds() {
  console.log('Running database seeds...');
  await seedGatewayConfigs();
  console.log('All seeds completed successfully.');
}

runSeeds().then(() => process.exit(0));
```

- [ ] **Step 3: Run seed script**

```bash
npx tsx drizzle/seed/index.ts
```

Expected output: "Payment gateway configurations seeded successfully."

- [ ] **Step 4: Commit seed files**

```bash
git add drizzle/seed
git commit -m "feat: add gateway config seed data

- Initial Velopay config as UPI 1 (priority 1)
- Initial OKPay config as UPI 2 (priority 2)
- Both enabled by default
- Config reads from environment variables"
```

---

## Task 3: Gateway Cache Service

**Files:**
- Create: `lib/gateway-cache.ts`

- [ ] **Step 1: Create gateway cache service**

Create `lib/gateway-cache.ts`:

```typescript
/**
 * Gateway Configuration Cache Service
 *
 * Redis-backed caching for payment gateway configurations.
 * Reduces database load and enables fast gateway lookups.
 */

import { redis } from './redis';

const CACHE_PREFIX = 'gateway_config';
const CACHE_TTL = 300; // 5 minutes

export interface CachedGatewayConfig {
  id: string;
  gatewayName: 'velopay' | 'okpay';
  displayName: string;
  enabled: boolean;
  priority: number;
  status: 'active' | 'maintenance' | 'disabled';
  configMetadata: {
    apiKey?: string;
    secret?: string;
    merchantId?: string;
    host?: string;
    callbackUrl?: string;
    mode?: 'sandbox' | 'production';
  };
}

/**
 * Get gateway config by ID from cache
 */
export async function getGatewayConfig(id: string): Promise<CachedGatewayConfig | null> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as CachedGatewayConfig;
  }

  return null;
}

/**
 * Cache gateway config by ID
 */
export async function setGatewayConfig(id: string, config: CachedGatewayConfig): Promise<void> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  await redis.set(key, JSON.stringify(config), 'EX', CACHE_TTL);
}

/**
 * Get all enabled gateway configs from cache
 */
export async function getAllEnabledGateways(): Promise<CachedGatewayConfig[]> {
  const keys = await redis.keys(`${CACHE_PREFIX}:id:*`);
  const configs: CachedGatewayConfig[] = [];

  for (const key of keys) {
    const cached = await redis.get(key);
    if (cached) {
      const config = JSON.parse(cached) as CachedGatewayConfig;
      if (config.enabled) {
        configs.push(config);
      }
    }
  }

  return configs.sort((a, b) => a.priority - b.priority);
}

/**
 * Get gateway by priority (1 = UPI 1, 2 = UPI 2)
 */
export async function getGatewayByPriority(priority: 1 | 2): Promise<CachedGatewayConfig | null> {
  const gateways = await getAllEnabledGateways();
  return gateways.find(g => g.priority === priority) || null;
}

/**
 * Invalidate specific gateway cache
 */
export async function invalidateGateway(id: string): Promise<void> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  await redis.del(key);
}

/**
 * Invalidate all gateway cache
 */
export async function invalidateAllGatewayCache(): Promise<void> {
  const keys = await redis.keys(`${CACHE_PREFIX}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Warm cache with all gateway configs from database
 */
export async function warmGatewayCache(configs: CachedGatewayConfig[]): Promise<void> {
  await Promise.all(
    configs.map(config => setGatewayConfig(config.id, config))
  );
}
```

- [ ] **Step 2: Commit gateway cache service**

```bash
git add lib/gateway-cache.ts
git commit -m "feat: add gateway cache service

- Redis-backed caching for gateway configs
- 5-minute TTL for automatic refresh
- getGatewayByPriority for UPI 1/2 resolution
- Cache invalidation helpers"
```

---

## Task 4: Gateway Selector Service

**Files:**
- Create: `lib/gateway-selector.ts`

- [ ] **Step 1: Create gateway selector service**

Create `lib/gateway-selector.ts`:

```typescript
/**
 * Gateway Selector Service
 *
 * Main service for selecting and routing to payment gateways.
 * Reads configuration from database with Redis caching.
 */

import { db } from '@/drizzle';
import { paymentGatewayConfig } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { velopayGateway } from './velopay-gateway';
import { okpayGateway } from './okpay-gateway';
import * as gatewayCache from './gateway-cache';

export interface GatewayOption {
  id: '1' | '2';
  displayName: string;
  gatewayName: 'velopay' | 'okpay';
  enabled: boolean;
  status: 'active' | 'maintenance' | 'disabled';
}

class GatewaySelector {
  private initialized = false;

  /**
   * Initialize gateway selector - warm cache on startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const configs = await db.select().from(paymentGatewayConfig);
      await gatewayCache.warmGatewayCache(configs as any);
      this.initialized = true;
      console.log('[GATEWAY_SELECTOR] Initialized with', configs.length, 'gateways');
    } catch (error) {
      console.error('[GATEWAY_SELECTOR] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get available gateways for deposit page display
   * Returns enabled gateways sorted by priority
   */
  async getAvailableGateways(): Promise<GatewayOption[]> {
    await this.ensureInitialized();

    const configs = await gatewayCache.getAllEnabledGateways();

    // Filter out maintenance/disabled gateways
    const activeConfigs = configs.filter(c => c.status === 'active');

    // If only one gateway, show as single "UPI" option
    if (activeConfigs.length === 1) {
      return [{
        id: '1',
        displayName: 'UPI',
        gatewayName: activeConfigs[0].gatewayName,
        enabled: true,
        status: activeConfigs[0].status,
      }];
    }

    // Map to UPI 1 / UPI 2 format
    return activeConfigs.map((config, index) => ({
      id: (index + 1).toString() as '1' | '2',
      displayName: config.displayName,
      gatewayName: config.gatewayName,
      enabled: config.enabled,
      status: config.status,
    }));
  }

  /**
   * Get gateway instance by priority selection (1 = UPI 1, 2 = UPI 2)
   */
  async getGatewayByPriority(priority: 1 | 2): Promise<typeof velopayGateway | typeof okpayGateway> {
    await this.ensureInitialized();

    const config = await gatewayCache.getGatewayByPriority(priority);

    if (!config) {
      throw new Error(`No gateway configured for priority ${priority}`);
    }

    if (config.status !== 'active') {
      throw new Error(`Gateway ${config.displayName} is currently ${config.status}`);
    }

    // Return the appropriate gateway instance
    switch (config.gatewayName) {
      case 'velopay':
        return velopayGateway;
      case 'okpay':
        return okpayGateway;
      default:
        throw new Error(`Unknown gateway: ${config.gatewayName}`);
    }
  }

  /**
   * Get gateway config by ID
   */
  async getGatewayConfig(id: string): Promise<any> {
    await this.ensureInitialized();

    const config = await db
      .select()
      .from(paymentGatewayConfig)
      .where(eq(paymentGatewayConfig.id, id))
      .limit(1);

    return config[0] || null;
  }

  /**
   * Refresh gateway config from database and invalidate cache
   */
  async refreshConfig(id?: string): Promise<void> {
    if (id) {
      // Refresh specific gateway
      const config = await db
        .select()
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.id, id))
        .limit(1);

      if (config[0]) {
        await gatewayCache.setGatewayConfig(id, config[0] as any);
      }
    } else {
      // Refresh all gateways
      const configs = await db.select().from(paymentGatewayConfig);
      await gatewayCache.invalidateAllGatewayCache();
      await gatewayCache.warmGatewayCache(configs as any);
    }
  }

  /**
   * Ensure selector is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const gatewaySelector = new GatewaySelector();

// Initialize on module load (in production)
if (process.env.NODE_ENV === 'production') {
  gatewaySelector.initialize().catch(console.error);
}
```

- [ ] **Step 2: Commit gateway selector service**

```bash
git add lib/gateway-selector.ts
git commit -m "feat: add gateway selector service

- Selects and routes to payment gateways based on priority
- Reads from DB with Redis caching
- getAvailableGateways for deposit page
- getGatewayByPriority for UPI 1/2 resolution
- Auto-initialization in production"
```

---

## Task 5: Deposit Router - Gateway Availability

**Files:**
- Create: `server/routers/deposit.ts`

- [ ] **Step 1: Create deposit router**

Create `server/routers/deposit.ts`:

```typescript
/**
 * Deposit Router
 * Public procedures for deposit-related queries
 */

import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { gatewaySelector } from '@/lib/gateway-selector';

export const depositRouter = router({
  /**
   * Get available deposit gateways
   * Returns enabled gateways for display on deposit page
   */
  getAvailableGateways: publicProcedure
    .query(async () => {
      try {
        const gateways = await gatewaySelector.getAvailableGateways();
        return {
          success: true,
          gateways,
        };
      } catch (error) {
        console.error('[DEPOSIT] Failed to get available gateways:', error);
        return {
          success: false,
          gateways: [],
          error: 'Failed to load payment options',
        };
      }
    }),
});
```

- [ ] **Step 2: Register deposit router in index**

Modify `server/routers/index.ts` to add the deposit router. After the existing imports, add:

```typescript
import { depositRouter } from './deposit';
```

In the appRouter export, add the deposit router:

```typescript
export const appRouter = router({
  // ... existing routers ...
  deposit: depositRouter,
  // ... existing routers ...
});
```

- [ ] **Step 3: Commit deposit router**

```bash
git add server/routers/deposit.ts server/routers/index.ts
git commit -m "feat: add deposit router with gateway availability

- getAvailableGateways public procedure
- Returns UPI 1 / UPI 2 options based on config
- Handles initialization errors gracefully"
```

---

## Task 6: Update Transaction Router

**Files:**
- Modify: `server/routers/transaction.ts`

- [ ] **Step 1: Update initiateDeposit input schema**

Find the `initiateDeposit` procedure (around line 32). Replace the input schema:

**Before:**
```typescript
input(z.object({
  amount: z.string().regex(/^\d+$/, "Invalid amount format — must be a whole number (paisa)"),
  method: z.enum(['upi', 'paytm', 'phonepe', 'okpay-upi', 'okpay-intent', 'bank_transfer', 'crypto']),
  phone: z.string().optional(),
  clientProvidedKey: z.string().optional(),
  currency: z.string().default('USD'),
}))
```

**After:**
```typescript
input(z.object({
  amount: z.string().regex(/^\d+$/, "Invalid amount format — must be a whole number (paisa)"),
  gatewaySelection: z.enum(['1', '2']), // UPI 1 or UPI 2
  phone: z.string().optional(), // Required for some gateways
  clientProvidedKey: z.string().optional(),
  currency: z.string().default('INR'),
}))
```

- [ ] **Step 2: Replace method-based routing with gateway selector**

Find the section after fraud detection (around line 78+). Replace the Velopay/OKPay integration block:

**Before:**
```typescript
// Integrate with VeloPay for UPI deposits
if (input.method === 'upi' || input.method === 'paytm' || input.method === 'phonepe') {
  try {
    // ... velopay code ...
  } catch (error) {
    // ... error handling ...
  }
}

// Integrate with OKPay for UPI deposits
if (input.method === 'okpay-upi' || input.method === 'okpay-intent') {
  try {
    // ... okpay code ...
  } catch (error) {
    // ... error handling ...
  }
}
```

**After:**
```typescript
// Get gateway by user selection (UPI 1 or UPI 2)
const priority = parseInt(input.gatewaySelection) as 1 | 2;
const gateway = await gatewaySelector.getGatewayByPriority(priority);

try {
  if (priority === 1) {
    // UPI 1 - Primary gateway (Velopay or OKPay based on config)
    const gatewayName = gateway === velopayGateway ? 'Velopay' : 'OKPay';
    console.log('[TRANSACTION] Routing to UPI 1 gateway:', gatewayName);

    // Determine which gateway instance we have
    if (gateway === velopayGateway) {
      // Velopay integration
      const amountInPaisa = velopayGateway.inrToPaisa(input.amount);

      const velopayResponse = await velopayGateway.createDeposit({
        txn_id: depositId,
        amount: amountInPaisa,
        type: 1,
        currency: 'INR',
      });

      await db.update(deposit)
        .set({
          gatewayReference: velopayResponse.id,
          gatewayMetadata: velopayResponse,
          gatewayId: (await gatewaySelector.getGatewayConfig(
            (await db.select({ id: paymentGatewayConfig.id })
              .from(paymentGatewayConfig)
              .where(eq(paymentGatewayConfig.gatewayName, 'velopay'))
              .limit(1))[0]?.id || ''
          ))?.id || null,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositId));

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        depositId,
        transactionId,
        paymentUrl: velopayResponse.pay_link,
        message: 'Deposit initiated. Complete UPI payment to credit your balance.',
      };
    } else {
      // OKPay integration for UPI 1
      const amountInRupees = (BigInt(input.amount) / 100n).toString();

      const okpayResponse = await okpayGateway.createDeposit({
        out_trade_no: depositId,
        pay_type: 'UPI',
        money: amountInRupees,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/deposit/success`,
      });

      const gatewayId = (await db.select({ id: paymentGatewayConfig.id })
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.gatewayName, 'okpay'))
        .limit(1))[0]?.id || '';

      await db.update(deposit)
        .set({
          gatewayReference: okpayResponse.data.transaction_Id,
          gatewayMetadata: okpayResponse,
          gatewayId,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositId));

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        depositId,
        transactionId,
        paymentUrl: okpayResponse.data.url,
        message: 'Complete UPI payment to credit your balance.',
      };
    }
  } else {
    // UPI 2 - Secondary gateway
    const gatewayName = gateway === velopayGateway ? 'Velopay' : 'OKPay';
    console.log('[TRANSACTION] Routing to UPI 2 gateway:', gatewayName);

    // Similar logic for UPI 2 (secondary gateway)
    // ... [same pattern as UPI 1 but for secondary]
    const isVelopay = gateway === velopayGateway;

    if (isVelopay) {
      const amountInPaisa = velopayGateway.inrToPaisa(input.amount);
      const velopayResponse = await velopayGateway.createDeposit({
        txn_id: depositId,
        amount: amountInPaisa,
        type: 1,
        currency: 'INR',
      });

      const gatewayId = (await db.select({ id: paymentGatewayConfig.id })
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.gatewayName, 'velopay'))
        .limit(1))[0]?.id || '';

      await db.update(deposit)
        .set({
          gatewayReference: velopayResponse.id,
          gatewayMetadata: velopayResponse,
          gatewayId,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositId));

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        depositId,
        transactionId,
        paymentUrl: velopayResponse.pay_link,
        message: 'Deposit initiated. Complete UPI payment to credit your balance.',
      };
    } else {
      const amountInRupees = (BigInt(input.amount) / 100n).toString();
      const okpayResponse = await okpayGateway.createDeposit({
        out_trade_no: depositId,
        pay_type: 'UPI',
        money: amountInRupees,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/deposit/success`,
      });

      const gatewayId = (await db.select({ id: paymentGatewayConfig.id })
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.gatewayName, 'okpay'))
        .limit(1))[0]?.id || '';

      await db.update(deposit)
        .set({
          gatewayReference: okpayResponse.data.transaction_Id,
          gatewayMetadata: okpayResponse,
          gatewayId,
          updatedAt: new Date(),
        })
        .where(eq(deposit.id, depositId));

      await idempotencyService.complete(idempotencyKey);

      return {
        success: true,
        depositId,
        transactionId,
        paymentUrl: okpayResponse.data.url,
        message: 'Complete UPI payment to credit your balance.',
      };
    }
  }
} catch (error) {
  await idempotencyService.delete(idempotencyKey);
  console.error('[TRANSACTION] Deposit initiation failed:', error);
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to initiate deposit with payment gateway',
  });
}
```

- [ ] **Step 3: Remove crypto fallback code**

Find and remove the crypto fallback section (around line 206-218):

**Remove this block:**
```typescript
// For other methods (crypto, bank_transfer), return mock response
const paymentBaseUrl = process.env.NEXT_PUBLIC_CRYPTO_GATEWAY_URL ||
  'https://payment-gateway.example';

await idempotencyService.complete(idempotencyKey);

return {
  success: true,
  depositId,
  transactionId,
  paymentUrl: `${paymentBaseUrl}/pay?amount=${input.amount}&method=${input.method}&id=${depositId}`,
  message: 'Deposit initiated. Complete payment to credit your balance.',
};
```

- [ ] **Step 4: Add missing imports**

Add these imports at the top of `server/routers/transaction.ts` if not already present:

```typescript
import { gatewaySelector } from '@/lib/gateway-selector';
import { paymentGatewayConfig } from '@/drizzle/schema';
```

- [ ] **Step 5: Test transaction router changes**

Run type check:

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Commit transaction router changes**

```bash
git add server/routers/transaction.ts
git commit -m "feat: update transaction router for gateway selection

- Replace method enum with gatewaySelection (1/2)
- Route via gatewaySelector service
- Remove crypto fallback logic
- Store gatewayId on deposit records
- Support dynamic Velopay/OKPay routing"
```

---

## Task 7: Update Deposit Page UI

**Files:**
- Modify: `app/deposit/page.tsx`

- [ ] **Step 1: Replace static payment categories with dynamic loading**

Replace the entire content of `app/deposit/page.tsx` with:

```typescript
"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import {
  IoQrCodeOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Bottom navigation items
const NAV_ITEMS = [
  { id: "home", icon: IoHomeOutline, label: "Home" },
  { id: "deposit", icon: IoArrowDownCircleOutline, label: "Deposit" },
  { id: "withdraw", icon: IoArrowUpCircleOutline, label: "Withdraw" },
  { id: "profile", icon: IoPersonOutline, label: "Profile" },
  { id: "menu", icon: IoMenuOutline, label: "More" },
];

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // Fetch available gateways
  const { data: gatewaysResponse, isLoading } = api.deposit.getAvailableGateways.useQuery();

  const availableGateways = gatewaysResponse?.success ? gatewaysResponse.gateways : [];

  // Map icon names to actual icon components for bottom nav
  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    home: IoHomeOutline,
    deposit: IoArrowDownCircleOutline,
    withdraw: IoArrowUpCircleOutline,
    profile: IoPersonOutline,
    menu: IoMenuOutline,
  };

  // Bottom navigation items with icons
  const NAV_ITEMS_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
    id: item.id,
    icon: NAV_ICONS[item.id],
    label: item.label,
  }));

  // Handle navigation
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
  };

  // Handle gateway selection - initiate deposit
  const handleGatewayClick = async (gatewayId: string) => {
    try {
      // Call initiate deposit with selected gateway
      // For now, navigate to a deposit amount entry page
      // This will be expanded in a future task
      router.push(`/deposit/${gatewayId}`);
    } catch (error) {
      console.error('Failed to initiate deposit:', error);
      alert('Failed to initiate deposit. Please try again.');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}>
        <AppHeader
          isAuthenticated={isAuthenticated}
          user={user ? {
            username: user.username,
            avatar: user.image,
            balance: user.balance ? parseFloat(user.balance) : 0,
            vipLevel: user.vipLevel,
          } : undefined}
          notificationCount={0}
          title="Deposit"
        />
        <div className="px-5 py-7">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (!gatewaysResponse?.success || availableGateways.length === 0) {
    return (
      <div className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}>
        <AppHeader
          isAuthenticated={isAuthenticated}
          user={user ? {
            username: user.username,
            avatar: user.image,
            balance: user.balance ? parseFloat(user.balance) : 0,
            vipLevel: user.vipLevel,
          } : undefined}
          notificationCount={0}
          title="Deposit"
        />
        <div className="px-5 py-7">
          <h1 className="text-2xl font-bold mb-2">Deposit Funds</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choose your preferred deposit method
          </p>
          <div className="p-6 bg-muted/30 rounded-lg border border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              {gatewaysResponse?.error || 'Deposit services are temporarily unavailable. Please try again later.'}
            </p>
          </div>
        </div>
        <BottomNav items={NAV_ITEMS_WITH_ICONS} active="deposit" onChange={handleNavigate} />
      </div>
    );
  }

  // Determine layout based on number of gateways
  const isSingleGateway = availableGateways.length === 1;

  return (
    <div
      className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}
    >
      <AppHeader
        isAuthenticated={isAuthenticated}
        user={user ? {
          username: user.username,
          avatar: user.image,
          balance: user.balance ? parseFloat(user.balance) : 0,
          vipLevel: user.vipLevel,
        } : undefined}
        notificationCount={2}
        title="Deposit"
      />

      <div className="px-5 py-7">
        {/* Page title */}
        <h1 className="text-2xl font-bold mb-2">Deposit Funds</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose your preferred deposit method
        </p>

        {/* Payment Gateway Options */}
        <section className="mb-6">
          <div className={cn(
            "grid gap-3",
            isSingleGateway ? "grid-cols-1" : "grid-cols-2"
          )}>
            {availableGateways.map((gateway) => (
              <div
                key={gateway.id}
                onClick={() => handleGatewayClick(gateway.id)}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2",
                  "bg-card hover:bg-accent/50",
                  "transition-all duration-200",
                  "cursor-pointer",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "p-4 flex flex-col items-center justify-center",
                  isSingleGateway ? "min-h-[120px]" : "min-h-[160px]",
                  "text-center"
                )}
              >
                {/* Icon */}
                <div className="text-4xl mb-3 text-green-500">
                  <IoQrCodeOutline />
                </div>

                {/* Name */}
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {gateway.displayName}
                </h3>

                {/* Status indicator */}
                {gateway.status === 'maintenance' && (
                  <span className="text-xs text-orange-500">
                    Under Maintenance
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            💡 You'll be redirected to our secure payment gateway to complete your deposit
          </p>
        </section>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="deposit" onChange={handleNavigate} />
    </div>
  );
}
```

- [ ] **Step 2: Commit deposit page changes**

```bash
git add app/deposit/page.tsx
git commit -m "feat: update deposit page for dynamic gateway loading

- Fetch available gateways from API
- Show single or dual gateway layout based on config
- Loading and error states
- Navigate to gateway-specific deposit flow
- Remove hardcoded crypto option"
```

---

## Task 8: Admin Gateway Router

**Files:**
- Create: `server/routers/admin-gateway.ts`

- [ ] **Step 1: Create admin gateway router**

Create `server/routers/admin-gateway.ts`:

```typescript
/**
 * Admin Gateway Router
 * Admin procedures for managing payment gateway configurations
 */

import { router, adminProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { db } from '@/drizzle';
import { paymentGatewayConfig, deposit } from '@/drizzle/schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { gatewaySelector } from '@/lib/gateway-selector';
import { velopayGateway } from '@/lib/velopay-gateway';
import { okpayGateway } from '@/lib/okpay-gateway';
import * as gatewayCache from '@/lib/gateway-cache';

export const adminGatewayRouter = router({
  /**
   * Get all gateway configurations
   */
  getConfigs: adminProcedure
    .query(async () => {
      const configs = await db
        .select()
        .from(paymentGatewayConfig)
        .orderBy(paymentGatewayConfig.priority);

      return configs;
    }),

  /**
   * Get single gateway config by ID
   */
  getConfig: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const config = await db
        .select()
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.id, input.id))
        .limit(1);

      if (!config[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Gateway configuration not found',
        });
      }

      return config[0];
    }),

  /**
   * Update gateway configuration
   */
  updateConfig: adminProcedure
    .input(z.object({
      id: z.string(),
      enabled: z.boolean().optional(),
      priority: z.number().int().min(1).max(2).optional(),
      status: z.enum(['active', 'maintenance', 'disabled']).optional(),
      displayName: z.string().optional(),
      configMetadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;

      // Check if config exists
      const existing = await db
        .select()
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.id, id))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Gateway configuration not found',
        });
      }

      // Update config
      await db
        .update(paymentGatewayConfig)
        .set(updates)
        .where(eq(paymentGatewayConfig.id, id));

      // Invalidate cache
      await gatewayCache.invalidateGateway(id);
      await gatewaySelector.refreshConfig(id);

      // Return updated config
      const updated = await db
        .select()
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.id, id))
        .limit(1);

      return updated[0];
    }),

  /**
   * Test gateway connection
   */
  testConnection: adminProcedure
    .input(z.object({
      gatewayName: z.enum(['velopay', 'okpay']),
    }))
    .mutation(async ({ input }) => {
      try {
        if (input.gatewayName === 'velopay') {
          // Test Velopay by getting config
          const config = velopayGateway.getConfig();
          return {
            success: true,
            gateway: 'velopay',
            config: {
              gatewayUrl: config.gatewayUrl,
              merchantNo: config.merchantNo,
              currency: config.currency,
            },
          };
        } else {
          // Test OKPay by getting config
          const config = okpayGateway.getConfig();
          return {
            success: true,
            gateway: 'okpay',
            config: {
              host: config.host,
              mchId: config.mchId,
              currency: config.currency,
            },
          };
        }
      } catch (error) {
        return {
          success: false,
          gateway: input.gatewayName,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  /**
   * Get transaction stats per gateway
   */
  getStats: adminProcedure
    .query(async () => {
      // Get deposit counts per gateway
      const stats = await db
        .select({
          gatewayId: deposit.gatewayId,
          count: count(),
          totalAmount: deposit.amount, // Note: this needs aggregation in real implementation
        })
        .from(deposit)
        .where(eq(deposit.status, 'completed'))
        .groupBy(deposit.gatewayId);

      // Get gateway configs for names
      const configs = await db
        .select()
        .from(paymentGatewayConfig);

      // Map stats to gateway names
      const statsWithNames = stats.map(stat => {
        const config = configs.find(c => c.id === stat.gatewayId);
        return {
          gatewayId: stat.gatewayId,
          gatewayName: config?.gatewayName || 'unknown',
          displayName: config?.displayName || 'Unknown',
          count: Number(stat.count),
        };
      });

      return statsWithNames;
    }),
});
```

- [ ] **Step 2: Register admin gateway router in index**

Modify `server/routers/index.ts`:

```typescript
import { adminGatewayRouter } from './admin-gateway';
```

Add to appRouter:

```typescript
export const appRouter = router({
  // ... existing routers ...
  adminGateway: adminGatewayRouter,
  // ... existing routers ...
});
```

- [ ] **Step 3: Commit admin gateway router**

```bash
git add server/routers/admin-gateway.ts server/routers/index.ts
git commit -m "feat: add admin gateway router

- getConfigs: get all gateway configurations
- updateConfig: update enabled/priority/status/metadata
- testConnection: test gateway connectivity
- getStats: transaction stats per gateway
- Cache invalidation on updates"
```

---

## Task 9: Admin Gateway List Component

**Files:**
- Create: `app/admin/gateways/components/gateway-list.tsx`

- [ ] **Step 1: Create gateway list component**

Create `app/admin/gateways/components/gateway-list.tsx`:

```typescript
"use client";

import * as React from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GatewayEditor } from "./gateway-editor";

interface GatewayListProps {
  onEdit?: (gatewayId: string) => void;
}

export function GatewayList({ onEdit }: GatewayListProps) {
  const { data: gateways, isLoading } = api.adminGateway.getConfigs.useQuery();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const utils = api.useContext();

  const updateEnabledMutation = api.adminGateway.updateConfig.useMutation({
    onSuccess: () => {
      utils.adminGateway.getConfigs.invalidate();
    },
  });

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    updateEnabledMutation.mutate({
      id,
      enabled,
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    onEdit?.(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'maintenance':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'disabled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!gateways || gateways.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No gateway configurations found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {gateways.map((gateway) => (
        <Card key={gateway.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">{gateway.displayName}</CardTitle>
              <CardDescription className="text-sm">
                {gateway.gatewayName} • Priority: {gateway.priority}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(gateway.status)}>
                {gateway.status}
              </Badge>
              <Switch
                checked={gateway.enabled}
                onCheckedChange={(checked) => handleToggleEnabled(gateway.id, checked)}
                disabled={updateEnabledMutation.isPending}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {gateway.enabled
                  ? `${gateway.displayName} is currently active`
                  : `${gateway.displayName} is disabled`
                }
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(gateway.id)}
              >
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingId && (
        <GatewayEditor
          gatewayId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit gateway list component**

```bash
git add app/admin/gateways/components/gateway-list.tsx
git commit -m "feat: add gateway list component

- Display all gateway configs in cards
- Toggle enabled switch with mutation
- Status badge with color coding
- Configure button opens editor
- Loading and empty states"
```

---

## Task 10: Admin Gateway Editor Component

**Files:**
- Create: `app/admin/gateways/components/gateway-editor.tsx`

- [ ] **Step 1: Create gateway editor component**

Create `app/admin/gateways/components/gateway-editor.tsx`:

```typescript
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const gatewayConfigSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(2),
  status: z.enum(['active', 'maintenance', 'disabled']),
  apiKey: z.string().optional(),
  secret: z.string().optional(),
  merchantId: z.string().optional(),
  host: z.string().optional(),
  callbackUrl: z.string().optional(),
  mode: z.enum(['sandbox', 'production']).optional(),
});

type GatewayConfigValues = z.infer<typeof gatewayConfigSchema>;

interface GatewayEditorProps {
  gatewayId: string;
  onClose: () => void;
}

export function GatewayEditor({ gatewayId, onClose }: GatewayEditorProps) {
  const router = useRouter();
  const utils = api.useContext();

  const { data: gateway, isLoading } = api.adminGateway.getConfig.useQuery(
    { id: gatewayId }
  );

  const updateMutation = api.adminGateway.updateConfig.useMutation({
    onSuccess: () => {
      utils.adminGateway.getConfigs.invalidate();
      utils.adminGateway.getConfig.invalidate({ id: gatewayId });
      onClose();
    },
  });

  const form = useForm<GatewayConfigValues>({
    resolver: zodResolver(gatewayConfigSchema),
    defaultValues: {
      displayName: gateway?.displayName || '',
      enabled: gateway?.enabled ?? true,
      priority: gateway?.priority || 1,
      status: gateway?.status || 'active',
      apiKey: gateway?.configMetadata?.apiKey || '',
      secret: gateway?.configMetadata?.secret || '',
      merchantId: gateway?.configMetadata?.merchantId || '',
      host: gateway?.configMetadata?.host || '',
      callbackUrl: gateway?.configMetadata?.callbackUrl || '',
      mode: gateway?.configMetadata?.mode || 'production',
    },
  });

  // Update form when gateway data loads
  React.useEffect(() => {
    if (gateway) {
      form.reset({
        displayName: gateway.displayName,
        enabled: gateway.enabled,
        priority: gateway.priority,
        status: gateway.status as any,
        apiKey: gateway.configMetadata?.apiKey || '',
        secret: gateway.configMetadata?.secret || '',
        merchantId: gateway.configMetadata?.merchantId || '',
        host: gateway.configMetadata?.host || '',
        callbackUrl: gateway.configMetadata?.callbackUrl || '',
        mode: gateway.configMetadata?.mode || 'production',
      });
    }
  }, [gateway, form]);

  const onSubmit = (values: GatewayConfigValues) => {
    updateMutation.mutate({
      id: gatewayId,
      displayName: values.displayName,
      enabled: values.enabled,
      priority: values.priority,
      status: values.status,
      configMetadata: {
        apiKey: values.apiKey,
        secret: values.secret,
        merchantId: values.merchantId,
        host: values.host,
        callbackUrl: values.callbackUrl,
        mode: values.mode,
      },
    });
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {gateway?.displayName}</DialogTitle>
          <DialogDescription>
            Update gateway settings and configuration
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="UPI 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Enabled</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={(val) => field.onChange(parseInt(val))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 (UPI 1)</SelectItem>
                        <SelectItem value="2">2 (UPI 2)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">API Configuration</h3>

              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway Host</FormLabel>
                    <FormControl>
                      <Input placeholder="https://gateway.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="merchantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Key</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit gateway editor component**

```bash
git add app/admin/gateways/components/gateway-editor.tsx
git commit -m "feat: add gateway editor dialog

- Edit display name, enabled, priority, status
- Configure API credentials (host, merchantId, apiKey, secret)
- Form validation with react-hook-form
- Loading and disabled states during mutation"
```

---

## Task 11: Admin Gateways Page

**Files:**
- Create: `app/admin/gateways/page.tsx`
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Create admin layout**

Create `app/admin/layout.tsx`:

```typescript
/**
 * Admin Layout
 * Layout for admin pages with authentication check
 */

import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ReactNode } from "react";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await authClient.getSession();

  if (!session) {
    redirect("/signin");
  }

  // TODO: Add admin role check
  // if (session.user.role !== "admin") {
  //   redirect("/");
  // }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create admin gateways page**

Create `app/admin/gateways/page.tsx`:

```typescript
/**
 * Admin Gateways Page
 * Admin interface for managing payment gateway configurations
 */

import { GatewayList } from "./components/gateway-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/trpc/client";

export default function AdminGatewaysPage() {
  const utils = api.useContext();
  const testConnectionMutation = api.adminGateway.testConnection.useMutation();

  const handleTestVelopay = () => {
    testConnectionMutation.mutate({ gatewayName: 'velopay' });
  };

  const handleTestOkpay = () => {
    testConnectionMutation.mutate({ gatewayName: 'okpay' });
  };

  const handleRefresh = () => {
    utils.adminGateway.getConfigs.invalidate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment Gateways</h2>
          <p className="text-muted-foreground">
            Manage payment gateway configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Test Connections</CardTitle>
          <CardDescription>
            Verify connectivity to payment gateways
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestVelopay}
              disabled={testConnectionMutation.isPending}
            >
              Test Velopay
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestOkpay}
              disabled={testConnectionMutation.isPending}
            >
              Test OKPay
            </Button>
          </div>
          {testConnectionMutation.data && (
            <div className="mt-4 p-3 bg-muted rounded text-sm">
              <pre className="overflow-auto">
                {JSON.stringify(testConnectionMutation.data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gateway List */}
      <GatewayList />
    </div>
  );
}
```

- [ ] **Step 3: Commit admin pages**

```bash
git add app/admin/gateways/page.tsx app/admin/layout.tsx
git commit -m "feat: add admin gateways management page

- List all gateway configurations
- Test connection buttons for Velopay/OKPay
- Refresh button for data reload
- Admin layout with auth check
- TODO: admin role verification"
```

---

## Task 12: Type Generation and Verification

**Files:**
- (Type generation)

- [ ] **Step 1: Generate tRPC types**

```bash
npx tsx --lib ./node_modules/@types/node -e "import('child_process').spawn('npx', ['tsr', 'generate'], {stdio: 'inherit'})"
```

Or if you have a specific script:

```bash
npm run typegen
```

Expected: tRPC types regenerated with new procedures.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Fix any type errors**

If there are type errors, fix them and re-run type check.

- [ ] **Step 4: Commit any type fixes**

```bash
git add -A
git commit -m "fix: resolve type errors after implementation"
```

---

## Task 13: Integration Testing

**Files:**
- (Manual testing)

- [ ] **Step 1: Start development server**

```bash
npm run dev
```

- [ ] **Step 2: Test gateway configuration in database**

Open PostgreSQL client and verify:

```sql
SELECT * FROM payment_gateway_config;
```

Expected: Two rows (velopay, okpay) with enabled=true.

- [ ] **Step 3: Test deposit page**

1. Navigate to http://localhost:3000/deposit
2. Verify "UPI 1" and "UPI 2" cards are shown
3. Click on a card and verify navigation

- [ ] **Step 4: Test admin gateway page**

1. Navigate to http://localhost:3000/admin/gateways
2. Verify gateway list displays
3. Test toggle enabled switch
4. Test configure button opens editor
5. Test save changes

- [ ] **Step 5: Test gateway cache**

Check Redis for cached data:

```bash
redis-cli KEYS "gateway_config:*"
```

Expected: Keys present for cached configs.

- [ ] **Step 6: Document any issues found**

Create a list of any issues found during testing for later fixes.

---

## Task 14: Documentation and Cleanup

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/deposit-system.md`

- [ ] **Step 1: Update CLAUDE.md with new architecture**

Add to the Architecture section in `CLAUDE.md`:

```markdown
**Payment Gateway Architecture** (`lib/gateway-selector.ts`): Dynamic gateway routing with database configuration:
- `paymentGatewayConfig` table stores Velopay/OKPay configurations
- `gateway-cache.ts` provides Redis caching with 5-minute TTL
- `gatewaySelector.getAvailableGateways()` - returns UPI 1 / UPI 2 options for UI
- `gatewaySelector.getGatewayByPriority(1|2)` - routes to configured gateway
- Admin UI at `/admin/gateways` for real-time gateway management
- Priority-based mapping: 1 = primary (UPI 1), 2 = secondary (UPI 2)
```

- [ ] **Step 2: Create deposit system documentation**

Create `docs/deposit-system.md`:

```markdown
# Deposit System Documentation

## Overview

The deposit system supports UPI payments through two configurable gateways: Velopay and OKPay. Gateway configuration is database-driven with Redis caching for performance.

## Architecture

### Components

1. **Gateway Config Table** (`paymentGatewayConfig`)
   - Stores gateway configurations (Velopay, OKPay)
   - Fields: enabled, priority, status, configMetadata
   - Status: active, maintenance, disabled

2. **Gateway Selector** (`lib/gateway-selector.ts`)
   - Selects gateway based on user selection (UPI 1 or UPI 2)
   - Reads from database with Redis caching
   - Auto-initialization on production startup

3. **Gateway Cache** (`lib/gateway-cache.ts`)
   - Redis-backed caching for gateway configs
   - 5-minute TTL for automatic refresh
   - Invalidation on config updates

4. **Admin UI** (`/admin/gateways`)
   - View all gateway configurations
   - Enable/disable gateways
   - Edit gateway settings
   - Test gateway connections

### Deposit Flow

1. User visits deposit page
2. Page calls `deposit.getAvailableGateways()` query
3. System returns 1 or 2 options (UPI or UPI 1 + UPI 2)
4. User selects option
5. `initiateDeposit` mutation receives `gatewaySelection: "1" | "2"`
6. Gateway selector routes to appropriate gateway
7. Gateway creates payment order
8. User completes payment on gateway page
9. Webhook confirms and credits balance

## Configuration

### Environment Variables

```bash
# Velopay
VELOPAY_GATEWAY_URL=https://velopay.ptasm.online
VELOPAY_MERCHANT_NO=201
VELOPAY_SECRET_KEY=your_secret_key
VELOPAY_CALLBACK_URL=https://clausbet.com/api/webhook/velopay

# OKPay
OKPAY_HOST=https://okpay.com
OKPAY_MCH_ID=your_merchant_id
OKPAY_KEY=your_secret_key
OKPAY_CALLBACK_URL=https://clausbet.com/api/webhook/okpay
OKPAY_MODE=production
```

### Database Seed

Initial gateway configurations are seeded via:

```bash
npx tsx drizzle/seed/index.ts
```

## Admin Management

Access admin gateway management at `/admin/gateways`:

- View all configured gateways
- Toggle enabled status
- Edit priority (which affects UPI 1 / UPI 2 display)
- Update API credentials
- Set maintenance status
- Test gateway connections

## Testing

### Test Deposit Flow

1. Navigate to `/deposit`
2. Verify gateway options display correctly
3. Select a gateway option
4. Complete payment flow

### Test Admin Controls

1. Navigate to `/admin/gateways`
2. Toggle gateway enabled status
3. Verify deposit page reflects changes
4. Edit gateway configuration
5. Test gateway connection

## Troubleshooting

### Gateways not showing on deposit page

1. Check `payment_gateway_config` table for enabled gateways
2. Verify Redis cache is not stale
3. Check browser console for API errors

### Gateway connection failing

1. Verify environment variables are set
2. Test gateway from admin panel
3. Check gateway service status
4. Review gateway logs

### Cache issues

```bash
# Clear all gateway cache
redis-cli KEYS "gateway_config:*" | xargs redis-cli DEL
```
```

- [ ] **Step 3: Commit documentation**

```bash
git add CLAUDE.md docs/deposit-system.md
git commit -m "docs: add deposit system documentation

- Update CLAUDE.md with gateway architecture
- Add comprehensive deposit system guide
- Include configuration, admin, and troubleshooting sections"
```

---

## Completion Checklist

- [ ] All tasks completed
- [ ] All commits made
- [ ] Type checking passes
- [ ] Manual integration testing completed
- [ ] Documentation updated
- [ ] No placeholder code remaining
- [ ] Crypto option fully removed from UI and API
- [ ] Gateway selector service functional
- [ ] Admin UI for gateway management functional

---

## Summary

This implementation plan creates a UPI-only deposit system with dynamic gateway configuration. Key deliverables:

1. **Database schema** for gateway configuration with priority-based routing
2. **Gateway selector service** with Redis caching
3. **Updated deposit UI** showing UPI 1 / UPI 2 options
4. **Admin gateway management UI** for real-time configuration
5. **Removal of crypto option** from all layers

The system is designed for flexibility—gateways can be enabled/disabled and reordered without code changes via the admin interface.
