CREATE TABLE "trial_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"document" text NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"converted_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trial_redemptions" ADD CONSTRAINT "trial_redemptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trial_redemptions_document_idx" ON "trial_redemptions" USING btree ("document");--> statement-breakpoint
CREATE INDEX "trial_redemptions_email_idx" ON "trial_redemptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "trial_redemptions_ip_idx" ON "trial_redemptions" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "trial_redemptions_workspace_idx" ON "trial_redemptions" USING btree ("workspace_id");