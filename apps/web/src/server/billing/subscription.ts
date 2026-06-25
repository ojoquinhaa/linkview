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
import { and, eq, isNull } from "drizzle-orm";
import * as asaas from "./asaas";

/** Asaas payment statuses that mean the money cleared. */
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

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
