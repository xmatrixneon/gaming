ALTER TYPE "public"."audit_action" ADD VALUE 'user_vip_upgrade' BEFORE 'balance_adjusted';--> statement-breakpoint
ALTER TABLE "user_bonus" DROP CONSTRAINT "user_bonus_wagering_progress";--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bet" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "bonus_template" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "deposit" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "game_session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "game_stats" ALTER COLUMN "net_pnl" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "game_stats" ALTER COLUMN "net_pnl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_stats" drop column "net_pnl";--> statement-breakpoint
ALTER TABLE "game_stats" ADD COLUMN "net_pnl" numeric(18, 2) GENERATED ALWAYS AS (total_won - total_wagered) STORED;--> statement-breakpoint
ALTER TABLE "game_stats" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "referral" ALTER COLUMN "qualify_by_date" SET DEFAULT NOW() + INTERVAL '30 days';--> statement-breakpoint
ALTER TABLE "referral" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "referral_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_bonus" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "withdrawal" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "withdrawal" ADD COLUMN "gateway_reference" text;--> statement-breakpoint
ALTER TABLE "withdrawal" ADD COLUMN "gateway_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_gameRound_idx" ON "bet" USING btree ("game_round");--> statement-breakpoint
CREATE INDEX "bet_user_created_idx" ON "bet" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "deposit_status_idx" ON "deposit" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deposit_user_status_created_idx" ON "deposit" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_unread_created_idx" ON "notification" USING btree ("user_id","created_at") WHERE "notification"."is_read" = false;--> statement-breakpoint
CREATE INDEX "transaction_createdAt_idx" ON "transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transaction_user_created_idx" ON "transaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_user_type_created_idx" ON "transaction" USING btree ("user_id","type","created_at");--> statement-breakpoint
CREATE INDEX "user_bonus_templateId_idx" ON "user_bonus" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "withdrawal_user_status_created_idx" ON "withdrawal" USING btree ("user_id","status","created_at");--> statement-breakpoint
ALTER TABLE "bet" ADD CONSTRAINT "bet_transaction_id_unique" UNIQUE("transaction_id");--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_transaction_id_unique" UNIQUE("transaction_id");--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_transaction_id_unique" UNIQUE("transaction_id");--> statement-breakpoint
ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_gateway_reference_unique" UNIQUE("gateway_reference");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_requirement" CHECK (("audit_log"."actor_id" IS NOT NULL) OR ("audit_log"."actor_role" IN ('system', 'cron')));--> statement-breakpoint
ALTER TABLE "user_bonus" ADD CONSTRAINT "user_bonus_wagering_non_negative" CHECK ("user_bonus"."wagering_completed" >= 0);