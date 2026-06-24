import "server-only";
import type { Database } from "@linkview/db";
import { billingCustomers, getDb, plans, subscriptions } from "@linkview/db";
import {
  type BillingCycle,
  getCyclePriceCents,
  getPlan,
  type PlanKey,
} from "@linkview/shared";
import { eq } from "drizzle-orm";
import * as asaas from "./asaas";

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
    callback: {
      successUrl: `${appUrl()}/assinar?status=ok`,
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
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
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

/** Cancel at Asaas and mark the local subscription canceled. */
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
    .set({ status: "canceled", canceledAt: new Date() })
    .where(eq(subscriptions.id, row.id));
}
