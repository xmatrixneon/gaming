/**
 * tRPC Context with Better Auth integration
 * Provides authentication context for all tRPC procedures
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Infer Session type from Better Auth
 * This type includes both `session` and `user` properties
 */
type Session = typeof auth.$Infer.Session;

/**
 * Authentication context passed to all procedures
 */
export interface AuthContext {
  session: Session | null;
  user: Session["user"] | null;
}

/**
 * tRPC Context creation function
 * Extracts session from Better Auth cookies
 */
export async function createContext(): Promise<AuthContext> {
  try {
    // Get the session from Better Auth
    const sessionData = await auth.api.getSession({
      headers: await headers(),
    });

    return {
      session: sessionData || null,
      user: sessionData?.user || null,
    };
  } catch (error) {
    console.error("[tRPC] Failed to create context:", error);
    return {
      session: null,
      user: null,
    };
  }
}

/**
 * Context type for tRPC procedures
 */
export type Context = Awaited<ReturnType<typeof createContext>>;
