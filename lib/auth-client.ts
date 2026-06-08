/**
 * Better Auth Client Configuration
 * Direct client for Better Auth operations that bypass tRPC
 * This ensures session cookies are set correctly by the API
 *
 * Following Better Auth best practices for Next.js + tRPC integration
 */

import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/**
 * Better Auth client instance
 * Use this for authentication operations that need to set cookies
 *
 * @example
 * ```ts
 * await authClient.phoneNumber.sendOtp({
 *   phoneNumber: "+1234567890",
 * });
 *
 * await authClient.phoneNumber.verify({
 *   phoneNumber: "+1234567890",
 *   code: "123456",
 * });
 * ```
 */
export const authClient = createAuthClient({
  // For local development, use relative URLs (no baseURL)
  // For production with external domain, set NEXT_PUBLIC_BETTER_AUTH_URL
  baseURL: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_BETTER_AUTH_URL : undefined,
  plugins: [
    phoneNumberClient(),
  ],
});

/**
 * Infer types from the auth client
 */
export type Session = typeof authClient.$Infer.Session;
