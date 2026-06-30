import "server-only";
import { billingCustomers, getDb, subscriptions } from "@linkview/db";
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
 * (there is no local payments table). Scoped to the workspace's *customer*, not
 * a single subscription, so every charge stays visible — across re-checkouts
 * that supersede the prior subscription, every billing type, and one-off
 * charges. Workspaces that never checked out have no provider customer, so they
 * return `neverPaid`. Provider outages return `unavailable` instead of throwing,
 * so the page can degrade gracefully.
 */
export async function listWorkspacePayments(
  workspaceId: string,
): Promise<PaymentsResult> {
  const db = getDb();
  const [customer] = await db
    .select({
      provider: billingCustomers.provider,
      providerCustomerId: billingCustomers.providerCustomerId,
    })
    .from(billingCustomers)
    .where(eq(billingCustomers.workspaceId, workspaceId))
    .limit(1);

  if (customer?.provider !== "asaas" || !customer.providerCustomerId) {
    return { payments: [], neverPaid: true, unavailable: false };
  }

  try {
    const raw = await asaas.getCustomerPayments(customer.providerCustomerId);
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

/** Asaas statuses for a charge that is generated but not yet settled. */
const OPEN_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

export interface OpenChargePix {
  /** Base64 PNG of the Pix QR (no data-URI prefix). */
  encodedImage: string;
  /** EMV "Pix Copia e Cola" code. */
  payload: string;
  /** ISO timestamp when the QR expires, or null. */
  expiresAt: string | null;
}

export interface OpenCharge {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  /** "pending" or "overdue" — an unpaid charge awaiting the customer. */
  state: PaymentState;
  /** Due date of the charge. */
  dueDate: Date | null;
  /** Hosted invoice URL (fallback / boleto). */
  invoiceUrl: string | null;
  /** Pix QR + copy-paste, present when the charge is Pix. */
  pix: OpenChargePix | null;
}

export interface OpenChargeInfo {
  method: PaymentMethod;
  /** "pending" or "overdue". */
  state: PaymentState;
  dueDate: Date | null;
}

/**
 * Lightweight check for an open (unpaid) charge — method, state and due date
 * only, no Pix QR fetch. Used by the dashboard layout to drive the fixed billing
 * banner on every page load without the extra round-trip {@link
 * getWorkspaceOpenCharge} makes for the QR. Returns null when nothing is owed.
 */
export async function getOpenChargeInfo(
  workspaceId: string,
): Promise<OpenChargeInfo | null> {
  const db = getDb();
  const [sub] = await db
    .select({
      provider: subscriptions.provider,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (sub?.provider !== "asaas" || !sub.providerSubscriptionId) return null;

  try {
    const charges = await asaas.getSubscriptionPayments(
      sub.providerSubscriptionId,
    );
    const open = charges
      .filter((c) => OPEN_STATUSES.has(c.status ?? ""))
      .sort(
        (a, b) =>
          (parseDate(a.dueDate)?.getTime() ?? 0) -
          (parseDate(b.dueDate)?.getTime() ?? 0),
      )[0];
    if (!open) return null;
    return {
      method: mapMethod(open.billingType ?? ""),
      state: mapState(open.status ?? ""),
      dueDate: parseDate(open.dueDate),
    };
  } catch (err) {
    console.error("billing.open_charge_info_failed", err);
    return null;
  }
}

/**
 * The workspace's open (generated-but-unpaid) charge for the current
 * subscription, if any — the renewal invoice the customer still needs to pay.
 * Scoped to the live `providerSubscriptionId` (not the whole customer history)
 * so a stale charge from a superseded subscription never resurfaces here. For a
 * Pix charge we also fetch its QR so the dashboard can render the payment in-app
 * (no hosted page). Returns null when nothing is owed, and degrades to a
 * QR-less charge (invoice link only) if the QR fetch fails.
 */
export async function getWorkspaceOpenCharge(
  workspaceId: string,
): Promise<OpenCharge | null> {
  const db = getDb();
  const [sub] = await db
    .select({
      provider: subscriptions.provider,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (sub?.provider !== "asaas" || !sub.providerSubscriptionId) return null;

  try {
    const charges = await asaas.getSubscriptionPayments(
      sub.providerSubscriptionId,
    );
    // Earliest-due open charge: that's the one the customer should pay next.
    const open = charges
      .filter((c) => OPEN_STATUSES.has(c.status ?? ""))
      .sort(
        (a, b) =>
          (parseDate(a.dueDate)?.getTime() ?? 0) -
          (parseDate(b.dueDate)?.getTime() ?? 0),
      )[0];
    if (!open) return null;

    let pix: OpenChargePix | null = null;
    if ((open.billingType ?? "") === "PIX") {
      try {
        const qr = await asaas.getPixQrCode(open.id);
        if (qr?.payload && qr.encodedImage) {
          pix = {
            encodedImage: qr.encodedImage,
            payload: qr.payload,
            expiresAt: qr.expirationDate ?? null,
          };
        }
      } catch (err) {
        // QR unavailable: fall back to the hosted invoice link below.
        console.error("billing.open_charge_qr_failed", err);
      }
    }

    return {
      id: open.id,
      amountCents: Math.round((open.value ?? 0) * 100),
      method: mapMethod(open.billingType ?? ""),
      state: mapState(open.status ?? ""),
      dueDate: parseDate(open.dueDate),
      invoiceUrl: open.invoiceUrl ?? null,
      pix,
    };
  } catch (err) {
    console.error("billing.open_charge_fetch_failed", err);
    return null;
  }
}
