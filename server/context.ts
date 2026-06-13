/**
 * tRPC Context with Better Auth integration
 * Provides authentication context for all tRPC procedures
 */

import { type ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

type Session = typeof auth.$Infer.Session;

export interface AuthContext {
  session: Session | null;
  user: Session["user"] | null;
  /** Raw request headers — pass to auth.api.* calls that need session context */
  headers: ReadonlyHeaders;
}

export async function createContext(): Promise<AuthContext> {
  const requestHeaders = await headers();
  try {
    const sessionData = await auth.api.getSession({ headers: requestHeaders });
    return {
      session: sessionData || null,
      user: sessionData?.user || null,
      headers: requestHeaders,
    };
  } catch (error) {
    console.error("[tRPC] Failed to create context:", error);
    return {
      session: null,
      user: null,
      headers: requestHeaders,
    };
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>;
