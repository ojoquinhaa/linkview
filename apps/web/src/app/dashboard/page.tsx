import { can } from "@linkview/auth/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessMap } from "@/components/dashboard/charts/access-map";
import { ChannelTrends } from "@/components/dashboard/charts/channel-trends";
import { ClicksTrend } from "@/components/dashboard/charts/clicks-trend";
import { DeviceDonutChart } from "@/components/dashboard/charts/device-donut-chart";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { OverviewFilters } from "@/components/dashboard/overview-filters";
import { RealtimeRefresher } from "@/components/dashboard/realtime-refresher";
import { toUf, ufName } from "@/lib/br-states";
import { systemDomain } from "@/lib/env";
import type {
  Breakdown,
  ChannelTrends as ChannelTrendsData,
} from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import {
  getWorkspaceChannelTrends,
  getWorkspaceOverview,
  PERIODS,
  type TopLink,
  type WorkspaceOverview,
} from "@/server/workspace-analytics";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
};

const regionNames = (() => {
  try {
    const dn = new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return (iso: string) => {
      try {
        return dn.of(iso.toUpperCase()) ?? iso;
      } catch {
        return iso;
      }
    };
  } catch {
    return (iso: string) => iso;
  }
})();

const share = (n: number, of: number) =>
  of > 0 ? Math.round((n / of) * 100) : 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; canal?: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const canMetrics = can(workspace.role, "metrics.view");
  const sp = await searchParams;
  const periodo = Number(sp.periodo);
  const days = (PERIODS as readonly number[]).includes(periodo) ? periodo : 14;
  const canal = sp.canal?.trim() || null;
  const domain = systemDomain();

  const overview = canMetrics
    ? await getWorkspaceOverview(workspace.id, days, canal)
    : null;
  const channelTrends =
    canMetrics && overview && overview.kpis.totalLinks > 0
      ? await getWorkspaceChannelTrends(workspace.id, days, canal)
      : null;

  const canalLabel = canal
    ? (overview?.channels.find((c) => c.key === canal)?.label ?? canal)
    : null;

  return (
    <div className="flex flex-col">
      {canMetrics && <RealtimeRefresher />}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-4 border-b border-line bg-paper px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
              Sua operação
            </h1>
            {canMetrics && <LiveIndicator />}
          </div>
          <p className="mt-1 text-[0.9rem] text-muted">
            {canMetrics && overview
              ? overview.kpis.totalLinks === 0
                ? "Crie o primeiro link e a operação começa a aparecer aqui."
                : describeScope(days, canalLabel)
              : "Resumo de cliques, canais e alcance dos seus links."}
          </p>
        </div>

        {canMetrics && overview && overview.kpis.totalLinks > 0 && (
          <OverviewFilters
            periods={PERIODS}
            days={days}
            channels={overview.channels}
            canal={canal}
          />
        )}
      </div>

      <div className="px-6 py-7 sm:px-8">
        {!canMetrics ? (
          <Notice>Seu plano não inclui as estatísticas da operação.</Notice>
        ) : !overview || overview.kpis.totalLinks === 0 ? (
          <EmptyState domain={domain} />
        ) : (
          <Operation
            overview={overview}
            channelTrends={channelTrends}
            domain={domain}
          />
        )}
      </div>
    </div>
  );
}

function describeScope(days: number, canalLabel: string | null): string {
  const period = `Últimos ${days} dias`;
  return canalLabel ? `${period} · canal ${canalLabel}` : period;
}

function Operation({
  overview,
  channelTrends,
  domain,
}: {
  overview: WorkspaceOverview;
  channelTrends: ChannelTrendsData | null;
  domain: string;
}) {
  const k = overview.kpis;
  const regionTotal = overview.geoRegions.reduce((s, r) => s + r.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-accent-line bg-accent-weak shadow-[0_1px_2px_oklch(0.42_0.16_265/0.08)]">
        <div className="flex items-center gap-2 px-5 pt-4">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-[0.72rem] font-medium uppercase tracking-wide text-accent-deep">
            Hoje
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-accent-line/60">
          <TodayStat label="Cliques" value={fmtNum(k.todayClicks)} />
          <TodayStat label="Visitantes" value={fmtNum(k.todayUnique)} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Cliques no período"
          value={fmtNum(k.clicks)}
          delta={<Delta current={k.clicks} prev={k.clicksPrev} />}
        />
        <Metric
          label="Visitantes"
          value={fmtNum(k.unique)}
          delta={<Delta current={k.unique} prev={k.uniquePrev} />}
        />
        <Metric
          label="Links ativos"
          value={fmtNum(k.activeLinks)}
          sub={`de ${fmtNum(k.totalLinks)} no total`}
        />
        <Metric
          label="Leituras de QR"
          value={fmtNum(k.qrScans)}
          sub="no período"
        />
        <Metric
          label="Canais ativos"
          value={fmtNum(k.channelsCount)}
          sub={
            k.channelsCount === 1 ? "origem com tráfego" : "origens com tráfego"
          }
        />
      </section>

      <Panel title="Cliques ao longo do tempo">
        <ClicksTrend byDay={overview.byDay} byHour={overview.byHour} />
      </Panel>

      {channelTrends && channelTrends.series.length > 0 && (
        <Panel title="Desempenho dos canais" meta="cada linha é um canal">
          <ChannelTrends data={channelTrends} />
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Panel
          title="De onde vêm os cliques"
          meta={
            overview.locatedTotal > 0
              ? `${fmtNum(overview.locatedTotal)} localizados`
              : undefined
          }
        >
          {overview.geoCountries.length > 0 ? (
            <AccessMap
              countries={overview.geoCountries.map((c) => ({
                iso: c.key,
                total: c.total,
              }))}
              regions={overview.geoRegions.map((r) => ({
                region: r.key,
                total: r.total,
              }))}
              locatedTotal={overview.locatedTotal}
              height={460}
            />
          ) : (
            <EmptyHint>
              Ainda não há cliques com localização neste período.
            </EmptyHint>
          )}
        </Panel>

        <div className="lg:relative">
          <div className="scroll-soft flex flex-col gap-5 lg:absolute lg:inset-0 lg:overflow-y-auto">
            <Panel title="Países">
              <TopGeo
                rows={overview.geoCountries}
                total={overview.locatedTotal}
                label={regionNames}
                empty="Sem localização ainda."
              />
            </Panel>
            <Panel title="Estados">
              {regionTotal > 0 ? (
                <TopRegions rows={overview.geoRegions} total={regionTotal} />
              ) : (
                <EmptyHint>Sem cliques do Brasil ainda.</EmptyHint>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[1rem] font-semibold tracking-[-0.01em] text-ink">
              Links que mais rodam
            </h2>
            <Link
              href="/dashboard/links"
              className="shrink-0 text-[0.8rem] font-medium text-accent-deep hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-4">
            {overview.topLinks.length > 0 ? (
              <TopLinks rows={overview.topLinks} domain={domain} />
            ) : (
              <EmptyHint>Nenhum clique no período.</EmptyHint>
            )}
          </div>
        </section>

        <Panel title="Dispositivos">
          {overview.devices.length > 0 ? (
            <DeviceDonutChart
              rows={overview.devices.map((d) => ({
                label: DEVICE_LABELS[d.key] ?? d.key,
                total: d.total,
              }))}
            />
          ) : (
            <EmptyHint>Sem dados de dispositivo ainda.</EmptyHint>
          )}
        </Panel>
      </div>
    </div>
  );
}

function TopLinks({ rows, domain }: { rows: TopLink[]; domain: string }) {
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const pct = share(r.clicks, max);
        return (
          <li key={r.id}>
            <Link
              href={`/dashboard/links/${r.slug}`}
              className="group block rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-paper-sunk"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-[0.86rem] font-medium">
                  <span className="text-muted">{domain}/</span>
                  <span className="text-accent-deep">{r.slug}</span>
                  {!r.isActive && (
                    <span className="ml-2 align-middle text-[0.66rem] font-sans uppercase tracking-wide text-muted">
                      pausado
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[0.82rem] text-muted">
                  <span className="nums font-semibold text-ink">
                    {fmtNum(r.clicks)}
                  </span>{" "}
                  · {fmtNum(r.unique)} visit.
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-sunk">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-quint)]"
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TopGeo({
  rows,
  total,
  label,
  empty,
}: {
  rows: Breakdown[];
  total: number;
  label: (key: string) => string;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyHint>{empty}</EmptyHint>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <GeoRow
          key={r.key}
          name={label(r.key)}
          total={r.total}
          pct={share(r.total, total)}
          width={Math.max(4, (r.total / max) * 100)}
        />
      ))}
    </ul>
  );
}

function TopRegions({ rows, total }: { rows: Breakdown[]; total: number }) {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const uf = toUf(r.key);
    if (!uf) continue;
    acc.set(uf, (acc.get(uf) ?? 0) + r.total);
  }
  const top = [...acc]
    .map(([key, t]) => ({ key, total: t }))
    .sort((a, b) => b.total - a.total);
  if (top.length === 0) return <EmptyHint>Sem estados ainda.</EmptyHint>;
  const max = Math.max(1, ...top.map((r) => r.total));
  return (
    <ul className="flex flex-col gap-3">
      {top.map((r) => (
        <GeoRow
          key={r.key}
          name={ufName(r.key)}
          total={r.total}
          pct={share(r.total, total)}
          width={Math.max(4, (r.total / max) * 100)}
        />
      ))}
    </ul>
  );
}

function GeoRow({
  name,
  total,
  pct,
  width,
}: {
  name: string;
  total: number;
  pct: number;
  width: number;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
        <span className="truncate text-ink-soft">{name}</span>
        <span className="shrink-0 text-muted">
          <span className="nums font-medium text-ink">{fmtNum(total)}</span> ·{" "}
          {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}

function Delta({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) {
    return (
      <span className="text-[0.74rem] text-muted">
        {current > 0 ? "novo no período" : "sem período anterior"}
      </span>
    );
  }
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) {
    return (
      <span className="text-[0.74rem] text-muted">estável vs anterior</span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[0.74rem] font-medium ${
        up ? "text-ok" : "text-danger"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-3 ${up ? "" : "rotate-180"}`}
      >
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
      {Math.abs(pct)}% vs anterior
    </span>
  );
}

function Metric({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[0.72rem] uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="nums mt-1 truncate text-[1.45rem] font-semibold tracking-[-0.01em] text-ink">
        {value}
      </p>
      <div className="mt-1">
        {delta ??
          (sub && <span className="text-[0.74rem] text-muted">{sub}</span>)}
      </div>
    </div>
  );
}

function TodayStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="nums text-[1.7rem] font-semibold leading-none tracking-[-0.02em] text-accent-deep">
        {value}
      </p>
      <p className="mt-1.5 text-[0.78rem] text-muted">{label}</p>
    </div>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[1rem] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {meta && (
          <span className="shrink-0 text-[0.78rem] text-muted">{meta}</span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-[0.85rem] text-muted">{children}</p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-[0.9rem] text-muted">
      {children}
    </div>
  );
}

function EmptyState({ domain }: { domain: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-ink">
        Sua operação ainda está em branco
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[0.9rem] text-muted">
        Crie um link curto, compartilhe, e este painel passa a mostrar cliques,
        canais e de onde vêm seus visitantes.
      </p>
      <Link
        href="/dashboard/links/new"
        className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="size-4"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Criar primeiro link
      </Link>
      <p className="mt-5 inline-block rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[0.82rem] text-muted">
        {domain}/<span className="text-accent-deep">sua-promo</span>
      </p>
    </div>
  );
}
