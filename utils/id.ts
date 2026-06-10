/**
 * ID Generation Utilities
 * Compatible with Better Auth's ID generation
 */

/**
 * Generate a unique ID compatible with Better Auth.
 * Uses crypto.getRandomValues for cryptographic security.
 * Format: 15-character lowercase alphanumeric string.
 */
export function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Generate a UUID v4 using the built-in Web Crypto API.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
