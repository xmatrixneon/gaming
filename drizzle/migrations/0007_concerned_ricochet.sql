CREATE TYPE "public"."gateway_status" AS ENUM('active', 'maintenance', 'disabled');--> statement-breakpoint
CREATE TABLE "payment_gateway_config" (
	"id" text PRIMARY KEY NOT NULL,
	"gateway_name" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"config_metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deposit" ADD COLUMN "gateway_id" text;--> statement-breakpoint
CREATE INDEX "gateway_config_priority_idx" ON "payment_gateway_config" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "gateway_config_enabled_idx" ON "payment_gateway_config" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "gateway_config_name_idx" ON "payment_gateway_config" USING btree ("gateway_name");--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_gateway_id_payment_gateway_config_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateway_config"("id") ON DELETE set null ON UPDATE no action;