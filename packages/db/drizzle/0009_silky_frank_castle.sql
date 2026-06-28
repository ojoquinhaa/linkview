ALTER TABLE "links" ADD COLUMN "kv_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "kv_sync_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "links_kv_sync_pending_idx" ON "links" USING btree ("id") WHERE "links"."kv_sync_pending" = true;