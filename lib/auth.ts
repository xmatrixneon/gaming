/**
 * Better Auth Server Configuration
 * Integrates phone/SMS authentication, Google OAuth, Drizzle ORM adapter, and Redis storage
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { phoneNumber } from "better-auth/plugins";
import { redisStorage } from "@better-auth/redis-storage";
import { db } from "@/drizzle";
import { redis } from "@/lib/redis";

// ============================================================================
// BETTER AUTH CONFIGURATION
// ============================================================================

/**
 * Better Auth instance with all plugins and configurations
 *
 * Features:
 * - Phone/SMS authentication with OTP (stored in Redis)
 * - Google OAuth social login
 * - Drizzle ORM adapter for PostgreSQL
 * - Redis secondary storage for OTP and rate limiting
 * - Session management with Redis caching
 * - Email verification
 */
export const auth = betterAuth({
  // ============================================================================
  // DATABASE CONFIGURATION
  // ============================================================================
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // ============================================================================
  // REDIS SECONDARY STORAGE
  // ============================================================================
  secondaryStorage: redisStorage({
    client: redis,
    keyPrefix: "better-auth:",
  }),

  // ============================================================================
  // BASE URL
  // ============================================================================
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  // ============================================================================
  // SESSION CONFIGURATION
  // ============================================================================
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache session for 5 minutes
    },
  },

  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  rateLimit: {
    // Use Redis for distributed rate limiting
    storage: "secondary-storage",
    // Window duration in seconds
    window: 60,
    // Max requests per window
    max: 10,
  },

  // ============================================================================
  // ACCOUNT CONFIGURATION
  // ============================================================================
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "phone"],
    },
  },

  // ============================================================================
  // SOCIAL PROVIDERS - GOOGLE OAUTH
  // ============================================================================
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      enabled: true,
      // Always prompt for account selection to allow account switching
      prompt: "select_account",
      // Request offline access for refresh token
      accessType: "offline",
    },
  },

  // ============================================================================
  // PLUGINS
  // ============================================================================
  plugins: [
    // Phone/SMS Authentication Plugin with Redis OTP storage
    phoneNumber({
      // Send OTP via SMS (using your SMS provider)
      // Note: Better Auth Infrastructure SMS service requires Pro plan
      // Alternatively, use Twilio, AWS SNS, or custom SMS provider
      sendOTP: async ({ phoneNumber, code }, _ctx) => {
        // TODO: Implement SMS sending logic
        // Options:
        // 1. Use @better-auth/infra SMS service (requires Pro plan)
        // 2. Use Twilio: twilioClient.messages.create({ body: `Your code is ${code}`, to: phoneNumber, from: process.env.TWILIO_PHONE_NUMBER })
        // 3. Use AWS SNS: awsSNS.publish({ PhoneNumber: phoneNumber, Message: `Your code is ${code}` })

        console.log(`[SMS] Sending OTP ${code} to ${phoneNumber}`);

        // Example with Twilio (uncomment and configure):
        // const twilio = require('twilio');
        // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await client.messages.create({
        //   body: `Your verification code is ${code}. Valid for 10 minutes.`,
        //   to: phoneNumber,
        //   from: process.env.TWILIO_PHONE_NUMBER,
        // });

        // Non-blocking - don't await to prevent timing attacks
        Promise.resolve().catch((err) => {
          console.error("[SMS] Failed to send OTP:", err);
        });
      },

      // Allow sign-up with phone number (generates temporary email)
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          return `${phoneNumber}@clausbet.temp`;
        },
        getTempName: (phoneNumber) => {
          return `User_${phoneNumber.slice(-4)}`;
        },
      },

      // OTP configuration
      otpLength: 6,
      expiresIn: 300, // 5 minutes

      // Require verification before sign-in
      requireVerification: true,

      // Max verification attempts (brute force protection)
      allowedAttempts: 3,

      // Send password reset OTP
      sendPasswordResetOTP: async ({ phoneNumber, code }, _ctx) => {
        console.log(`[SMS] Sending password reset OTP ${code} to ${phoneNumber}`);
        // TODO: Implement SMS sending (same as sendOTP)
      },

      // Callback after successful verification
      callbackOnVerification: async ({ phoneNumber, user }, _ctx) => {
        console.log(`[AUTH] Phone number verified: ${phoneNumber} for user: ${user.id}`);
        // TODO: Send welcome email or notification
      },
    }),
  ],

  // ============================================================================
  // USER CONFIGURATION
  // ============================================================================
  user: {
    // Additional fields that can be updated during sign-up
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

  // ============================================================================
  // ADVANCED CONFIGURATION
  // ============================================================================
  advanced: {
    // Use secure cookies in production
    useSecureCookies: process.env.NODE_ENV === "production",

    // Cross-subdomain cookies
    crossSubDomainCookies: {
      enabled: false,
    },

    // Generate IDs using UUID
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // ============================================================================
  // EXPERIMENTAL FEATURES
  // ============================================================================
  experimental: {
    // Enable database joins for better performance
    joins: true,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export type Auth = typeof auth;
