import "server-only";
import { getDb, links, pageLayouts, workspaces } from "@linkview/db";
import {
  getPlan,
  type KvLinkRecord,
  type PlanKey,
  resolveSplash,
  type SplashConfig,
} from "@linkview/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getSystemDomain } from "@/server/domain";
import { syncLinkToKv } from "./kv";

/** Stamp a link's KV mirror as in sync (clears any pending-resync flag). */
async function markKvSynced(linkId: string): Promise<void> {
  await getDb()
    .update(links)
    .set({ kvSyncedAt: new Date(), kvSyncPending: false })
    .where(eq(links.id, linkId));
}

/** Flag a link for KV resync after a failed write. Best-effort: if even this
 *  update fails the row simply stays unflagged, which the next mutation or a
 *  full reconciliation would still catch. */
async function markKvSyncPending(linkId: string): Promise<void> {
  try {
    await getDb()
      .update(links)
      .set({ kvSyncPending: true })
      .where(eq(links.id, linkId));
  } catch (err) {
    console.error("link.kv_mark_pending_failed", linkId, err);
  }
}

/**
 * Push a link's operational record to KV and record the outcome in Postgres.
 * Never throws: a KV failure flags the link for resync (the scheduled job
 * re-pushes it) instead of failing the caller's mutation — Postgres stays the
 * source of truth and the user's action still succeeds (§11.6). Returns whether
 * the live KV write landed.
 */
export async function syncLinkTracked(
  linkId: string,
  hostname: string,
  slug: string,
  record: KvLinkRecord,
): Promise<boolean> {
  try {
    await syncLinkToKv(hostname, slug, record);
    await markKvSynced(linkId);
    return true;
  } catch (err) {
    console.error("link.kv_sync_failed", slug, err);
    await markKvSyncPending(linkId);
    return false;
  }
}

/** Narrow the loosely-typed layout columns to the splash union types. */
function toSplashLayout(row: {
  logoUrl: string | null;
  bgType: string;
  bgColor: string;
  bgImageUrl: string | null;
  blur: number;
  logoPosition: string;
  accentColor: string;
  textColor: string;
  countdownSeconds: number;
  showBranding: boolean;
}) {
  return {
    ...row,
    bgType: row.bgType === "image" ? ("image" as const) : ("color" as const),
    logoPosition:
      row.logoPosition === "top"
        ? ("top" as const)
        : row.logoPosition === "bottom"
          ? ("bottom" as const)
          : ("center" as const),
  };
}

/**
 * Resolve the interstitial config for a link's KV record. Free plans always get
 * the forced branded splash; paid plans get their assigned layout (or null for a
 * direct redirect). Mirrors the private resolver in `server/links.ts` so admin
 * actions can rebuild a faithful KV record outside the owner-scoped flow.
 */
export async function resolveSplashForLink(
  planKey: PlanKey,
  pageLayoutId: string | null,
): Promise<SplashConfig | null> {
  if (!pageLayoutId || !getPlan(planKey).customSplashEnabled) {
    return resolveSplash(planKey, null);
  }
  const db = getDb();
  const [layout] = await db
    .select({
      logoUrl: pageLayouts.logoUrl,
      bgType: pageLayouts.bgType,
      bgColor: pageLayouts.bgColor,
      bgImageUrl: pageLayouts.bgImageUrl,
      blur: pageLayouts.blur,
      logoPosition: pageLayouts.logoPosition,
      accentColor: pageLayouts.accentColor,
      textColor: pageLayouts.textColor,
      countdownSeconds: pageLayouts.countdownSeconds,
      showBranding: pageLayouts.showBranding,
    })
    .from(pageLayouts)
    .where(and(eq(pageLayouts.id, pageLayoutId), isNull(pageLayouts.deletedAt)))
    .limit(1);
  return resolveSplash(planKey, layout ? toSplashLayout(layout) : null);
}

/** Columns needed to rebuild a link's operational KV record. */
const ROW = {
  id: links.id,
  slug: links.slug,
  workspaceId: links.workspaceId,
  destinationUrl: links.destinationUrl,
  isActive: links.isActive,
  expiresAt: links.expiresAt,
  passwordHash: links.passwordHash,
  blockBots: links.blockBots,
  allowedCountries: links.allowedCountries,
  blockedCountries: links.blockedCountries,
  rateLimitPerMinute: links.rateLimitPerMinute,
} as const;

type LinkRow = {
  id: string;
  slug: string;
  workspaceId: string;
  destinationUrl: string;
  isActive: boolean;
  expiresAt: Date | null;
  passwordHash: string | null;
  blockBots: boolean;
  allowedCountries: string[] | null;
  blockedCountries: string[] | null;
  rateLimitPerMinute: number | null;
};

function recordFor(row: LinkRow, splash: SplashConfig | null): KvLinkRecord {
  return {
    linkId: row.id,
    workspaceId: row.workspaceId,
    destinationUrl: row.destinationUrl,
    active: row.isActive,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    passwordProtected: Boolean(row.passwordHash),
    blockBots: row.blockBots ?? false,
    allowedCountries: row.allowedCountries ?? [],
    blockedCountries: row.blockedCountries ?? [],
    rateLimitPerMinute: row.rateLimitPerMinute ?? null,
    splash,
    updatedAt: new Date().toISOString(),
  };
}

async function writeAll(rows: LinkRow[], splash: SplashConfig | null) {
  if (!rows.length) return;
  const domain = await getSystemDomain();
  await Promise.all(
    rows.map((row) =>
      syncLinkTracked(row.id, domain.hostname, row.slug, recordFor(row, splash)),
    ),
  );
}

/** Re-push the KV record for every link assigned to a layout, with `splash`. */
export async function resyncLinksUsingLayout(
  layoutId: string,
  splash: SplashConfig | null,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select(ROW)
    .from(links)
    .where(and(eq(links.pageLayoutId, layoutId), isNull(links.deletedAt)));
  await writeAll(rows, splash);
}

/** Re-push the KV record for a single link with the given `splash`. */
export async function resyncLink(
  linkId: string,
  splash: SplashConfig | null,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select(ROW)
    .from(links)
    .where(and(eq(links.id, linkId), isNull(links.deletedAt)))
    .limit(1);
  await writeAll(rows, splash);
}

export interface ResyncResult {
  scanned: number;
  resynced: number;
  failed: number;
}

/**
 * Drain the KV resync backlog: every live link flagged `kvSyncPending` (a prior
 * KV write failed) is rebuilt from authoritative Postgres state — including its
 * plan-resolved splash — and re-pushed. A successful push clears the flag; a
 * still-failing one leaves it set for the next run. Bounded by `limit` so a
 * single invocation can't run unbounded. Driven by the kv-resync cron (§11.6).
 */
export async function resyncPendingLinks(limit = 200): Promise<ResyncResult> {
  const db = getDb();
  const rows = await db
    .select({
      id: links.id,
      slug: links.slug,
      workspaceId: links.workspaceId,
      destinationUrl: links.destinationUrl,
      isActive: links.isActive,
      expiresAt: links.expiresAt,
      passwordHash: links.passwordHash,
      blockBots: links.blockBots,
      allowedCountries: links.allowedCountries,
      blockedCountries: links.blockedCountries,
      rateLimitPerMinute: links.rateLimitPerMinute,
      pageLayoutId: links.pageLayoutId,
      planKey: workspaces.planKey,
    })
    .from(links)
    .innerJoin(workspaces, eq(links.workspaceId, workspaces.id))
    .where(
      and(
        eq(links.kvSyncPending, true),
        isNull(links.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(limit);

  if (!rows.length) return { scanned: 0, resynced: 0, failed: 0 };

  const domain = await getSystemDomain();
  let resynced = 0;
  for (const row of rows) {
    const splash = await resolveSplashForLink(
      row.planKey as PlanKey,
      row.pageLayoutId,
    );
    const ok = await syncLinkTracked(
      row.id,
      domain.hostname,
      row.slug,
      recordFor(row, splash),
    );
    if (ok) resynced += 1;
  }

  return {
    scanned: rows.length,
    resynced,
    failed: rows.length - resynced,
  };
}
