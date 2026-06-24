import "server-only";
import { getDb, subscriptions } from "@linkview/db";
import { eq } from "drizzle-orm";
import * as asaas from "./asaas";

export type PaymentMethod = "pix" | "boleto" | "card" | "unknown";

/** Settled, in-flight, or failed: drives the status pill tone in the UI. */
export type PaymentState = "paid" | "pending" | "overdue" | "refunded";

export interface PaymentRow {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  state: PaymentState;
  /** When it settled, or the due date while still pending. */
  date: Date | null;
  description: string | null;
  invoiceUrl: string | null;
}

export interface PaymentsResult {
  payments: PaymentRow[];
  /** True when the workspace never had a paid subscription (trial only). */
  neverPaid: boolean;
  /** True when the billing provider could not be reached. */
  unavailable: boolean;
}

function mapMethod(billingType: string): PaymentMethod {
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

function mapState(status: string): PaymentState {
  switch (status) {
    case "CONFIRMED":
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
      return "refunded";
    default:
      return "pending";
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Payment history for a workspace, pulled live from the billing provider
 * (there is no local payments table). Trial-only workspaces have no provider
 * subscription, so they return `neverPaid`. Provider outages return
 * `unavailable` instead of throwing, so the page can degrade gracefully.
 */
export async function listWorkspacePayments(
  workspaceId: string,
): Promise<PaymentsResult> {
  const db = getDb();
  const [sub] = await db
    .select({
      provider: subscriptions.provider,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (sub?.provider !== "asaas" || !sub.providerSubscriptionId) {
    return { payments: [], neverPaid: true, unavailable: false };
  }

  try {
    const raw = await asaas.getSubscriptionPayments(sub.providerSubscriptionId);
    const payments: PaymentRow[] = raw
      .map((p) => ({
        id: p.id,
        amountCents: Math.round((p.value ?? 0) * 100),
        method: mapMethod(p.billingType ?? ""),
        state: mapState(p.status ?? ""),
        date:
          parseDate(p.confirmedDate ?? p.paymentDate) ?? parseDate(p.dueDate),
        description: p.description ?? null,
        invoiceUrl: p.invoiceUrl ?? null,
      }))
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    return { payments, neverPaid: false, unavailable: false };
  } catch (err) {
    console.error("billing.payments_fetch_failed", err);
    return { payments: [], neverPaid: false, unavailable: true };
  }
}
