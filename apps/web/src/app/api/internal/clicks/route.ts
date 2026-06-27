import { clicks, getDb, linkChannels, links, qrCodes } from "@linkview/db";
import { clickIngestSchema, type KvLinkRecord } from "@linkview/shared";
import { and, eq, sql } from "drizzle-orm";
import { channelLabel } from "@/lib/channel-labels";
import { clickIngestToken } from "@/lib/env";
import { syncLinkToKv } from "@/lib/kv";
import { publishClick } from "@/lib/realtime";
import { getSystemDomain } from "@/server/domain";

/**
 * Register a tracking channel the first time a real UTM source lands, so the
 * channels list reflects traffic that actually happened (no phantom channels).
 * Idempotent via the (link, source) unique index; best-effort so a hiccup here
 * never fails click ingestion.
 */
async function ensureChannel(
  db: ReturnType<typeof getDb>,
  c: {
    workspaceId: string;
    linkId: string;
    source: string;
    medium?: string | null;
    campaign?: string | null;
  },
): Promise<void> {
  try {
    await db
      .insert(linkChannels)
      .values({
        workspaceId: c.workspaceId,
        linkId: c.linkId,
        name: channelLabel(c.source),
        utmSource: c.source,
        utmMedium: c.medium ?? null,
        utmCampaign: c.campaign ?? null,
      })
      .onConflictDoNothing({
        target: [linkChannels.linkId, linkChannels.utmSource],
      });
  } catch (err) {
    console.error("channel.auto_create_failed", err);
  }
}

/**
 * Auto-deactivate a link that has reached its click cap and mirror the change
 * to KV so the Worker stops redirecting (§14.7). Best-effort: a handful of
 * clicks may slip through during KV propagation.
 */
async function enforceClickCap(
  workspaceId: string,
  row: {
    id: string;
    slug: string;
    destinationUrl: string;
    totalClicks: number;
    maxClicks: number | null;
    expiresAt: Date | null;
    passwordHash: string | null;
    blockBots: boolean;
    allowedCountries: string[] | null;
    blockedCountries: string[] | null;
    rateLimitPerMinute: number | null;
  },
): Promise<void> {
  if (row.maxClicks == null || row.totalClicks < row.maxClicks) return;
  const db = getDb();
  await db
    .update(links)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(links.id, row.id));
  try {
    const domain = await getSystemDomain();
    const record: KvLinkRecord = {
      linkId: row.id,
      workspaceId,
      destinationUrl: row.destinationUrl,
      active: false,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      passwordProtected: Boolean(row.passwordHash),
      blockBots: row.blockBots,
      allowedCountries: row.allowedCountries ?? [],
      blockedCountries: row.blockedCountries ?? [],
      rateLimitPerMinute: row.rateLimitPerMinute,
      updatedAt: new Date().toISOString(),
    };
    await syncLinkToKv(domain.hostname, row.slug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
  }
}

/** Ingest a click from the redirect Worker (§11.5). Bearer-protected. */
export async function POST(request: Request) {
  // Fail closed: without a configured token, anyone could POST forged clicks —
  // poisoning analytics and, worse, tripping a victim link's click cap to
  // deactivate it. Reject rather than wave the request through (matches the
  // billing webhook / cron behaviour).
  const token = clickIngestToken();
  if (!token) {
    console.error("clicks.ingest_token_unset");
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = clickIngestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload" }, { status: 422 });
  }
  const c = parsed.data;
  const occurredAt = c.occurredAt ? new Date(c.occurredAt) : new Date();

  const db = getDb();

  // Defense in depth: trust the DB for the link's owner, not the payload. A
  // forged `workspaceId` must never attribute clicks to — or trip the click cap
  // on — another tenant's link. Reject a click whose link doesn't exist, and
  // use the link's real workspace for everything downstream.
  const [linkRow] = await db
    .select({ workspaceId: links.workspaceId })
    .from(links)
    .where(eq(links.id, c.linkId))
    .limit(1);
  if (!linkRow) {
    return Response.json({ error: "unknown_link" }, { status: 404 });
  }
  const workspaceId = linkRow.workspaceId;

  // Attribute the scan to a QR code only when the marker is a real QR for this
  // link. Guards against a bogus `?qr=` (which would break the FK) and against
  // pointing one link's scan at another link's QR.
  let qrCodeId: string | null = null;
  if (c.qrCodeId) {
    const [qr] = await db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(and(eq(qrCodes.id, c.qrCodeId), eq(qrCodes.linkId, c.linkId)))
      .limit(1);
    qrCodeId = qr?.id ?? null;
  }

  await db.insert(clicks).values({
    linkId: c.linkId,
    workspaceId,
    qrCodeId,
    occurredAt,
    ipHash: c.ipHash,
    userAgent: c.userAgent,
    referer: c.referer,
    country: c.country,
    region: c.region,
    city: c.city,
    device: c.device,
    browser: c.browser,
    os: c.os,
    bot: c.bot ?? false,
    source: c.source,
    medium: c.medium,
    campaign: c.campaign,
  });

  // Denormalized counters (§16.2) — skip bots from totals.
  if (!c.bot) {
    const [updated] = await db
      .update(links)
      .set({
        totalClicks: sql`${links.totalClicks} + 1`,
        lastClickedAt: occurredAt,
      })
      .where(eq(links.id, c.linkId))
      .returning({
        id: links.id,
        slug: links.slug,
        destinationUrl: links.destinationUrl,
        totalClicks: links.totalClicks,
        maxClicks: links.maxClicks,
        isActive: links.isActive,
        expiresAt: links.expiresAt,
        passwordHash: links.passwordHash,
        blockBots: links.blockBots,
        allowedCountries: links.allowedCountries,
        blockedCountries: links.blockedCountries,
        rateLimitPerMinute: links.rateLimitPerMinute,
      });
    if (updated?.isActive) {
      await enforceClickCap(workspaceId, updated);
    }
    // A real UTM hit registers its channel (idempotent, no phantom channels).
    if (c.source) {
      await ensureChannel(db, {
        workspaceId,
        linkId: c.linkId,
        source: c.source,
        medium: c.medium,
        campaign: c.campaign,
      });
    }
    // Push the new click to any open dashboard so its tabs refresh live.
    if (updated) {
      await publishClick(workspaceId, {
        linkId: updated.id,
        slug: updated.slug,
      });
    }
  }

  return Response.json({ ok: true });
}
