import { timingSafeEqual } from "node:crypto";
import {
  billingCustomers,
  billingEvents,
  getDb,
  plans,
  subscriptions,
  trialRedemptions,
  workspaces,
} from "@linkview/db";
import { getCyclePriceCents, type PlanKey } from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";
import {
  emailConfigured,
  sendCardChargeFailedEmail,
  sendPaymentOverdueEmail,
  sendPaymentReceiptEmail,
} from "@/lib/email";

/**
 * Asaas billing webhook (§ billing). Authenticated by the shared
 * `asaas-access-token` header, idempotent via `billing_events.providerEventId`.
 * Payment confirmation activates the subscription and promotes the workspace
 * plan; cancellation / overdue events demote or flag it.
 */

// node:crypto (timingSafeEqual) requires the Node.js runtime.
export const runtime = "nodejs";

interface AsaasPayload {
  id?: string;
  event?: string;
  payment?: {
    id: string;
    subscription?: string;
    externalReference?: string;
    confirmedDate?: string;
    dueDate?: string;
    invoiceUrl?: string;
    /** Amount in BRL (e.g. 24.9), not cents. */
    value?: number;
    /** PIX | BOLETO | CREDIT_CARD | UNDEFINED. */
    billingType?: string;
    /** Paid-receipt URL, present once the charge settles. */
    transactionReceiptUrl?: string;
  };
  subscription?: {
    id: string;
    externalReference?: string;
  };
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

/** Next renewal date for a paid period that just started, by billing cadence. */
function periodEnd(from: Date, cycle: string): Date {
  return cycle === "yearly" ? addYear(from) : addMonth(from);
}

/** Asaas billingType → the receipt email's method label key. */
function mapMethod(
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

/** Public app origin, trimmed (a CRLF in the env var would break links). */
function appUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000")
    .trim()
    .replace(/\/$/, "");
}

/**
 * Email the workspace's billing contact about a payment problem. Best-effort:
 * skips silently when email is unconfigured and never throws (a failed send
 * must not fail the webhook). The invoice URL falls back to the payments page.
 */
async function emailBillingIssue(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  payload: AsaasPayload,
  sender: (args: {
    to: string;
    name?: string | null;
    invoiceUrl: string;
  }) => Promise<void>,
): Promise<void> {
  if (!emailConfigured()) return;
  try {
    const [customer] = await db
      .select({ email: billingCustomers.email, name: billingCustomers.name })
      .from(billingCustomers)
      .where(eq(billingCustomers.workspaceId, workspaceId))
      .limit(1);
    if (!customer?.email) return;
    const invoiceUrl =
      payload.payment?.invoiceUrl ?? `${appUrl()}/dashboard/pagamentos`;
    await sender({ to: customer.email, name: customer.name, invoiceUrl });
  } catch (err) {
    console.error("billing.issue_email_failed", err);
  }
}

/** Resolve the local subscription row from event payload. */
async function resolveSubscription(
  db: ReturnType<typeof getDb>,
  payload: AsaasPayload,
) {
  const providerSubId =
    payload.payment?.subscription ?? payload.subscription?.id;
  const workspaceId =
    payload.payment?.externalReference ??
    payload.subscription?.externalReference;

  if (providerSubId) {
    const [row] = await db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        planId: subscriptions.planId,
        billingCycle: subscriptions.billingCycle,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, providerSubId))
      .limit(1);
    if (row) return row;
  }
  if (workspaceId) {
    const [row] = await db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        planId: subscriptions.planId,
        billingCycle: subscriptions.billingCycle,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    if (row) return row;
  }
  return null;
}

/** Constant-time string compare; false (not throw) on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  // Fail closed: an unconfigured token must reject, never wave events through.
  // Without this, a forged PAYMENT_CONFIRMED could grant Pro for free.
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    console.error("billing.webhook_token_unset");
    return Response.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const token = request.headers.get("asaas-access-token");
  if (!token || !safeEqual(token, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: AsaasPayload;
  try {
    payload = (await request.json()) as AsaasPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventId = payload.id;
  const event = payload.event;
  if (!eventId || !event) {
    return Response.json({ error: "invalid_payload" }, { status: 422 });
  }

  const db = getDb();

  // Idempotency gate: a duplicate delivery no-ops.
  const inserted = await db
    .insert(billingEvents)
    .values({
      provider: "asaas",
      providerEventId: eventId,
      eventType: event,
      payload: payload as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: billingEvents.providerEventId })
    .returning({ id: billingEvents.id });
  if (inserted.length === 0) {
    return Response.json({ ok: true, duplicate: true });
  }

  const sub = await resolveSubscription(db, payload);
  if (sub) {
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const [plan] = await db
        .select({ key: plans.key })
        .from(plans)
        .where(eq(plans.id, sub.planId))
        .limit(1);

      // Defense in depth: confirm the amount paid matches the plan's price for
      // the billing cycle before granting access. A forged or tampered event
      // (or a wrong-priced charge) that underpays must not unlock Pro. We only
      // gate on a present value and a known plan; anything else proceeds.
      const amountCents = Math.round((payload.payment?.value ?? 0) * 100);
      const expectedCents = plan
        ? getCyclePriceCents(plan.key as PlanKey, sub.billingCycle)
        : null;
      if (
        expectedCents != null &&
        payload.payment?.value != null &&
        amountCents < expectedCents
      ) {
        console.error("billing.amount_mismatch", {
          eventId,
          planKey: plan?.key,
          cycle: sub.billingCycle,
          amountCents,
          expectedCents,
        });
        await db
          .update(billingEvents)
          .set({ processedAt: new Date() })
          .where(eq(billingEvents.providerEventId, eventId));
        return Response.json({ ok: true, ignored: "amount_mismatch" });
      }

      const paidAt = payload.payment?.confirmedDate
        ? new Date(payload.payment.confirmedDate)
        : new Date();
      const renewsAt = periodEnd(paidAt, sub.billingCycle);
      await db
        .update(subscriptions)
        .set({
          status: "active",
          currentPeriodStart: paidAt,
          currentPeriodEnd: renewsAt,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        })
        .where(eq(subscriptions.id, sub.id));

      // Promote the workspace to the subscribed plan.
      if (plan) {
        await db
          .update(workspaces)
          .set({ planKey: plan.key })
          .where(eq(workspaces.id, sub.workspaceId));
      }

      // A converting trial is exempt from the retention purge: stamp the
      // redemption so the maintenance job leaves its data alone.
      await db
        .update(trialRedemptions)
        .set({ convertedAt: paidAt })
        .where(
          and(
            eq(trialRedemptions.workspaceId, sub.workspaceId),
            isNull(trialRedemptions.convertedAt),
          ),
        );

      // Thank-you + receipt. Best-effort, never fails the webhook.
      if (emailConfigured()) {
        try {
          const [customer] = await db
            .select({
              email: billingCustomers.email,
              name: billingCustomers.name,
            })
            .from(billingCustomers)
            .where(eq(billingCustomers.workspaceId, sub.workspaceId))
            .limit(1);
          if (customer?.email) {
            await sendPaymentReceiptEmail({
              to: customer.email,
              name: customer.name,
              amountCents: Math.round((payload.payment?.value ?? 0) * 100),
              method: mapMethod(payload.payment?.billingType),
              renewsAt,
              receiptUrl:
                payload.payment?.transactionReceiptUrl ??
                payload.payment?.invoiceUrl ??
                `${appUrl()}/dashboard/pagamentos`,
            });
          }
        } catch (err) {
          console.error("billing.receipt_email_failed", err);
        }
      }
    } else if (event === "PAYMENT_OVERDUE") {
      await db
        .update(subscriptions)
        .set({ status: "past_due" })
        .where(eq(subscriptions.id, sub.id));

      // A charge passed its due date unpaid (manual invoice not paid, or a card
      // capture that ultimately failed). Nudge the customer to pay.
      await emailBillingIssue(
        db,
        sub.workspaceId,
        payload,
        sendPaymentOverdueEmail,
      );
    } else if (event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
      // Recurring card charge was refused (expired/blocked/insufficient funds).
      // Don't change status — Asaas retries, and an eventual PAYMENT_OVERDUE
      // drives the past_due flow. Just warn the customer to fix the card now.
      await emailBillingIssue(
        db,
        sub.workspaceId,
        payload,
        sendCardChargeFailedEmail,
      );
    } else if (
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_CHARGEBACK_REQUESTED"
    ) {
      // Money was returned (refund) or is being clawed back (chargeback): revoke
      // access immediately — no grace, the period was effectively not paid for.
      await db
        .update(subscriptions)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
      await db
        .update(workspaces)
        .set({ planKey: "free" })
        .where(eq(workspaces.id, sub.workspaceId));
    } else if (
      event === "SUBSCRIPTION_DELETED" ||
      event === "SUBSCRIPTION_INACTIVATED"
    ) {
      // A user-initiated "cancel at period end" deletes the Asaas subscription
      // immediately (to stop future charges) but the workspace keeps Pro until
      // the paid period lapses. Skip the demotion while that grace window is
      // still open — the cron maintenance job demotes it once it ends.
      const inGracePeriod =
        sub.cancelAtPeriodEnd &&
        sub.currentPeriodEnd != null &&
        sub.currentPeriodEnd > new Date();
      if (!inGracePeriod) {
        await db
          .update(subscriptions)
          .set({ status: "canceled", canceledAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        // Drop the workspace back to the free plan.
        await db
          .update(workspaces)
          .set({ planKey: "free" })
          .where(eq(workspaces.id, sub.workspaceId));
      }
    }
  }

  await db
    .update(billingEvents)
    .set({ processedAt: new Date() })
    .where(eq(billingEvents.providerEventId, eventId));

  return Response.json({ ok: true });
}
