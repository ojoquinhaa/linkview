import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { domainStatusEnum, domainTypeEnum, timestamps } from "./_shared";

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null workspaceId = global system domain (default product domain)
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    hostname: text("hostname").notNull().unique(),
    type: domainTypeEnum("type").notNull().default("custom"),
    status: domainStatusEnum("status").notNull().default("pending"),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("domains_workspace_idx").on(t.workspaceId)],
);
