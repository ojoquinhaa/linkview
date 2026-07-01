import {
  getDb,
  subscriptions,
  trialRedemptions,
  user,
  workspaces,
} from "@linkview/db";
import {
  ACCOUNT_CLOSURE_RETENTION_DAYS,
  CANCEL_RETENTION_DAYS,
  PAST_DUE_GRACE_DAYS,
  TRIAL_RETENTION_DAYS,
} from "@linkview/shared";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { lockWorkspaceLinks } from "@/lib/kv";

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
 *  1d. Retention purge for suspended/closed accounts past
 *     ACCOUNT_CLOSURE_RETENTION_DAYS — soft-delete the workspaces they own.
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
    // No active plan: take the workspace's links offline.
    await lockWorkspaceLinks(row.workspaceId);
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
    await lockWorkspaceLinks(row.workspaceId);
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
    await lockWorkspaceLinks(row.workspaceId);
  }

  // Pass 1b3 — a re-checkout left the subscription `pending`, but the paid
  // period it was riding on has now lapsed (the user abandoned the new payment).
  // Expire it so it stops granting access and eventually purges, and dark its
  // links. Rows with no `currentPeriodEnd` (never paid) are left for onboarding.
  const pendingLapsed = await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.status, "pending"),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .returning({ workspaceId: subscriptions.workspaceId });

  for (const row of pendingLapsed) {
    await db
      .update(workspaces)
      .set({ planKey: "free" })
      .where(eq(workspaces.id, row.workspaceId));
    await lockWorkspaceLinks(row.workspaceId);
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

  // Pass 1d — retention purge for suspended/closed accounts (SECURITY-AUDIT F1).
  // An account suspended by an admin or closed by its owner (LGPD erasure) keeps
  // a read-only dashboard until ACCOUNT_CLOSURE_RETENTION_DAYS after `deletedAt`;
  // past that, soft-delete every workspace the user owns (the rows stay for legal
  // retention). The links were already darked when the status changed.
  const closureCutoff = new Date(
    now.getTime() - ACCOUNT_CLOSURE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const closedAccounts = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        inArray(user.status, ["suspended", "deleted"]),
        lt(user.deletedAt, closureCutoff),
      ),
    );

  let purgedAccounts = 0;
  for (const row of closedAccounts) {
    const done = await db
      .update(workspaces)
      .set({ deletedAt: now })
      .where(and(eq(workspaces.ownerId, row.id), isNull(workspaces.deletedAt)))
      .returning({ id: workspaces.id });
    if (done.length > 0) purgedAccounts += 1;
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
    pendingLapsed: pendingLapsed.length,
    purgedPaid,
    purgedAccounts,
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
