-- Fix schema mismatch for Better Auth phone-number plugin
-- This script aligns the existing database with the Drizzle schema

-- Start transaction
BEGIN;

-- Rename existing columns to match Better Auth phone-number plugin expectations
ALTER TABLE "user" RENAME COLUMN "phone" TO "phone_number";
ALTER TABLE "user" RENAME COLUMN "phone_verified" TO "phone_number_verified";

-- Add missing custom fields for casino platform
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" varchar(50);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "balance" text DEFAULT '0';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "vip_level" text DEFAULT 'Bronze';

-- Add unique constraints for new fields
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE ("username");

-- Update index for renamed column
DROP INDEX IF EXISTS "user_phone_idx";
CREATE INDEX "user_phone_number_idx" ON "user" ("phone_number");

COMMIT;

-- Verify changes
\echo "Schema fix completed. Verifying..."
\d "user"
