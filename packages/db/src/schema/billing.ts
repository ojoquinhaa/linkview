import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  billingCycleEnum,
  subscriptionStatusEnum,
  timestamps,
} from "./_shared";
import { workspaces } from "./workspaces";

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("BRL"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  maxLinks: integer("max_links").notNull(),
  maxClicksPerMonth: integer("max_clicks_per_month").notNull(),
  maxWorkspaces: integer("max_workspaces").notNull().default(1),
  maxMembers: integer("max_members").notNull().default(1),
  customDomainsEnabled: boolean("custom_domains_enabled")
    .notNull()
    .default(false),
  passwordLinksEnabled: boolean("password_links_enabled")
    .notNull()
    .default(false),
  expirationEnabled: boolean("expiration_enabled").notNull().default(false),
  qrCodesEnabled: boolean("qr_codes_enabled").notNull().default(true),
  bioPagesEnabled: boolean("bio_pages_enabled").notNull().default(false),
  analyticsRetentionDays: integer("analytics_retention_days")
    .notNull()
    .default(7),
  ...timestamps,
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().default("asaas"),
    providerSubscriptionId: text("provider_subscription_id"),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    /** Cadence the workspace pays on. Drives the renewal date the webhook
     * stamps (monthly = +1 month, yearly = +1 year) and the price shown. */
    billingCycle: billingCycleEnum("billing_cycle")
      .notNull()
      .default("monthly"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** True when the workspace pays by recurring credit card (Asaas auto-charges
     * each cycle). False = manual Pix/boleto/card invoice every renewal. */
    autopay: boolean("autopay").notNull().default(false),
    /** Opaque Asaas card token, set when the workspace pays via our own card
     * checkout. Reused to charge renewals and to swap the card. Never the PAN. */
    cardToken: text("card_token"),
    /** Last 4 digits of the card on file, for display ("···· 4242"). */
    cardLast4: text("card_last4"),
    /** Card brand label on file, e.g. "VISA" / "MASTERCARD". */
    cardBrand: text("card_brand"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    /** Stamped the first time the payment-confirmed receipt email is sent for
     * the current paid period. Dedup guard so the webhook and the "Já paguei"
     * reconcile poll don't both email the customer (set atomically). */
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("subscriptions_workspace_idx").on(t.workspaceId)],
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("asaas"),
    providerCustomerId: text("provider_customer_id").notNull(),
    name: text("name"),
    email: text("email"),
    document: text("document"),
    phone: text("phone"),
    ...timestamps,
  },
  (t) => [index("billing_customers_workspace_idx").on(t.workspaceId)],
);

/**
 * Trial redemption ledger. One row per granted 7-day trial, keyed by the
 * identifiers that gate abuse, in two tiers: strong keys — the fiscal
 * `document` (CPF/CNPJ) and `email` — deny a new trial if either matches alone;
 * weak keys — `fingerprint` and `ip` — deny only when *both* match the same
 * prior row (a single shared IP or reset fingerprint is too noisy to block a
 * legitimate new customer). `convertedAt` is stamped when
 * the workspace starts a paid subscription (exempts it from retention purge);
 * `purgedAt` is stamped when the workspace is soft-deleted after the retention
 * window elapses without conversion.
 */
export const trialRedemptions = pgTable(
  "trial_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** CPF/CNPJ digits only, copied from the user profile at grant time. */
    document: text("document").notNull(),
    email: text("email").notNull(),
    /** IP captured at sign-up, one of the abuse-gate keys. */
    ip: text("ip"),
    /** Device fingerprint hash captured when the trial is redeemed. A weak
     * signal: only blocks a new trial when it AND the IP both match a prior
     * redemption (two weak signals agreeing), never on its own. */
    fingerprint: text("fingerprint"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Set when the trial converts to a paid subscription. */
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    /** Set when the workspace is soft-deleted after the retention window. */
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("trial_redemptions_document_idx").on(t.document),
    index("trial_redemptions_email_idx").on(t.email),
    index("trial_redemptions_ip_idx").on(t.ip),
    index("trial_redemptions_fingerprint_idx").on(t.fingerprint),
    index("trial_redemptions_workspace_idx").on(t.workspaceId),
  ],
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("asaas"),
    providerEventId: text("provider_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("billing_events_type_idx").on(t.eventType)],
);
