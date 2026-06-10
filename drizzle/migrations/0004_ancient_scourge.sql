ALTER TABLE "user" ADD CONSTRAINT "user_banned_by_user_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "bonus_template" ADD CONSTRAINT "bonus_template_expiry_positive" CHECK ("bonus_template"."expiry_days" > 0);--> statement-breakpoint
ALTER TABLE "bonus_template" ADD CONSTRAINT "bonus_template_claims_positive" CHECK ("bonus_template"."max_claims_per_user" > 0);--> statement-breakpoint
ALTER TABLE "bonus_template" ADD CONSTRAINT "bonus_template_max_value_gte_value" CHECK (("bonus_template"."max_value" IS NULL) OR ("bonus_template"."max_value" >= "bonus_template"."value"));--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_not_self" CHECK ("referral"."referrer_id" <> "referral"."referred_user_id");