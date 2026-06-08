/**
 * Better Auth API Route Handler for Next.js 16
 * Handles all Better Auth requests including OAuth, sign in, sign out, etc.
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth API route handler
 * All Better Auth requests are routed through this endpoint
 * including:
 * - OAuth callbacks (Google)
 * - Sign in / Sign out
 * - Session management
 * - Email verification
 * - Password reset
 */
export const { GET, POST } = toNextJsHandler(auth);
