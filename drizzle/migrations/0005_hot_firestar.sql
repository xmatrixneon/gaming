CREATE TYPE "public"."game_provider_status" AS ENUM('active', 'disabled', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'disabled', 'maintenance');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'game_added';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'game_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'game_removed';--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"game_uid" text NOT NULL,
	"game_name" text NOT NULL,
	"game_type" text NOT NULL,
	"supported_currencies" text NOT NULL,
	"supported_languages" text NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"banner_url" text,
	"background_url" text,
	"image_alt" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_hot" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"launch_url_template" text,
	"last_synced_at" timestamp,
	"is_synced" boolean DEFAULT false NOT NULL,
	"notes" text,
	"slug" text,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_game_uid_unique" UNIQUE("game_uid"),
	CONSTRAINT "game_slug_unique" UNIQUE("slug"),
	CONSTRAINT "game_has_image" CHECK ("game"."image_url" IS NOT NULL AND "game"."image_url" <> '')
);
--> statement-breakpoint
CREATE TABLE "game_category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"image_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "game_category_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"category_id" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"supported_currencies" text NOT NULL,
	"supported_languages" text NOT NULL,
	"status" "game_provider_status" DEFAULT 'active' NOT NULL,
	"image_url" text,
	"thumbnail_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"game_count" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'slots' NOT NULL,
	"features" jsonb,
	"last_synced_at" timestamp,
	"is_synced" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_provider_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_provider_id_game_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."game_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_category_relation" ADD CONSTRAINT "game_category_relation_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_category_relation" ADD CONSTRAINT "game_category_relation_category_id_game_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."game_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_providerId_idx" ON "game" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "game_gameUid_idx" ON "game" USING btree ("game_uid");--> statement-breakpoint
CREATE INDEX "game_status_idx" ON "game" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_gameType_idx" ON "game" USING btree ("game_type");--> statement-breakpoint
CREATE INDEX "game_displayOrder_idx" ON "game" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "game_isFeatured_idx" ON "game" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "game_isNew_idx" ON "game" USING btree ("is_new");--> statement-breakpoint
CREATE INDEX "game_isHot_idx" ON "game" USING btree ("is_hot");--> statement-breakpoint
CREATE INDEX "game_slug_idx" ON "game" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "game_category_slug_idx" ON "game_category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "game_category_displayOrder_idx" ON "game_category" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "game_category_isActive_idx" ON "game_category" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "game_category_relation_gameId_idx" ON "game_category_relation" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_category_relation_categoryId_idx" ON "game_category_relation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "game_category_relation_unique_idx" ON "game_category_relation" USING btree ("game_id","category_id");--> statement-breakpoint
CREATE INDEX "game_provider_code_idx" ON "game_provider" USING btree ("code");--> statement-breakpoint
CREATE INDEX "game_provider_status_idx" ON "game_provider" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_provider_category_idx" ON "game_provider" USING btree ("category");--> statement-breakpoint
CREATE INDEX "game_provider_displayOrder_idx" ON "game_provider" USING btree ("display_order");