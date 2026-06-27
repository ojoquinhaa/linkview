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
  type PlanKey,
} from "@linkview/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  emailConfigured,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/email";
import * as asaas from "./asaas";

/** Asaas payment statuses that mean the money cleared. */
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

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

export interface CheckoutResult {
  /** Asaas hosted payment page (Pix / boleto / card). */
  invoiceUrl: string;
}

/**
 * Create (or refresh) a paid subscription for the workspace and return the
 * hosted checkout URL. The subscription stays `pending` until the Asaas
 * webhook confirms the first payment, which flips it to `active` and promotes
 * the workspace plan.
 */
export async function startSubscription(
  workspaceId: string,
  planKey: PlanKey,
  input: CheckoutInput,
  cycle: BillingCycle = "monthly",
  /**
   * When true, the hosted checkout captures a credit card and Asaas auto-charges
   * every renewal. When false (default), the payer picks Pix / boleto / card and
   * pays each cycle manually.
   */
  autopay = false,
): Promise<CheckoutResult> {
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
    billingType: autopay ? "CREDIT_CARD" : "UNDEFINED",
    callback: {
      successUrl: `${appUrl()}/assinar/confirmando`,
      autoRedirect: true,
    },
  });

  // One subscription row per workspace: refresh it on re-checkout.
  const [existing] = await db
    .select({ id: subscriptions.id })
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
        autopay,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      workspaceId,
      planId: row.id,
      provider: "asaas",
      providerSubscriptionId: sub.id,
      status: "pending",
      billingCycle: cycle,
      autopay,
    });
  }

  const payments = await asaas.getSubscriptionPayments(sub.id);
  const invoiceUrl = payments[0]?.invoiceUrl;
  if (!invoiceUrl) {
    throw new Error("Asaas não retornou um link de pagamento.");
  }
  return { invoiceUrl };
}

export interface WorkspaceSubscription {
  status: string;
  planKey: string;
  billingCycle: BillingCycle;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autopay: boolean;
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
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
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

  const paidIso = paid.confirmedDate ?? paid.paymentDate ?? null;
  const paidAt = paidIso ? new Date(paidIso) : new Date();
  const currentPeriodEnd =
    row.billingCycle === "yearly" ? addYear(paidAt) : addMonth(paidAt);

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

  const [plan] = await db
    .select({ key: plans.key })
    .from(plans)
    .where(eq(plans.id, row.planId))
    .limit(1);
  if (plan) {
    await db
      .update(workspaces)
      .set({ planKey: plan.key })
      .where(eq(workspaces.id, workspaceId));
  }

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
 * future-dated PENDING payment, which `getOpenInvoiceUrl` surfaces — so the
 * normal "Atualizar cartão" button on the plan page recaptures the card whenever
 * the customer chooses, with no charge today and no payment page to get stuck on.
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
    billingType: row.autopay ? "CREDIT_CARD" : "UNDEFINED",
    callback: {
      successUrl: `${appUrl()}/dashboard/planos`,
      autoRedirect: true,
    },
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
}

/** Asaas payment statuses that are still awaiting payment. */
const OPEN_PAYMENT_STATUSES = new Set([
  "OVERDUE",
  "PENDING",
  "AWAITING_RISK_ANALYSIS",
]);

/**
 * Hosted invoice URL of the workspace's earliest unpaid charge, or null when
 * nothing is open. Paying it on the Asaas page lets a card-autopay customer
 * settle an overdue charge and swap the card on file (the new card is reused for
 * future renewals). Overdue charges take priority over upcoming ones.
 */
export async function getOpenInvoiceUrl(
  workspaceId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ providerSubscriptionId: subscriptions.providerSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  if (!row?.providerSubscriptionId) return null;

  let payments: Awaited<ReturnType<typeof asaas.getSubscriptionPayments>>;
  try {
    payments = await asaas.getSubscriptionPayments(row.providerSubscriptionId);
  } catch (err) {
    console.error("billing.open_invoice_fetch_failed", err);
    return null;
  }

  const open = payments
    .filter((p) => OPEN_PAYMENT_STATUSES.has(p.status) && p.invoiceUrl)
    .sort((a, b) => {
      // Overdue first, then by soonest due date.
      const ao = a.status === "OVERDUE" ? 0 : 1;
      const bo = b.status === "OVERDUE" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    });
  return open[0]?.invoiceUrl ?? null;
}
