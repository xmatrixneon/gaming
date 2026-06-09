/**
 * ID Generation Utilities
 * Compatible with Better Auth's ID generation
 */

/**
 * Generate a unique ID compatible with Better Auth
 * Uses the same format as Better Auth's generateId function
 */
export function generateId(): string {
  // Better Auth uses a simple random ID generator
  // Format: 15 character alphanumeric string
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a UUID v4
 * Alternative ID format if needed
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
