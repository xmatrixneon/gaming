/**
 * Better Auth Server Configuration
 *
 * Schema approach (per official docs):
 * - Pass full `* as schema` to drizzleAdapter — not individual table refs.
 * - This is required for experimental.joins (relations must be included).
 * - Since our table names already match Better Auth's defaults (singular:
 *   user, session, account, verification), no modelName overrides needed.
 * - The plural tables (users, sessions, accounts, wallets, idempotency_records)
 *   were created by an earlier Better Auth generate run and must be dropped
 *   via a manual migration (see drizzle/migrations/0003_drop_stale_auth_tables.sql).
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { phoneNumber } from "better-auth/plugins";
import { redisStorage } from "@better-auth/redis-storage";
import { db } from "@/drizzle";
import { redis } from "@/lib/redis";
import * as schema from "@/drizzle/schema";

// ============================================================================
// BETTER AUTH CONFIGURATION
// ============================================================================

export const auth = betterAuth({
  // ──────────────────────────────────────────────────────────────────────────
  // DATABASE
  // Pass full schema (tables + relations) so experimental.joins works.
  // Our table names are already singular (user, session, account, verification)
  // so no usePlural or modelName overrides are needed.
  // ──────────────────────────────────────────────────────────────────────────
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  // ──────────────────────────────────────────────────────────────────────────
  // REDIS SECONDARY STORAGE
  // Used for: OTP codes, rate limiting, session cache
  // ──────────────────────────────────────────────────────────────────────────
  secondaryStorage: redisStorage({
    client: redis,
    keyPrefix: "better-auth:",
  }),

  // ──────────────────────────────────────────────────────────────────────────
  // BASE URL & ORIGINS
  // ──────────────────────────────────────────────────────────────────────────
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:*",
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // SESSION
  // ──────────────────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 days
    updateAge: 60 * 60 * 24,         // refresh every 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,                // 5 min client-side cache
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RATE LIMITING  (Redis-backed for distributed deployments)
  // ──────────────────────────────────────────────────────────────────────────
  rateLimit: {
    storage: "secondary-storage",
    window: 60,
    max: 10,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ACCOUNT LINKING
  // ──────────────────────────────────────────────────────────────────────────
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "phone"],
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SOCIAL PROVIDERS
  // ──────────────────────────────────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      enabled: true,
      prompt: "select_account",
      accessType: "offline",
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PLUGINS
  // ──────────────────────────────────────────────────────────────────────────
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }, _ctx) => {
        // TODO: wire up SMS provider (Twilio / AWS SNS / MSG91)
        console.log(`[SMS] OTP ${code} → ${phoneNumber}`);
      },

      signUpOnVerification: {
        // Better Auth requires email on all users — generate a temp one from phone
        getTempEmail: (phoneNumber) => {
          const clean = phoneNumber.replace(/^\+/, "");
          return `${clean}@clausbet.temp`;
        },
        getTempName: (phoneNumber) => `User_${phoneNumber.slice(-6)}`,
      },

      otpLength: 6,
      expiresIn: 300,          // 5 minutes
      requireVerification: true,
      allowedAttempts: 3,

      sendPasswordResetOTP: async ({ phoneNumber, code }, _ctx) => {
        console.log(`[SMS] Reset OTP ${code} → ${phoneNumber}`);
      },

      callbackOnVerification: async ({ phoneNumber, user }) => {
        console.log(`[AUTH] Verified: ${phoneNumber} → ${user.id}`);
      },
    }),
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // USER — additional casino fields
  // These are read/written by Better Auth on sign-up/sign-in.
  // The actual columns (balance, vipLevel) already exist in your schema.
  // ──────────────────────────────────────────────────────────────────────────
  user: {
    additionalFields: {
      balance: {
        type: "string",
        required: false,
        defaultValue: "0",
      },
      vipLevel: {
        type: "string",
        required: false,
        defaultValue: "Bronze",
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ADVANCED
  // ──────────────────────────────────────────────────────────────────────────
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // EXPERIMENTAL
  // joins: true requires full schema (tables + relations) passed above.
  // Gives 2–3x perf on /get-session, /get-full-organization etc.
  // ──────────────────────────────────────────────────────────────────────────
  experimental: {
    joins: true,
  },
});

export type Auth = typeof auth;