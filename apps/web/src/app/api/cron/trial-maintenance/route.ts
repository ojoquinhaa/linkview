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
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { lockWorkspaceLinks } from "@/lib/kv";
import * as asaas from "@/server/billing/asaas";
import { reconcilePendingSubscription } from "@/server/billing/subscription";

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
 *  1b4. Expire an abandoned cycle switch (`active` + `pendingBillingCycle` set)
 *     whose old paid period has lapsed with the switch charge still unpaid —
 *     reconcile first (spare a paid-but-unwebhooked switch), else expire to free.
 *  1e. Retry orphaned provider-subscription cancellations — a superseded Asaas
 *     subscription whose inline DELETE failed (stashed in
 *     `staleProviderSubscriptionId`), so it can never bill the customer twice.
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

  // Pass 1b4 — abandoned cycle switch. A switch keeps the sub `active` with the
  // target cycle staged in `pendingBillingCycle` while the new charge is
  // outstanding; the workspace rides the *old* paid period until it clears. If
  // that period has lapsed and the switch charge is still unpaid, the user is no
  // longer covered. Reconcile once first — a paid charge whose PAYMENT webhook was
  // missed still activates and is spared; only a genuinely unpaid switch is
  // expired + darked. Backstops a missing PAYMENT_OVERDUE webhook (which is what
  // would otherwise flip it to past_due for Pass 1b2).
  const switchLapsed = await db
    .select({ workspaceId: subscriptions.workspaceId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        isNotNull(subscriptions.pendingBillingCycle),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    );

  let switchExpired = 0;
  for (const row of switchLapsed) {
    // A provider read error here throws — skip and retry next run rather than
    // expiring a possibly-paid workspace on a transient failure.
    let settled: boolean;
    try {
      settled = await reconcilePendingSubscription(row.workspaceId);
    } catch {
      continue;
    }
    if (settled) continue; // switch charge cleared — now active on the new cycle

    // Still unpaid and the old period is gone: expire, clear the stale target,
    // drop to free, dark links. Guarded on the state we selected to avoid racing
    // a payment that landed between the select and here.
    const done = await db
      .update(subscriptions)
      .set({ status: "expired", pendingBillingCycle: null })
      .where(
        and(
          eq(subscriptions.workspaceId, row.workspaceId),
          eq(subscriptions.status, "active"),
          isNotNull(subscriptions.pendingBillingCycle),
          lt(subscriptions.currentPeriodEnd, now),
        ),
      )
      .returning({ workspaceId: subscriptions.workspaceId });
    if (done.length === 0) continue;
    await db
      .update(workspaces)
      .set({ planKey: "free" })
      .where(eq(workspaces.id, row.workspaceId));
    await lockWorkspaceLinks(row.workspaceId);
    switchExpired += 1;
  }

  // Pass 1e — retry orphaned provider-subscription cancellations. A re-checkout
  // supersedes the old Asaas subscription and cancels it inline so its leftover
  // charges can never bill the customer a second time; if that DELETE failed (a
  // provider outage) the orphaned id is stashed in `staleProviderSubscriptionId`.
  // Retry until it sticks — `cancelSubscription` treats a 404 as success, so an
  // already-gone id clears the stash instead of looping forever.
  const orphaned = await db
    .select({
      id: subscriptions.id,
      staleId: subscriptions.staleProviderSubscriptionId,
    })
    .from(subscriptions)
    .where(isNotNull(subscriptions.staleProviderSubscriptionId));

  let staleCanceled = 0;
  for (const row of orphaned) {
    if (!row.staleId) continue;
    try {
      await asaas.cancelSubscription(row.staleId);
    } catch {
      continue; // provider still failing — leave stashed, retry next run
    }
    // Clear the stash, guarded on the same id so we don't wipe a *newer* orphan
    // stashed by a switch that raced this pass.
    const done = await db
      .update(subscriptions)
      .set({ staleProviderSubscriptionId: null })
      .where(
        and(
          eq(subscriptions.id, row.id),
          eq(subscriptions.staleProviderSubscriptionId, row.staleId),
        ),
      )
      .returning({ id: subscriptions.id });
    if (done.length > 0) staleCanceled += 1;
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
    switchExpired,
    staleCanceled,
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
