/**
 * tRPC Integration Setup Guide
 *
 * This file provides the complete setup for tRPC client-server integration
 * in Next.js 16 with full TypeScript type safety.
 */

// ==================== CLIENT EXPORTS ====================

export { api } from "./client";
export { transformer, trpcClientOptions } from "./client";
export type { RouterInputs, RouterOutputs } from "./client";

// ==================== SERVER EXPORTS ====================

export { createServerCaller } from "./server";
export type { ServerCaller } from "./server";

// ==================== PROVIDER EXPORTS ====================

export { TRPCProvider } from "./provider";
export type { TRPCProviderProps } from "./provider";

// ==================== TYPES & UTILITIES ====================

export {
  isTRPCError,
  getTRPCErrorCode,
  getTRPCErrorMessage,
} from "./types";
export type {
  ProcedureOutput,
  ProcedureInput,
  TRPCError,
  TRPCErrorResponse,
  APIResponse,
  PaginatedResponse,
  MutationResult,
} from "./types";

// ==================== CUSTOM HOOKS ====================

export {
  useInfiniteList,
  useMutationWithHandlers,
  useCachedQuery,
  useRealtimeSubscription,
  useOptimisticMutation,
} from "./hooks";

// ==================== SETUP INSTRUCTIONS ====================

/**
 * COMPLETE SETUP INSTRUCTIONS
 *
 * Follow these steps to fully integrate tRPC with type safety:
 *
 * 1. UPDATE APP LAYOUT (app/layout.tsx):
 * ```tsx
 * import { TRPCProvider } from "@/lib/trpc";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="en">
 *       <body>
 *         <TRPCProvider>
 *           {children}
 *         </TRPCProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * 2. CREATE SERVER ROUTER (server/src/routers/index.ts):
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import superjson from "superjson";
 * import { z } from "zod";
 *
 * const t = initTRPC.create({
 *   transformer: superjson,
 * });
 *
 * export const appRouter = t.router({
 *   game: t.router({
 *     list: t.procedure
 *       .input(z.object({ limit: z.number().optional() }))
 *       .query(async ({ input }) => {
 *         return { games: [] };
 *       }),
 *   }),
 * });
 *
 * export type AppRouter = typeof appRouter;
 * ```
 *
 * 3. UPDATE TYPING (lib/trpc/client.ts):
 * ```typescript
 * import type { AppRouter } from "@/server/routers";
 *
 * export const api = createTRPCReact<AppRouter>();
 * ```
 *
 * 4. USE IN COMPONENTS:
 * ```tsx
 * "use client";
 * import { api } from "@/lib/trpc";
 *
 * export function GameList() {
 *   const { data, isLoading } = api.game.list.useQuery({ limit: 10 });
 *   const updateGame = api.game.update.useMutation();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{data?.games.map(...)}</div>;
 * }
 * ```
 *
 * 5. SERVER-SIDE USAGE (Server Components):
 * ```typescript
 * import { createServerCaller } from "@/lib/trpc/server";
 *
 * export default async function ServerPage() {
 *   const caller = await createServerCaller();
 *   const games = await caller.game.list({ limit: 10 });
 *   return <div>{games.map(...)}</div>;
 * }
 * ```
 */
