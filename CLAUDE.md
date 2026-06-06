# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** For project architecture, server details, and full technology stack, see [`/home/neo/game/CLAUDE.md`](../CLAUDE.md).

## Client-Specific Development

### Development Commands

```bash
# Development
npm run dev          # Start Next.js dev server on http://localhost:3000

# Build & Production
npm run build        # Build for production
npm start           # Start production server

# Code Quality
npm run lint         # Run ESLint
```

### Shadcn/ui Configuration

This project uses shadcn/ui with the **radix-nova** style variant:
- Style: `radix-nova`
- Icon library: `lucide`
- Path aliases: `@/components`, `@/lib/utils`, `@/hooks`
- CSS variables: enabled in `app/globals.css`

When adding new shadcn components, use the MCP `shadcn` tools or install via CLI - they will integrate with the existing Tailwind CSS v4 setup.

### Next.js 16 + React 19 Critical Notes

**This version has breaking changes** from previous Next.js versions. Before writing Next.js code:
1. Check `node_modules/next/dist/docs/` for updated APIs
2. React 19 changes affect component patterns (no more forwardRef needing explicit declaration, etc.)
3. App Router conventions may have changed

### Tailwind CSS v4

This project uses Tailwind CSS v4 with PostCSS - the configuration approach differs from v3:
- No `tailwind.config.js` file
- Configuration via CSS `@theme` and `@import` directives
- See `app/globals.css` for theme configuration

### State Management Strategy

- **Server State**: TanStack Query via `@trpc/react-query`
- **Client State**: Zustand stores (in `hooks/` or `lib/stores/`)
- **Real-time**: Socket.IO client event listeners

### Component Development Patterns

```typescript
// Importing utilities (from lib/utils.ts)
import { cn } from "@/lib/utils";

// Conditional class merging
className={cn("base-class", condition && "conditional-class")}

// Using shadcn components
import { Button } from "@/components/ui/button";
```

### tRPC Integration

Client-side tRPC hooks are auto-generated from the server router:
```typescript
// Access the API
const { data } = api.example.route.useQuery();

// Mutations
const mutation = api.example.action.useMutation();
```

### Path Aliases

Configured in `tsconfig.json`:
- `@/*` → root directory (`/home/neo/game/client/*`)
- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/hooks` → `hooks/`
