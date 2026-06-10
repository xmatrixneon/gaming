# UPI-Only Deposit System with Dynamic Gateway Configuration

**Date:** 2025-01-10
**Status:** Approved
**Scope:** Deposit system redesign, crypto removal, gateway configuration

---

## Overview

Redesign the deposit system to use UPI-only payment methods (Velopay and OKPay gateways) with dynamic enable/disable configuration via database. Users see generic "UPI 1" and "UPI 2" options without brand names.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deposit Page (UI)                          │
│  ┌──────────┐  ┌──────────┐                                  │
│  │  UPI 1   │  │  UPI 2   │  (or single "UPI" if 1 enabled) │
│  └──────────┘  └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Gateway Selector Service                        │
│  • Reads config from database                                │
│  • Maps UPI 1 → primary gateway                             │
│  • Maps UPI 2 → secondary gateway                            │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│    Velopay Gateway   │        │    OKPay Gateway     │
│  • UPI QR            │        │  • UPI               │
│  • Paytm             │        │  • UPI Intent        │
│  • PhonePe           │        │                      │
└──────────────────────┘        └──────────────────────┘
```

---

## Database Schema

### New Table: `payment_gateway_config`

```typescript
export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: text("id").primaryKey(),
  gatewayName: text("gateway_name").notNull(), // 'velopay' or 'okpay'
  displayName: text("display_name").notNull(), // 'UPI 1' or 'UPI 2'
  enabled: boolean("enabled").default(true).notNull(),
  priority: integer("priority").default(1).notNull(), // 1 = primary, 2 = secondary
  configMetadata: jsonb("config_metadata").$type<{
    apiKey?: string;
    secret?: string;
    merchantId?: string;
    host?: string;
    callbackUrl?: string;
  }>(),
  status: text("status").default("active").notNull(), // 'active', 'maintenance', 'disabled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

### Schema Changes

**Remove from `depositMethodEnum`:**
- `'crypto'` option

**Remove from `transaction` router:**
- Crypto method validation
- Crypto gateway URL fallback logic

---

## Service Layer

### New File: `lib/gateway-selector.ts`

```typescript
interface GatewayOption {
  id: '1' | '2';
  displayName: string;
  gatewayName: 'velopay' | 'okpay';
  enabled: boolean;
}

class GatewaySelector {
  private configCache: Map<string, any> = new Map();
  private cacheTTL = 300; // 5 minutes

  // Get available gateways for deposit page display
  async getAvailableGateways(): Promise<GatewayOption[]>;

  // Get specific gateway by priority (for routing)
  async getGatewayByPriority(priority: 1 | 2): Promise<VelopayGateway | OkpayGateway>;

  // Refresh config from database (invalidates cache)
  async refreshConfig(): Promise<void>;

  // Get config with caching (Redis + in-memory)
  private async getConfig(): Promise<PaymentGatewayConfig[]>;
}
```

---

## UI Changes

### Deposit Page: `app/deposit/page.tsx`

**Before:**
```tsx
PAYMENT_CATEGORIES = [
  { id: "upi", name: "UPI Payment", ... },
  { id: "crypto", name: "Crypto", ... },
]
```

**After:**
```tsx
// Dynamic - fetched from gateway selector
const { data: gateways } = api.deposit.getAvailableGateways.useQuery();

// Renders 1 or 2 cards based on config:
// - Single: "UPI Payment"
// - Double: "UPI 1" and "UPI 2"
```

---

## Admin UI

### New Route: `/app/admin/gateways/page.tsx`

Features:
- List all configured gateways with status
- Toggle enable/disable switches
- Drag-to-reorder priority (UPI 1 vs UPI 2)
- Edit gateway configuration (API keys, etc.)
- Test connection button
- View transaction stats per gateway

### New tRPC Router: `server/routers/admin-gateway.ts`

```typescript
export const adminGatewayRouter = router({
  // Get all gateway configurations
  getConfigs: adminProcedure.query(...),

  // Update single gateway config
  updateConfig: adminProcedure.input(z.object({
    id: z.string(),
    enabled: z.boolean().optional(),
    priority: z.number().optional(),
    status: z.enum(['active', 'maintenance', 'disabled']).optional(),
    configMetadata: z.record(z.any()).optional(),
  })).mutation(...),

  // Test gateway connection
  testConnection: adminProcedure.input(z.object({
    gatewayName: z.enum(['velopay', 'okpay']),
  })).mutation(...),

  // Get transaction stats per gateway
  getStats: adminProcedure.query(...),
});
```

---

## Transaction Router Changes

### `server/routers/transaction.ts`

**Update `initiateDeposit` input:**
```typescript
// Before:
method: z.enum(['upi', 'paytm', 'phonepe', 'okpay-upi', 'okpay-intent', 'bank_transfer', 'crypto']),

// After:
gatewaySelection: z.enum(['1', '2']), // UPI 1 or UPI 2
```

**Update deposit logic:**
```typescript
const gateway = await gatewaySelector.getGatewayByPriority(
  parseInt(input.gatewaySelection) as 1 | 2
);

// Route to appropriate gateway
if (gateway instanceof VelopayGateway) {
  // Velopay deposit flow
} else if (gateway instanceof OkpayGateway) {
  // OKPay deposit flow
}
```

---

## Seed Data

### Initial Gateway Configuration

```sql
INSERT INTO payment_gateway_config (id, gateway_name, display_name, enabled, priority, status) VALUES
('velopay-default', 'velopay', 'UPI 1', true, 1, 'active'),
('okpay-default', 'okpay', 'UPI 2', true, 2, 'active');
```

---

## Error Handling

1. **Both gateways disabled:** Show "Deposits temporarily unavailable" message
2. **Primary gateway fails:** Log error, suggest user try UPI 2
3. **Gateway returns error:** Display user-friendly message, keep deposit record as 'failed'

---

## Security Considerations

1. Gateway credentials stored in `configMetadata` should be encrypted at rest
2. Admin gateway management requires admin role verification
3. Config changes logged to audit_log table
4. Gateway selection cannot be spoofed (server-side validation)

---

## Files to Create/Modify

### New Files
- `lib/gateway-selector.ts`
- `server/routers/admin-gateway.ts`
- `app/admin/gateways/page.tsx`
- `app/admin/gateways/components/gateway-card.tsx`
- `app/admin/gateways/components/gateway-editor.tsx`

### Modified Files
- `drizzle/schema.ts` - add paymentGatewayConfig table, remove crypto from enum
- `server/routers/transaction.ts` - update initiateDeposit logic
- `app/deposit/page.tsx` - dynamic gateway loading
- `lib/velopay-gateway.ts` - no changes (already integrated)
- `lib/okpay-gateway.ts` - no changes (already integrated)

---

## Testing Checklist

- [ ] Single gateway enabled - shows "UPI Payment"
- [ ] Both gateways enabled - shows "UPI 1" and "UPI 2"
- [ ] Selecting UPI 1 routes to correct gateway
- [ ] Selecting UPI 2 routes to correct gateway
- [ ] Disabled gateway not shown
- [ ] Admin can enable/disable gateways
- [ ] Admin can change priority
- [ ] Gateway test connection works
- [ ] Crypto option completely removed from UI and API
- [ ] Deposit flow completes successfully with both gateways

---

## Migration Steps

1. Create new migration for `payment_gateway_config` table
2. Seed initial gateway configurations
3. Run migration to remove 'crypto' from depositMethodEnum
4. Deploy new service layer and router changes
5. Deploy updated deposit UI
6. Deploy admin gateway management UI

---

## Rollback Plan

If issues occur:
1. Admin can disable problematic gateway via admin UI
2. Revert to single-gateway mode in database
3. Previous transaction records remain intact
4. No data loss - configuration only
