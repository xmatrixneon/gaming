/**
 * tRPC API Route Handler for Next.js 16
 * Handles all tRPC requests with Better Auth context
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers";
import { createContext } from "@/server/context";

/**
 * tRPC API route handler
 * All tRPC requests are routed through this endpoint
 *
 * Note: Using Node.js runtime instead of Edge runtime for compatibility with:
 * - ioredis (Redis client)
 * - Better Auth internals
 * - Database adapters
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(),
  });
}

export async function POST(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(),
  });
}
