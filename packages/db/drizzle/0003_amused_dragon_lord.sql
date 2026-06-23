ALTER TABLE "clicks" ADD COLUMN "qr_code_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD COLUMN "name" text DEFAULT 'QR Code' NOT NULL;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_qr_code_idx" ON "clicks" USING btree ("qr_code_id");