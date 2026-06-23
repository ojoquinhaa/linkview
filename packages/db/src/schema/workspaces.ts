import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { softDelete, timestamps, workspaceRoleEnum } from "./_shared";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    planKey: text("plan_key").notNull().default("free"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("workspaces_owner_idx").on(t.ownerId)],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    ...timestamps,
  },
  (t) => [
    unique("workspace_members_unique").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
);
