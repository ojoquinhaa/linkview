ALTER TABLE "trial_redemptions" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE INDEX "trial_redemptions_fingerprint_idx" ON "trial_redemptions" USING btree ("fingerprint");