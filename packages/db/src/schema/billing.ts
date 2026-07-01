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
    /** Asaas subscription id a re-checkout superseded but whose inline cancel
     * failed (provider outage). Stashed so the cron backstop retries the DELETE
     * until it sticks — otherwise the dead subscription could keep issuing
     * charges alongside the live one and bill the customer twice. Null once the
     * cancel lands. */
    staleProviderSubscriptionId: text("stale_provider_subscription_id"),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    /** Cadence the workspace pays on. Drives the renewal date the webhook
     * stamps (monthly = +1 month, yearly = +1 year) and the price shown. */
    billingCycle: billingCycleEnum("billing_cycle")
      .notNull()
      .default("monthly"),
    /** Target cycle of an in-flight cycle switch, while the subscription stays
     * `active` on its current (old) cycle + period until the new charge clears.
     * Null except between starting a switch checkout and that charge settling;
     * on settlement the webhook/reconcile copies it into `billingCycle`, stamps
     * the new period, and clears this back to null. Lets a switch never drop the
     * subscription to `pending` or show the new price/date before it's paid. */
    pendingBillingCycle: billingCycleEnum("pending_billing_cycle"),
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

/**
 * Fiscal invoices (NFS-e) issued by Asaas for a workspace's paid charges. Asaas
 * emits the NFS-e automatically after each confirmed payment (configured per
 * subscription via `invoiceSettings`) and reports its lifecycle through
 * `INVOICE_*` webhook events. We mirror each note here so its PDF/XML survive the
 * volatile webhook payload and so the "your invoice is ready" email is sent at
 * most once per note (`emailedAt`). `providerInvoiceId` is Asaas's `inv_…` id;
 * `paymentId` is the `pay_…` charge it bills.
 */
export const fiscalInvoices = pgTable(
  "fiscal_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("asaas"),
    /** Asaas invoice id, e.g. "inv_000000000232". */
    providerInvoiceId: text("provider_invoice_id").notNull().unique(),
    /** Asaas charge id the note bills, e.g. "pay_145059895800". */
    paymentId: text("payment_id"),
    /** SCHEDULED | AUTHORIZED | PROCESSING_CANCELLATION | CANCELED |
     * CANCELLATION_DENIED | ERROR. */
    status: text("status").notNull(),
    /** Populated once authorized. */
    pdfUrl: text("pdf_url"),
    xmlUrl: text("xml_url"),
    number: text("number"),
    validationCode: text("validation_code"),
    /** Note total, in cents. */
    valueCents: integer("value_cents"),
    /** Stamped when the "your fiscal invoice" email is sent, so a duplicate
     * INVOICE_AUTHORIZED delivery never re-emails. */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("fiscal_invoices_workspace_idx").on(t.workspaceId),
    index("fiscal_invoices_payment_idx").on(t.paymentId),
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
