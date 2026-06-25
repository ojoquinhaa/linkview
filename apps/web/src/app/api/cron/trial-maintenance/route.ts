import {
  getDb,
  subscriptions,
  trialRedemptions,
  workspaces,
} from "@linkview/db";
import {
  CANCEL_RETENTION_DAYS,
  PAST_DUE_GRACE_DAYS,
  TRIAL_RETENTION_DAYS,
} from "@linkview/shared";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";

/**
 * Trial maintenance job. Runs on a schedule (Vercel Cron / external trigger),
 * authenticated by `Bearer ${CRON_SECRET}`. Passes:
 *
 *  1. Expire trials whose 7 days have elapsed — flip the subscription to
 *     `expired` and drop the workspace back to the free plan.
 *  1b. Close the grace period on canceled paid subscriptions whose paid period
 *     has lapsed — flip to `expired` and drop the workspace to free.
 *  1b2. Cut access on past-due subscriptions older than PAST_DUE_GRACE_DAYS —
 *     flip to `expired` and drop the workspace to free.
 *  1c. Retention purge for paid subscriptions ended (canceled/expired/unpaid)
 *     longer than CANCEL_RETENTION_DAYS — soft-delete the workspace.
 *  2. Retention purge — for trials that ended more than TRIAL_RETENTION_DAYS
 *     ago without ever converting to a paid plan, soft-delete the workspace
 *     (`deletedAt`) and stamp the redemption `purgedAt`. The rows stay in the
 *     database for audit / LGPD; they simply leave the product.
 */
async function runMaintenance() {
  const db = getDb();
  const now = new Date();

  // Pass 1 — expire elapsed trials.
  const expired = await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        lt(subscriptions.trialEndsAt, now),
      ),
    )
    .returning({ workspaceId: subscriptions.workspaceId });

  for (const row of expired) {
    await db
      .update(workspaces)
      .set({ planKey: "free" })
      .where(
        and(
          eq(workspaces.id, row.workspaceId),
          eq(workspaces.planKey, "trial"),
        ),
      );
  }

  // Pass 1b — close the grace period on canceled paid subscriptions. A cancel
  // flags `cancelAtPeriodEnd` and keeps the workspace on Pro until the paid
  // period lapses; once it has, demote to free and mark the sub expired.
  const lapsed = await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.status, "active"),
        eq(subscriptions.cancelAtPeriodEnd, true),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .returning({ workspaceId: subscriptions.workspaceId });

  for (const row of lapsed) {
    await db
      .update(workspaces)
      .set({ planKey: "free" })
      .where(eq(workspaces.id, row.workspaceId));
  }

  // Pass 1b2 — cut access on past-due subscriptions past the tolerance window.
  // Measured from the last paid period end; bounds "access without paying"
  // regardless of whether the provider has escalated the overdue charge.
  const pastDueCutoff = new Date(
    now.getTime() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );
  const overdue = await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.status, "past_due"),
        lt(subscriptions.currentPeriodEnd, pastDueCutoff),
      ),
    )
    .returning({ workspaceId: subscriptions.workspaceId });

  for (const row of overdue) {
    await db
      .update(workspaces)
      .set({ planKey: "free" })
      .where(eq(workspaces.id, row.workspaceId));
  }

  // Pass 1c — retention purge for ended paid subscriptions. A workspace whose
  // paid subscription has been canceled/expired/unpaid for longer than
  // CANCEL_RETENTION_DAYS is soft-deleted: the product data leaves, but the
  // rows (incl. fiscal/billing) stay in the DB for legal retention.
  const cancelCutoff = new Date(
    now.getTime() - CANCEL_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const lapsedPaid = await db
    .select({ workspaceId: subscriptions.workspaceId })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ["canceled", "expired", "unpaid"]),
        lt(subscriptions.currentPeriodEnd, cancelCutoff),
      ),
    );

  let purgedPaid = 0;
  for (const row of lapsedPaid) {
    const done = await db
      .update(workspaces)
      .set({ deletedAt: now })
      .where(
        and(eq(workspaces.id, row.workspaceId), isNull(workspaces.deletedAt)),
      )
      .returning({ id: workspaces.id });
    if (done.length > 0) purgedPaid += 1;
  }

  // Pass 2 — soft-delete non-converting workspaces past the retention window.
  const cutoff = new Date(
    now.getTime() - TRIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const stale = await db
    .select({
      id: trialRedemptions.id,
      workspaceId: trialRedemptions.workspaceId,
    })
    .from(trialRedemptions)
    .where(
      and(
        isNull(trialRedemptions.convertedAt),
        isNull(trialRedemptions.purgedAt),
        lt(trialRedemptions.endsAt, cutoff),
      ),
    );

  let purged = 0;
  for (const row of stale) {
    await db.batch([
      db
        .update(workspaces)
        .set({ deletedAt: now })
        .where(
          and(eq(workspaces.id, row.workspaceId), isNull(workspaces.deletedAt)),
        ),
      db
        .update(trialRedemptions)
        .set({ purgedAt: now })
        .where(eq(trialRedemptions.id, row.id)),
    ]);
    purged += 1;
  }

  return {
    expired: expired.length,
    lapsed: lapsed.length,
    overdue: overdue.length,
    purgedPaid,
    purged,
  };
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runMaintenance();
  return Response.json({ ok: true, ...result });
}

// Vercel Cron issues GET requests; accept both.
export async function GET(request: Request) {
  return POST(request);
}
