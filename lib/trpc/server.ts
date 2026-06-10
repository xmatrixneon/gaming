/**
 * tRPC server-side caller for Next.js Server Components and Server Actions.
 * Uses createCallerFactory for in-process invocation (no HTTP round-trip).
 *
 * Usage:
 *   const caller = await createServerCaller();
 *   const profile = await caller.user.getProfile();
 */

import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers";
import { createContext } from "@/server/context";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  return createCaller(await createContext());
}

export type ServerCaller = Awaited<ReturnType<typeof createServerCaller>>;
