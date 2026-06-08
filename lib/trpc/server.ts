/**
 * tRPC Server-Side Helpers for Next.js 16
 *
 * These utilities are used in Server Components and Server Actions
 * to call tRPC procedures directly on the server.
 *
 * Note: These utilities require the server router to be implemented.
 * The @/server/routers directory and AppRouter type must exist.
 */

import { createTRPCClient } from "@trpc/client";
import { transformer } from "./client";
import type { AppRouter } from "@/server/routers"; // Import type from server

/**
 * Create a tRPC caller for server-side usage
 *
 * @example
 * ```typescript
 * const trpc = createServerCaller();
 * const games = await trpc.game.list({ limit: 10 });
 * ```
 */
export function createServerCaller() {
  // This will be configured with the actual server context
  // once the server router is implemented
  return createTRPCClient<AppRouter>({
    // Transformer is now configured on links, not client
    // Add server-specific configuration here when router exists
    links: [],
  });
}

/**
 * Type-safe server-side tRPC caller
 * Use this in Server Components and Server Actions
 *
 * Note: This will throw an error at runtime until @/server/routers is implemented.
 */
export const serverTRPC = createServerCaller();
