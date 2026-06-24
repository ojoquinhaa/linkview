"use server";
import { can } from "@linkview/auth/permissions";
import { clicks, getDb, links } from "@linkview/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { CLICKS_PAGE_SIZE } from "@/lib/clicks";
import type { ClicksPage } from "./links-query";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

const EMPTY: ClicksPage = {
  rows: [],
  total: 0,
  page: 0,
  pageSize: CLICKS_PAGE_SIZE,
};

/**
 * One page of a link's clicks, newest first. Offset pagination keeps the
 * payload small (10 rows) so the table never ships the whole history at once.
 * Total is queried alongside so the client can render "page X of Y" without a
 * second round trip.
 */
export async function fetchClicksPage(
  linkId: string,
  page = 0,
): Promise<ClicksPage> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace || !can(workspace.role, "metrics.view")) return EMPTY;

  const db = getDb();
  const [owned] = await db
    .select({ id: links.id })
    .from(links)
    .where(
      and(
        eq(links.id, linkId),
        eq(links.workspaceId, workspace.id),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  if (!owned) return EMPTY;

  const safePage = Math.max(0, Math.floor(page));
  const [rows, [tally]] = await Promise.all([
    db
      .select({
        occurredAt: clicks.occurredAt,
        device: clicks.device,
        os: clicks.os,
        browser: clicks.browser,
        country: clicks.country,
        region: clicks.region,
        city: clicks.city,
        source: clicks.source,
      })
      .from(clicks)
      .where(eq(clicks.linkId, linkId))
      .orderBy(desc(clicks.occurredAt))
      .limit(CLICKS_PAGE_SIZE)
      .offset(safePage * CLICKS_PAGE_SIZE),
    db.select({ total: count() }).from(clicks).where(eq(clicks.linkId, linkId)),
  ]);

  return {
    rows,
    total: Number(tally?.total ?? 0),
    page: safePage,
    pageSize: CLICKS_PAGE_SIZE,
  };
}
