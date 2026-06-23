import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { softDelete, timestamps } from "./_shared";

export const bioPages = pgTable(
  "bio_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title"),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    theme: text("theme").notNull().default("default"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("bio_pages_workspace_idx").on(t.workspaceId)],
);

export const bioPageLinks = pgTable(
  "bio_page_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bioPageId: uuid("bio_page_id")
      .notNull()
      .references(() => bioPages.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [unique("bio_page_links_position").on(t.bioPageId, t.position)],
);
