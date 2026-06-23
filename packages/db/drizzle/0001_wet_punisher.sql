CREATE TYPE "public"."consent_type" AS ENUM('terms', 'privacy', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('pf', 'pj');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "consent_type" NOT NULL,
	"document_version" text NOT NULL,
	"accepted" boolean NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"person_type" "person_type" NOT NULL,
	"document" text NOT NULL,
	"phone" text NOT NULL,
	"zip" text NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"complement" text,
	"district" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"signup_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "page_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" text,
	"name" text NOT NULL,
	"logo_url" text,
	"bg_type" text DEFAULT 'color' NOT NULL,
	"bg_color" text DEFAULT '#0b0b0f' NOT NULL,
	"bg_image_url" text,
	"blur" integer DEFAULT 0 NOT NULL,
	"logo_position" text DEFAULT 'center' NOT NULL,
	"accent_color" text DEFAULT '#6366f1' NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"countdown_seconds" integer DEFAULT 3 NOT NULL,
	"show_branding" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "link_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"name" text NOT NULL,
	"utm_source" text NOT NULL,
	"utm_medium" text,
	"utm_campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_channels_link_source_unique" UNIQUE("link_id","utm_source")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "page_layout_id" uuid;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "og_title" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "og_description" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "og_image_url" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "max_clicks" bigint;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "block_bots" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "allowed_countries" text[];--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "blocked_countries" text[];--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_layouts" ADD CONSTRAINT "page_layouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_layouts" ADD CONSTRAINT "page_layouts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_channels" ADD CONSTRAINT "link_channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_channels" ADD CONSTRAINT "link_channels_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_consents_user_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_document_idx" ON "user_profiles" USING btree ("document");--> statement-breakpoint
CREATE INDEX "page_layouts_workspace_idx" ON "page_layouts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "link_channels_link_idx" ON "link_channels" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "link_channels_workspace_idx" ON "link_channels" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_page_layout_id_page_layouts_id_fk" FOREIGN KEY ("page_layout_id") REFERENCES "public"."page_layouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "links_page_layout_idx" ON "links" USING btree ("page_layout_id");