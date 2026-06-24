import { boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { softDelete, timestamps } from "./_shared";
import { workspaces } from "./workspaces";

/**
 * Reusable redirect-page (interstitial) layouts authored in the dashboard.
 * A layout is assigned to N links via `links.page_layout_id`; the redirect
 * Worker renders a countdown splash from the resolved config (§ splash).
 * Customization is a Starter+ feature — free links use the branded default.
 */
export const pageLayouts = pgTable(
  "page_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** Logo image URL (R2). null renders the linkview wordmark. */
    logoUrl: text("logo_url"),
    // Background: a solid color or an uploaded image.
    bgType: text("bg_type").notNull().default("color"),
    bgColor: text("bg_color").notNull().default("#0b0b0f"),
    bgImageUrl: text("bg_image_url"),
    blur: integer("blur").notNull().default(0),
    logoPosition: text("logo_position").notNull().default("center"),
    accentColor: text("accent_color").notNull().default("#6366f1"),
    textColor: text("text_color").notNull().default("#ffffff"),
    countdownSeconds: integer("countdown_seconds").notNull().default(3),
    showBranding: boolean("show_branding").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("page_layouts_workspace_idx").on(t.workspaceId)],
);
