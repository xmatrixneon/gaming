/**
 * Drizzle ORM Schema for Better Auth
 * Casino-specific schema with wallet/transaction system
 *
 * ============================================================================
 * FINANCIAL CORRECTNESS STRATEGY
 * ============================================================================
 *
 * Balance Synchronization:
 * - `user.balance` is a CACHED value for performance, not source of truth
 * - `transaction` table is the immutable source of truth for all balance changes
 * - All balance updates MUST go through walletService.updateBalanceAtomic()
 *   which creates transaction records atomically with optimistic locking
 * - A reconciliation job should run periodically to detect drift:
 *   SELECT user_id, balance, SUM(amount) OVER (ORDER BY created_at) as calculated_balance
 *   FROM transaction WHERE user_id = ? AND status = 'completed'
 *
 * 1:1 Relationship Enforcement (Critical):
 * - deposit.transactionId UNIQUE - prevents multiple deposits from claiming same transaction
 * - withdrawal.transactionId UNIQUE - prevents multiple withdrawals from claiming same transaction
 * - bet.transactionId UNIQUE - prevents multiple bets from claiming same transaction
 * - These UNIQUE constraints are critical for accounting correctness
 *
 * Immutability:
 * - transaction table has NO updatedAt field - truly append-only after insertion
 * - audit_log also has no updatedAt - append-only audit trail
 * - Status changes (pending -> completed) are handled by:
 *   1. Creating compensating transactions for reversals/refunds
 *   2. Separate state tracking in linked tables (deposit, withdrawal, bet)
 * - Application-level code never UPDATEs or DELETEs from these tables
 * - Consider database-level triggers or permissions to enforce immutability in production
 *
 * ============================================================================
 * FIXES APPLIED IN THIS VERSION
 * ============================================================================
 *
 * From second production code review (2026-06-10):
 * - Removed updatedAt from transaction table - makes ledger truly immutable
 * - Added FK to user.bannedBy - ensures referential integrity for admin actions
 * - Added CHECK constraint referral_not_self - prevents referrerId == referredUserId
 * - Added bonusTemplate logical checks:
 *   - expiryDays > 0
 *   - maxClaimsPerUser > 0
 *   - maxValue >= value (when maxValue is set)
 *
 * From first production code review (2026-06-10):
 * - Added UNIQUE constraints to deposit.transactionId, withdrawal.transactionId, bet.transactionId
 *   (Critical: prevents accounting corruption from 1:N relationships)
 * - Added composite indexes for common query patterns:
 *   - transaction_user_created_idx, transaction_user_type_created_idx
 *   - deposit_user_status_created_idx
 *   - withdrawal_user_status_created_idx
 *   - bet_user_created_idx
 *   - notification_user_unread_created_idx (partial index for unread notifications)
 * - Added financial correctness documentation header with balance reconciliation strategy
 * - generatedAlwaysAs: removed { mode: 'stored' } second argument.
 *   In drizzle-orm 0.45.x the PostgreSQL column's generatedAlwaysAs() signature is:
 *     generatedAlwaysAs(as: SQL | T['data'] | (() => SQL)): HasGenerated<this, ...>
 *   It accepts ONE argument only. The { mode } option exists in MySQL/SQLite (where
 *   VIRTUAL is also valid) but not in the pg-core types, because PostgreSQL only
 *   supports STORED generated columns — the mode is implicit and drizzle hardcodes it.
 *   Passing a second argument causes TS2554 "Expected 1 arguments, but got 2".
 *
 * All other fixes from previous sessions are preserved:
 * - updatedAt: .defaultNow() on all tables
 * - auditActionEnum: user_vip_upgrade added
 * - referralCode default null (not empty string)
 * - single userRelations export
 * - referralRelations: relationName on both sides
 * - userBonus wagering check: no upper bound (app layer clamps)
 */

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  varchar,
  pgEnum,
  decimal,
  integer,
  serial,
  jsonb,
  check,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdraw",
  "bet",
  "win",
  "loss",
  "bonus",
  "adjustment",
  "refund",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "reversed",
]);

export const betResultEnum = pgEnum("bet_result", [
  "pending",
  "won",
  "lost",
  "void",
  "cancelled",
]);

export const gameSessionStatusEnum = pgEnum("game_session_status", [
  "active",
  "completed",
  "cancelled",
]);

export const depositMethodEnum = pgEnum("deposit_method", [
  "upi",
  "paytm",
  "phonepe",
  "bank_transfer",
]);

export const withdrawalMethodEnum = pgEnum("withdrawal_method", [
  "upi",
  "bank_transfer",
]);

export const gatewayStatusEnum = pgEnum("gateway_status", [
  "active",
  "maintenance",
  "disabled",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rewarded",
  "expired",
  "cancelled",
]);

export const bonusTypeEnum = pgEnum("bonus_type", [
  "welcome",
  "referral",
  "deposit_match",
  "free_bet",
  "manual",
]);

export const bonusStatusEnum = pgEnum("bonus_status", [
  "pending",
  "active",
  "completed",
  "expired",
  "cancelled",
  "forfeited",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "deposit_confirmed",
  "withdrawal_approved",
  "withdrawal_rejected",
  "withdrawal_processed",
  "bonus_credited",
  "bonus_expiring",
  "referral_joined",
  "referral_qualified",
  "bet_settled",
  "account_flagged",
  "account_banned",
  "system",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "user_banned",
  "user_unbanned",
  "user_activated",
  "user_deactivated",
  "user_vip_upgrade",
  "balance_adjusted",
  "withdrawal_approved",
  "withdrawal_rejected",
  "withdrawal_flagged",
  "withdrawal_unflagged",
  "deposit_verified",
  "deposit_flagged",
  "bonus_issued",
  "bonus_cancelled",
  "referral_cancelled",
  "payment_method_added",
  "payment_method_set_primary",
  "payment_method_deleted",
  "admin_login",
  "permission_changed",
  "game_added",
  "game_updated",
  "game_removed",
]);

export const gameProviderStatusEnum = pgEnum("game_provider_status", [
  "active",
  "disabled",
  "maintenance",
]);

export const gameStatusEnum = pgEnum("game_status", [
  "active",
  "disabled",
  "maintenance",
]);

// ============================================================================
// PAYMENT GATEWAY CONFIG TABLE
// ============================================================================

export const paymentGatewayConfig = pgTable("payment_gateway_config", {
  id: text("id").primaryKey(),
  gatewayName: text("gateway_name").notNull(), // 'velopay' or 'okpay'
  displayName: text("display_name").notNull(), // 'UPI 1' or 'UPI 2'
  enabled: boolean("enabled").default(true).notNull(),
  priority: integer("priority").notNull().default(1), // 1 = primary (UPI 1), 2 = secondary (UPI 2)
  configMetadata: jsonb("config_metadata").$type<{
    apiKey?: string;
    secret?: string;
    merchantId?: string;
    host?: string;
    callbackUrl?: string;
    mode?: 'sandbox' | 'production';
  }>(),
  status: text("status").$type<'active' | 'maintenance' | 'disabled'>().default('active').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("gateway_config_priority_idx").on(table.priority),
  index("gateway_config_enabled_idx").on(table.enabled),
  index("gateway_config_name_idx").on(table.gatewayName),
]);

// ============================================================================
// USER TABLE
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified"),

  username: varchar("username", { length: 50 }).unique(),

  // null default — empty string '' breaks the unique constraint at scale
  // (only one user could ever have an empty referral code)
  referralCode: varchar("referral_code", { length: 12 }).unique(),

  balance: decimal("balance", { precision: 18, scale: 2 }).default("0").notNull(),
  balanceVersion: integer("balance_version").notNull().default(0),

  vipLevel: text("vip_level").default("Bronze").notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
  bannedBy: text("banned_by").references(() => user.id, { onDelete: "set null" }),

  // Better Auth 2FA support
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
});

// ============================================================================
// SESSION TABLE
// ============================================================================

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

// ============================================================================
// ACCOUNT TABLE
// ============================================================================

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

// ============================================================================
// VERIFICATION TABLE
// ============================================================================

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ============================================================================
// TWO FACTOR TABLE (Better Auth 2FA Support)
// ============================================================================

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("two_factor_userId_idx").on(table.userId),
  ],
);

// ============================================================================
// TRANSACTION TABLE (Immutable Ledger)
// ============================================================================
// NOTE: This table is APPEND-ONLY for financial correctness.
// - No updatedAt field (immutable after insertion)
// - Status changes (e.g., pending -> completed) are handled by:
//   1. Creating compensating transactions for reversals/refunds
//   2. Separate state tracking in linked tables (deposit, withdrawal, bet)
// - Never UPDATE or DELETE rows from this table in production
// - Consider database-level triggers or permissions to enforce immutability

export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 18, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 18, scale: 2 }).notNull(),

    idempotencyKey: text("idempotency_key").unique(),

    metadata: jsonb("metadata").$type<{
      gameSessionId?: string;
      betId?: string;
      provider?: string;
      method?: string;
      address?: string;
      reason?: string;
      adjustedBy?: string;
      reversedBy?: string;
      aggregatorRef?: string;
      gameRoundId?: string;
      originalTransactionId?: string;
      gatewayReference?: string;
      depositId?: string;
      withdrawalId?: string;
      currency?: string;
    }>(),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transaction_userId_idx").on(table.userId),
    index("transaction_status_idx").on(table.status),
    index("transaction_createdAt_idx").on(table.createdAt),
    index("transaction_user_created_idx").on(table.userId, table.createdAt),
    index("transaction_user_type_created_idx").on(table.userId, table.type, table.createdAt),
    check("transaction_amount_positive", sql`${table.amount} > 0`),
    check("transaction_balance_after_check", sql`${table.balanceAfter} >= 0`),
  ],
);

// ============================================================================
// DEPOSIT TABLE
// ============================================================================

export const deposit = pgTable(
  "deposit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    transactionId: text("transaction_id")
      .notNull()
      .unique()
      .references(() => transaction.id, { onDelete: "restrict" }),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    method: depositMethodEnum("method").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    gatewayId: text("gateway_id").references(() => paymentGatewayConfig.id, { onDelete: "set null" }),
    gatewayReference: text("gateway_reference").unique(),
    gatewayMetadata: jsonb("gateway_metadata"),

    verifiedBy: text("verified_by").references(() => user.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at"),

    isFlagged: boolean("is_flagged").default(false).notNull(),
    flaggedReason: text("flagged_reason"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("deposit_userId_idx").on(table.userId),
    index("deposit_transactionId_idx").on(table.transactionId),
    index("deposit_status_idx").on(table.status),
    index("deposit_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    check("deposit_amount_positive", sql`${table.amount} > 0`),
  ],
);

// ============================================================================
// WITHDRAWAL TABLE
// ============================================================================

export const withdrawal = pgTable(
  "withdrawal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    transactionId: text("transaction_id")
      .notNull()
      .unique()
      .references(() => transaction.id, { onDelete: "restrict" }),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    method: withdrawalMethodEnum("method").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    bankName: text("bank_name"),
    ifscCode: text("ifsc_code"),
    upiId: text("upi_id"),

    isApproved: boolean("is_approved").default(false).notNull(),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),

    processedBy: text("processed_by").references(() => user.id, { onDelete: "restrict" }),
    processedAt: timestamp("processed_at"),
    utrNumber: text("utr_number").unique(),

    isFlagged: boolean("is_flagged").default(false).notNull(),
    flaggedReason: text("flagged_reason"),
    notes: text("notes"),

    gatewayReference: text("gateway_reference").unique(),
    gatewayMetadata: jsonb("gateway_metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("withdrawal_userId_idx").on(table.userId),
    index("withdrawal_transactionId_idx").on(table.transactionId),
    index("withdrawal_isApproved_status_idx").on(table.isApproved, table.status),
    index("withdrawal_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    check("withdrawal_amount_positive", sql`${table.amount} > 0`),
    check(
      "withdrawal_payout_details",
      sql`(${table.method} = 'upi' AND ${table.upiId} IS NOT NULL)
          OR (${table.method} = 'bank_transfer' AND ${table.accountNumber} IS NOT NULL AND ${table.ifscCode} IS NOT NULL)`,
    ),
  ],
);

// ============================================================================
// PAYMENT METHOD TABLE
// ============================================================================

export const paymentMethod = pgTable(
  "payment_method",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: withdrawalMethodEnum("type").notNull(), // 'upi' or 'bank_transfer'
    isPrimary: boolean("is_primary").default(false).notNull(),
    label: text("label"), // Optional custom nickname (e.g., "My HDFC", "Personal UPI")

    // UPI details
    upiId: text("upi_id"),

    // Bank details (stored plain text, masked in UI only)
    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    bankName: text("bank_name"),
    ifscCode: text("ifsc_code"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_method_userId_idx").on(table.userId),
    // Note: One primary per user is enforced at application level in tRPC router
    // PostgreSQL doesn't support filtered unique constraints in a simple way
    // CHECK: UPI methods require upiId
    check(
      "payment_method_upi_requires_id",
      sql`(${table.type} != 'upi' OR ${table.upiId} IS NOT NULL)`,
    ),
    // CHECK: Bank methods require account details
    check(
      "payment_method_bank_requires_details",
      sql`(${table.type} != 'bank_transfer' OR (${table.accountNumber} IS NOT NULL AND ${table.ifscCode} IS NOT NULL))`,
    ),
  ],
);

// ============================================================================
// GAME SESSION TABLE
// ============================================================================

export const gameSession = pgTable(
  "game_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    provider: text("provider").notNull(),
    providerGameId: text("provider_game_id").notNull(),
    providerSessionId: text("provider_session_id").unique(),

    gameApiSerial: text("game_api_serial").unique(),

    status: gameSessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),

    totalBet: decimal("total_bet", { precision: 18, scale: 2 }).notNull().default("0"),
    totalWin: decimal("total_win", { precision: 18, scale: 2 }).notNull().default("0"),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_session_userId_idx").on(table.userId),
    index("game_session_providerGameId_idx").on(table.providerGameId),
    index("game_session_providerSessionId_idx").on(table.providerSessionId),
    index("game_session_gameApiSerial_idx").on(table.gameApiSerial),
    check(
      "game_session_totals_non_negative",
      sql`${table.totalBet} >= 0 AND ${table.totalWin} >= 0`,
    ),
  ],
);

// ============================================================================
// BET TABLE
// ============================================================================

export const bet = pgTable(
  "bet",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    transactionId: text("transaction_id")
      .notNull()
      .unique()
      .references(() => transaction.id, { onDelete: "restrict" }),

    gameSessionId: text("game_session_id").references(() => gameSession.id, {
      onDelete: "restrict",
    }),

    gameApiSerial: text("game_api_serial"),
    gameRound: text("game_round"),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    odds: decimal("odds", { precision: 10, scale: 2 }),

    gameData: jsonb("game_data").$type<{
      gameType: string;
      selection?: string;
      market?: string;
      gameApi?: Record<string, unknown>;
      [key: string]: unknown;
    }>(),

    result: betResultEnum("result").notNull().default("pending"),
    winAmount: decimal("win_amount", { precision: 18, scale: 2 }).notNull().default("0"),

    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bet_userId_idx").on(table.userId),
    index("bet_gameSessionId_idx").on(table.gameSessionId),
    index("bet_transactionId_idx").on(table.transactionId),
    index("bet_gameApiSerial_idx").on(table.gameApiSerial),
    index("bet_result_idx").on(table.result),
    index("bet_gameRound_idx").on(table.gameRound),
    index("bet_user_created_idx").on(table.userId, table.createdAt),
    check("bet_amount_positive", sql`${table.amount} > 0`),
    check("bet_winAmount_non_negative", sql`${table.winAmount} >= 0`),
  ],
);

// ============================================================================
// REFERRAL TABLE
// ============================================================================

export const referral = pgTable(
  "referral",
  {
    id: text("id").primaryKey(),

    referrerId: text("referrer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    referredUserId: text("referred_user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),

    referralCode: text("referral_code").notNull(),
    status: referralStatusEnum("status").notNull().default("pending"),

    bonusTransactionId: text("bonus_transaction_id").references(() => transaction.id, {
      onDelete: "restrict",
    }),

    qualifyByDate: timestamp("qualify_by_date")
      .notNull()
      .default(sql`NOW() + INTERVAL '30 days'`),
    qualifiedAt: timestamp("qualified_at"),
    rewardedAt: timestamp("rewarded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("referral_referrerId_idx").on(table.referrerId),
    index("referral_code_idx").on(table.referralCode),
    index("referral_status_idx").on(table.status),
    check("referral_not_self", sql`${table.referrerId} <> ${table.referredUserId}`),
  ],
);

// ============================================================================
// BONUS TEMPLATE TABLE
// ============================================================================

export const bonusTemplate = pgTable(
  "bonus_template",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    type: bonusTypeEnum("type").notNull(),

    value: decimal("value", { precision: 18, scale: 2 }).notNull(),
    maxValue: decimal("max_value", { precision: 18, scale: 2 }),

    wageringMultiplier: decimal("wagering_multiplier", { precision: 5, scale: 2 })
      .notNull()
      .default("1"),

    expiryDays: integer("expiry_days").notNull().default(30),
    maxClaimsPerUser: integer("max_claims_per_user").default(1),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bonus_template_type_idx").on(table.type),
    index("bonus_template_isActive_idx").on(table.isActive),
    check("bonus_template_value_positive", sql`${table.value} > 0`),
    check("bonus_template_wagering_positive", sql`${table.wageringMultiplier} >= 1`),
    check("bonus_template_expiry_positive", sql`${table.expiryDays} > 0`),
    check("bonus_template_claims_positive", sql`${table.maxClaimsPerUser} > 0`),
    check(
      "bonus_template_max_value_gte_value",
      sql`(${table.maxValue} IS NULL) OR (${table.maxValue} >= ${table.value})`,
    ),
  ],
);

// ============================================================================
// USER BONUS TABLE
// ============================================================================

export const userBonus = pgTable(
  "user_bonus",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    templateId: text("template_id")
      .notNull()
      .references(() => bonusTemplate.id, { onDelete: "restrict" }),

    awardedAmount: decimal("awarded_amount", { precision: 18, scale: 2 }).notNull(),
    status: bonusStatusEnum("status").notNull().default("pending"),

    wageringRequired: decimal("wagering_required", { precision: 18, scale: 2 }).notNull(),
    wageringCompleted: decimal("wagering_completed", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),

    expiresAt: timestamp("expires_at").notNull(),
    completedAt: timestamp("completed_at"),

    sourceReferralId: text("source_referral_id").references(() => referral.id, {
      onDelete: "restrict",
    }),
    sourceDepositId: text("source_deposit_id").references(() => deposit.id, {
      onDelete: "restrict",
    }),

    completionTransactionId: text("completion_transaction_id").references(
      () => transaction.id,
      { onDelete: "restrict" },
    ),

    issuedBy: text("issued_by").references(() => user.id, { onDelete: "restrict" }),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_bonus_userId_idx").on(table.userId),
    index("user_bonus_templateId_idx").on(table.templateId),
    index("user_bonus_status_idx").on(table.status),
    index("user_bonus_expiresAt_idx").on(table.expiresAt),
    check("user_bonus_wagering_non_negative", sql`${table.wageringCompleted} >= 0`),
    check("user_bonus_amount_positive", sql`${table.awardedAmount} > 0`),
  ],
);

// ============================================================================
// NOTIFICATION TABLE
// ============================================================================

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),

    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),

    metadata: jsonb("metadata").$type<{
      transactionId?: string;
      withdrawalId?: string;
      depositId?: string;
      betId?: string;
      bonusId?: string;
      referralId?: string;
      actionUrl?: string;
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_userId_isRead_idx").on(table.userId, table.isRead),
    index("notification_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("notification_user_unread_created_idx").on(table.userId, table.createdAt)
      .where(sql`${table.isRead} = false`),
  ],
);

// ============================================================================
// AUDIT LOG TABLE (append-only)
// ============================================================================

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),

    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorRole: text("actor_role").notNull(),

    action: auditActionEnum("action").notNull(),

    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),

    before: jsonb("before"),
    after: jsonb("after"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_actorId_idx").on(table.actorId),
    index("audit_log_target_idx").on(table.targetType, table.targetId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_createdAt_idx").on(table.createdAt),
    check(
      "audit_log_actor_requirement",
      sql`(${table.actorId} IS NOT NULL) OR (${table.actorRole} IN ('system', 'cron'))`,
    ),
  ],
);

// ============================================================================
// GAME STATS TABLE
// ============================================================================

export const gameStats = pgTable(
  "game_stats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    totalBets: integer("total_bets").notNull().default(0),
    totalWins: integer("total_wins").notNull().default(0),
    totalLosses: integer("total_losses").notNull().default(0),

    totalWagered: decimal("total_wagered", { precision: 18, scale: 2 }).notNull().default("0"),
    totalWon: decimal("total_won", { precision: 18, scale: 2 }).notNull().default("0"),

    // FIX: generatedAlwaysAs takes ONE argument in drizzle-orm 0.45.x for PostgreSQL.
    // The pg-core type signature is:
    //   generatedAlwaysAs(as: SQL | T['data'] | (() => SQL)): HasGenerated<this, ...>
    // There is no second { mode } parameter because PostgreSQL only supports STORED
    // generated columns — drizzle hardcodes STORED in the emitted DDL.
    // Passing { mode: 'stored' } caused TS2554 "Expected 1 arguments, but got 2".
    netPnl: decimal("net_pnl", { precision: 18, scale: 2 }).generatedAlwaysAs(
      sql`total_won - total_wagered`,
    ),

    biggestWin: decimal("biggest_win", { precision: 18, scale: 2 }).notNull().default("0"),
    biggestWinBetId: text("biggest_win_bet_id").references(() => bet.id, {
      onDelete: "set null",
    }),
    biggestLoss: decimal("biggest_loss", { precision: 18, scale: 2 }).notNull().default("0"),

    favouriteProvider: text("favourite_provider"),
    favouriteGameId: text("favourite_game_id"),

    currentWinStreak: integer("current_win_streak").notNull().default(0),
    currentLossStreak: integer("current_loss_streak").notNull().default(0),
    longestWinStreak: integer("longest_win_streak").notNull().default(0),

    lastBetAt: timestamp("last_bet_at"),

    statsVersion: integer("stats_version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_stats_totalWagered_idx").on(table.totalWagered),
    index("game_stats_totalWon_idx").on(table.totalWon),
    check(
      "game_stats_non_negative",
      sql`${table.totalBets} >= 0 AND ${table.totalWagered} >= 0 AND ${table.totalWon} >= 0`,
    ),
  ],
);

// ============================================================================
// GAME PROVIDER TABLE
// ============================================================================

/**
 * Game providers from the Game API
 * Syncs with /game/providers endpoint
 */
export const gameProvider = pgTable(
  "game_provider",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(), // e.g., "PG", "JL", "PPLIVE"
    name: text("name").notNull(), // e.g., "PGSoft", "JILI", "Evolution"

    // From API: supported currencies (comma-separated)
    supportedCurrencies: text("supported_currencies").notNull(),
    // From API: supported languages (comma-separated)
    supportedLanguages: text("supported_languages").notNull(),

    status: gameProviderStatusEnum("status").notNull().default("active"),

    // Provider image/logo (manual upload)
    imageUrl: text("image_url"),
    thumbnailUrl: text("thumbnail_url"),

    // Display order for frontend
    displayOrder: integer("display_order").notNull().default(0),

    // Admin can override the API game count
    gameCount: integer("game_count").notNull().default(0),

    // Category classification (for frontend grouping)
    category: text("category").notNull().default("slots"), // slots, live_casino, fishing, sports, etc.

    // Features enabled for this provider
    features: jsonb("features").$type<{
      hasDemo?: boolean;
      hasJackpot?: boolean;
      hasBuyBonus?: boolean;
      hasMegaways?: boolean;
      [key: string]: unknown;
    }>(),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at"),
    isSynced: boolean("is_synced").notNull().default(false), // true if synced from API

    // Admin notes
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_provider_code_idx").on(table.code),
    index("game_provider_status_idx").on(table.status),
    index("game_provider_category_idx").on(table.category),
    index("game_provider_displayOrder_idx").on(table.displayOrder),
  ],
);

// ============================================================================
// GAME TABLE
// ============================================================================

/**
 * Individual games from providers
 * Syncs with /game/list endpoint + manual additions
 * Image URLs are added manually by admin
 */
export const game = pgTable(
  "game",
  {
    id: text("id").primaryKey(),

    // Reference to provider
    providerId: text("provider_id")
      .notNull()
      .references(() => gameProvider.id, { onDelete: "restrict" }),

    // From API
    gameUid: text("game_uid").notNull().unique(), // API game UID
    gameName: text("game_name").notNull(),
    gameType: text("game_type").notNull(), // Slot, Live Casino, Fish, Sports, etc.

    // From API: supported currencies (comma-separated)
    supportedCurrencies: text("supported_currencies").notNull(),
    // From API: supported languages (comma-separated)
    supportedLanguages: text("supported_languages").notNull(),

    status: gameStatusEnum("status").notNull().default("active"),

    // ===== IMAGES (MOST IMPORTANT) =====
    // Primary game image (card/banner)
    imageUrl: text("image_url").notNull(),
    // Square thumbnail (for game grids)
    thumbnailUrl: text("thumbnail_url"),
    // Wide banner (for carousels)
    bannerUrl: text("banner_url"),
    // Background image (for game launch page)
    backgroundUrl: text("background_url"),

    // Image alt text for accessibility
    imageAlt: text("image_alt"),

    // Display settings
    displayOrder: integer("display_order").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    isHot: boolean("is_hot").notNull().default(false),

    // Game metadata (rich info)
    metadata: jsonb("metadata").$type<{
      volatility?: "low" | "medium" | "high";
      rtp?: number; // Return to Player percentage
      maxWin?: number; // Max win multiplier
      minBet?: number; // Minimum bet in rupees
      maxBet?: number; // Maximum bet in rupees
      paylines?: number;
      reels?: number;
      rows?: number;
      features?: string[]; // bonus_buy, free_spins, megaways, etc.
      tags?: string[]; // popular, new, exclusive, etc.
      description?: string;
      releaseDate?: string; // ISO date
      providerGameCode?: string;
      [key: string]: unknown;
    }>(),

    // Game launch URL template (can override default)
    launchUrlTemplate: text("launch_url_template"),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at"),
    isSynced: boolean("is_synced").notNull().default(false), // true if synced from API

    // Admin notes
    notes: text("notes"),

    // SEO
    slug: text("slug").unique(), // URL-friendly game name
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_providerId_idx").on(table.providerId),
    index("game_gameUid_idx").on(table.gameUid),
    index("game_status_idx").on(table.status),
    index("game_gameType_idx").on(table.gameType),
    index("game_displayOrder_idx").on(table.displayOrder),
    index("game_isFeatured_idx").on(table.isFeatured),
    index("game_isNew_idx").on(table.isNew),
    index("game_isHot_idx").on(table.isHot),
    index("game_slug_idx").on(table.slug),
    check("game_has_image", sql`${table.imageUrl} IS NOT NULL AND ${table.imageUrl} <> ''`),
  ],
);

// ============================================================================
// GAME CATEGORY TABLE
// ============================================================================

/**
 * Game categories for frontend organization
 */
export const gameCategory = pgTable(
  "game_category",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),

    // Category image
    iconUrl: text("icon_url"),
    imageUrl: text("image_url"),

    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_category_slug_idx").on(table.slug),
    index("game_category_displayOrder_idx").on(table.displayOrder),
    index("game_category_isActive_idx").on(table.isActive),
  ],
);

// ============================================================================
// GAME CATEGORY RELATION TABLE
// ============================================================================

/**
 * Many-to-many relationship between games and categories
 */
export const gameCategoryRelation = pgTable(
  "game_category_relation",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => gameCategory.id, { onDelete: "cascade" }),

    displayOrder: integer("display_order").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("game_category_relation_gameId_idx").on(table.gameId),
    index("game_category_relation_categoryId_idx").on(table.categoryId),
    index("game_category_relation_unique_idx").on(table.gameId, table.categoryId),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  transactions: many(transaction),
  deposits: many(deposit),
  withdrawals: many(withdrawal),
  paymentMethods: many(paymentMethod),
  gameSessions: many(gameSession),
  bets: many(bet),
  referralsMade: many(referral, { relationName: "referrer" }),
  referredAs: many(referral, { relationName: "referredUser" }),
  bonuses: many(userBonus),
  notifications: many(notification),
  auditLogs: many(auditLog),
  twoFactors: many(twoFactor),
  gameStats: one(gameStats, {
    fields: [user.id],
    references: [gameStats.userId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  user: one(user, { fields: [transaction.userId], references: [user.id] }),
  deposit: one(deposit, { fields: [transaction.id], references: [deposit.transactionId] }),
  withdrawal: one(withdrawal, {
    fields: [transaction.id],
    references: [withdrawal.transactionId],
  }),
  bet: one(bet, { fields: [transaction.id], references: [bet.transactionId] }),
}));

export const depositRelations = relations(deposit, ({ one }) => ({
  user: one(user, { fields: [deposit.userId], references: [user.id] }),
  transaction: one(transaction, {
    fields: [deposit.transactionId],
    references: [transaction.id],
  }),
  gatewayConfig: one(paymentGatewayConfig, {
    fields: [deposit.gatewayId],
    references: [paymentGatewayConfig.id],
  }),
}));

export const withdrawalRelations = relations(withdrawal, ({ one }) => ({
  user: one(user, { fields: [withdrawal.userId], references: [user.id] }),
  transaction: one(transaction, {
    fields: [withdrawal.transactionId],
    references: [transaction.id],
  }),
}));

export const paymentMethodRelations = relations(paymentMethod, ({ one }) => ({
  user: one(user, {
    fields: [paymentMethod.userId],
    references: [user.id],
  }),
}));

export const gameSessionRelations = relations(gameSession, ({ one, many }) => ({
  user: one(user, { fields: [gameSession.userId], references: [user.id] }),
  bets: many(bet),
}));

export const betRelations = relations(bet, ({ one }) => ({
  user: one(user, { fields: [bet.userId], references: [user.id] }),
  transaction: one(transaction, { fields: [bet.transactionId], references: [transaction.id] }),
  gameSession: one(gameSession, {
    fields: [bet.gameSessionId],
    references: [gameSession.id],
  }),
}));

export const referralRelations = relations(referral, ({ one }) => ({
  referrer: one(user, {
    fields: [referral.referrerId],
    references: [user.id],
    relationName: "referrer",
  }),
  referredUser: one(user, {
    fields: [referral.referredUserId],
    references: [user.id],
    relationName: "referredUser",
  }),
  bonusTransaction: one(transaction, {
    fields: [referral.bonusTransactionId],
    references: [transaction.id],
  }),
}));

export const bonusTemplateRelations = relations(bonusTemplate, ({ many }) => ({
  userBonuses: many(userBonus),
}));

export const userBonusRelations = relations(userBonus, ({ one }) => ({
  user: one(user, { fields: [userBonus.userId], references: [user.id] }),
  template: one(bonusTemplate, {
    fields: [userBonus.templateId],
    references: [bonusTemplate.id],
  }),
  sourceReferral: one(referral, {
    fields: [userBonus.sourceReferralId],
    references: [referral.id],
  }),
  sourceDeposit: one(deposit, {
    fields: [userBonus.sourceDepositId],
    references: [deposit.id],
  }),
  completionTransaction: one(transaction, {
    fields: [userBonus.completionTransactionId],
    references: [transaction.id],
  }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, { fields: [auditLog.actorId], references: [user.id] }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
  user: one(user, { fields: [gameStats.userId], references: [user.id] }),
  biggestWinBet: one(bet, {
    fields: [gameStats.biggestWinBetId],
    references: [bet.id],
  }),
}));

// ============================================================================
// GAME TABLE RELATIONS
// ============================================================================

export const gameProviderRelations = relations(gameProvider, ({ many }) => ({
  games: many(game),
}));

export const gameRelations = relations(game, ({ one, many }) => ({
  provider: one(gameProvider, {
    fields: [game.providerId],
    references: [gameProvider.id],
  }),
  categoryRelations: many(gameCategoryRelation),
}));

export const gameCategoryRelations = relations(gameCategory, ({ many }) => ({
  gameRelations: many(gameCategoryRelation),
}));

export const gameCategoryRelationRelations = relations(gameCategoryRelation, ({ one }) => ({
  game: one(game, {
    fields: [gameCategoryRelation.gameId],
    references: [game.id],
  }),
  category: one(gameCategory, {
    fields: [gameCategoryRelation.categoryId],
    references: [gameCategory.id],
  }),
}));

// ============================================================================
// PAYMENT GATEWAY CONFIG RELATIONS
// ============================================================================

export const paymentGatewayConfigRelations = relations(paymentGatewayConfig, ({ many }) => ({
  deposits: many(deposit),
}));

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;
export type Deposit = typeof deposit.$inferSelect;
export type NewDeposit = typeof deposit.$inferInsert;
export type Withdrawal = typeof withdrawal.$inferSelect;
export type NewWithdrawal = typeof withdrawal.$inferInsert;
export type GameSession = typeof gameSession.$inferSelect;
export type NewGameSession = typeof gameSession.$inferInsert;
export type Bet = typeof bet.$inferSelect;
export type NewBet = typeof bet.$inferInsert;
export type Referral = typeof referral.$inferSelect;
export type NewReferral = typeof referral.$inferInsert;
export type BonusTemplate = typeof bonusTemplate.$inferSelect;
export type NewBonusTemplate = typeof bonusTemplate.$inferInsert;
export type UserBonus = typeof userBonus.$inferSelect;
export type NewUserBonus = typeof userBonus.$inferInsert;
export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type GameStats = typeof gameStats.$inferSelect;
export type NewGameStats = typeof gameStats.$inferInsert;
export type GameProvider = typeof gameProvider.$inferSelect;
export type NewGameProvider = typeof gameProvider.$inferInsert;
export type Game = typeof game.$inferSelect;
export type NewGame = typeof game.$inferInsert;
export type GameCategory = typeof gameCategory.$inferSelect;
export type NewGameCategory = typeof gameCategory.$inferInsert;
export type GameCategoryRelation = typeof gameCategoryRelation.$inferSelect;
export type NewGameCategoryRelation = typeof gameCategoryRelation.$inferInsert;
export type PaymentGatewayConfig = typeof paymentGatewayConfig.$inferSelect;
export type NewPaymentGatewayConfig = typeof paymentGatewayConfig.$inferInsert;

export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionStatus = (typeof transactionStatusEnum.enumValues)[number];
export type BetResult = (typeof betResultEnum.enumValues)[number];
export type GameSessionStatus = (typeof gameSessionStatusEnum.enumValues)[number];
export type DepositMethod = (typeof depositMethodEnum.enumValues)[number];
export type WithdrawalMethod = (typeof withdrawalMethodEnum.enumValues)[number];
export type ReferralStatus = (typeof referralStatusEnum.enumValues)[number];
export type BonusType = (typeof bonusTypeEnum.enumValues)[number];
export type BonusStatus = (typeof bonusStatusEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
export type GameProviderStatus = (typeof gameProviderStatusEnum.enumValues)[number];
export type GameStatus = (typeof gameStatusEnum.enumValues)[number];

export type UserFlags = Pick<User, "isActive" | "isBanned">;
export type WithdrawalFlags = Pick<Withdrawal, "isApproved" | "isFlagged">;
export type DepositFlags = Pick<Deposit, "isFlagged">;