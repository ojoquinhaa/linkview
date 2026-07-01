CREATE TABLE "fiscal_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"provider_invoice_id" text NOT NULL,
	"payment_id" text,
	"status" text NOT NULL,
	"pdf_url" text,
	"xml_url" text,
	"number" text,
	"validation_code" text,
	"value_cents" integer,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_invoices_provider_invoice_id_unique" UNIQUE("provider_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "fiscal_invoices" ADD CONSTRAINT "fiscal_invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_invoices" ADD CONSTRAINT "fiscal_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiscal_invoices_workspace_idx" ON "fiscal_invoices" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "fiscal_invoices_payment_idx" ON "fiscal_invoices" USING btree ("payment_id");