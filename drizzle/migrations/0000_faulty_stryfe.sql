CREATE TYPE "public"."audit_action" AS ENUM('user_banned', 'user_unbanned', 'user_activated', 'user_deactivated', 'balance_adjusted', 'withdrawal_approved', 'withdrawal_rejected', 'withdrawal_flagged', 'withdrawal_unflagged', 'deposit_verified', 'deposit_flagged', 'bonus_issued', 'bonus_cancelled', 'referral_cancelled', 'admin_login', 'permission_changed');--> statement-breakpoint
CREATE TYPE "public"."bet_result" AS ENUM('pending', 'won', 'lost', 'void', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bonus_status" AS ENUM('pending', 'active', 'completed', 'expired', 'cancelled', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."bonus_type" AS ENUM('welcome', 'referral', 'deposit_match', 'free_bet', 'manual');--> statement-breakpoint
CREATE TYPE "public"."deposit_method" AS ENUM('upi', 'paytm', 'phonepe', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."game_session_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('deposit_confirmed', 'withdrawal_approved', 'withdrawal_rejected', 'withdrawal_processed', 'bonus_credited', 'bonus_expiring', 'referral_joined', 'referral_qualified', 'bet_settled', 'account_flagged', 'account_banned', 'system');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'qualified', 'rewarded', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdraw', 'bet', 'win', 'loss', 'bonus', 'adjustment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_method" AS ENUM('upi', 'bank_transfer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bet" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"game_session_id" text,
	"amount" numeric(18, 2) NOT NULL,
	"odds" numeric(10, 2),
	"game_data" jsonb,
	"result" "bet_result" DEFAULT 'pending' NOT NULL,
	"win_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "bet_amount_positive" CHECK ("bet"."amount" > 0),
	CONSTRAINT "bet_winAmount_non_negative" CHECK ("bet"."win_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bonus_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "bonus_type" NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"max_value" numeric(18, 2),
	"wagering_multiplier" numeric(5, 2) DEFAULT '1' NOT NULL,
	"expiry_days" integer DEFAULT 30 NOT NULL,
	"max_claims_per_user" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "bonus_template_value_positive" CHECK ("bonus_template"."value" > 0),
	CONSTRAINT "bonus_template_wagering_positive" CHECK ("bonus_template"."wagering_multiplier" >= 1)
);
--> statement-breakpoint
CREATE TABLE "deposit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"method" "deposit_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"gateway_reference" text,
	"gateway_metadata" jsonb,
	"verified_by" text,
	"verified_at" timestamp,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flagged_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "deposit_gateway_reference_unique" UNIQUE("gateway_reference"),
	CONSTRAINT "deposit_amount_positive" CHECK ("deposit"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_game_id" text NOT NULL,
	"provider_session_id" text,
	"status" "game_session_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"total_bet" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_win" numeric(18, 2) DEFAULT '0' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "game_session_provider_session_id_unique" UNIQUE("provider_session_id"),
	CONSTRAINT "game_session_totals_non_negative" CHECK ("game_session"."total_bet" >= 0 AND "game_session"."total_win" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_bets" integer DEFAULT 0 NOT NULL,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"total_wagered" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_won" numeric(18, 2) DEFAULT '0' NOT NULL,
	"net_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"biggest_win" numeric(18, 2) DEFAULT '0' NOT NULL,
	"biggest_win_bet_id" text,
	"biggest_loss" numeric(18, 2) DEFAULT '0' NOT NULL,
	"favourite_provider" text,
	"favourite_game_id" text,
	"current_win_streak" integer DEFAULT 0 NOT NULL,
	"current_loss_streak" integer DEFAULT 0 NOT NULL,
	"longest_win_streak" integer DEFAULT 0 NOT NULL,
	"last_bet_at" timestamp,
	"stats_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "game_stats_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "game_stats_non_negative" CHECK ("game_stats"."total_bets" >= 0 AND "game_stats"."total_wagered" >= 0 AND "game_stats"."total_won" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"referral_code" text NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"bonus_transaction_id" text,
	"qualify_by_date" timestamp NOT NULL,
	"qualified_at" timestamp,
	"rewarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "referral_referred_user_id_unique" UNIQUE("referred_user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"balance_before" numeric(18, 2) NOT NULL,
	"balance_after" numeric(18, 2) NOT NULL,
	"idempotency_key" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "transaction_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "transaction_amount_positive" CHECK ("transaction"."amount" > 0),
	CONSTRAINT "transaction_balance_after_check" CHECK ("transaction"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"phone_number" text,
	"phone_number_verified" boolean,
	"username" varchar(50),
	"balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"balance_version" integer DEFAULT 0 NOT NULL,
	"vip_level" text DEFAULT 'Bronze' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp,
	"banned_reason" text,
	"banned_by" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_bonus" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"awarded_amount" numeric(18, 2) NOT NULL,
	"status" "bonus_status" DEFAULT 'pending' NOT NULL,
	"wagering_required" numeric(18, 2) NOT NULL,
	"wagering_completed" numeric(18, 2) DEFAULT '0' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"source_referral_id" text,
	"source_deposit_id" text,
	"completion_transaction_id" text,
	"issued_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_bonus_wagering_progress" CHECK ("user_bonus"."wagering_completed" <= "user_bonus"."wagering_required"),
	CONSTRAINT "user_bonus_amount_positive" CHECK ("user_bonus"."awarded_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"method" "withdrawal_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"account_number" text,
	"account_holder" text,
	"bank_name" text,
	"ifsc_code" text,
	"upi_id" text,
	"is_approved" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"processed_by" text,
	"processed_at" timestamp,
	"utr_number" text,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flagged_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "withdrawal_utr_number_unique" UNIQUE("utr_number"),
	CONSTRAINT "withdrawal_amount_positive" CHECK ("withdrawal"."amount" > 0),
	CONSTRAINT "withdrawal_payout_details" CHECK (("withdrawal"."method" = 'upi' AND "withdrawal"."upi_id" IS NOT NULL)
          OR ("withdrawal"."method" = 'bank_transfer' AND "withdrawal"."account_number" IS NOT NULL AND "withdrawal"."ifsc_code" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet" ADD CONSTRAINT "bet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet" ADD CONSTRAINT "bet_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet" ADD CONSTRAINT "bet_game_session_id_game_session_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_session"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_biggest_win_bet_id_bet_id_fk" FOREIGN KEY ("biggest_win_bet_id") REFERENCES "public"."bet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_bonus_transaction_id_transaction_id_fk" FOREIGN KEY ("bonus_transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_template_id_bonus_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bonus_template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_source_referral_id_referral_id_fk" FOREIGN KEY ("source_referral_id") REFERENCES "public"."referral"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_source_deposit_id_deposit_id_fk" FOREIGN KEY ("source_deposit_id") REFERENCES "public"."deposit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_completion_transaction_id_transaction_id_fk" FOREIGN KEY ("completion_transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_actorId_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bet_userId_idx" ON "bet" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bet_gameSessionId_idx" ON "bet" USING btree ("game_session_id");--> statement-breakpoint
CREATE INDEX "bet_transactionId_idx" ON "bet" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "bet_result_idx" ON "bet" USING btree ("result");--> statement-breakpoint
CREATE INDEX "bonus_template_type_idx" ON "bonus_template" USING btree ("type");--> statement-breakpoint
CREATE INDEX "bonus_template_isActive_idx" ON "bonus_template" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "deposit_userId_idx" ON "deposit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deposit_transactionId_idx" ON "deposit" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "game_session_userId_idx" ON "game_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_session_providerGameId_idx" ON "game_session" USING btree ("provider_game_id");--> statement-breakpoint
CREATE INDEX "game_session_providerSessionId_idx" ON "game_session" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "game_stats_totalWagered_idx" ON "game_stats" USING btree ("total_wagered");--> statement-breakpoint
CREATE INDEX "game_stats_totalWon_idx" ON "game_stats" USING btree ("total_won");--> statement-breakpoint
CREATE INDEX "notification_userId_isRead_idx" ON "notification" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notification_userId_createdAt_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "referral_referrerId_idx" ON "referral" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referral_code_idx" ON "referral" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "referral_status_idx" ON "referral" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_userId_idx" ON "transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_status_idx" ON "transaction" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_bonus_userId_idx" ON "user_bonus" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_bonus_status_idx" ON "user_bonus" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_bonus_expiresAt_idx" ON "user_bonus" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "withdrawal_userId_idx" ON "withdrawal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_transactionId_idx" ON "withdrawal" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "withdrawal_isApproved_status_idx" ON "withdrawal" USING btree ("is_approved","status");