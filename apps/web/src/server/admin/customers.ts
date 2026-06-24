import "server-only";
import {
  clicks,
  getDb,
  links,
  plans,
  subscriptions,
  user,
  workspaces,
} from "@linkview/db";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

export interface CustomerRow {
  workspaceId: string;
  name: string;
  slug: string;
  planKey: string;
  ownerName: string;
  ownerEmail: string;
  subStatus: string | null;
  /** Plan price in cents, or null when there is no subscription. */
  planPriceCents: number | null;
  links: number;
  clicks: number;
  createdAt: Date;
}

/**
 * Tenant roster for the admin console: every active workspace with its owner,
 * plan, subscription status, and link / redirect volume. Link and click counts
 * are aggregated separately and merged in memory so the base list stays a single
 * join. Soft-deleted workspaces are excluded.
 */
export async function listCustomers(limit = 100): Promise<CustomerRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      planKey: workspaces.planKey,
      createdAt: workspaces.createdAt,
      ownerName: user.name,
      ownerEmail: user.email,
      subStatus: subscriptions.status,
      planPriceCents: plans.priceCents,
    })
    .from(workspaces)
    .innerJoin(user, eq(workspaces.ownerId, user.id))
    .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(isNull(workspaces.deletedAt))
    .orderBy(desc(workspaces.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.workspaceId);
  if (ids.length === 0) return [];

  const [linkCounts, clickCounts] = await Promise.all([
    db
      .select({ workspaceId: links.workspaceId, total: count() })
      .from(links)
      .where(and(inArray(links.workspaceId, ids), isNull(links.deletedAt)))
      .groupBy(links.workspaceId),
    db
      .select({ workspaceId: clicks.workspaceId, total: count() })
      .from(clicks)
      .where(inArray(clicks.workspaceId, ids))
      .groupBy(clicks.workspaceId),
  ]);

  const linkMap = new Map(
    linkCounts.map((r) => [r.workspaceId, Number(r.total)]),
  );
  const clickMap = new Map(
    clickCounts.map((r) => [r.workspaceId, Number(r.total)]),
  );

  return rows.map((r) => ({
    workspaceId: r.workspaceId,
    name: r.name,
    slug: r.slug,
    planKey: r.planKey,
    ownerName: r.ownerName,
    ownerEmail: r.ownerEmail,
    subStatus: r.subStatus,
    planPriceCents: r.planPriceCents ?? null,
    links: linkMap.get(r.workspaceId) ?? 0,
    clicks: clickMap.get(r.workspaceId) ?? 0,
    createdAt: r.createdAt,
  }));
}
