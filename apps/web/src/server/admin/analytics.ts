import "server-only";
import {
  billingEvents,
  clicks,
  getDb,
  links,
  plans,
  subscriptions,
  user,
  workspaces,
} from "@linkview/db";
import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";

const DAY_MS = 86_400_000;

/** Allowed period windows for the admin console filter (days). */
export const ADMIN_PERIODS = [7, 14, 30, 90] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];

/** Asaas event types that represent settled, counted revenue. */
const PAID_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
/** Asaas event types that represent money given back. */
const REFUND_EVENTS = ["PAYMENT_REFUNDED"];

export interface TimePoint {
  date: string;
  total: number;
}

export interface PlatformOverview {
  days: number;
  kpis: {
    /** Monthly recurring revenue: Σ plan price over active subscriptions. */
    mrrCents: number;
    /** Settled revenue in the window, and the previous window for the delta. */
    revenueCents: number;
    revenuePrevCents: number;
    /** Money refunded in the window. */
    refundsCents: number;
    refundsCount: number;
    totalUsers: number;
    newUsers: number;
    newUsersPrev: number;
    totalWorkspaces: number;
    payingWorkspaces: number;
    trialingWorkspaces: number;
    totalLinks: number;
    activeLinks: number;
    /** All-time redirects (clicks). */
    totalClicks: number;
    clicksWindow: number;
    clicksToday: number;
  };
  /** Settled revenue (in cents) per day across the window. */
  revenueByDay: TimePoint[];
  /** New sign-ups per day across the window. */
  signupsByDay: TimePoint[];
  /** Redirects per day across the window. */
  clicksByDay: TimePoint[];
  /** Active workspaces grouped by plan key. */
  planDistribution: { key: string; total: number }[];
}

const num = (v: unknown) => Number(v ?? 0);
const toCents = (reais: unknown) => Math.round(Number(reais ?? 0) * 100);

/** Σ of the Asaas payment value (reais) over billing events of the given types. */
function eventValueSum(types: string[], extra?: SQL) {
  const db = getDb();
  return db
    .select({
      sum: sql<string>`coalesce(sum((${billingEvents.payload}->'payment'->>'value')::numeric), 0)`,
      n: count(),
    })
    .from(billingEvents)
    .where(and(inArray(billingEvents.eventType, types), extra));
}

/**
 * Platform-wide analytics for the admin console over a trailing window: revenue
 * (MRR + settled), refunds, customers, growth, links, and redirects, plus the
 * daily series that back the charts. Revenue is reconstructed from the stored
 * Asaas webhook payloads (`billing_events`), so it reflects money actually
 * confirmed by the provider rather than list prices.
 */
export async function getPlatformOverview(
  days = 30,
): Promise<PlatformOverview> {
  const db = getDb();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dayExpr = (col: SQLWrapper) =>
    sql<string>`to_char(date_trunc('day', ${col}), 'YYYY-MM-DD')`;

  const [
    mrrRow,
    revenueRow,
    revenuePrevRow,
    refundsRow,
    revenueDayRows,
    usersRow,
    newUsersRow,
    newUsersPrevRow,
    signupDayRows,
    workspacesRow,
    subStatusRows,
    planDistRows,
    linkStatsRow,
    clicksTotalRow,
    clicksWindowRow,
    clicksTodayRow,
    clicksDayRows,
  ] = await Promise.all([
    db
      .select({
        sum: sql<number>`coalesce(sum(${plans.priceCents}), 0)`,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.status, "active")),
    eventValueSum(PAID_EVENTS, gte(billingEvents.createdAt, start)),
    eventValueSum(
      PAID_EVENTS,
      and(
        gte(billingEvents.createdAt, prevStart),
        lt(billingEvents.createdAt, start),
      ),
    ),
    eventValueSum(REFUND_EVENTS, gte(billingEvents.createdAt, start)),
    db
      .select({
        day: dayExpr(billingEvents.createdAt),
        sum: sql<string>`coalesce(sum((${billingEvents.payload}->'payment'->>'value')::numeric), 0)`,
      })
      .from(billingEvents)
      .where(
        and(
          inArray(billingEvents.eventType, PAID_EVENTS),
          gte(billingEvents.createdAt, start),
        ),
      )
      .groupBy(sql`date_trunc('day', ${billingEvents.createdAt})`),
    db.select({ total: count() }).from(user).where(isNull(user.deletedAt)),
    db
      .select({ total: count() })
      .from(user)
      .where(and(isNull(user.deletedAt), gte(user.createdAt, start))),
    db
      .select({ total: count() })
      .from(user)
      .where(
        and(
          isNull(user.deletedAt),
          gte(user.createdAt, prevStart),
          lt(user.createdAt, start),
        ),
      ),
    db
      .select({
        day: dayExpr(user.createdAt),
        total: count(),
      })
      .from(user)
      .where(and(isNull(user.deletedAt), gte(user.createdAt, start)))
      .groupBy(sql`date_trunc('day', ${user.createdAt})`),
    db
      .select({ total: count() })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt)),
    db
      .select({ status: subscriptions.status, total: count() })
      .from(subscriptions)
      .groupBy(subscriptions.status),
    db
      .select({ key: workspaces.planKey, total: count() })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt))
      .groupBy(workspaces.planKey),
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${links.isActive})`,
      })
      .from(links)
      .where(isNull(links.deletedAt)),
    db.select({ total: count() }).from(clicks),
    db
      .select({ total: count() })
      .from(clicks)
      .where(gte(clicks.occurredAt, start)),
    db
      .select({ total: count() })
      .from(clicks)
      .where(gte(clicks.occurredAt, todayStart)),
    db
      .select({
        day: dayExpr(clicks.occurredAt),
        total: count(),
      })
      .from(clicks)
      .where(gte(clicks.occurredAt, start))
      .groupBy(sql`date_trunc('day', ${clicks.occurredAt})`),
  ]);

  // Zero-filled daily axes shared by every series.
  const axis: string[] = [];
  for (let i = 0; i < days; i++) {
    axis.push(
      new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
    );
  }
  const fill = (rows: { day: string; value: number }[]): TimePoint[] => {
    const map = new Map(rows.map((r) => [r.day, r.value]));
    return axis.map((date) => ({ date, total: map.get(date) ?? 0 }));
  };

  const subCounts = new Map(subStatusRows.map((r) => [r.status, num(r.total)]));

  return {
    days,
    kpis: {
      mrrCents: num(mrrRow[0]?.sum),
      revenueCents: toCents(revenueRow[0]?.sum),
      revenuePrevCents: toCents(revenuePrevRow[0]?.sum),
      refundsCents: toCents(refundsRow[0]?.sum),
      refundsCount: num(refundsRow[0]?.n),
      totalUsers: num(usersRow[0]?.total),
      newUsers: num(newUsersRow[0]?.total),
      newUsersPrev: num(newUsersPrevRow[0]?.total),
      totalWorkspaces: num(workspacesRow[0]?.total),
      payingWorkspaces: subCounts.get("active") ?? 0,
      trialingWorkspaces: subCounts.get("trialing") ?? 0,
      totalLinks: num(linkStatsRow[0]?.total),
      activeLinks: num(linkStatsRow[0]?.active),
      totalClicks: num(clicksTotalRow[0]?.total),
      clicksWindow: num(clicksWindowRow[0]?.total),
      clicksToday: num(clicksTodayRow[0]?.total),
    },
    revenueByDay: fill(
      revenueDayRows.map((r) => ({ day: r.day, value: toCents(r.sum) })),
    ),
    signupsByDay: fill(
      signupDayRows.map((r) => ({ day: r.day, value: num(r.total) })),
    ),
    clicksByDay: fill(
      clicksDayRows.map((r) => ({ day: r.day, value: num(r.total) })),
    ),
    planDistribution: planDistRows
      .map((r) => ({ key: r.key, total: num(r.total) }))
      .sort((a, b) => b.total - a.total),
  };
}
