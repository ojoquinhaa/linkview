import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { campaigns } from "./campaigns";
import { domains } from "./domains";
import { pageLayouts } from "./page-layouts";
import { qrCodes } from "./qr";
import { workspaces } from "./workspaces";
import { softDelete, timestamps } from "./_shared";

export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    // Reusable redirect-page layout (interstitial). null = branded default
    // (free) or direct redirect (paid). Set null if the layout is deleted.
    pageLayoutId: uuid("page_layout_id").references(() => pageLayouts.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    destinationUrl: text("destination_url").notNull(),
    title: text("title"),
    description: text("description"),
    // Open Graph overrides for the social share card (section share preview).
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImageUrl: text("og_image_url"),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    // Security controls enforced by the redirect Worker (§14.5–14.7).
    // Click cap: link auto-deactivates once totalClicks reaches maxClicks.
    maxClicks: bigint("max_clicks", { mode: "number" }),
    // Drop bot/crawler traffic instead of redirecting it.
    blockBots: boolean("block_bots").notNull().default(false),
    // Geo gating by ISO 3166-1 alpha-2 country code. If allowedCountries is
    // non-empty it is an allow-list; blockedCountries is always a deny-list.
    allowedCountries: text("allowed_countries").array(),
    blockedCountries: text("blocked_countries").array(),
    // Per-IP redirects/minute cap (abuse mitigation, best-effort in KV).
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    tags: text("tags").array(),
    metadata: jsonb("metadata"),
    // denormalized metrics (section 16.2)
    totalClicks: bigint("total_clicks", { mode: "number" })
      .notNull()
      .default(0),
    uniqueClicks: bigint("unique_clicks", { mode: "number" })
      .notNull()
      .default(0),
    lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    unique("links_domain_slug_unique").on(t.domainId, t.slug),
    index("links_workspace_idx").on(t.workspaceId),
    index("links_created_by_idx").on(t.createdByUserId),
    index("links_campaign_idx").on(t.campaignId),
    index("links_page_layout_idx").on(t.pageLayoutId),
    index("links_created_at_idx").on(t.createdAt),
    index("links_is_active_idx").on(t.isActive),
    index("links_expires_at_idx").on(t.expiresAt),
  ],
);

/** Optional many-to-many link<->campaign join (section 10.6). */
export const campaignLinks = pgTable(
  "campaign_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("campaign_links_unique").on(t.campaignId, t.linkId)],
);

/**
 * Named tracking channels for a link. Each is a UTM-tagged variant of the
 * short URL (e.g. "Instagram" -> ?utm_source=instagram), so click origin is
 * attributable. Per-channel counts derive from `clicks.source`.
 */
export const linkChannels = pgTable(
  "link_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    utmSource: text("utm_source").notNull(),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    ...timestamps,
  },
  (t) => [
    unique("link_channels_link_source_unique").on(t.linkId, t.utmSource),
    index("link_channels_link_idx").on(t.linkId),
    index("link_channels_workspace_idx").on(t.workspaceId),
  ],
);

export const clicks = pgTable(
  "clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // QR code that produced this scan, when the visit carried a `?qr=` marker.
    // Null for ordinary clicks. Kept on delete so scan history survives.
    qrCodeId: uuid("qr_code_id").references(() => qrCodes.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    device: text("device"),
    browser: text("browser"),
    os: text("os"),
    bot: boolean("bot").notNull().default(false),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("clicks_link_occurred_idx").on(t.linkId, t.occurredAt),
    index("clicks_workspace_occurred_idx").on(t.workspaceId, t.occurredAt),
    index("clicks_qr_code_idx").on(t.qrCodeId),
    index("clicks_country_idx").on(t.country),
    index("clicks_device_idx").on(t.device),
    index("clicks_browser_idx").on(t.browser),
  ],
);
