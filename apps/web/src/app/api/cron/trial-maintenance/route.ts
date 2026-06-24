import {
  getDb,
  subscriptions,
  trialRedemptions,
  workspaces,
} from "@linkview/db";
import { TRIAL_RETENTION_DAYS } from "@linkview/shared";
import { and, eq, isNull, lt } from "drizzle-orm";

/**
 * Trial maintenance job. Runs on a schedule (Vercel Cron / external trigger),
 * authenticated by `Bearer ${CRON_SECRET}`. Two passes:
 *
 *  1. Expire trials whose 7 days have elapsed — flip the subscription to
 *     `expired` and drop the workspace back to the free plan.
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

  return { expired: expired.length, purged };
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
