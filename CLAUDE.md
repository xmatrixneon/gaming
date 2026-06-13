# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClausBet is a mobile-first crypto casino platform built with Next.js 16, featuring a modern UI inspired by BC.Game. The app includes game browsing, user authentication (phone/Google OAuth), deposit/withdrawal flows, multi-currency support, and transaction processing with fraud detection.

### Tech Stack

**Core Framework**: Next.js 16 (App Router) with React 19 and TypeScript
**Styling**: Tailwind CSS 4 with shadcn/ui components, OKLCH color system
**Backend**: tRPC for type-safe APIs, Better Auth for authentication
**Database**: Drizzle ORM with PostgreSQL, Redis for sessions and caching
**Queue**: BullMQ for background job processing
**UI Libraries**: Radix UI primitives, motion/Framer Motion, recharts
**Additional**: ioredis for Redis, next-intl for i18n, dinero.js for currency handling

## Development Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Build & Production
npm run build            # Build for production
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint

# Database (Drizzle)
npx drizzle-kit generate    # Generate migrations from schema changes
npx drizzle-kit migrate     # Apply migrations to database
npx drizzle-kit push        # Push schema changes directly (dev only)
npx drizzle-kit studio      # Open Drizzle Studio for database GUI

# Testing (vitest configured but not yet in package.json scripts)
npx vitest run           # Run all tests once (CI mode)
npx vitest               # Run tests in watch mode
npx vitest run lib/__tests__/okpay-gateway.test.ts  # Run single test file

# Scripts
npx tsx scripts/generate-referral-codes.ts  # Backfill referral codes for existing users
npx tsx scripts/reconcile-balances.ts [--dry-run] [--auto-fix-threshold=100]  # Balance audit
npx tsx scripts/sync-games.ts               # Sync game catalog from external Game API
```

## Architecture

### Project Structure

```
app/                    # Next.js App Router pages
├── (auth)/            # Auth route group (layout wrapper only)
├── signin/            # Phone/Google sign-in page
├── signup/            # Phone/Google sign-up page
├── forgot-password/   # Password reset
├── settings/          # Settings (change-password, set-password sub-routes)
├── payment-methods/   # Payment methods management
├── deposit/           # Deposit flow
├── withdraw/          # Withdrawal flow
├── play/[gameUid]/    # In-app game player
├── profile/           # User profile
├── history/           # Transaction/game history
├── more/              # Additional features menu
└── api/
    ├── auth/[...auth]/    # Better Auth catch-all handler
    ├── trpc/[trpc]/       # tRPC handler
    ├── game/callback/     # Game provider bet settlement callback
    └── webhook/
        ├── game-api/      # Game API webhook
        ├── velopay/       # VeloPay deposit/withdrawal callbacks
        └── okpay/
            ├── deposit/   # OKPay deposit callback
            └── withdrawal/ # OKPay withdrawal callback

server/routers/        # tRPC router implementations
├── auth.ts            # Authentication procedures
├── user.ts            # User profile and preferences
├── wallet.ts          # Wallet balance and transaction queries
├── transaction.ts     # Deposit/withdrawal processing
├── deposit.ts         # Deposit-specific procedures
├── payment-method.ts  # Payment method management
├── game.ts            # Game session and bet queries
├── bonus.ts           # Bonus queries and claims
├── referral.ts        # Referral stats and code lookup
└── vip.ts             # VIP status and benefits

lib/                   # Shared business logic and utilities
├── auth.ts / auth-client.ts  # Better Auth server/client configuration
├── wallet-service.ts  # Atomic balance updates (single source of truth)
├── velopay-gateway.ts # VeloPay payment gateway integration
├── okpay-gateway.ts   # OKPay payment gateway integration
├── gateway-selector.ts # DB-backed gateway routing (reads paymentGatewayConfig table)
├── gateway-cache.ts   # Redis caching layer for gateway configs
├── fraud-detection.ts # Pre-transaction fraud checks
├── idempotency.ts     # Redis-based idempotency keys
├── aggregator-adapter.ts # Game wallet API (debit/credit/rollback for external provider)
├── game-api-client.ts # External game API client (AES256 encrypted requests)
├── game-api-config.ts # Game API env-var configuration
├── game-api-types.ts  # TypeScript types for game API
├── game-adapter.ts    # Adapter between game API and internal types
├── game-service.ts    # Game catalog sync and management
├── game-repository.ts # Database queries for games/providers
├── bonus-service.ts   # Bonus management (templates, wagering, completion)
├── referral-service.ts # Referral program logic
├── vip-service.ts     # VIP tier management
├── crypto-utils.ts    # AES encryption utilities (for game API)
├── format-currency.ts # Currency formatting (BigInt paisa ↔ display)
├── redis.ts           # Redis client and key-generation helpers
├── config.ts          # Navigation, currency, locale configuration
└── trpc/              # tRPC client, server helpers, types, hooks

hooks/
├── use-auth.ts        # Better Auth hook (real implementation — not a mock)
├── use-games.ts       # Game list and filtering
├── use-auto-scroll.ts # Auto-scroll behavior
├── use-mobile.ts      # Mobile detection
└── use-user-preferences.ts # User preference management (localStorage)
```

### Path Aliases

The project uses `@/*` path alias mapping (configured in tsconfig.json and components.json):
- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/hooks` → `hooks/`
- `@/server` → `server/`
- `@/drizzle` → `drizzle/`
- `@/*` → root directory

### Key Architectural Decisions

**Mobile-First Design**: The entire app is optimized for mobile viewport (`max-w-md mx-auto`), with bottom navigation and safe-area handling for iOS/Android.

**Better Auth Integration**: Fully configured authentication system with:
- Google OAuth social login
- Phone-based authentication with OTP (SMS via placeholder)
- Drizzle adapter for PostgreSQL persistence
- Redis secondary storage for OTP codes, rate limiting, and session caching
- Account linking between Google and phone providers
- Additional user fields: balance, vipLevel (managed by Better Auth)

**tRPC Layer**: Type-safe API layer with:
- `publicProcedure` - No authentication required
- `protectedProcedure` - Requires valid Better Auth session
- `adminProcedure` - Requires admin role (placeholder, not implemented)
- Zod validation for input/output
- Superjson transformer for date/circular serialization

**Payment Architecture**: Multi-layer payment processing:
- `gateway-selector.ts` - DB-backed routing: reads `paymentGatewayConfig` table (Redis-cached via `gateway-cache.ts`) to pick VeloPay or OKPay
- `velopay-gateway.ts` / `okpay-gateway.ts` - Gateway implementations; OKPay supports UPI and UPI_INTENT
- `wallet-service.ts` - Business logic for deposits/withdrawals with atomic balance updates
- `fraud-detection.ts` - Pre-transaction fraud checks (amount limits, velocity checks)
- `idempotency.ts` - Duplicate request prevention using Redis
- Webhook handlers at `app/api/webhook/velopay/` and `app/api/webhook/okpay/deposit|withdrawal/`

**Game Integration** (`aggregator-adapter.ts`): Standard aggregator wallet API for external game providers:
- `debit()` - Deduct balance for bet placement with idempotency
- `credit()` - Add winnings with bet lookup and settlement
- `rollback()` - Reverse failed transactions
- Integrates with bonus wagering tracking and VIP progress (on bets only, not wins)

**Bonus System** (`bonus-service.ts`): Flexible bonus management:
- Template-based bonuses (welcome, referral, deposit match)
- Wagering requirement tracking with progress distribution across active bonuses
- Atomic completion: bonus status transitions to "completed" only after wallet credit succeeds
- Welcome bonus auto-awarded on first deposit (100% match, capped)

**Referral System** (`referral-service.ts`): User referral program:
- Unique 12-character referral codes (nanoid-based)
- Self-referral prevention (email similarity and IP match detection)
- Qualification on referred user's first deposit (10% of deposit, max ₹2,000)
- Bonus credited BEFORE status update for retry safety

**VIP System** (`vip-service.ts`): Tiered loyalty program:
- Five tiers: Bronze → Silver → Gold → Platinum → Diamond
- Progress tracked by total wagered (not wins)
- Tier thresholds: Bronze (0), Silver (₹50,000), Gold (₹2,00,000), Platinum (₹5,00,000), Diamond (₹10,00,000)
- Bonus multipliers per tier (1.0x to 2.0x)
- Automatic upgrade with optimistic locking and capped retries
- Benefits per tier: withdrawal limits, exclusive bonuses, support levels

**Database Schema**: Key tables:
- `user` - User accounts with balance, VIP level, referral code (Better Auth managed)
- `session` / `account` - Better Auth managed session and OAuth provider tables
- `transaction` - Immutable transaction ledger (deposit, withdraw, bet, win, bonus, adjustment)
- `deposit` / `withdrawal` - Payment-specific records with gateway references and approval flags
- `gameSession` / `bet` - Game provider sessions and individual bet records
- `gameProvider` / `game` - Game catalog synced from external Game API
- `paymentGatewayConfig` - DB-driven gateway routing (which provider handles each payment type)
- `referral` - Referral relationships with qualification status and reward tracking
- `bonusTemplate` / `userBonus` - Bonus configuration and per-user claims
- `notification` / `auditLog` - User notifications and admin audit trail
- `gameStats` - Per-user statistics (total wagered, win/loss streaks, VIP progress)

**Currency & i18n**: Multi-currency (USD, INR, EUR, BTC, ETH, USDT, USDC, SOL) and multi-locale support (en, hi, es, pt, zh, ja, ko, de, fr) via `lib/config.ts` with type-safe formatting functions using dinero.js for precise currency calculations.

**Redis Usage**: Redis is used for:
- Better Auth secondary storage (OTP codes, rate limiting, session cache)
- Custom OTP storage and verification (`lib/redis.ts` helpers)
- Rate limiting for authentication endpoints
- Session caching for performance
- Referral stats caching (`referral_stats:{userId}`, 300s TTL)
- VIP status caching (`vip_status:{userId}`)
- Active bonuses invalidation (`active_bonuses:{userId}`)

### Component Organization

Components are organized by feature domain (`game/`), with shared components in `game/shared/` and reusable UI components in `ui/`. The `lib/` directory contains business logic services that can be used by both tRPC procedures and React components.

### Styling System

**Color System**: Uses OKLCH color space for better perceptual uniformity. CSS variables define semantic tokens (`--primary`, `--muted`, etc.) with light/dark themes defined in `app/globals.css`.

**Mobile Handling**: Includes CSS utilities for safe areas (iOS notch, Android nav bar) using `env()` variables. Bottom navigation uses Chrome-recommended calc pattern to prevent layout thrashing.

**Component Styling**: shadcn/ui components use CSS variables for theming. Custom components use Tailwind utility classes with `cn()` for conditional styling.

**Tailwind CSS 4**: Uses `@tailwindcss/postcss` (new PostCSS plugin in v4) and `shadcn/tailwind.css` import in globals.css.

### Service Patterns

**Optimistic Locking**: Services that update user state use version-based optimistic locking to prevent race conditions:
- `user.balanceVersion` - Incremented on each balance update (wallet-service.ts)
- `gameStats.statsVersion` - Incremented on each wagering update (vip-service.ts)
- Pattern: `WHERE id = X AND version = N` with retry loop on failure (max 5 retries)

**Atomic Balance Updates**: `walletService.updateBalanceAtomic()` is the single source of truth for balance changes:
- Always returns `{ success, transactionId, balanceBefore, balanceAfter, error }`
- Creates immutable transaction records
- Uses optimistic locking via `balanceVersion`
- All services call this — never update `user.balance` directly

**Idempotency Pattern**: Critical operations use idempotency keys:
- `idempotencyService.generateKey(userId, type, ref)` creates unique keys
- `checkWithStatus()` returns `{ canProceed, status }`
- `complete()` marks successful completion
- `delete()` cleans up on failure
- Used in: aggregator-adapter.ts, wallet-service.ts, transaction router

**Notification Metadata Schema**: When inserting notifications, only include keys defined in `notification.metadata` type:
- `transactionId`, `withdrawalId`, `depositId`, `betId`, `bonusId`, `referralId`, `actionUrl`
- Do NOT add arbitrary fields — this causes TypeScript errors

**Bonus Wagering Distribution**: Active bonuses share wagering proportionally:
- Each bet's amount is split across all active bonuses based on remaining requirement
- Distribution formula: `(betAmount × bonusRemaining) / totalRemaining`
- Prevents bonus abuse by ensuring all bonuses progress together

**VIP Progress on Bets Only**: VIP tier upgrades track total wagered, not total won:
- `vipService.trackProgress()` called on `debit()` (bet placement) only
- NOT called on `credit()` (winning) — VIP is earned by play, not by receiving money
- Same pattern applies to bonus wagering tracking

**Retry with Exponential Backoff**: Operations with optimistic locking use capped retries:
- `MAX_RETRIES = 5` (vip-service.ts)
- Delay: `50ms × (retryCount + 1)`
- Prevents infinite loops under heavy concurrent load

### Configuration Files

**`lib/config.ts`**: Centralized configuration for:
- Bottom navigation items (Home, Deposit, Withdraw, Profile, More)
- Currency formatting with locale-specific separators and decimals
- Locale configuration with associated currencies, date/time formats
- User preference management (localStorage-based)
- Type-safe `formatCurrency()`, `formatUserCurrency()`, `parseCurrency()` functions

**`lib/auth.ts`**: Better Auth server configuration:
- Google OAuth with `prompt: select_account` and offline access
- Phone plugin with 6-digit OTP, 5-minute expiry, 3 attempts allowed
- Redis secondary storage for OTP and rate limiting
- Session management (30-day expiry, 24h update age, 5min cookie cache)
- Account linking between Google and phone providers
- Custom user fields: balance (default: "0"), vipLevel (default: "Bronze")

**`components.json`**: shadcn/ui configuration with Radix Nova style, CSS variables enabled, path aliases matching tsconfig.json.

**`next.config.ts`**: Includes ngrok dev origin for local development with external services.

**`postcss.config.mjs`**: Uses `@tailwindcss/postcss` plugin (Tailwind CSS 4).

**`.env.example`**: Payment gateway URL templates for UPI and crypto gateways, Better Auth URLs, Redis configuration, Google OAuth credentials.

### Important Files

**`drizzle/schema.ts`**: Authoritative source for all tables, relations, indexes, and check constraints. Includes JSONB metadata columns with typed schemas. See file header for financial correctness strategy and reconciliation notes.

**`hooks/use-auth.ts`**: Real Better Auth integration. Combines `authClient.useSession()` for reactive session state, tRPC for business-logic queries, and Better Auth client for auth operations. Email/password sign-up is **disabled** — users authenticate via Phone+OTP or Google OAuth only.

**`lib/format-currency.ts`**: Centralized currency formatting:
- `formatPaisa()` - Convert BigInt paisa to ₹ display string with Indian comma grouping
- `paisaToRupeeString()` - Plain number string for API responses
- `rupeeStringToPaisa()` - Parse user input back to BigInt

**Scripts**:
- `scripts/generate-referral-codes.ts` - Backfill referral codes for existing users
- `scripts/reconcile-balances.ts` - Balance reconciliation (compare `user.balance` vs transaction ledger; run daily, auto-fixes small discrepancies)
- `scripts/sync-games.ts` - Sync game catalog from external Game API into `game`/`gameProvider` tables

## Important Notes

**Next.js 16 Changes**: This uses Next.js 16 which has breaking changes from earlier versions. Always check `node_modules/next/dist/docs/` before implementing Next.js features.

**Auth**: Email/password sign-up is **disabled**. Users authenticate via Phone+OTP or Google OAuth only. Password-related routes (`settings/set-password`, `settings/change-password`) exist for users who want to add a password to an existing account — not for initial sign-up. Better Auth is configured in `lib/auth.ts` (server) and `lib/auth-client.ts` (client).

**Database Migrations**: Use Drizzle migrations for schema changes:
- Edit `drizzle/schema.ts`
- Run `npx drizzle-kit generate` to create migration
- Run `npx drizzle-kit migrate` to apply to database
- Use `npx drizzle-kit push` for rapid prototyping (not recommended for production)

**Latest Schema Changes** (2024-06-10 production review):
- Round 1: UNIQUE constraints on `deposit.transactionId`, `withdrawal.transactionId`, `bet.transactionId` (critical for accounting correctness)
- Round 1: Composite indexes: `transaction_user_created_idx`, `transaction_user_type_created_idx`, `deposit_user_status_created_idx`, `withdrawal_user_status_created_idx`, `bet_user_created_idx`
- Round 1: Partial index `notification_user_unread_created_idx` for efficient unread queries
- Round 2: **Removed `transaction.updatedAt`** - makes ledger truly immutable (append-only)
- Round 2: **Added FK to `user.bannedBy`** - referential integrity for admin actions
- Round 2: **Added `referral_not_self` CHECK** - prevents self-referral at DB level
- Round 2: **Added bonusTemplate CHECKs** - `expiryDays > 0`, `maxClaimsPerUser > 0`, `maxValue >= value`
- See `drizzle/schema.ts` header for financial correctness strategy and reconciliation notes

**Testing**: vitest is configured (`vitest.config.ts`). Test files live in `lib/__tests__/` (e.g., `okpay-gateway.test.ts`). Run with `npx vitest run`. Test scripts are not in `package.json` yet.

**Redis Connection**: Redis is configured in `lib/redis.ts` with connection pooling, retry strategy, and event logging. Ensure Redis is running before starting the dev server.

**Payment Gateway Integration**: Payment gateway URLs are configured via environment variables. Update `.env.local` with actual endpoints for Velopay or other providers.

**Mobile Testing**: Test all changes in mobile viewport (375px width) to ensure responsive behavior. The bottom navigation and safe areas require careful testing on actual devices.

**Currency Handling**: All amounts are stored as BigInt paisa (integer paise). Use `lib/format-currency.ts` for display formatting. Do NOT use floating-point division. Use dinero.js for multi-currency calculations via `lib/config.ts`.

**Error Handling**: tRPC procedures throw `TRPCError` with appropriate codes (UNAUTHORIZED, BAD_REQUEST, INTERNAL_SERVER_ERROR). Zod validation errors are formatted in the error shape.

**Security Considerations**:
- All sensitive operations require `protectedProcedure` authentication
- Rate limiting is enforced via Better Auth Redis storage
- Fraud detection runs before transaction processing
- Idempotency keys prevent duplicate transaction processing
- Admin procedures are placeholder - implement role-based access control before production

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (or `REDIS_URL`) - Redis
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` - Better Auth
- `NEXT_PUBLIC_APP_URL` - Public app URL
- `GAME_API_AGENCY_UID`, `GAME_API_AES_KEY`, `GAME_API_SERVER_URL` - External game provider
- `GAME_API_CALLBACK_URL` - Callback URL for bet settlement (publicly reachable)
- `GAME_API_PLAYER_PREFIX` - Prefix for all player accounts (e.g., `h5ab3a`)
- `GAME_API_IP_WHITELIST` - Comma-separated IPs allowed to call game callback endpoint
- VeloPay: `VELOPAY_*` (see `.env.example`)
- OKPay: `OKPAY_HOST`, `OKPAY_MCH_ID`, `OKPAY_KEY`, `OKPAY_CALLBACK_URL`, `OKPAY_MODE`

**External Game Provider Integration**: Documented in `GameApi_Doc_EN.md`. Key files:
- `lib/game-api-client.ts` - HTTP client with AES256 encryption/decryption
- `lib/game-api-config.ts` - Env-var configuration (validates required vars at startup)
- `lib/game-adapter.ts` / `lib/game-service.ts` / `lib/game-repository.ts` - Sync and catalog management
- `app/api/game/callback/` - Bet settlement callback (game server → app)
- `app/api/webhook/game-api/` - Game API webhook
- `aggregator-adapter.ts` - Wallet debit/credit/rollback called by game provider

Games are synced into the DB via `scripts/sync-games.ts` and served through the `game.ts` tRPC router.
