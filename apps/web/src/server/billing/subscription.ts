import "server-only";
import type { Database } from "@linkview/db";
import {
  billingCustomers,
  getDb,
  plans,
  subscriptions,
  trialRedemptions,
  workspaces,
} from "@linkview/db";
import {
  type BillingCycle,
  getCyclePriceCents,
  getPlan,
  PAST_DUE_GRACE_DAYS,
  type PlanKey,
} from "@linkview/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  emailConfigured,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/email";
import { unlockWorkspaceLinks } from "@/lib/kv";
import * as asaas from "./asaas";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Asaas payment statuses that mean the money cleared. */
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

/**
 * Statuses a *card* token charge may legitimately hold right after creation: it
 * either cleared (paid) or is in anti-fraud review (`AWAITING_RISK_ANALYSIS`).
 * Anything else — a charge left PENDING/OVERDUE with no capture — means the card
 * was refused. Asaas usually returns an error for a declined card, but it can
 * also create the subscription and hand back a non-cleared charge with HTTP 200;
 * we treat that as a decline instead of stranding the user on the poll screen.
 */
const CARD_SETTLING_STATUSES = new Set([
  ...PAID_STATUSES,
  "AWAITING_RISK_ANALYSIS",
]);

/** Asaas billingType → the receipt email's method label key. */
export function mapBillingMethod(
  billingType: string | undefined,
): "pix" | "boleto" | "card" | "unknown" {
  switch (billingType) {
    case "PIX":
      return "pix";
    case "BOLETO":
      return "boleto";
    case "CREDIT_CARD":
      return "card";
    default:
      return "unknown";
  }
}

export interface PaymentReceipt {
  amountCents: number;
  method: "pix" | "boleto" | "card" | "unknown";
  renewsAt: Date | null;
  receiptUrl: string;
}

/**
 * Send the "payment confirmed — thank you" receipt at most once per paid
 * period. Both the Asaas webhook and the "Já paguei" reconcile poll activate a
 * subscription, so without this guard a sandbox (no webhook) sends nothing while
 * a configured webhook plus a poll could send twice. We claim the send with an
 * atomic conditional update: only fire when no receipt has gone out for the
 * *current* period (`receiptSentAt` null or older than `currentPeriodStart`), so
 * a renewal still emails while the CONFIRMED+RECEIVED pair for one charge does
 * not. Best-effort: releases the claim if the send fails so a later trigger can
 * retry, and never throws (a failed email must not fail billing).
 */
export async function sendReceiptEmailOnce(
  workspaceId: string,
  receipt: PaymentReceipt,
): Promise<void> {
  if (!emailConfigured()) return;
  const db = getDb();

  // Claim atomically: flip the stamp only when this period hasn't been emailed.
  const claimed = await db
    .update(subscriptions)
    .set({ receiptSentAt: new Date() })
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        sql`(${subscriptions.receiptSentAt} is null or ${subscriptions.receiptSentAt} < ${subscriptions.currentPeriodStart})`,
      ),
    )
    .returning({ id: subscriptions.id });
  if (claimed.length === 0) return; // already sent for this period

  try {
    const [customer] = await db
      .select({ email: billingCustomers.email, name: billingCustomers.name })
      .from(billingCustomers)
      .where(eq(billingCustomers.workspaceId, workspaceId))
      .limit(1);
    if (!customer?.email) {
      // No address yet — release the claim so a later attempt can still deliver.
      await db
        .update(subscriptions)
        .set({ receiptSentAt: null })
        .where(eq(subscriptions.id, claimed[0].id));
      return;
    }
    await sendPaymentReceiptEmail({
      to: customer.email,
      name: customer.name,
      ...receipt,
    });
  } catch (err) {
    console.error("billing.receipt_email_failed", err);
    // Release the claim so the next confirmed event / poll retries the send.
    await db
      .update(subscriptions)
      .set({ receiptSentAt: null })
      .where(eq(subscriptions.id, claimed[0].id));
  }
}

function addMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function addYear(from: Date): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * Period end for an activating charge, crediting any unused time left on a
 * still-running prior period exactly once. This is what makes a cycle switch
 * "pay the new cycle now, keep the remaining days as extra time": the user
 * re-checks out (which leaves the old `currentPeriodEnd` on the row until the new
 * charge clears), and on activation we add the leftover to the new period.
 *
 * Idempotent across the CONFIRMED+RECEIVED pair and a webhook/poll race: the
 * credit is only added on the *first* activation of this charge (detected by the
 * stored `currentPeriodStart` predating `paidAt`); later events just preserve the
 * already-credited end via the max(), never doubling it.
 */
export function activatedPeriodEnd(args: {
  paidAt: Date;
  cycle: BillingCycle;
  prevStart: Date | null;
  prevEnd: Date | null;
}): Date {
  const paid = args.paidAt.getTime();
  const base = (
    args.cycle === "yearly" ? addYear(args.paidAt) : addMonth(args.paidAt)
  ).getTime();
  const prevEnd = args.prevEnd?.getTime() ?? null;
  const firstActivation = !args.prevStart || args.prevStart.getTime() < paid;
  const credit =
    firstActivation && prevEnd && prevEnd > paid ? prevEnd - paid : 0;
  return new Date(Math.max(base + credit, prevEnd ?? base, base));
}

function appUrl(): string {
  // trim() guards against trailing whitespace/newlines baked into the env var
  // (e.g. a CRLF from `vercel env add` piped on Windows), which would otherwise
  // produce an invalid Asaas callback URL.
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000")
    .trim()
    .replace(/\/$/, "");
}

export interface CheckoutInput {
  name: string;
  email: string;
  /** CPF or CNPJ — Asaas requires it to create a customer. */
  cpfCnpj: string;
  phone?: string;
}

async function planRow(db: Database, key: PlanKey) {
  const [row] = await db
    .select({ id: plans.id, priceCents: plans.priceCents })
    .from(plans)
    .where(eq(plans.key, key))
    .limit(1);
  if (!row) throw new Error(`Plano não existe no banco: ${key}. Rode o seed.`);
  return row;
}

/** Reuse the workspace's Asaas customer, creating one on first checkout. */
async function ensureCustomer(
  db: Database,
  workspaceId: string,
  input: CheckoutInput,
): Promise<string> {
  const [existing] = await db
    .select({ providerCustomerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);
  if (existing?.providerCustomerId) return existing.providerCustomerId;

  const customer = await asaas.createCustomer({
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
    mobilePhone: input.phone?.replace(/\D/g, ""),
    externalReference: workspaceId,
  });

  await db.insert(billingCustomers).values({
    workspaceId,
    provider: "asaas",
    providerCustomerId: customer.id,
    name: input.name,
    email: input.email,
    document: input.cpfCnpj,
    phone: input.phone,
  });
  return customer.id;
}

export interface PixCheckoutResult {
  /** Base64 PNG of the Pix QR (no data-URI prefix). */
  encodedImage: string;
  /** EMV "Pix Copia e Cola" code. */
  payload: string;
  /** ISO timestamp when the QR expires, or null. */
  expiresAt: string | null;
  /** Charge amount in cents, for the on-screen summary. */
  amountCents: number;
}

/**
 * Create (or refresh) a Pix subscription for the workspace and return the Pix
 * QR + copy-paste code, rendered in-app — no Asaas hosted page. The first charge
 * is generated immediately; the subscription stays `pending` until the payment
 * confirms (webhook, or the "Já paguei" reconcile poll), which flips it `active`
 * and promotes the workspace plan. Renews each cycle as a fresh Pix charge.
 */
export async function startPixSubscription(
  workspaceId: string,
  planKey: PlanKey,
  input: CheckoutInput,
  cycle: BillingCycle = "monthly",
): Promise<PixCheckoutResult> {
  const plan = getPlan(planKey);
  const priceCents = getCyclePriceCents(planKey, cycle);
  if (priceCents <= 0) {
    throw new Error("O plano gratuito não exige pagamento.");
  }
  const db = getDb();
  const row = await planRow(db, planKey);
  const customerId = await ensureCustomer(db, workspaceId, input);

  const sub = await asaas.createSubscription({
    customer: customerId,
    value: priceCents / 100,
    nextDueDate: new Date().toISOString().slice(0, 10),
    description: `linkview ${plan.name} (${cycle === "yearly" ? "anual" : "mensal"})`,
    externalReference: workspaceId,
    cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
    billingType: "PIX",
  });

  // One subscription row per workspace: refresh it on re-checkout.
  const [existing] = await db
    .select({
      id: subscriptions.id,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        planId: row.id,
        provider: "asaas",
        providerSubscriptionId: sub.id,
        status: "pending",
        billingCycle: cycle,
        // Pix is paid manually each cycle: no card on file, no autopay.
        autopay: false,
        cardToken: null,
        cardLast4: null,
        cardBrand: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      })
      .where(eq(subscriptions.id, existing.id));
    // The new Asaas subscription supersedes any prior one for this workspace.
    // Cancel the old one so its leftover (often overdue) charges stop competing
    // and the user pays into the live subscription. Best-effort: never block
    // checkout.
    if (
      existing.providerSubscriptionId &&
      existing.providerSubscriptionId !== sub.id
    ) {
      await asaas
        .cancelSubscription(existing.providerSubscriptionId)
        .catch((err) =>
          console.error("billing.stale_subscription_cancel_failed", err),
        );
    }
  } else {
    await db.insert(subscriptions).values({
      workspaceId,
      planId: row.id,
      provider: "asaas",
      providerSubscriptionId: sub.id,
      status: "pending",
      billingCycle: cycle,
      autopay: false,
    });
  }

  // Pull the first charge and its Pix QR. The subscription always creates one
  // charge synchronously; fetch its dynamic Pix payload to show in-app.
  const payments = await asaas.getSubscriptionPayments(sub.id);
  const charge = payments.find((p) => p.billingType === "PIX") ?? payments[0];
  if (!charge) {
    throw new Error("Asaas não gerou a cobrança Pix.");
  }
  const qr = await asaas.getPixQrCode(charge.id);
  if (!qr?.payload || !qr.encodedImage) {
    throw new Error("Asaas não retornou o QR Code do Pix.");
  }
  return {
    encodedImage: qr.encodedImage,
    payload: qr.payload,
    expiresAt: qr.expirationDate ?? null,
    amountCents: priceCents,
  };
}

/** Buyer + card identity for our own card checkout, on top of {@link CheckoutInput}. */
export interface CardCheckoutInput extends CheckoutInput {
  /** CEP, digits only. */
  postalCode: string;
  addressNumber: string;
}

/** Build the anti-fraud holder info Asaas requires, normalizing to digits. */
function holderInfo(input: CardCheckoutInput): asaas.AsaasCardHolderInfo {
  return {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
    postalCode: input.postalCode.replace(/\D/g, ""),
    addressNumber: input.addressNumber,
    phone: (input.phone ?? "").replace(/\D/g, ""),
  };
}

export interface CardCheckoutResult {
  /** `active` once the synchronous first charge clears (the common case);
   * `pending` if Asaas accepted the card but hasn't settled yet (webhook will
   * finish the activation). A declined card throws instead. */
  status: "active" | "pending";
  /** Card metadata for an immediate confirmation, no extra round-trip. */
  card: { last4: string; brand: string };
}

/**
 * Subscribe a workspace to a paid plan with a credit card captured by our own
 * checkout — no Asaas hosted page. The card is tokenized (PAN never stored), the
 * subscription is created on that token so Asaas charges the first cycle
 * synchronously, and we reconcile right away so the user lands active. A declined
 * card surfaces as a thrown error from the Asaas call.
 */
export async function startCardSubscription(
  workspaceId: string,
  planKey: PlanKey,
  input: CardCheckoutInput,
  card: asaas.AsaasCard,
  remoteIp: string,
  cycle: BillingCycle = "monthly",
): Promise<CardCheckoutResult> {
  const plan = getPlan(planKey);
  const priceCents = getCyclePriceCents(planKey, cycle);
  if (priceCents <= 0) {
    throw new Error("O plano gratuito não exige pagamento.");
  }
  const db = getDb();
  const row = await planRow(db, planKey);
  const customerId = await ensureCustomer(db, workspaceId, input);

  // PAN/CCV reach Asaas only here; we keep just the token + display metadata.
  const tokenized = await asaas.tokenizeCard({
    customer: customerId,
    creditCard: card,
    creditCardHolderInfo: holderInfo(input),
    remoteIp,
  });

  const sub = await asaas.createSubscription({
    customer: customerId,
    value: priceCents / 100,
    nextDueDate: new Date().toISOString().slice(0, 10),
    description: `linkview ${plan.name} (${cycle === "yearly" ? "anual" : "mensal"})`,
    externalReference: workspaceId,
    cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
    billingType: "CREDIT_CARD",
    creditCardToken: tokenized.creditCardToken,
    remoteIp,
  });

  const cardFields = {
    autopay: true,
    cardToken: tokenized.creditCardToken,
    cardLast4: tokenized.creditCardNumber,
    cardBrand: tokenized.creditCardBrand,
  };

  // One subscription row per workspace: refresh on re-checkout, cancel any stale
  // Asaas subscription so its leftover charges stop competing.
  const [existing] = await db
    .select({
      id: subscriptions.id,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        planId: row.id,
        provider: "asaas",
        providerSubscriptionId: sub.id,
        status: "pending",
        billingCycle: cycle,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        ...cardFields,
      })
      .where(eq(subscriptions.id, existing.id));
    if (
      existing.providerSubscriptionId &&
      existing.providerSubscriptionId !== sub.id
    ) {
      await asaas
        .cancelSubscription(existing.providerSubscriptionId)
        .catch((err) =>
          console.error("billing.stale_subscription_cancel_failed", err),
        );
    }
  } else {
    await db.insert(subscriptions).values({
      workspaceId,
      planId: row.id,
      provider: "asaas",
      providerSubscriptionId: sub.id,
      status: "pending",
      billingCycle: cycle,
      ...cardFields,
    });
  }

  // Card charges settle synchronously: reconcile now so the user lands active
  // without waiting on the webhook. If it hasn't settled yet, stay pending and
  // let the webhook finish — but never fail the checkout over it.
  let active = false;
  try {
    active = await reconcilePendingSubscription(workspaceId);
  } catch (err) {
    console.error("billing.card_checkout_reconcile_failed", err);
  }

  // Not active yet: make sure the charge is genuinely still settling and not a
  // card Asaas refused while still returning HTTP 200. A refused card would
  // otherwise route the user to /confirmando to poll forever. Surface it as a
  // decline (the `Asaas <code>:` prefix lets the action show a clean message)
  // and cancel the dead subscription so a retry starts clean.
  if (!active) {
    const payments = await asaas
      .getSubscriptionPayments(sub.id)
      .catch(() => [] as asaas.AsaasPayment[]);
    const charge = payments[0];
    if (!charge || !CARD_SETTLING_STATUSES.has(charge.status)) {
      await asaas.cancelSubscription(sub.id).catch(() => {});
      throw new Error(
        "Asaas 402: Pagamento não autorizado. Confira os dados ou use outro cartão.",
      );
    }
  }

  return {
    status: active ? "active" : "pending",
    card: {
      last4: tokenized.creditCardNumber,
      brand: tokenized.creditCardBrand,
    },
  };
}

/**
 * Swap the card on an active card subscription via our own form (no hosted
 * page). Tokenizes the new card, points the Asaas subscription at it (which also
 * rewrites any open charge), and stores the new display metadata. Nothing is
 * charged now.
 */
export async function changeCard(
  workspaceId: string,
  input: CardCheckoutInput,
  card: asaas.AsaasCard,
  remoteIp: string,
): Promise<{ last4: string; brand: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.providerSubscriptionId) {
    throw new Error("Nenhuma assinatura ativa para trocar o cartão.");
  }

  const [customer] = await db
    .select({ providerCustomerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);
  if (!customer?.providerCustomerId) {
    throw new Error("Cadastro de cobrança não encontrado.");
  }

  const tokenized = await asaas.tokenizeCard({
    customer: customer.providerCustomerId,
    creditCard: card,
    creditCardHolderInfo: holderInfo(input),
    remoteIp,
  });

  await asaas.updateSubscriptionCard(row.providerSubscriptionId, {
    creditCardToken: tokenized.creditCardToken,
    remoteIp,
  });

  await db
    .update(subscriptions)
    .set({
      autopay: true,
      cardToken: tokenized.creditCardToken,
      cardLast4: tokenized.creditCardNumber,
      cardBrand: tokenized.creditCardBrand,
    })
    .where(eq(subscriptions.id, row.id));

  return {
    last4: tokenized.creditCardNumber,
    brand: tokenized.creditCardBrand,
  };
}

/**
 * Move an active *card* subscription to manual Pix, effective the next renewal.
 * Nothing is charged now: the current paid period is kept and Asaas switches the
 * open future-dated charge to Pix (updatePendingPayments). We drop the card on
 * file and clear autopay, so the renewal generates a Pix charge — the webhook
 * (PAYMENT_CREATED) then emails the invoice and the customer pays in-app.
 */
export async function switchToPixBilling(workspaceId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      autopay: subscriptions.autopay,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.providerSubscriptionId) {
    throw new Error("Nenhuma assinatura ativa para alterar.");
  }
  if (row.status !== "active") {
    throw new Error(
      "Só é possível trocar a forma de pagamento de uma assinatura ativa.",
    );
  }
  if (!row.autopay) return; // already manual/Pix — nothing to change

  await asaas.updateSubscriptionMethod(row.providerSubscriptionId, {
    billingType: "PIX",
  });

  await db
    .update(subscriptions)
    .set({
      autopay: false,
      cardToken: null,
      cardLast4: null,
      cardBrand: null,
    })
    .where(eq(subscriptions.id, row.id));
}

/**
 * Move an active *Pix* subscription to card autopay, effective the next renewal.
 * The card is tokenized now (PAN never stored) and attached to the Asaas
 * subscription; nothing is charged today because the current period is already
 * paid and the next charge is future-dated. From the next renewal on, Asaas
 * auto-charges the card. A declined/invalid card surfaces as a thrown error from
 * the Asaas tokenization call.
 */
export async function switchToCardBilling(
  workspaceId: string,
  input: CardCheckoutInput,
  card: asaas.AsaasCard,
  remoteIp: string,
): Promise<{ last4: string; brand: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.providerSubscriptionId) {
    throw new Error("Nenhuma assinatura ativa para alterar.");
  }
  if (row.status !== "active") {
    throw new Error(
      "Só é possível trocar a forma de pagamento de uma assinatura ativa.",
    );
  }

  const [customer] = await db
    .select({ providerCustomerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);
  if (!customer?.providerCustomerId) {
    throw new Error("Cadastro de cobrança não encontrado.");
  }

  // PAN/CCV reach Asaas only here; we keep just the token + display metadata.
  const tokenized = await asaas.tokenizeCard({
    customer: customer.providerCustomerId,
    creditCard: card,
    creditCardHolderInfo: holderInfo(input),
    remoteIp,
  });

  await asaas.updateSubscriptionMethod(row.providerSubscriptionId, {
    billingType: "CREDIT_CARD",
    creditCardToken: tokenized.creditCardToken,
    remoteIp,
  });

  await db
    .update(subscriptions)
    .set({
      autopay: true,
      cardToken: tokenized.creditCardToken,
      cardLast4: tokenized.creditCardNumber,
      cardBrand: tokenized.creditCardBrand,
    })
    .where(eq(subscriptions.id, row.id));

  return {
    last4: tokenized.creditCardNumber,
    brand: tokenized.creditCardBrand,
  };
}

export interface WorkspaceSubscription {
  status: string;
  planKey: string;
  billingCycle: BillingCycle;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autopay: boolean;
  /** Last 4 digits of the card on file, or null (manual / no card yet). */
  cardLast4: string | null;
  /** Brand label of the card on file, or null. */
  cardBrand: string | null;
}

/** Current subscription + plan for a workspace, or null if never subscribed. */
export async function getWorkspaceSubscription(
  workspaceId: string,
): Promise<WorkspaceSubscription | null> {
  const db = getDb();
  const [row] = await db
    .select({
      status: subscriptions.status,
      planKey: plans.key,
      billingCycle: subscriptions.billingCycle,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      autopay: subscriptions.autopay,
      cardLast4: subscriptions.cardLast4,
      cardBrand: subscriptions.cardBrand,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

export type WorkspaceAccess = "full" | "locked" | "none";

/**
 * Single source of truth for what a workspace's billing state grants. Every
 * gate — the dashboard layout, the write-action guard, the redirect Worker's
 * KV flag — derives from this so they never disagree:
 *
 *  - `full`   active/trialing, OR a paid period that hasn't lapsed yet. The
 *             period still covers them even when a *new* charge is `pending`
 *             (a re-checkout mid-upgrade) or the latest charge went `past_due`
 *             within the tolerance window. Links live, writes allowed.
 *  - `locked` the workspace paid at least once but the paid period has lapsed
 *             (expired / canceled / unpaid / past-due beyond grace, or an
 *             abandoned re-checkout whose period ran out). Read-only dashboard,
 *             links dark — kept reachable until the retention job purges it, so
 *             the user can pay and come back instead of being trapped.
 *  - `none`   never completed a payment: onboarding belongs on /assinar.
 */
export function resolveSubscriptionAccess(
  sub: WorkspaceSubscription | null,
): WorkspaceAccess {
  if (!sub) return "none";
  if (sub.status === "active" || sub.status === "trialing") return "full";
  const periodEndMs = sub.currentPeriodEnd?.getTime() ?? null;
  if (periodEndMs != null) {
    const accessUntil =
      sub.status === "past_due"
        ? periodEndMs + PAST_DUE_GRACE_DAYS * DAY_MS
        : periodEndMs;
    return accessUntil > Date.now() ? "full" : "locked";
  }
  return "none";
}

/**
 * Poll Asaas for a pending subscription's payments and activate locally if one
 * already cleared. Mirrors the webhook's activation so the "Já paguei" path
 * unblocks the user even when the webhook is late, blocked, or not configured
 * (common in sandbox). Best-effort and idempotent: a no-op unless there's a
 * pending subscription with a paid charge. Returns true when active afterward.
 */
export async function reconcilePendingSubscription(
  workspaceId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      planId: subscriptions.planId,
      billingCycle: subscriptions.billingCycle,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (!row) return false;
  if (row.status === "active") return true;
  if (row.status !== "pending" || !row.providerSubscriptionId) return false;

  const payments = await asaas.getSubscriptionPayments(
    row.providerSubscriptionId,
  );
  const paid = payments.find((p) => PAID_STATUSES.has(p.status));
  if (!paid) return false;

  const [plan] = await db
    .select({ key: plans.key })
    .from(plans)
    .where(eq(plans.id, row.planId))
    .limit(1);

  // Defense in depth (mirrors the webhook): only activate when the cleared charge
  // covers the plan's price for the billing cycle. The amount is set by us when
  // creating the Asaas subscription, so a shortfall means a stale/divergent charge
  // surfaced in the payments list — never promote the plan off of it.
  if (plan && paid.value != null) {
    const amountCents = Math.round(paid.value * 100);
    const expectedCents = getCyclePriceCents(
      plan.key as PlanKey,
      row.billingCycle,
    );
    if (amountCents < expectedCents) {
      console.error("billing.reconcile_amount_mismatch", {
        workspaceId,
        planKey: plan.key,
        cycle: row.billingCycle,
        amountCents,
        expectedCents,
      });
      return false;
    }
  }

  const paidIso = paid.confirmedDate ?? paid.paymentDate ?? null;
  const paidAt = paidIso ? new Date(paidIso) : new Date();
  // Credit any unused time from the prior period (cycle switch / early renewal).
  const currentPeriodEnd = activatedPeriodEnd({
    paidAt,
    cycle: row.billingCycle,
    prevStart: row.currentPeriodStart,
    prevEnd: row.currentPeriodEnd,
  });

  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: paidAt,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    })
    .where(eq(subscriptions.id, row.id));

  if (plan) {
    await db
      .update(workspaces)
      .set({ planKey: plan.key })
      .where(eq(workspaces.id, workspaceId));
  }

  // Billing is healthy again: bring the workspace's links back online.
  await unlockWorkspaceLinks(workspaceId);

  // A converting trial is exempt from the retention purge.
  await db
    .update(trialRedemptions)
    .set({ convertedAt: paidAt })
    .where(
      and(
        eq(trialRedemptions.workspaceId, workspaceId),
        isNull(trialRedemptions.convertedAt),
      ),
    );

  // Thank-you + receipt. The webhook normally sends this, but it often isn't
  // delivered in sandbox — so the poll that activates here must send it too. The
  // once-per-period guard keeps the two paths from double-emailing.
  await sendReceiptEmailOnce(workspaceId, {
    amountCents: Math.round((paid.value ?? 0) * 100),
    method: mapBillingMethod(paid.billingType),
    renewsAt: currentPeriodEnd,
    receiptUrl: paid.invoiceUrl ?? `${appUrl()}/dashboard/pagamentos`,
  });

  return true;
}

/**
 * Switch an active paid subscription between monthly and yearly in place. We
 * update the existing Asaas subscription (no cancel, no new charge today), so
 * access never drops and there's no double billing. The new cycle and price
 * take effect from the next renewal; the local `billingCycle` is updated so the
 * webhook stamps the right period length when that charge confirms.
 */
export async function changeSubscriptionCycle(
  workspaceId: string,
  cycle: BillingCycle,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      billingCycle: subscriptions.billingCycle,
      status: subscriptions.status,
      planKey: plans.key,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (!row?.providerSubscriptionId) {
    throw new Error("Nenhuma assinatura ativa para alterar.");
  }
  if (row.status !== "active") {
    throw new Error("Só é possível trocar o ciclo de uma assinatura ativa.");
  }
  if (row.billingCycle === cycle) return;

  const plan = getPlan(row.planKey as PlanKey);
  const priceCents = getCyclePriceCents(row.planKey as PlanKey, cycle);

  await asaas.updateSubscription(row.providerSubscriptionId, {
    value: priceCents / 100,
    cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
    description: `linkview ${plan.name} (${cycle === "yearly" ? "anual" : "mensal"})`,
  });

  await db
    .update(subscriptions)
    .set({ billingCycle: cycle })
    .where(eq(subscriptions.id, row.id));
}

/**
 * Cancel at Asaas (stops all future charges) but keep the local subscription
 * `active` until the end of the period the user already paid for. We only flag
 * `cancelAtPeriodEnd`; the workspace keeps Pro access and the cron maintenance
 * job demotes it to free once `currentPeriodEnd` passes. The Asaas DELETE fires
 * a `SUBSCRIPTION_DELETED` webhook, which the handler ignores while the grace
 * period is still open (see api/billing/webhook).
 */
export async function cancelWorkspaceSubscription(
  workspaceId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.providerSubscriptionId) return;

  await asaas.cancelSubscription(row.providerSubscriptionId);
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
    .where(eq(subscriptions.id, row.id));

  // Win-back nudge: tell the customer what they keep until the period ends and
  // that resuming costs nothing now. Best-effort — never let a failed email (or
  // unconfigured email) break the cancellation the user just asked for.
  await sendCancellationEmail(db, workspaceId, row.currentPeriodEnd);
}

/** Best-effort win-back email after a cancellation. Swallows all errors. */
async function sendCancellationEmail(
  db: Database,
  workspaceId: string,
  accessUntil: Date | null,
): Promise<void> {
  if (!emailConfigured()) return;
  try {
    const [customer] = await db
      .select({ email: billingCustomers.email, name: billingCustomers.name })
      .from(billingCustomers)
      .where(eq(billingCustomers.workspaceId, workspaceId))
      .limit(1);
    if (!customer?.email) return;
    await sendSubscriptionCanceledEmail({
      to: customer.email,
      name: customer.name,
      accessUntil,
      resumeUrl: `${appUrl()}/dashboard/planos`,
    });
  } catch (err) {
    console.error("billing.cancel_email_failed", err);
  }
}

/**
 * Undo a "cancel at period end" while the paid period is still running, without
 * charging now. Canceling DELETEs the Asaas subscription, so there's nothing to
 * un-delete — we recreate it with `nextDueDate` set to the current period's end,
 * meaning the first new charge lands exactly when the paid access would have
 * lapsed (no double-billing, no gap). Only valid inside the grace window
 * (`cancelAtPeriodEnd` set, still `active`, `currentPeriodEnd` in the future);
 * once it lapses the cron demotes to free and the user must subscribe again.
 *
 * Card autopay needs no redirect: the recreated subscription's first charge is a
 * future-dated PENDING payment, and the normal "Atualizar cartão" button on the
 * plan page recaptures the card whenever the customer chooses, with no charge
 * today and no payment page to get stuck on. Pix resumes generate a future-dated
 * Pix charge the customer pays when it comes due.
 */
export async function resumeSubscription(workspaceId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      billingCycle: subscriptions.billingCycle,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      autopay: subscriptions.autopay,
      planKey: plans.key,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (!row) throw new Error("Nenhuma assinatura para retomar.");
  if (!row.cancelAtPeriodEnd) {
    throw new Error("A assinatura já está ativa.");
  }
  if (
    row.status !== "active" ||
    !row.currentPeriodEnd ||
    row.currentPeriodEnd <= new Date()
  ) {
    throw new Error("O período já encerrou. Assine novamente.");
  }

  const [customer] = await db
    .select({ providerCustomerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);
  if (!customer?.providerCustomerId) {
    throw new Error("Cadastro de cobrança não encontrado.");
  }

  const planKey = row.planKey as PlanKey;
  const plan = getPlan(planKey);
  const priceCents = getCyclePriceCents(planKey, row.billingCycle);

  // First charge falls on the day the paid period ends — nothing today.
  const nextDueDate = row.currentPeriodEnd.toISOString().slice(0, 10);

  const sub = await asaas.createSubscription({
    customer: customer.providerCustomerId,
    value: priceCents / 100,
    nextDueDate,
    description: `linkview ${plan.name} (${row.billingCycle === "yearly" ? "anual" : "mensal"})`,
    externalReference: workspaceId,
    cycle: row.billingCycle === "yearly" ? "YEARLY" : "MONTHLY",
    billingType: row.autopay ? "CREDIT_CARD" : "PIX",
  });

  await db
    .update(subscriptions)
    .set({
      providerSubscriptionId: sub.id,
      status: "active",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    })
    .where(eq(subscriptions.id, row.id));

  // Defensive: ensure the workspace's links are online again.
  await unlockWorkspaceLinks(workspaceId);
}
