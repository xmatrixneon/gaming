ALTER TABLE "bet" ADD COLUMN "game_api_serial" text;--> statement-breakpoint
ALTER TABLE "bet" ADD COLUMN "game_round" text;--> statement-breakpoint
ALTER TABLE "game_session" ADD COLUMN "game_api_serial" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referral_code" varchar(12) DEFAULT '';--> statement-breakpoint
CREATE INDEX "bet_gameApiSerial_idx" ON "bet" USING btree ("game_api_serial");--> statement-breakpoint
CREATE INDEX "game_session_gameApiSerial_idx" ON "game_session" USING btree ("game_api_serial");--> statement-breakpoint
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_game_api_serial_unique" UNIQUE("game_api_serial");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code");