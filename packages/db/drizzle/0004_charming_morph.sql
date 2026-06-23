CREATE TYPE "public"."platform_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "platform_role" DEFAULT 'user' NOT NULL;