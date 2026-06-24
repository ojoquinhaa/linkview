import "server-only";
import { clicks, getDb, linkChannels, links, qrCodes } from "@linkview/db";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { channelLabel, QR_CHANNEL_KEY } from "@/lib/channel-labels";

export interface LinkListItem {
  id: string;
  slug: string;
  destinationUrl: string;
  title: string | null;
  totalClicks: number;
  uniqueClicks: number;
  isActive: boolean;
  expiresAt: Date | null;
  lastClickedAt: Date | null;
  createdAt: Date;
}

export async function listLinks(workspaceId: string): Promise<LinkListItem[]> {
  const db = getDb();
  return db
    .select({
      id: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      title: links.title,
      totalClicks: links.totalClicks,
      // Visitors are computed live from distinct IPs (non-bot) so the count
      // matches the detail analytics; the denormalized column drifts because
      // ingest only maintains totalClicks.
      uniqueClicks:
        sql<number>`coalesce((select count(distinct ${clicks.ipHash}) from ${clicks} where ${clicks.linkId} = ${links.id} and ${clicks.bot} = false), 0)`.mapWith(
          Number,
        ),
      isActive: links.isActive,
      expiresAt: links.expiresAt,
      lastClickedAt: links.lastClickedAt,
      createdAt: links.createdAt,
    })
    .from(links)
    .where(and(eq(links.workspaceId, workspaceId), isNull(links.deletedAt)))
    .orderBy(desc(links.createdAt));
}

export interface LinkDetail extends LinkListItem {
  destinationUrl: string;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  uniqueClicks: number;
  updatedAt: Date;
  /** Whether a password is set (the hash itself never leaves the server). */
  hasPassword: boolean;
  maxClicks: number | null;
  blockBots: boolean;
  allowedCountries: string[] | null;
  blockedCountries: string[] | null;
  rateLimitPerMinute: number | null;
  pageLayoutId: string | null;
}

/** Single link the workspace owns, by slug. Null when missing or deleted. */
export async function getLinkBySlug(
  workspaceId: string,
  slug: string,
): Promise<LinkDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      title: links.title,
      description: links.description,
      ogTitle: links.ogTitle,
      ogDescription: links.ogDescription,
      ogImageUrl: links.ogImageUrl,
      totalClicks: links.totalClicks,
      // Live distinct-IP count (see listLinks) — keeps the detail card in step
      // with the analytics "visitantes" figure.
      uniqueClicks:
        sql<number>`coalesce((select count(distinct ${clicks.ipHash}) from ${clicks} where ${clicks.linkId} = ${links.id} and ${clicks.bot} = false), 0)`.mapWith(
          Number,
        ),
      isActive: links.isActive,
      expiresAt: links.expiresAt,
      lastClickedAt: links.lastClickedAt,
      createdAt: links.createdAt,
      updatedAt: links.updatedAt,
      passwordHash: links.passwordHash,
      maxClicks: links.maxClicks,
      blockBots: links.blockBots,
      allowedCountries: links.allowedCountries,
      blockedCountries: links.blockedCountries,
      rateLimitPerMinute: links.rateLimitPerMinute,
      pageLayoutId: links.pageLayoutId,
    })
    .from(links)
    .where(
      and(
        eq(links.workspaceId, workspaceId),
        eq(links.slug, slug),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const { passwordHash, ...rest } = row;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

export interface Breakdown {
  key: string;
  total: number;
}

export interface ClickRow {
  occurredAt: Date;
  device: string | null;
  os: string | null;
  browser: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  source: string | null;
}

export interface ClicksPage {
  rows: ClickRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LinkAnalytics {
  /** Daily totals for the trailing `days` window, oldest first, zero-filled.
   *  `unique` is the distinct-visitor count in the bucket (`total` ≥ `unique`). */
  byDay: { date: string; total: number; unique: number }[];
  /** Hourly totals for the trailing 48 h, oldest first, zero-filled. */
  byHour: { hour: string; total: number; unique: number }[];
  devices: Breakdown[];
  countries: Breakdown[];
  /** Every located country (ISO alpha-2 in `key`), all-time, for the map. */
  geoCountries: Breakdown[];
  /** Brazilian clicks by region (`key` = whatever the edge stored), all-time. */
  geoRegions: Breakdown[];
  sources: Breakdown[];
  windowTotal: number;
  /** Clicks with a known country, all-time. Lets the UI show located share. */
  locatedTotal: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HOURS_WINDOW = 48;

/** Click analytics for a single link over a trailing window (default 14 days). */
export async function getLinkAnalytics(
  linkId: string,
  days = 14,
): Promise<LinkAnalytics> {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);

  // Hourly window: floor to the current hour, then step back 47 hours.
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  hourStart.setTime(hourStart.getTime() - (HOURS_WINDOW - 1) * HOUR_MS);

  const topBy = (col: SQLWrapper) =>
    db
      .select({ key: sql<string>`${col}`, total: count() })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), isNotNull(col)))
      .groupBy(sql`${col}`)
      .orderBy(desc(count()))
      .limit(5);

  const [
    dayRows,
    hourRows,
    devices,
    countries,
    geoCountries,
    geoRegions,
    sources,
  ] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${clicks.occurredAt}), 'YYYY-MM-DD')`,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), gte(clicks.occurredAt, start)))
      .groupBy(sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({
        // Epoch hour index: timezone-independent, so JS and SQL agree on buckets.
        hour: sql<number>`floor(extract(epoch from ${clicks.occurredAt}) / 3600)::int`,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), gte(clicks.occurredAt, hourStart)))
      .groupBy(sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`),
    topBy(clicks.device),
    topBy(clicks.country),
    db
      .select({ key: sql<string>`${clicks.country}`, total: count() })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), isNotNull(clicks.country)))
      .groupBy(clicks.country)
      .orderBy(desc(count())),
    db
      .select({ key: sql<string>`${clicks.region}`, total: count() })
      .from(clicks)
      .where(
        and(
          eq(clicks.linkId, linkId),
          eq(clicks.country, "BR"),
          isNotNull(clicks.region),
        ),
      )
      .groupBy(clicks.region)
      .orderBy(desc(count())),
    topBy(clicks.source),
  ]);

  const dayBuckets = new Map(
    dayRows.map((r) => [
      r.day,
      { total: Number(r.total), unique: Number(r.unique) },
    ]),
  );
  const byDay: { date: string; total: number; unique: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const b = dayBuckets.get(key);
    byDay.push({ date: key, total: b?.total ?? 0, unique: b?.unique ?? 0 });
  }
  const windowTotal = byDay.reduce((s, d) => s + d.total, 0);

  // Zero-fill the hourly window by epoch-hour index, then emit an ISO timestamp
  // per bucket so the chart formats day + hour itself.
  const hourBuckets = new Map(
    hourRows.map((r) => [
      Number(r.hour),
      { total: Number(r.total), unique: Number(r.unique) },
    ]),
  );
  const firstHour = Math.floor(hourStart.getTime() / HOUR_MS);
  const byHour: { hour: string; total: number; unique: number }[] = [];
  for (let i = 0; i < HOURS_WINDOW; i++) {
    const idx = firstHour + i;
    const b = hourBuckets.get(idx);
    byHour.push({
      hour: new Date(idx * HOUR_MS).toISOString(),
      total: b?.total ?? 0,
      unique: b?.unique ?? 0,
    });
  }

  const map = (rows: { key: string; total: number }[]): Breakdown[] =>
    rows.map((r) => ({ key: r.key, total: Number(r.total) }));

  const geo = map(geoCountries);
  const locatedTotal = geo.reduce((s, r) => s + r.total, 0);

  return {
    byDay,
    byHour,
    devices: map(devices),
    countries: map(countries),
    geoCountries: geo,
    geoRegions: map(geoRegions),
    sources: map(sources),
    windowTotal,
    locatedTotal,
  };
}

export interface LinkChannel {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
  clicks: number;
  /** Distinct visitors for this channel (`unique` ≤ `clicks`). */
  unique: number;
  createdAt: Date;
}

/**
 * Tracking channels for a link, newest first, each annotated with its real
 * click total (clicks whose `source` matches the channel's `utm_source`).
 */
export async function getLinkChannels(linkId: string): Promise<LinkChannel[]> {
  const db = getDb();
  const [rows, sourceCounts] = await Promise.all([
    db
      .select({
        id: linkChannels.id,
        name: linkChannels.name,
        utmSource: linkChannels.utmSource,
        utmMedium: linkChannels.utmMedium,
        utmCampaign: linkChannels.utmCampaign,
        createdAt: linkChannels.createdAt,
      })
      .from(linkChannels)
      .where(eq(linkChannels.linkId, linkId))
      .orderBy(desc(linkChannels.createdAt)),
    db
      .select({
        source: clicks.source,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), isNotNull(clicks.source)))
      .groupBy(clicks.source),
  ]);

  const counts = new Map(
    sourceCounts.map((r) => [
      r.source,
      { clicks: Number(r.total), unique: Number(r.unique) },
    ]),
  );
  return rows.map((r) => ({
    ...r,
    clicks: counts.get(r.utmSource)?.clicks ?? 0,
    unique: counts.get(r.utmSource)?.unique ?? 0,
  }));
}

export interface LinkQrCode {
  id: string;
  name: string;
  /** Total scans recorded for this QR code (all-time). */
  scans: number;
  /** Distinct visitors among the scans (`unique` ≤ `scans`). */
  unique: number;
  createdAt: Date;
}

/**
 * QR codes for a link, newest first, each annotated with its scan total and
 * distinct-visitor count (clicks whose `qrCodeId` matches). Mirrors
 * {@link getLinkChannels}: counts derive from `clicks`, not a denormalized
 * counter, so they can never drift.
 */
export async function getLinkQrCodes(linkId: string): Promise<LinkQrCode[]> {
  const db = getDb();
  const [rows, scanCounts] = await Promise.all([
    db
      .select({
        id: qrCodes.id,
        name: qrCodes.name,
        createdAt: qrCodes.createdAt,
      })
      .from(qrCodes)
      .where(eq(qrCodes.linkId, linkId))
      .orderBy(desc(qrCodes.createdAt)),
    db
      .select({
        qrCodeId: clicks.qrCodeId,
        total: count(),
        unique: countDistinct(clicks.ipHash),
      })
      .from(clicks)
      .where(and(eq(clicks.linkId, linkId), isNotNull(clicks.qrCodeId)))
      .groupBy(clicks.qrCodeId),
  ]);

  const counts = new Map(
    scanCounts.map((r) => [
      r.qrCodeId,
      { scans: Number(r.total), unique: Number(r.unique) },
    ]),
  );
  return rows.map((r) => ({
    ...r,
    scans: counts.get(r.id)?.scans ?? 0,
    unique: counts.get(r.id)?.unique ?? 0,
  }));
}

export interface ChannelSeries {
  /** UTM source value, or {@link QR_CHANNEL_KEY} for the aggregated QR line. */
  key: string;
  label: string;
  /** Window total, used for ranking and the legend. */
  total: number;
  /** Click counts aligned to {@link ChannelTrends.days}, zero-filled. */
  byDay: number[];
  /** Click counts aligned to {@link ChannelTrends.hours}, zero-filled. */
  byHour: number[];
}

export interface ChannelTrends {
  /** ISO day keys (`YYYY-MM-DD`), oldest first — the daily x-axis. */
  days: string[];
  /** ISO hour timestamps, oldest first — the hourly x-axis. */
  hours: string[];
  /** Top channels by window total, plus the QR line when it has scans. */
  series: ChannelSeries[];
}

const MAX_CHANNEL_SERIES = 5;

/**
 * Per-channel click trends for a link: one series per top UTM source plus an
 * aggregated "QR Code" series, each as a daily (trailing `days`) and hourly
 * (trailing 48 h) zero-filled line. Mirrors {@link getLinkAnalytics}' windowing
 * so the channels chart shares the overview's time axes.
 */
export async function getChannelTrends(
  linkId: string,
  days = 14,
): Promise<ChannelTrends> {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);

  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  hourStart.setTime(hourStart.getTime() - (HOURS_WINDOW - 1) * HOUR_MS);

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
        and(
          eq(clicks.linkId, linkId),
          gte(clicks.occurredAt, start),
          isNotNull(clicks.source),
        ),
      )
      .groupBy(clicks.source, sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({ key: clicks.source, hour: hourExpr(), total: count() })
      .from(clicks)
      .where(
        and(
          eq(clicks.linkId, linkId),
          gte(clicks.occurredAt, hourStart),
          isNotNull(clicks.source),
        ),
      )
      .groupBy(
        clicks.source,
        sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`,
      ),
    db
      .select({ day: dayExpr(), total: count() })
      .from(clicks)
      .where(
        and(
          eq(clicks.linkId, linkId),
          gte(clicks.occurredAt, start),
          isNotNull(clicks.qrCodeId),
        ),
      )
      .groupBy(sql`date_trunc('day', ${clicks.occurredAt})`),
    db
      .select({ hour: hourExpr(), total: count() })
      .from(clicks)
      .where(
        and(
          eq(clicks.linkId, linkId),
          gte(clicks.occurredAt, hourStart),
          isNotNull(clicks.qrCodeId),
        ),
      )
      .groupBy(sql`floor(extract(epoch from ${clicks.occurredAt}) / 3600)`),
  ]);

  // Shared axes — same windowing as getLinkAnalytics so the charts line up.
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

  // Accumulate per-source aligned arrays.
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
    if (i != null) ensure(r.key).byDay[i] = Number(r.total);
  }
  for (const r of srcHour) {
    if (!r.key) continue;
    const i = Number(r.hour) - firstHour;
    if (i >= 0 && i < HOURS_WINDOW) ensure(r.key).byHour[i] = Number(r.total);
  }

  const sourceSeries: ChannelSeries[] = [...bySource.entries()]
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

  // Aggregated QR line, always appended when it has any scans.
  const qrByDay = new Array(days).fill(0);
  for (const r of qrDay) {
    const i = dayIndex.get(r.day);
    if (i != null) qrByDay[i] = Number(r.total);
  }
  const qrByHour = new Array(HOURS_WINDOW).fill(0);
  for (const r of qrHour) {
    const i = Number(r.hour) - firstHour;
    if (i >= 0 && i < HOURS_WINDOW) qrByHour[i] = Number(r.total);
  }
  const qrTotal = qrByDay.reduce((a: number, b: number) => a + b, 0);

  const series = [...sourceSeries];
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
