import {
  billingEvents,
  getDb,
  plans,
  subscriptions,
  trialRedemptions,
  workspaces,
} from "@linkview/db";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Asaas billing webhook (§ billing). Authenticated by the shared
 * `asaas-access-token` header, idempotent via `billing_events.providerEventId`.
 * Payment confirmation activates the subscription and promotes the workspace
 * plan; cancellation / overdue events demote or flag it.
 */

interface AsaasPayload {
  id?: string;
  event?: string;
  payment?: {
    id: string;
    subscription?: string;
    externalReference?: string;
    confirmedDate?: string;
    dueDate?: string;
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
      })
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .limit(1);
    if (row) return row;
  }
  return null;
}

export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expected) {
    const token = request.headers.get("asaas-access-token");
    if (token !== expected) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
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
      const paidAt = payload.payment?.confirmedDate
        ? new Date(payload.payment.confirmedDate)
        : new Date();
      await db
        .update(subscriptions)
        .set({
          status: "active",
          currentPeriodStart: paidAt,
          currentPeriodEnd: periodEnd(paidAt, sub.billingCycle),
          cancelAtPeriodEnd: false,
          canceledAt: null,
        })
        .where(eq(subscriptions.id, sub.id));

      // Promote the workspace to the subscribed plan.
      const [plan] = await db
        .select({ key: plans.key })
        .from(plans)
        .where(eq(plans.id, sub.planId))
        .limit(1);
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
    } else if (event === "PAYMENT_OVERDUE") {
      await db
        .update(subscriptions)
        .set({ status: "past_due" })
        .where(eq(subscriptions.id, sub.id));
    } else if (
      event === "SUBSCRIPTION_DELETED" ||
      event === "SUBSCRIPTION_INACTIVATED"
    ) {
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

  await db
    .update(billingEvents)
    .set({ processedAt: new Date() })
    .where(eq(billingEvents.providerEventId, eventId));

  return Response.json({ ok: true });
}
