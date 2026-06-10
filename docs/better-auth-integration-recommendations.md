# Better Auth Integration Recommendations

**Date:** 2025-06-10
**Based on:** Better Auth v1.6.11 (latest stable)
**Target:** ClausBet Casino Platform

---

## Executive Summary

Your current auth schema is **mostly compatible** with Better Auth's core schema. However, several **security enhancements** and **missing features** are identified based on Better Auth best practices.

**Overall Assessment:** ⚠️ **Compatible - With Security Enhancements Needed**

---

## 🔴 Critical Security Issues

### 1. OAuth Tokens Stored in Plaintext - **HIGH RISK**

**Current Schema (INSECURE):**
```typescript
account: pgTable("account", {
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    // ...
})
```

**Risk:** Database compromise exposes all user OAuth tokens

**Better Auth Solution:**
```typescript
// Enable OAuth token encryption in Better Auth config
export const auth = betterAuth({
    account: {
        encryptOAuthTokens: true, // 🔒 Auto-encrypts tokens
        storeStateStrategy: "database",
    },
    advanced: {
        cookiePrefix: "clausbet",
        crossSubDomainCookies: {
            enabled: false,
        },
    },
})
```

**Implementation:**
1. Add `ENCRYPTION_KEY` to environment variables
2. Enable `encryptOAuthTokens: true` in Better Auth config
3. Better Auth handles encryption/decryption automatically

---

### 2. Missing Two-Factor Authentication (2FA) Support

**Current Issue:** No 2FA table or user fields

**Better Auth Schema:**
```typescript
// Add to user table
export const user = pgTable("user", {
    // ... existing fields
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

// New table for 2FA
export const twoFactor = pgTable("two_factor", {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(false),
}, (table) => [
    index("twoFactor_userId_idx").on(table.userId),
]);
```

**Better Auth Plugin:**
```typescript
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [twoFactor({
        // TOTP (Time-based One-Time Password) settings
        totp: {
            enabled: true,
            issuer: "ClausBet",
            algorithm: "SHA256",
            digits: 6,
            period: 30,
        },
    })],
});
```

---

### 3. Weak Session Security Configuration

**Current Issue:** Session IP and userAgent tracked but not validated

**Better Auth Recommendations:**

| Feature | Current State | Recommendation |
|---------|--------------|----------------|
| IP validation | Tracked only | Enable in Better Auth config |
| User agent validation | Tracked only | Enable for high-security operations |
| Session expiration | 30 days default | Consider shorter for admin users |
| Session rotation | Not implemented | Add for sensitive operations |

**Better Auth Config:**
```typescript
export const auth = betterAuth({
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // Update every 24 hours
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // Cache for 5 minutes
        },
        ipAddress: {
            // Require same IP for sensitive operations
            strictSecurity: ["withdrawal", "admin"],
        },
    },
});
```

---

## ⚠️ High-Priority Improvements

### 4. Missing Account Linking Configuration

**Current State:** Users can have multiple OAuth providers linked

**Better Auth Account Linking:**
```typescript
export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "email-password"], // Only these
            allowDifferentEmails: false, // Require same email
        },
    },
});
```

---

### 5. Phone Authentication Enhancement

**Current:** Phone stored in `user` table

**Better Auth Phone Plugin:**
```typescript
import { phoneNumber } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [
        phoneNumber({
            // Phone verification settings
            sendPhoneNumber: async ({ phoneNumber, code }) => {
                // Your SMS provider integration
                await sendSMS(phoneNumber, `Your code: ${code}`);
            },
            expireIn: 5 * 60, // 5 minutes
            maxAttempts: 3,
        }),
    ],
});
```

**Schema Addition:**
```typescript
// Better Auth manages this automatically
export const userPhoneNumber = pgTable("user_phone_number", {
    userId: text("user_id").primaryKey().references(() => user.id),
    phoneNumber: text("phone_number").notNull(),
    verified: boolean("verified").default(false),
});
```

---

### 6. Session Cleanup & Management

**Current:** No automatic session cleanup

**Better Auth Recommendations:**
```sql
-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM session
    WHERE expires_at < NOW();
    
    -- Also clean up verification codes
    DELETE FROM verification
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily
-- (Use pg_cron or external cron job)
```

---

## ✅ Compatible Design Patterns Found

Your schema already follows these Better Auth best practices:

1. ✅ **Session IP tracking** - `ipAddress` field present
2. ✅ **User agent tracking** - `userAgent` field present
3. ✅ **Session expiration** - `expiresAt` field with proper indexing
4. ✅ **Account linking support** - `account` table with `providerId`
5. ✅ **Verification storage** - `verification` table with proper indexing
6. ✅ **Email verification** - `emailVerified` boolean field
7. ✅ **Cascade deletes** - Proper `onDelete: "cascade"` on session/account

---

## 📋 Migration Plan

### Phase 1: Critical Security (Week 1)

**Add 2FA Support:**
```sql
-- Add twoFactorEnabled to user
ALTER TABLE "user" ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;

-- Create twoFactor table
CREATE TABLE two_factor (
    id TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    backup_codes TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    verified BOOLEAN DEFAULT false
);

CREATE INDEX two_factor_user_id_idx ON two_factor(user_id);
```

**Enable OAuth Token Encryption:**
```typescript
// lib/auth.ts
export const auth = betterAuth({
    account: {
        encryptOAuthTokens: true, // Set encryption key in .env
        storeStateStrategy: "database",
    },
    // ... rest of config
});
```

### Phase 2: Enhanced Security (Week 2)

**Add IP validation for withdrawals:**
```typescript
session: {
    ipAddress: {
        strictSecurity: ["withdrawal", "admin", "bonus-claim"],
    },
}
```

**Add phone verification plugin:**
```typescript
plugins: [
    phoneNumber({
        sendPhoneNumber: async ({ phoneNumber, code }) => {
            // Integrate with your SMS provider
        },
    }),
],
```

### Phase 3: Session Management (Week 3)

**Implement session cleanup:**
```sql
-- Create cleanup job
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'cleanup-sessions',
    '0 2 * * *', -- 2 AM daily
    $$DELETE FROM session WHERE expires_at < NOW()$$
);
```

---

## 🎯 Better Auth Configuration for ClausBet

**Complete Recommended Config:**

```typescript
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { phoneNumber } from "better-auth/plugins";
import { passkey } from "better-auth/plugins"; // Future: add passkey support

export const auth = betterAuth({
    // Database configuration
    database: new DrizzleAdapter(db, {
        provider: "pg",
    }),
    
    // Account & security
    account: {
        modelName: "account",
        encryptOAuthTokens: true,
        storeStateStrategy: "database",
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "email-password"],
            allowDifferentEmails: false,
        },
    },
    
    // Session management
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // 24 hours
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
        },
        ipAddress: {
            strictSecurity: ["withdrawal", "admin"],
        },
    },
    
    // Advanced security
    advanced: {
        cookiePrefix: "clausbet",
        crossSubDomainCookies: { enabled: false },
        useSecureCookies: true, // Required for production
        generateId: () => nanoid(32), // Better random IDs
    },
    
    // Plugins
    plugins: [
        twoFactor({
            totp: {
                enabled: true,
                issuer: "ClausBet",
            },
        }),
        phoneNumber({
            sendPhoneNumber: async ({ phoneNumber, code }) => {
                // Your SMS integration
            },
            expireIn: 5 * 60,
            maxAttempts: 3,
        }),
        // Future: add passkey support
        // passkey({}),
    ],
    
    // Email (for verification)
    email: {
        async sendVerificationEmail({ email, code }) {
            // Your email service
        },
    },
});
```

---

## 🔧 Schema Changes Required

### Add to `drizzle/schema.ts`:

```typescript
// Add twoFactorEnabled to user table
export const user = pgTable("user", {
    // ... existing fields
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

// Add twoFactor table
export const twoFactor = pgTable(
    "two_factor",
    {
        id: text("id").primaryKey(),
        secret: text("secret").notNull(),
        backupCodes: text("backup_codes").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        verified: boolean("verified").default(false),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("twoFactor_userId_idx").on(table.userId),
    ],
);

// Add relations
export const userRelations = relations(user, ({ many }) => ({
    // ... existing relations
    twoFactors: many(twoFactor),
});

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
    user: one(user, {
        fields: [twoFactor.userId],
        references: [user.id],
    }),
}));
```

---

## 📊 Security Checklist

| Feature | Status | Priority |
|---------|--------|----------|
| OAuth token encryption | ❌ Not enabled | 🔴 Critical |
| 2FA support | ❌ Not implemented | 🔴 Critical |
| IP validation | ⚠️ Tracked only | ⚠️ High |
| Phone verification | ⚠️ Basic only | ⚠️ High |
| Session cleanup | ❌ Not implemented | ✅ Medium |
| Account linking | ✅ Implemented | ✅ Good |
| Email verification | ✅ Implemented | ✅ Good |

---

## 🚀 Quick Start

```bash
# Update Better Auth config
# Edit lib/auth.ts with the recommendations above

# Generate migration for 2FA
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate

# Update environment variables
echo "BETTER_AUTH_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
```

---

## 📚 Better Auth Resources

- **Documentation:** https://better-auth.com/docs
- **GitHub:** https://github.com/better-auth/better-auth
- **Plugins:** https://better-auth.com/docs/plugins/overview
- **Migration Guide:** https://better-auth.com/docs/migrate

---

**Next Steps:**
1. Enable `encryptOAuthTokens: true` with environment key
2. Add 2FA table and plugin
3. Implement session cleanup job
4. Add IP validation for sensitive operations
