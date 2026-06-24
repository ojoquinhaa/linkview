import "server-only";
import { clicks, getDb, links } from "@linkview/db";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { channelLabel, QR_CHANNEL_KEY } from "@/lib/channel-labels";
import type { Breakdown, ChannelTrends } from "./links-query";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HOURS_WINDOW = 48;

/** Allowed period windows for the dashboard filter (days). */
export const PERIODS = [7, 14, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export interface ChannelOption {
  /** UTM source value, or {@link QR_CHANNEL_KEY} for QR scans. */
  key: string;
  label: string;
  total: number;
}

export interface TopLink {
  id: string;
  slug: string;
  title: string | null;
  isActive: boolean;
  clicks: number;
  unique: number;
}

export interface WorkspaceOverview {
  days: number;
  /** Selected channel filter, or null for the whole operation. */
  canal: string | null;
  kpis: {
    clicks: number;
    unique: number;
    clicksPrev: number;
    uniquePrev: number;
    todayClicks: number;
    todayUnique: number;
    activeLinks: number;
    totalLinks: number;
    qrScans: number;
    channelsCount: number;
  };
  byDay: { date: string; total: number; unique: number }[];
  byHour: { hour: string; total: number; unique: number }[];
  topLinks: TopLink[];
  devices: Breakdown[];
  sources: Breakdown[];
  geoCountries: Breakdown[];
  geoRegions: Breakdown[];
  locatedTotal: number;
  /** Filter options (always the full operation, never scoped by `canal`). */
  channels: ChannelOption[];
}

/** Narrow a click query to the selected channel (a UTM source or all QR). */
function channelCond(canal: string | null): SQL | undefined {
  if (!canal) return undefined;
  if (canal === QR_CHANNEL_KEY) return isNotNull(clicks.qrCodeId);
  return eq(clicks.source, canal);
}

const num = (v: unknown) => Number(v ?? 0);

/**
 * Operation-wide analytics for a workspace over a trailing window, optionally
 * scoped to one channel. Powers the `/dashboard` summary: KPIs (with a previous
 * period delta), a click trend, the busiest links, device / channel / geo
 * breakdowns, and the unscoped channel list that feeds the filter.
 */
export async function getWorkspaceOverview(
  workspaceId: string,
  days = 14,
  canal: string | null = null,
): Promise<WorkspaceOverview> {
  const db = getDb();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  hourStart.setTime(hourStart.getTime() - (HOURS_WINDOW - 1) * HOUR_MS);

  const ws = eq(clicks.workspaceId, workspaceId);
  const sc = channelCond(canal);
  const inWindow = and(ws, gte(clicks.occurredAt, start), sc);

  const topBy = (col: typeof clicks.device | typeof clicks.source) =>
    db
      .select({ key: sql<string>`${col}`, total: count() })
      .from(clicks)
      .where(and(ws, gte(clicks.occurredAt, start), isNotNull(col), sc))
      .groupBy(sql`${col}`)
      .orderBy(desc(count()))
      .limit(6);

  const [
    dayRows,
    hourRows,
    windowAgg,
    prevAgg,
    todayAgg,
    linkCounts,
    devices,
    sources,
    geoCountries,
    geoRegions,
    qrScanRow,
    linkStats,
    channelSources,
    qrTotalRow,
  ] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${clicks.occurredAt}), 'YYYY-MM-DD')`,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(inWindow)
      .groupBy(sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({
        hour: sql<number>`floor(extract(epoch from ${clicks.occurredAt}) / 3600)::int`,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(and(ws, gte(clicks.occurredAt, hourStart), sc))
      .groupBy(sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`),
    db
      .select({ total: count(), unique: countDistinct(clicks.ipHash) })
      .from(clicks)
      .where(inWindow),
    db
      .select({ total: count(), unique: countDistinct(clicks.ipHash) })
      .from(clicks)
      .where(
        and(
          ws,
          gte(clicks.occurredAt, prevStart),
          lt(clicks.occurredAt, start),
          sc,
        ),
      ),
    db
      .select({ total: count(), unique: countDistinct(clicks.ipHash) })
      .from(clicks)
      .where(and(ws, gte(clicks.occurredAt, todayStart), sc)),
    db
      .select({
        linkId: clicks.linkId,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(inWindow)
      .groupBy(clicks.linkId)
      .orderBy(desc(count()))
      .limit(6),
    topBy(clicks.device),
    topBy(clicks.source),
    db
      .select({ key: sql<string>`${clicks.country}`, total: count() })
      .from(clicks)
      .where(
        and(ws, gte(clicks.occurredAt, start), isNotNull(clicks.country), sc),
      )
      .groupBy(clicks.country)
      .orderBy(desc(count())),
    db
      .select({ key: sql<string>`${clicks.region}`, total: count() })
      .from(clicks)
      .where(
        and(
          ws,
          gte(clicks.occurredAt, start),
          eq(clicks.country, "BR"),
          isNotNull(clicks.region),
          sc,
        ),
      )
      .groupBy(clicks.region)
      .orderBy(desc(count())),
    db
      .select({ total: count() })
      .from(clicks)
      .where(
        and(ws, gte(clicks.occurredAt, start), isNotNull(clicks.qrCodeId)),
      ),
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${links.isActive})`,
      })
      .from(links)
      .where(and(eq(links.workspaceId, workspaceId), isNull(links.deletedAt))),
    db
      .select({ key: clicks.source, total: count() })
      .from(clicks)
      .where(and(ws, isNotNull(clicks.source)))
      .groupBy(clicks.source)
      .orderBy(desc(count())),
    db
      .select({ total: count() })
      .from(clicks)
      .where(and(ws, isNotNull(clicks.qrCodeId))),
  ]);

  // Zero-filled daily axis.
  const dayBuckets = new Map(
    dayRows.map((r) => [r.day, { total: num(r.total), unique: num(r.unique) }]),
  );
  const byDay: { date: string; total: number; unique: number }[] = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(start.getTime() + i * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const b = dayBuckets.get(key);
    byDay.push({ date: key, total: b?.total ?? 0, unique: b?.unique ?? 0 });
  }

  // Zero-filled hourly axis (trailing 48 h).
  const hourBuckets = new Map(
    hourRows.map((r) => [
      Number(r.hour),
      { total: num(r.total), unique: num(r.unique) },
    ]),
  );
  const firstHour = Math.floor(hourStart.getTime() / HOUR_MS);
  const byHour: { hour: string; total: number; unique: number }[] = [];
  for (let i = 0; i < HOURS_WINDOW; i++) {
    const b = hourBuckets.get(firstHour + i);
    byHour.push({
      hour: new Date((firstHour + i) * HOUR_MS).toISOString(),
      total: b?.total ?? 0,
      unique: b?.unique ?? 0,
    });
  }

  // Resolve the busiest links to their slug/title, preserving the click order.
  const linkIds = linkCounts.map((r) => r.linkId);
  const linkRows = linkIds.length
    ? await db
        .select({
          id: links.id,
          slug: links.slug,
          title: links.title,
          isActive: links.isActive,
        })
        .from(links)
        .where(inArray(links.id, linkIds))
    : [];
  const linkMap = new Map(linkRows.map((l) => [l.id, l]));
  const topLinks: TopLink[] = linkCounts.flatMap((r) => {
    const l = linkMap.get(r.linkId);
    return l
      ? [
          {
            id: l.id,
            slug: l.slug,
            title: l.title,
            isActive: l.isActive,
            clicks: num(r.total),
            unique: num(r.unique),
          },
        ]
      : [];
  });

  const mapRows = (rows: { key: string; total: number }[]): Breakdown[] =>
    rows.map((r) => ({ key: r.key, total: num(r.total) }));
  const geo = mapRows(geoCountries);
  const locatedTotal = geo.reduce((s, r) => s + r.total, 0);

  // Filter options: every channel the operation has ever seen, QR included.
  const qrTotalAll = num(qrTotalRow[0]?.total);
  const channels: ChannelOption[] = channelSources
    .filter((r): r is { key: string; total: number } => Boolean(r.key))
    .map((r) => ({
      key: r.key,
      label: channelLabel(r.key),
      total: num(r.total),
    }));
  if (qrTotalAll > 0) {
    channels.push({ key: QR_CHANNEL_KEY, label: "QR Code", total: qrTotalAll });
  }
  channels.sort((a, b) => b.total - a.total);

  return {
    days,
    canal,
    kpis: {
      clicks: num(windowAgg[0]?.total),
      unique: num(windowAgg[0]?.unique),
      clicksPrev: num(prevAgg[0]?.total),
      uniquePrev: num(prevAgg[0]?.unique),
      todayClicks: num(todayAgg[0]?.total),
      todayUnique: num(todayAgg[0]?.unique),
      activeLinks: num(linkStats[0]?.active),
      totalLinks: num(linkStats[0]?.total),
      qrScans: num(qrScanRow[0]?.total),
      channelsCount: channels.filter((c) => c.key !== QR_CHANNEL_KEY).length,
    },
    byDay,
    byHour,
    topLinks,
    devices: mapRows(devices),
    sources: mapRows(sources),
    geoCountries: geo,
    geoRegions: mapRows(geoRegions),
    locatedTotal,
    channels,
  };
}

const MAX_CHANNEL_SERIES = 5;

/**
 * Workspace-wide version of the per-link channel trends: one line per top UTM
 * source plus an aggregated QR line, scoped to the same window (and optional
 * channel filter) as {@link getWorkspaceOverview}.
 */
export async function getWorkspaceChannelTrends(
  workspaceId: string,
  days = 14,
  canal: string | null = null,
): Promise<ChannelTrends> {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  hourStart.setTime(hourStart.getTime() - (HOURS_WINDOW - 1) * HOUR_MS);

  const ws = eq(clicks.workspaceId, workspaceId);
  const sc = channelCond(canal);
  // Fresh sql each call: a drizzle `sql` fragment is consumed when a query is
  // built, so reusing one instance across queries corrupts the later ones.
  const dayExpr = () =>
    sql<string>`to_char(date_trunc('day', ${clicks.occurredAt}), 'YYYY-MM-DD')`;
  const hourExpr = () =>
    sql<number>`floor(extract(epoch from ${clicks.occurredAt}) / 3600)::int`;

  const [srcDay, srcHour, qrDay, qrHour] = await Promise.all([
    db
      .select({ key: clicks.source, day: dayExpr(), total: count() })
      .from(clicks)
      .where(
        and(ws, gte(clicks.occurredAt, start), isNotNull(clicks.source), sc),
      )
      .groupBy(clicks.source, sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({ key: clicks.source, hour: hourExpr(), total: count() })
      .from(clicks)
      .where(
        and(
          ws,
          gte(clicks.occurredAt, hourStart),
          isNotNull(clicks.source),
          sc,
        ),
      )
      .groupBy(
        clicks.source,
        sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`,
      ),
    db
      .select({ day: dayExpr(), total: count() })
      .from(clicks)
      .where(and(ws, gte(clicks.occurredAt, start), isNotNull(clicks.qrCodeId)))
      .groupBy(sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({ hour: hourExpr(), total: count() })
      .from(clicks)
      .where(
        and(ws, gte(clicks.occurredAt, hourStart), isNotNull(clicks.qrCodeId)),
      )
      .groupBy(sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`),
  ]);

  const days_: string[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = new Date(start.getTime() + i * DAY_MS)
      .toISOString()
      .slice(0, 10);
    dayIndex.set(key, i);
    days_.push(key);
  }
  const firstHour = Math.floor(hourStart.getTime() / HOUR_MS);
  const hours: string[] = [];
  for (let i = 0; i < HOURS_WINDOW; i++) {
    hours.push(new Date((firstHour + i) * HOUR_MS).toISOString());
  }

  const bySource = new Map<string, { byDay: number[]; byHour: number[] }>();
  const ensure = (key: string) => {
    let s = bySource.get(key);
    if (!s) {
      s = {
        byDay: new Array(days).fill(0),
        byHour: new Array(HOURS_WINDOW).fill(0),
      };
      bySource.set(key, s);
    }
    return s;
  };
  for (const r of srcDay) {
    if (!r.key) continue;
    const i = dayIndex.get(r.day);
    if (i != null) ensure(r.key).byDay[i] = num(r.total);
  }
  for (const r of srcHour) {
    if (!r.key) continue;
    const i = Number(r.hour) - firstHour;
    if (i >= 0 && i < HOURS_WINDOW) ensure(r.key).byHour[i] = num(r.total);
  }

  const series = [...bySource.entries()]
    .map(([key, s]) => ({
      key,
      label: channelLabel(key),
      total: s.byDay.reduce((a, b) => a + b, 0),
      byDay: s.byDay,
      byHour: s.byHour,
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_CHANNEL_SERIES);

  const qrByDay = new Array(days).fill(0);
  for (const r of qrDay) {
    const i = dayIndex.get(r.day);
    if (i != null) qrByDay[i] = num(r.total);
  }
  const qrByHour = new Array(HOURS_WINDOW).fill(0);
  for (const r of qrHour) {
    const i = Number(r.hour) - firstHour;
    if (i >= 0 && i < HOURS_WINDOW) qrByHour[i] = num(r.total);
  }
  const qrTotal = qrByDay.reduce((a: number, b: number) => a + b, 0);
  if (qrTotal > 0) {
    series.push({
      key: QR_CHANNEL_KEY,
      label: "QR Code",
      total: qrTotal,
      byDay: qrByDay,
      byHour: qrByHour,
    });
  }

  return { days: days_, hours, series };
}
