/**
 * Shared auth utilities for server-side password verification.
 * Uses Better Auth's own crypto so hashes always match.
 */

import { verifyPassword } from "better-auth/crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/drizzle";
import { account } from "@/drizzle/schema";

/**
 * Returns true if the user has a credential (password) account.
 */
export async function checkUserHasPassword(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  return rows.length > 0;
}

/**
 * Verifies a plaintext password against the stored scrypt hash without
 * creating a session or touching rate-limit counters.
 */
export async function verifyUserPassword(
  userId: string,
  plaintext: string
): Promise<boolean> {
  const rows = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);

  const hash = rows[0]?.password;
  if (!hash) return false;

  return verifyPassword({ password: plaintext, hash });
}
