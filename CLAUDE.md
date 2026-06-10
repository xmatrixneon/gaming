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

# Testing
npx vitest                 # Run tests (vitest is configured but no test scripts in package.json)
npx vitest --ui           # Run tests with UI
npx vitest run           # Run tests once (CI mode)
```

## Architecture

### Project Structure

```
app/                    # Next.js App Router pages
├── (auth)/            # Authentication pages (signin, signup, forgot-password)
├── deposit/           # Deposit flow pages
├── withdraw/          # Withdrawal flow pages
├── profile/           # User profile page
├── history/           # Transaction/game history
├── more/              # Additional features menu
├── layout.tsx         # Root layout with theme provider
├── page.tsx           # Home page
├── loading.tsx        # Loading UI
├── error.tsx          # Error boundary
├── not-found.tsx      # 404 page
└── globals.css        # Global styles with OKLCH tokens

components/
├── game/              # Game-related components
│   ├── auth/          # Authentication UI components (tabs, buttons, inputs)
│   ├── home/          # Home page components (carousel, game grid, etc.)
│   └── shared/        # Shared game components (balance card, transaction item)
├── lib/               # Library components (animations)
└── ui/                # shadcn/ui components

server/
├── context.ts         # tRPC context with Better Auth session
├── trpc.ts            # tRPC initialization with public/protected/admin procedures
└── routers/           # tRPC router implementations
    ├── auth.ts        # Authentication procedures (sign-in, sign-up, OAuth)
    ├── user.ts        # User profile and preferences
    ├── wallet.ts      # Wallet operations (balance, transactions)
    └── transaction.ts # Deposit/withdrawal processing

lib/                   # Shared business logic and utilities
├── auth.ts            # Better Auth server configuration (Google OAuth, phone)
├── auth-client.ts     # Better Auth client configuration
├── redis.ts           # Redis client with helpers (OTP, rate limiting, sessions)
├── config.ts          # Navigation, currency, and locale configuration
├── utils.ts           # Utility functions (cn class merger)
├── wallet-service.ts  # Wallet business logic (transaction handling)
├── velopay-gateway.ts # Velopay payment gateway integration
├── fraud-detection.ts # Fraud detection rules and checks
├── idempotency.ts     # Idempotency keys for duplicate request prevention
└── trpc/              # tRPC client and server utilities
    ├── client.ts      # tRPC React client with React Query integration
    ├── server.ts      # Server-side tRPC helpers (references @/server/routers)
    ├── types.ts       # TypeScript types
    ├── hooks.ts       # React hooks
    └── index.ts       # Barrel export

drizzle/
├── schema.ts          # Database schema (user, session, account, wallet, transaction)
├── index.ts           # Database client export
├── migrations/        # Database migrations
└── config.ts          # Drizzle configuration (PostgreSQL)

hooks/
├── use-auth.ts        # Authentication state management (currently mock)
├── use-auto-scroll.ts # Auto-scroll behavior
├── use-mobile.ts      # Mobile detection utilities
└── use-user-preferences.ts # User preference management
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
- `velopay-gateway.ts` - External payment gateway integration (Velopay)
- `wallet-service.ts` - Business logic for deposits/withdrawals
- `fraud-detection.ts` - Pre-transaction fraud checks (amount limits, velocity checks)
- `idempotency.ts` - Duplicate request prevention using Redis
- Transaction records with status tracking (pending, completed, failed)

**Database Schema**: Key tables:
- `user` - User accounts with balance and VIP level (Better Auth managed)
- `session` - User sessions (Better Auth managed)
- `account` - OAuth provider accounts (Better Auth managed)
- `wallet` - User wallets (USD, crypto currencies)
- `transaction` - Transaction history with status tracking
- `idempotency_record` - Idempotency key storage

**Currency & i18n**: Multi-currency (USD, INR, EUR, BTC, ETH, USDT, USDC, SOL) and multi-locale support (en, hi, es, pt, zh, ja, ko, de, fr) via `lib/config.ts` with type-safe formatting functions using dinero.js for precise currency calculations.

**Redis Usage**: Redis is used for:
- Better Auth secondary storage (OTP codes, rate limiting, session cache)
- Custom OTP storage and verification (`lib/redis.ts` helpers)
- Rate limiting for authentication endpoints
- Session caching for performance

### Component Organization

Components are organized by feature domain (`game/`), with shared components in `game/shared/` and reusable UI components in `ui/`. The `lib/` directory contains business logic services that can be used by both tRPC procedures and React components.

### Styling System

**Color System**: Uses OKLCH color space for better perceptual uniformity. CSS variables define semantic tokens (`--primary`, `--muted`, etc.) with light/dark themes defined in `app/globals.css`.

**Mobile Handling**: Includes CSS utilities for safe areas (iOS notch, Android nav bar) using `env()` variables. Bottom navigation uses Chrome-recommended calc pattern to prevent layout thrashing.

**Component Styling**: shadcn/ui components use CSS variables for theming. Custom components use Tailwind utility classes with `cn()` for conditional styling.

**Tailwind CSS 4**: Uses `@tailwindcss/postcss` (new PostCSS plugin in v4) and `shadcn/tailwind.css` import in globals.css.

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

**`server/routers/`**: tRPC router implementations organized by domain:
- `auth.ts` - Authentication procedures using Better Auth client
- `user.ts` - User profile and preferences management
- `wallet.ts` - Wallet balance and transaction queries
- `transaction.ts` - Deposit/withdrawal processing with fraud detection

**`lib/wallet-service.ts`**: Business logic for wallet operations:
- Transaction processing with status updates
- Balance updates with idempotency checks
- Fraud detection integration
- Payment gateway communication

**`lib/fraud-detection.ts`**: Fraud prevention logic:
- Transaction amount limits (min/max per transaction, daily limits)
- Velocity checks (max transactions per time period)
- suspicious pattern detection

**`lib/idempotency.ts`**: Idempotency key management:
- Redis-based key storage with TTL
- Duplicate request detection
- Thread-safe key generation using nanoid

**`lib/redis.ts`**: Redis client and helper functions:
- OTP storage key generation (`otpKey`, `otpAttemptsKey`)
- Rate limiting key generation (`rateLimitKey`)
- Session cache key generation (`sessionKey`)
- Generic Redis operations with type safety

**`drizzle/schema.ts`**: Database schema with:
- Better Auth tables (user, session, account, verification)
- Custom tables (wallet, transaction, idempotency_record)
- Relations defined for optimal queries
- Indexes for performance

**`hooks/use-auth.ts`**: Mock authentication using localStorage. Returns `MOCK_USER` with test data (Player_12345, balance: 12458.50). This should be replaced with Better Auth client hooks for production.

**`app/layout.tsx`**: Root layout with ThemeProvider (dark mode default), TooltipProvider, Toaster (sonner), and font configurations (Inter, Geist Sans/Mono).

**`lib/trpc/client.ts`**: tRPC React client with superjson transformer, development logging, and React Query integration (5min staleTime, retry logic).

## Important Notes

**Next.js 16 Changes**: This uses Next.js 16 which has breaking changes from earlier versions. Always check `node_modules/next/dist/docs/` before implementing Next.js features.

**Better Auth Configuration**: Better Auth is fully configured with:
- Server configuration in `lib/auth.ts`
- Client configuration in `lib/auth-client.ts`
- tRPC context in `server/context.ts`
- Phone plugin with SMS placeholder (TODO: wire up SMS provider)
- Google OAuth with offline access
- Redis secondary storage for OTP and rate limiting

**Database Migrations**: Use Drizzle migrations for schema changes:
- Edit `drizzle/schema.ts`
- Run `npx drizzle-kit generate` to create migration
- Run `npx drizzle-kit migrate` to apply to database
- Use `npx drizzle-kit push` for rapid prototyping (not recommended for production)

**Testing**: vitest is configured in `vitest.config.ts` with test files matching `*.test.ts`. Test scripts are not in package.json yet - add them when implementing tests:
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:run": "vitest run"
```

**Redis Connection**: Redis is configured in `lib/redis.ts` with connection pooling, retry strategy, and event logging. Ensure Redis is running before starting the dev server.

**Payment Gateway Integration**: Payment gateway URLs are configured via environment variables. Update `.env.local` with actual endpoints for Velopay or other providers.

**Mobile Testing**: Test all changes in mobile viewport (375px width) to ensure responsive behavior. The bottom navigation and safe areas require careful testing on actual devices.

**Currency Handling**: Use `dinero.js` for all currency calculations to avoid floating-point precision issues. The `lib/config.ts` provides type-safe formatting functions.

**Error Handling**: tRPC procedures throw `TRPCError` with appropriate codes (UNAUTHORIZED, BAD_REQUEST, INTERNAL_SERVER_ERROR). Zod validation errors are formatted in the error shape.

**Security Considerations**:
- All sensitive operations require `protectedProcedure` authentication
- Rate limiting is enforced via Better Auth Redis storage
- Fraud detection runs before transaction processing
- Idempotency keys prevent duplicate transaction processing
- Admin procedures are placeholder - implement role-based access control before production

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis configuration
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `BETTER_AUTH_URL` - Better Auth base URL
- `NEXT_PUBLIC_APP_URL` - Public app URL
- `NEXT_PUBLIC_UPI_GATEWAY_URL` - UPI payment gateway
- `NEXT_PUBLIC_CRYPTO_GATEWAY_URL` - Crypto payment gateway
