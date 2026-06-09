/**
 * Drizzle ORM Schema for Better Auth
 * This schema includes all tables required by Better Auth with plugins
 * Plus casino-specific custom fields and wallet/transaction system
 */

import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, varchar, pgEnum, decimal, bigint, jsonb, integer } from "drizzle-orm/pg-core";

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
    .$onUpdate(() => new Date())
    .notNull(),

  // Phone authentication (phone-number plugin)
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified"),

  // Casino-specific custom fields
  username: varchar("username", { length: 50 }).unique(),
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"),
  balanceVersion: integer("balance_version").notNull().default(0),
  vipLevel: text("vip_level").default("Bronze"),
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
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ============================================================================
// TRANSACTION TYPES (ENUMS)
// ============================================================================

export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdraw", "bet", "win", "loss", "bonus", "adjustment", "refund"]);

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "processing", "completed", "failed", "cancelled", "reversed"]);

// ============================================================================
// TRANSACTION TABLE (Immutable Ledger)
// ============================================================================

export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    // Financial fields (DECIMAL for precision)
    amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 18, scale: 8 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 18, scale: 8 }).notNull(),

    // Idempotency
    idempotencyKey: text("idempotency_key").unique(),

    // Metadata
    metadata: jsonb("metadata").$type<{
      gameSessionId?: string;
      betId?: string;
      provider?: string;
      method?: string;
      address?: string;
      reason?: string;
      adjustedBy?: string;
      aggregatorRef?: string;
      gameRoundId?: string;
    }>(),

    // Audit
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("transaction_userId_idx").on(table.userId)],
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
      .references(() => transaction.id),

    amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
    method: text("method").notNull(), // upi, paytm, phonepe, bank_transfer
    status: transactionStatusEnum("status").notNull().default("pending"),

    // Payment gateway details
    gatewayReference: text("gateway_reference"),
    gatewayMetadata: jsonb("gateway_metadata"),

    // Verified by admin
    verifiedBy: text("verified_by").references(() => user.id),
    verifiedAt: timestamp("verified_at"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("deposit_userId_idx").on(table.userId)],
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
      .references(() => transaction.id),

    amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
    method: text("method").notNull(), // upi, bank_transfer
    status: transactionStatusEnum("status").notNull().default("pending"),

    // Withdrawal details
    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    bankName: text("bank_name"),
    ifscCode: text("ifsc_code"),
    upiId: text("upi_id"),

    // Processing
    processedBy: text("processed_by").references(() => user.id),
    processedAt: timestamp("processed_at"),
    utrNumber: text("utr_number"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("withdrawal_userId_idx").on(table.userId)],
);

// ============================================================================
// GAME SESSION TABLE (for Aggregator Integration)
// ============================================================================

export const gameSession = pgTable(
  "game_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    // Aggregator/game details
    provider: text("provider").notNull(), // aggregator name
    providerGameId: text("provider_game_id").notNull(),
    providerSessionId: text("provider_session_id"),

    // Session state
    status: text("status").notNull().default("active"), // active, completed, cancelled
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),

    // Financial summary
    totalBet: decimal("total_bet", { precision: 18, scale: 8 }).notNull().default("0"),
    totalWin: decimal("total_win", { precision: 18, scale: 8 }).notNull().default("0"),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("game_session_userId_idx").on(table.userId),
    index("game_session_providerSessionId_idx").on(table.providerSessionId),
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
      .references(() => transaction.id),
    gameSessionId: text("game_session_id")
      .references(() => gameSession.id),

    // Bet details
    amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
    odds: decimal("odds", { precision: 10, scale: 2 }), // decimal odds (e.g., 1.95)

    // Game-specific data
    gameData: jsonb("game_data").$type<{
      gameType: string;
      selection?: string;
      market?: string;
      [key: string]: any;
    }>(),

    // Result
    result: text("result").notNull(), // pending, won, lost, void, cancelled
    winAmount: decimal("win_amount", { precision: 18, scale: 8 }).notNull().default("0"),

    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bet_userId_idx").on(table.userId),
    index("bet_gameSessionId_idx").on(table.gameSessionId),
    index("bet_transactionId_idx").on(table.transactionId),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
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
export type Transaction = typeof transaction.$inferSelect;
export type Deposit = typeof deposit.$inferSelect;
export type NewDeposit = typeof deposit.$inferInsert;
export type Withdrawal = typeof withdrawal.$inferSelect;
export type NewWithdrawal = typeof withdrawal.$inferInsert;
export type GameSession = typeof gameSession.$inferSelect;
export type NewGameSession = typeof gameSession.$inferInsert;
export type Bet = typeof bet.$inferSelect;
export type NewBet = typeof bet.$inferInsert;
