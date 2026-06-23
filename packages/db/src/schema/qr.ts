import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { links } from "./links";
import { workspaces } from "./workspaces";
import { qrFormatEnum, timestamps } from "./_shared";

export const qrCodes = pgTable(
  "qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    /** Human label so a link can have several QR codes (poster, flyer, menu…),
     * each tracked separately. */
    name: text("name").notNull().default("QR Code"),
    format: qrFormatEnum("format").notNull().default("png"),
    foregroundColor: text("foreground_color").notNull().default("#000000"),
    backgroundColor: text("background_color").notNull().default("#ffffff"),
    logoUrl: text("logo_url"),
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (t) => [index("qr_codes_link_idx").on(t.linkId)],
);
