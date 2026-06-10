/**
 * Cryptographic Utilities for Game API Integration
 *
 * Implements AES-256-ECB encryption/decryption with PKCS7 padding
 * as required by the Game API provider.
 *
 * Security Note: ECB mode is not recommended for new systems due to
 * security weaknesses, but is required by the Game API specification.
 * Additional security layers (IP whitelisting, AES key secrecy) mitigate risks.
 */

import * as crypto from "crypto";

// ============================================================================
// AES-256-ECB ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypts plaintext using AES-256-ECB with PKCS7 padding
 *
 * @param plaintext - The string to encrypt
 * @param key - The 32-byte AES key (must be exactly 32 bytes for AES-256)
 * @returns Base64-encoded ciphertext
 * @throws Error if key is invalid or encryption fails
 *
 * @example
 * ```ts
 * const encrypted = aesEncrypt("Hello World", "32-byte-aes-key-here!")
 * // Returns: "U2FsdGVkX1..." (Base64 string)
 * ```
 */
export function aesEncrypt(plaintext: string, key: string): string {
  try {
    // Validate key length (AES-256 requires 32 bytes)
    if (key.length !== 32) {
      throw new Error(
        `Invalid AES key length: ${key.length} bytes. AES-256 requires exactly 32 bytes.`
      );
    }

    // Validate input
    if (!plaintext || typeof plaintext !== "string") {
      throw new Error("Plaintext must be a non-empty string");
    }

    // Create cipher with AES-256-ECB mode
    // Note: ECB mode doesn't use an IV, so we pass null
    const cipher = crypto.createCipheriv(
      "aes-256-ecb",
      Buffer.from(key, "utf8"),
      null
    );

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Return as Base64
    return encrypted.toString("base64");
  } catch (error) {
    throw new Error(`AES encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Decrypts Base64-encoded ciphertext using AES-256-ECB with PKCS7 padding
 *
 * @param base64Ciphertext - The Base64-encoded ciphertext to decrypt
 * @param key - The 32-byte AES key (must be exactly 32 bytes for AES-256)
 * @returns Decrypted plaintext string
 * @throws Error if key is invalid, ciphertext is malformed, or decryption fails
 *
 * @example
 * ```ts
 * const decrypted = aesDecrypt("U2FsdGVkX1...", "32-byte-aes-key-here!")
 * // Returns: "Hello World"
 * ```
 */
export function aesDecrypt(base64Ciphertext: string, key: string): string {
  try {
    // Validate key length (AES-256 requires 32 bytes)
    if (key.length !== 32) {
      throw new Error(
        `Invalid AES key length: ${key.length} bytes. AES-256 requires exactly 32 bytes.`
      );
    }

    // Validate input
    if (!base64Ciphertext || typeof base64Ciphertext !== "string") {
      throw new Error("Ciphertext must be a non-empty Base64 string");
    }

    // Create decipher with AES-256-ECB mode
    const decipher = crypto.createDecipheriv(
      "aes-256-ecb",
      Buffer.from(key, "utf8"),
      null
    );

    // Decrypt the ciphertext
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(base64Ciphertext, "base64")),
      decipher.final(),
    ]);

    // Return as UTF-8 string
    return decrypted.toString("utf8");
  } catch (error) {
    // Enhance error message for debugging
    if (error instanceof Error) {
      if (error.message.includes("wrong final block length")) {
        throw new Error("Invalid ciphertext or wrong AES key");
      }
      if (error.message.includes("Unsupported state")) {
        throw new Error("Invalid ciphertext: unable to decrypt");
      }
    }
    throw new Error(`AES decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that a string is properly formatted Base64
 *
 * @param str - The string to validate
 * @returns true if valid Base64, false otherwise
 */
export function isValidBase64(str: string): boolean {
  try {
    // Check if string is valid Base64 by attempting to decode it
    Buffer.from(str, "base64");
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that an AES key is the correct length for AES-256
 *
 * @param key - The AES key to validate
 * @returns true if valid 32-byte key, false otherwise
 */
export function isValidAesKey(key: string): boolean {
  return typeof key === "string" && key.length === 32;
}

// ============================================================================
// OBJECT ENCRYPTION/DECRYPTION CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Encrypts a JavaScript object by JSON-stringifying it first
 *
 * @param obj - The object to encrypt
 * @param key - The 32-byte AES key
 * @returns Base64-encoded ciphertext
 *
 * @example
 * ```ts
 * const encrypted = encryptObject({ foo: "bar" }, "32-byte-aes-key-here!")
 * ```
 */
export function encryptObject(obj: unknown, key: string): string {
  const json = JSON.stringify(obj);
  return aesEncrypt(json, key);
}

/**
 * Decrypts ciphertext and parses it as JSON
 *
 * @param base64Ciphertext - The Base64-encoded ciphertext
 * @param key - The 32-byte AES key
 * @returns Parsed JavaScript object
 * @throws Error if decrypted JSON is invalid
 *
 * @example
 * ```ts
 * const decrypted = decryptObject("U2FsdGVkX1...", "32-byte-aes-key-here!")
 * // Returns: { foo: "bar" }
 * ```
 */
export function decryptObject<T = unknown>(base64Ciphertext: string, key: string): T {
  const json = aesDecrypt(base64Ciphertext, key);
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse decrypted JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
