ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_requirement";--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "actor_role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "target_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "target_id" DROP NOT NULL;