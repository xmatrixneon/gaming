# Deposit Page Simplification Design

**Date:** 2025-01-06
**Status:** Approved
**Author:** Graphify + User

## Overview

Simplify the deposit page from 4 payment methods to 2 main category cards (UPI and CRYPTO) displayed horizontally. Each card redirects directly to the payment gateway when clicked.

## Requirements

### Current State
- 4 payment methods: Bitcoin, Ethereum, Credit Card, Instant Bank Transfer
- Vertical card layout
- In-page expansion for network selection and wallet input

### New State
- 2 payment categories: UPI, CRYPTO
- Horizontal card layout (2 columns, equal width)
- Direct redirect to payment gateway on card click
- No in-page expansion needed

## Architecture

### Payment Categories Configuration

```tsx
const PAYMENT_CATEGORIES = [
  {
    id: "upi",
    name: "UPI Payment",
    icon: <IoQrCodeOutline />, // QR code icon
    description: "Google Pay, Paytm, PhonePe + more",
    gatewayUrl: string, // from environment config
  },
  {
    id: "crypto",
    name: "Crypto",
    icon: <IoWalletOutline />, // Wallet icon
    description: "USDT, BTC, ETH + more",
    gatewayUrl: string, // from environment config
  },
];
```

### Component Changes

**Remove:**
- `PAYMENT_METHODS` array (4 methods)
- `NETWORKS` array
- `availableNetworks` logic
- Amount input state
- Network selector UI
- Wallet address input UI
- Submit button UI
- Recent deposits section

**Add:**
- `PAYMENT_CATEGORIES` array (2 categories)
- Gateway URL configuration (environment variable)
- Card click handler for redirect

**Modify:**
- `MethodCard` component: Update to handle new category structure
- Layout: Change from vertical `space-y-2.5` to horizontal `grid-cols-2 gap-3`

### Data Flow

```
User clicks card → handleCategoryClick() → window.open(gatewayUrl) → Payment Gateway
```

### State Management

**Remove state:**
- `selectedMethod`
- `amount`
- `network`
- `walletAddress`
- `isProcessing`

**Add/keep:**
- None needed (simple redirect, no local state)

## Components

### Updated DepositPage Structure

```tsx
export default function DepositPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const handleCategoryClick = (category: PaymentCategory) => {
    // Redirect to payment gateway
    window.open(category.gatewayUrl, '_blank');
    // Or: router.push(category.gatewayUrl);
  };

  return (
    <div>
      <AppHeader />
      <div>
        <h1>Deposit Funds</h1>
        <p>Choose your preferred deposit method</p>

        {/* Two horizontal cards */}
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_CATEGORIES.map((category) => (
            <MethodCard
              key={category.id}
              name={category.name}
              icon={category.icon}
              description={category.description}
              onClick={() => handleCategoryClick(category)}
            />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
```

### MethodCard Updates

**Props change:**
- Remove: `fee`, `estimatedTime`, `badge`, `selected`
- Add: `description` (for the "GPay, Paytm..." text)
- Keep: `name`, `icon`, `onClick`

**UI changes:**
- Larger card for horizontal layout
- Icon centered or top-aligned
- Description text smaller below name
- Remove fee/time/badge elements

## Environment Configuration

Add to `.env`:
```bash
NEXT_PUBLIC_UPI_GATEWAY_URL=https://payment-gateway.com/upi
NEXT_PUBLIC_CRYPTO_GATEWAY_URL=https://payment-gateway.com/crypto
```

## React Icons

**UPI:** `IoQrCodeOutline` from `react-icons/io5`
**Crypto:** `IoWalletOutline` from `react-icons/io5`

## Error Handling

- Gateway URL not configured: Show error toast/note
- Redirect blocked by popup blocker: Show "Click to open payment gateway" fallback

## Testing

- [ ] Two cards display horizontally
- [ ] UPI card shows correct icon and description
- [ ] Crypto card shows correct icon and description
- [ ] Clicking card opens gateway URL
- [ ] Works on mobile (responsive)

## Files to Modify

1. `app/deposit/page.tsx` - Main deposit page
2. `lib/config.ts` - Add gateway URLs
3. `.env.local` - Gateway URL environment variables

## Notes

- Simpler than current implementation
- No amount collection on this page (handled by gateway)
- No network selection (handled by gateway)
- Faster user flow: fewer clicks to deposit
