import "server-only";
import type { Database } from "@linkview/db";
import { billingCustomers, getDb, plans, subscriptions } from "@linkview/db";
import { getPlan, type PlanKey } from "@linkview/shared";
import { eq } from "drizzle-orm";
import * as asaas from "./asaas";

function appUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
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
): Promise<CheckoutResult> {
  const plan = getPlan(planKey);
  if (plan.priceCents <= 0) {
    throw new Error("O plano gratuito não exige pagamento.");
  }
  const db = getDb();
  const row = await planRow(db, planKey);
  const customerId = await ensureCustomer(db, workspaceId, input);

  const sub = await asaas.createSubscription({
    customer: customerId,
    value: row.priceCents / 100,
    nextDueDate: new Date().toISOString().slice(0, 10),
    description: `linkview ${plan.name}`,
    externalReference: workspaceId,
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
