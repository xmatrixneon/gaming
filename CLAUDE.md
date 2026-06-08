# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClausBet is a mobile-first crypto casino platform built with Next.js 16, featuring a modern UI inspired by BC.Game. The app includes game browsing, user authentication, deposit/withdrawal flows, and multi-currency support.

### Tech Stack

**Core Framework**: Next.js 16 (App Router) with React 19 and TypeScript
**Styling**: Tailwind CSS 4 with shadcn/ui components, OKLCH color system
**Backend**: tRPC for type-safe APIs, Better Auth for authentication
**Database**: Drizzle ORM with PostgreSQL (planned), Redis for sessions
**UI Libraries**: Radix UI primitives, motion/Framer Motion, recharts
**Additional**: BullMQ for job queues, ioredis for Redis, next-intl for i18n

## Development Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Build & Production
npm run build            # Build for production
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint

# Testing (vitest installed but not configured - no test scripts yet)
# Add test scripts to package.json when implementing tests
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

lib/
├── config.ts          # Navigation, currency, and locale configuration
├── utils.ts           # Utility functions (cn class merger)
└── trpc/              # tRPC client and server utilities
    ├── client.ts      # tRPC React client with React Query integration
    ├── server.ts      # Server-side tRPC helpers (references @/server/routers)
    ├── types.ts       # TypeScript types
    ├── hooks.ts       # React hooks
    └── index.ts       # Barrel export

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
- `@/*` → root directory

### Key Architectural Decisions

**Mobile-First Design**: The entire app is optimized for mobile viewport (`max-w-md mx-auto`), with bottom navigation and safe-area handling for iOS/Android.

**Component Organization**: Components are organized by feature domain (`game/`), with shared components in `game/shared/` and reusable UI components in `ui/`.

**Currency & i18n**: Multi-currency (USD, INR, EUR, BTC, ETH, USDT, USDC, SOL) and multi-locale support (en, hi, es, pt, zh, ja, ko, de, fr) via `lib/config.ts` with type-safe formatting functions. Includes locale-specific formatting (separators, date/time formats).

**tRPC Setup**: The project uses tRPC for type-safe client-server communication. Server utilities reference `@/server/routers` but this directory doesn't exist yet - create when implementing server features.

**Authentication**: Better Auth is in dependencies but not configured. Current auth is mock-based in `hooks/use-auth.ts` using localStorage. The production setup should use Better Auth with Drizzle adapter and Redis storage.

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

**`components.json`**: shadcn/ui configuration with Radix Nova style, CSS variables enabled, path aliases matching tsconfig.json.

**`next.config.ts`**: Includes ngrok dev origin for local development with external services.

**`postcss.config.mjs`**: Uses `@tailwindcss/postcss` plugin (Tailwind CSS 4).

**`.env.example`**: Payment gateway URL templates for UPI and crypto gateways.

### Important Files

**`hooks/use-auth.ts`**: Mock authentication using localStorage. Returns `MOCK_USER` with test data (Player_12345, balance: 12458.50). Replace with Better Auth implementation for production.

**`app/layout.tsx`**: Root layout with ThemeProvider (dark mode default), TooltipProvider, Toaster (sonner), and font configurations (Inter, Geist Sans/Mono).

**`lib/trpc/client.ts`**: tRPC React client with superjson transformer, development logging, and React Query integration (5min staleTime, retry logic).

**`lib/trpc/server.ts`**: Server-side tRPC utilities that reference non-existent `@/server/routers`.

## Important Notes

**Next.js 16 Changes**: This uses Next.js 16 which has breaking changes from earlier versions. Always check `node_modules/next/dist/docs/` before implementing Next.js features.

**Server-Side Code**: The project references `@/server/routers` for tRPC server setup, but this directory doesn't exist. When implementing server features, create the server structure first.

**Mock vs Production**: Authentication currently uses mock data in `hooks/use-auth.ts`. When integrating real auth, replace with Better Auth implementation.

**Mobile Testing**: Test all changes in mobile viewport (375px width) to ensure responsive behavior. The bottom navigation and safe areas require careful testing on actual devices.

**Payment Integration**: Payment gateway URLs are configured via environment variables (`NEXT_PUBLIC_UPI_GATEWAY_URL`, `NEXT_PUBLIC_CRYPTO_GATEWAY_URL`). Update `.env.local` with actual endpoints.

**Testing**: vitest is installed as a dev dependency but no test scripts or test files exist yet. Add test commands to package.json when implementing tests.

**Database**: Drizzle ORM is in dependencies but no schema or migrations exist yet. PostgreSQL and Redis are planned but not configured.
