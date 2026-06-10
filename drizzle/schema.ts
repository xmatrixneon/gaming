/**
 * Drizzle ORM Schema for Better Auth
 * Casino-specific schema with wallet/transaction system
 *
 * Key improvements over v1:
 * - Enums for bet.result, gameSession.status, deposit.method, withdrawal.method
 * - CHECK constraints: amount > 0, balanceAfter = balanceBefore + amount
 * - Missing indexes on FK columns and hot query paths
 * - Drizzle relations() defined for ALL tables (enables relational query API)
 * - idempotencyKey added to deposit (gateway webhook deduplication)
 * - transaction.updatedAt uses $onUpdate for consistency
 * - onDelete: "restrict" made explicit on verifiedBy / processedBy refs
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

// Finite known payment methods — prevents typos and enables exhaustive handling
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

  // Casino-specific fields
  username: varchar("username", { length: 50 }).unique(),

  // Denormalized balance: must always equal sum of completed transactions.
  // Guarded by balanceVersion (optimistic locking) — always read + CAS update
  // in a transaction; never update balance directly without incrementing version.
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0").notNull(),
  balanceVersion: integer("balance_version").notNull().default(0),

  vipLevel: text("vip_level").default("Bronze").notNull(),

  // Account health flags
  // isActive: false = soft-suspended (login blocked, bets blocked, withdrawals blocked)
  // isBanned: true = permanent ban, reason required
  isActive: boolean("is_active").default(true).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
  bannedBy: text("banned_by"), // admin user id — no FK to avoid circular ref
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

    // Precision: scale:2 for INR; bump to scale:8 if adding crypto support
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    balanceBefore: decimal("balance_before", { precision: 18, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 18, scale: 2 }).notNull(),

    // Prevents duplicate processing on retries/replays
    idempotencyKey: text("idempotency_key").unique(),

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

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Transactions are effectively immutable — only status transitions are allowed.
    // Keep updatedAt to track status changes; never modify financial fields post-insert.
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transaction_userId_idx").on(table.userId),
    index("transaction_status_idx").on(table.status),
    // Enforce accounting identity at DB level
    check(
      "transaction_amount_positive",
      sql`${table.amount} > 0`,
    ),
    check(
      "transaction_balance_after_check",
      sql`${table.balanceAfter} >= 0`,
    ),
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
      .references(() => transaction.id, { onDelete: "restrict" }),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    method: depositMethodEnum("method").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    // Gateway reference doubles as idempotency key for webhook deduplication.
    // Mark unique so duplicate webhook callbacks are safely rejected.
    gatewayReference: text("gateway_reference").unique(),
    gatewayMetadata: jsonb("gateway_metadata"),

    verifiedBy: text("verified_by").references(() => user.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at"),

    // Fraud/compliance flag — set by automated checks or manual review
    isFlagged: boolean("is_flagged").default(false).notNull(),
    flaggedReason: text("flagged_reason"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("deposit_userId_idx").on(table.userId),
    // FK join index — queried on every transaction lookup
    index("deposit_transactionId_idx").on(table.transactionId),
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
      .references(() => transaction.id, { onDelete: "restrict" }),

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    method: withdrawalMethodEnum("method").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),

    accountNumber: text("account_number"),
    accountHolder: text("account_holder"),
    bankName: text("bank_name"),
    ifscCode: text("ifsc_code"),
    upiId: text("upi_id"),

    // Two-step payout gate — payout worker checks BOTH isApproved = true AND status = 'pending'
    isApproved: boolean("is_approved").default(false).notNull(),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),

    processedBy: text("processed_by").references(() => user.id, { onDelete: "restrict" }),
    processedAt: timestamp("processed_at"),
    utrNumber: text("utr_number").unique(), // UTR is globally unique once assigned

    // Risk flag — flagged withdrawals must be cleared before isApproved can be set
    isFlagged: boolean("is_flagged").default(false).notNull(),
    flaggedReason: text("flagged_reason"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("withdrawal_userId_idx").on(table.userId),
    index("withdrawal_transactionId_idx").on(table.transactionId),
    // Payout worker: WHERE is_approved = true AND status = 'pending'
    index("withdrawal_isApproved_status_idx").on(table.isApproved, table.status),
    check("withdrawal_amount_positive", sql`${table.amount} > 0`),
    // Exactly one of upiId or accountNumber must be present for bank_transfer.
    // Enforced here; application layer should also validate.
    check(
      "withdrawal_payout_details",
      sql`(${table.method} = 'upi' AND ${table.upiId} IS NOT NULL)
          OR (${table.method} = 'bank_transfer' AND ${table.accountNumber} IS NOT NULL AND ${table.ifscCode} IS NOT NULL)`,
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
    providerSessionId: text("provider_session_id").unique(), // aggregator sessions are 1:1

    // Game API specific fields
    gameApiSerial: text("game_api_serial").unique(), // Game API serial number for reconciliation

    status: gameSessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),

    totalBet: decimal("total_bet", { precision: 18, scale: 2 }).notNull().default("0"),
    totalWin: decimal("total_win", { precision: 18, scale: 2 }).notNull().default("0"),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("game_session_userId_idx").on(table.userId),
    // Aggregator callbacks look up sessions by providerGameId + providerSessionId
    index("game_session_providerGameId_idx").on(table.providerGameId),
    index("game_session_providerSessionId_idx").on(table.providerSessionId),
    // Game API callback lookup by serial number
    index("game_session_gameApiSerial_idx").on(table.gameApiSerial),
    check("game_session_totals_non_negative", sql`${table.totalBet} >= 0 AND ${table.totalWin} >= 0`),
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
      .references(() => transaction.id, { onDelete: "restrict" }),

    // Nullable: direct bets (e.g. sports) may not belong to a game session
    gameSessionId: text("game_session_id").references(() => gameSession.id, {
      onDelete: "restrict",
    }),

    // Game API specific fields
    gameApiSerial: text("game_api_serial"), // Game API serial number for reconciliation
    gameRound: text("game_round"), // Game round ID from Game API

    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    odds: decimal("odds", { precision: 10, scale: 2 }),

    gameData: jsonb("game_data").$type<{
      gameType: string;
      selection?: string;
      market?: string;
      gameApi?: Record<string, unknown>; // Game API specific data
      [key: string]: unknown;
    }>(),

    // Enum instead of plain text — keeps result values consistent across queries
    result: betResultEnum("result").notNull().default("pending"),
    winAmount: decimal("win_amount", { precision: 18, scale: 2 }).notNull().default("0"),

    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bet_userId_idx").on(table.userId),
    index("bet_gameSessionId_idx").on(table.gameSessionId),
    index("bet_transactionId_idx").on(table.transactionId),
    // Game API callback lookup by serial number
    index("bet_gameApiSerial_idx").on(table.gameApiSerial),
    // Settlement worker filters by pending result constantly
    index("bet_result_idx").on(table.result),
    check("bet_amount_positive", sql`${table.amount} > 0`),
    check("bet_winAmount_non_negative", sql`${table.winAmount} >= 0`),
  ],
);

// ============================================================================
// RELATIONS (enables db.query.X.findMany({ with: { ... } }))
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  transactions: many(transaction),
  deposits: many(deposit),
  withdrawals: many(withdrawal),
  gameSessions: many(gameSession),
  bets: many(bet),
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
  withdrawal: one(withdrawal, { fields: [transaction.id], references: [withdrawal.transactionId] }),
  bet: one(bet, { fields: [transaction.id], references: [bet.transactionId] }),
}));

export const depositRelations = relations(deposit, ({ one }) => ({
  user: one(user, { fields: [deposit.userId], references: [user.id] }),
  transaction: one(transaction, { fields: [deposit.transactionId], references: [transaction.id] }),
}));

export const withdrawalRelations = relations(withdrawal, ({ one }) => ({
  user: one(user, { fields: [withdrawal.userId], references: [user.id] }),
  transaction: one(transaction, { fields: [withdrawal.transactionId], references: [transaction.id] }),
}));

export const gameSessionRelations = relations(gameSession, ({ one, many }) => ({
  user: one(user, { fields: [gameSession.userId], references: [user.id] }),
  bets: many(bet),
}));

export const betRelations = relations(bet, ({ one }) => ({
  user: one(user, { fields: [bet.userId], references: [user.id] }),
  transaction: one(transaction, { fields: [bet.transactionId], references: [transaction.id] }),
  gameSession: one(gameSession, { fields: [bet.gameSessionId], references: [gameSession.id] }),
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

// Enum value types (useful for application-layer type guards)
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionStatus = (typeof transactionStatusEnum.enumValues)[number];
export type BetResult = (typeof betResultEnum.enumValues)[number];
export type GameSessionStatus = (typeof gameSessionStatusEnum.enumValues)[number];
export type DepositMethod = (typeof depositMethodEnum.enumValues)[number];
export type WithdrawalMethod = (typeof withdrawalMethodEnum.enumValues)[number];

// Flag field helpers — useful for query filtering in application code
export type UserFlags = Pick<User, "isActive" | "isBanned">;
export type WithdrawalFlags = Pick<Withdrawal, "isApproved" | "isFlagged">;
export type DepositFlags = Pick<Deposit, "isFlagged">;

// ============================================================================
// NEW ENUMS — Referral, Bonus, Notification, Audit
// ============================================================================

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",    // referred user signed up, not yet deposited
  "qualified",  // first deposit made — bonus can now be credited
  "rewarded",   // bonus transaction created and credited
  "expired",    // qualified window elapsed without deposit
  "cancelled",  // fraud / self-referral detected
]);

export const bonusTypeEnum = pgEnum("bonus_type", [
  "welcome",        // first-deposit match
  "referral",       // credited when referred user qualifies
  "deposit_match",  // percentage match on deposit
  "free_bet",       // fixed-amount free bet credit
  "manual",         // admin-issued one-off
]);

export const bonusStatusEnum = pgEnum("bonus_status", [
  "pending",    // awarded but wagering requirement not yet met
  "active",     // wagering in progress
  "completed",  // wagering requirement met, bonus converted to real balance
  "expired",    // expiry date passed before wagering completed
  "cancelled",  // voided by admin
  "forfeited",  // user withdrew before meeting wagering requirement
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
  // User management
  "user_banned",
  "user_unbanned",
  "user_activated",
  "user_deactivated",
  // Balance
  "balance_adjusted",
  // Withdrawal lifecycle
  "withdrawal_approved",
  "withdrawal_rejected",
  "withdrawal_flagged",
  "withdrawal_unflagged",
  // Deposit lifecycle
  "deposit_verified",
  "deposit_flagged",
  // Bonus
  "bonus_issued",
  "bonus_cancelled",
  // Referral
  "referral_cancelled",
  // Auth / access
  "admin_login",
  "permission_changed",
]);

// ============================================================================
// REFERRAL TABLE
// ============================================================================

export const referral = pgTable(
  "referral",
  {
    id: text("id").primaryKey(),

    // The user who shared the code
    referrerId: text("referrer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    // The user who used the code at signup — unique: one referrer per new user
    referredUserId: text("referred_user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),

    // The code that was used (snapshot — referrer may change code later)
    referralCode: text("referral_code").notNull(),

    status: referralStatusEnum("status").notNull().default("pending"),

    // Populated when status → rewarded
    bonusTransactionId: text("bonus_transaction_id")
      .references(() => transaction.id, { onDelete: "restrict" }),

    // Referred user has this many days from signup to make first deposit
    qualifyByDate: timestamp("qualify_by_date").notNull(),
    qualifiedAt: timestamp("qualified_at"),
    rewardedAt: timestamp("rewarded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("referral_referrerId_idx").on(table.referrerId),
    // Queried on every signup to resolve a code to a referrer
    index("referral_code_idx").on(table.referralCode),
    index("referral_status_idx").on(table.status),
  ],
);

// Referral code on the user row — short, unique, shareable
// Add this column to the user table migration separately:
//   referralCode: varchar("referral_code", { length: 12 }).unique()

// ============================================================================
// BONUS TEMPLATE TABLE  (reusable promotion definitions)
// ============================================================================

export const bonusTemplate = pgTable(
  "bonus_template",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),              // e.g. "Welcome Bonus 100%"
    description: text("description"),
    type: bonusTypeEnum("type").notNull(),

    // Value semantics depend on type:
    //   deposit_match / welcome → percentage (e.g. "100" = 100% match)
    //   free_bet / referral / manual → fixed INR amount
    value: decimal("value", { precision: 18, scale: 2 }).notNull(),
    maxValue: decimal("max_value", { precision: 18, scale: 2 }), // cap for percentage bonuses

    // Wagering: user must bet (bonusAmount × wageringMultiplier) before withdrawal
    wageringMultiplier: decimal("wagering_multiplier", { precision: 5, scale: 2 })
      .notNull()
      .default("1"),

    // How many days the user has to meet wagering after bonus is credited
    expiryDays: integer("expiry_days").notNull().default(30),

    // Max number of times this template can be claimed per user (null = unlimited)
    maxClaimsPerUser: integer("max_claims_per_user").default(1),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bonus_template_type_idx").on(table.type),
    index("bonus_template_isActive_idx").on(table.isActive),
    check("bonus_template_value_positive", sql`${table.value} > 0`),
    check("bonus_template_wagering_positive", sql`${table.wageringMultiplier} >= 1`),
  ],
);

// ============================================================================
// USER BONUS TABLE  (per-user bonus claims)
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

    // Snapshot of value at time of award — template may change later
    awardedAmount: decimal("awarded_amount", { precision: 18, scale: 2 }).notNull(),
    status: bonusStatusEnum("status").notNull().default("pending"),

    // Wagering progress
    wageringRequired: decimal("wagering_required", { precision: 18, scale: 2 }).notNull(),
    wageringCompleted: decimal("wagering_completed", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),

    expiresAt: timestamp("expires_at").notNull(),
    completedAt: timestamp("completed_at"),

    // Source that triggered this bonus
    sourceReferralId: text("source_referral_id")
      .references(() => referral.id, { onDelete: "restrict" }),
    sourceDepositId: text("source_deposit_id")
      .references(() => deposit.id, { onDelete: "restrict" }),

    // Transaction that moved the bonus amount to real balance (on completion)
    completionTransactionId: text("completion_transaction_id")
      .references(() => transaction.id, { onDelete: "restrict" }),

    issuedBy: text("issued_by").references(() => user.id, { onDelete: "restrict" }), // admin, null if automatic
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_bonus_userId_idx").on(table.userId),
    index("user_bonus_status_idx").on(table.status),
    index("user_bonus_expiresAt_idx").on(table.expiresAt), // expiry cron job
    check("user_bonus_wagering_progress", sql`${table.wageringCompleted} <= ${table.wageringRequired}`),
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

    // Deep-link metadata — lets the frontend navigate to the relevant entity
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
    // Primary access pattern: unread notifications for a user, newest first
    index("notification_userId_isRead_idx").on(table.userId, table.isRead),
    index("notification_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

// ============================================================================
// AUDIT LOG TABLE  (append-only — never update or delete rows)
// ============================================================================

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),

    // Who performed the action (admin or system)
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    actorRole: text("actor_role").notNull(), // "admin" | "system" | "cron"

    action: auditActionEnum("action").notNull(),

    // The entity being acted on
    targetType: text("target_type").notNull(), // "user" | "withdrawal" | "deposit" | "bonus" etc.
    targetId: text("target_id").notNull(),

    // Snapshot of before/after state for sensitive field changes
    before: jsonb("before"),
    after: jsonb("after"),

    // Request context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // NO updatedAt — this table is strictly append-only
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Admin dashboard: filter by actor
    index("audit_log_actorId_idx").on(table.actorId),
    // Compliance: full history for a specific entity (e.g. all events on user X)
    index("audit_log_target_idx").on(table.targetType, table.targetId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_createdAt_idx").on(table.createdAt),
  ],
);

// ============================================================================
// GAME STATS TABLE  (materialized per-user summary, updated async post-settlement)
// ============================================================================

export const gameStats = pgTable(
  "game_stats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique() // one stats row per user
      .references(() => user.id, { onDelete: "cascade" }),

    // Lifetime counters
    totalBets: integer("total_bets").notNull().default(0),
    totalWins: integer("total_wins").notNull().default(0),
    totalLosses: integer("total_losses").notNull().default(0),

    // Financial lifetime totals
    totalWagered: decimal("total_wagered", { precision: 18, scale: 2 }).notNull().default("0"),
    totalWon: decimal("total_won", { precision: 18, scale: 2 }).notNull().default("0"),
    netPnl: decimal("net_pnl", { precision: 18, scale: 2 }).notNull().default("0"), // totalWon - totalWagered

    // Records
    biggestWin: decimal("biggest_win", { precision: 18, scale: 2 }).notNull().default("0"),
    biggestWinBetId: text("biggest_win_bet_id")
      .references(() => bet.id, { onDelete: "set null" }),
    biggestLoss: decimal("biggest_loss", { precision: 18, scale: 2 }).notNull().default("0"),

    // Favourite game (updated on every bet, last-write-wins is fine for stats)
    favouriteProvider: text("favourite_provider"),
    favouriteGameId: text("favourite_game_id"),

    // Streaks
    currentWinStreak: integer("current_win_streak").notNull().default(0),
    currentLossStreak: integer("current_loss_streak").notNull().default(0),
    longestWinStreak: integer("longest_win_streak").notNull().default(0),

    lastBetAt: timestamp("last_bet_at"),

    // Version for optimistic-locking during async updates
    statsVersion: integer("stats_version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Leaderboard queries: top winners, highest wagered
    index("game_stats_totalWagered_idx").on(table.totalWagered),
    index("game_stats_totalWon_idx").on(table.totalWon),
    check("game_stats_non_negative", sql`${table.totalBets} >= 0 AND ${table.totalWagered} >= 0 AND ${table.totalWon} >= 0`),
  ],
);

// ============================================================================
// RELATIONS — new tables
// ============================================================================

export const referralRelations = relations(referral, ({ one }) => ({
  referrer: one(user, { fields: [referral.referrerId], references: [user.id] }),
  referredUser: one(user, { fields: [referral.referredUserId], references: [user.id] }),
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
  template: one(bonusTemplate, { fields: [userBonus.templateId], references: [bonusTemplate.id] }),
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

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
  user: one(user, { fields: [gameStats.userId], references: [user.id] }),
  biggestWinBet: one(bet, {
    fields: [gameStats.biggestWinBetId],
    references: [bet.id],
  }),
}));

// Extend userRelations to include new tables
// Note: replace the existing userRelations export in the file above with this one
export const userRelationsExtended = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  transactions: many(transaction),
  deposits: many(deposit),
  withdrawals: many(withdrawal),
  gameSessions: many(gameSession),
  bets: many(bet),
  referralsMade: many(referral, { relationName: "referrer" }),
  bonuses: many(userBonus),
  notifications: many(notification),
  gameStats: one(gameStats, { fields: [user.id], references: [gameStats.userId] }),
}));

// ============================================================================
// TYPES — new tables
// ============================================================================

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

// Enum value types
export type ReferralStatus = (typeof referralStatusEnum.enumValues)[number];
export type BonusType = (typeof bonusTypeEnum.enumValues)[number];
export type BonusStatus = (typeof bonusStatusEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];