import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { AccessMap } from "@/components/dashboard/charts/access-map";
import {
  type BarRow,
  BreakdownBarChart,
} from "@/components/dashboard/charts/breakdown-bar-chart";
import { ChannelTrends } from "@/components/dashboard/charts/channel-trends";
import { ClicksTrend } from "@/components/dashboard/charts/clicks-trend";
import { DeviceDonutChart } from "@/components/dashboard/charts/device-donut-chart";
import { ClicksTable } from "@/components/dashboard/clicks-table";
import { CopyButton } from "@/components/dashboard/copy-button";
import { toUf, ufName } from "@/lib/br-states";
import { systemDomain } from "@/lib/env";
import { fetchClicksPage } from "@/server/link-clicks";
import type { Breakdown, LinkQrCode } from "@/server/links-query";
import {
  getChannelTrends,
  getLinkAnalytics,
  getLinkBySlug,
  getLinkQrCodes,
} from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    d,
  );

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

function relativeFromNow(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return fmtDay(d);
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
};

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube",
  google: "Google",
  bing: "Bing",
  yahoo: "Yahoo",
  email: "E-mail",
  newsletter: "Newsletter",
  "disparo-promocional": "Disparo promocional",
  "fluxo-automacao": "Fluxo de automação",
  "site-parceiro": "Site parceiro",
  influenciador: "Influenciador",
  "google-ads": "Google Ads",
  "meta-ads": "Meta Ads",
  afiliados: "Afiliados",
  bio: "Bio",
};

const toRows = (
  rows: Breakdown[],
  label: (key: string) => string = (k) => k,
): BarRow[] => rows.map((r) => ({ label: label(r.key), total: r.total }));

const share = (n: number, of: number) =>
  of > 0 ? `${Math.round((n / of) * 100)}%` : "—";

export default async function LinkOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const { slug } = await params;
  const link = await getLinkBySlug(workspace.id, slug);
  if (!link) notFound();

  const domain = systemDomain();
  const shortUrl = `https://${domain}/${link.slug}`;
  const canMetrics = can(workspace.role, "metrics.view");
  const analytics = canMetrics ? await getLinkAnalytics(link.id) : null;
  const hasData = Boolean(analytics) && link.totalClicks > 0;
  const clicksInitial = hasData ? await fetchClicksPage(link.id, 0) : null;
  const channelTrends = hasData ? await getChannelTrends(link.id) : null;
  const qrCodes = hasData ? await getLinkQrCodes(link.id) : [];
  const topQr = qrCodes
    .filter((q) => q.scans > 0)
    .sort((a, b) => b.scans - a.scans);
  const qrScanTotal = topQr.reduce((s, q) => s + q.scans, 0);
  const qrShare = share(qrScanTotal, link.totalClicks);

  const topCountry = analytics?.geoCountries[0];
  const topSource = analytics?.sources[0];
  const sourcesTotal = analytics?.sources.reduce((s, r) => s + r.total, 0) ?? 0;
  const regionTotal =
    analytics?.geoRegions.reduce((s, r) => s + r.total, 0) ?? 0;

  // Today's slice from the daily window — byDay is ISO-keyed, so match on the
  // local day, falling back to the last bucket (the window always ends today).
  const todayKey = new Date().toISOString().slice(0, 10);
  const today =
    analytics?.byDay.find((d) => d.date === todayKey) ??
    analytics?.byDay.at(-1);

  return (
    <div className="flex flex-col gap-6">
      {canMetrics && analytics && (
        <section className="overflow-hidden rounded-2xl border border-accent-line bg-accent-weak shadow-[0_1px_2px_oklch(0.42_0.16_265/0.08)]">
          <div className="flex items-center gap-2 px-5 pt-4">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="text-[0.72rem] font-medium uppercase tracking-wide text-accent-deep">
              Hoje
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-accent-line/60">
            <TodayStat label="Cliques" value={fmtNum(today?.total ?? 0)} />
            <TodayStat label="Visitantes" value={fmtNum(today?.unique ?? 0)} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Cliques" value={fmtNum(link.totalClicks)} />
        <Metric label="Visitantes" value={fmtNum(link.uniqueClicks)} />
        <Metric
          label="País principal"
          value={topCountry ? regionNames(topCountry.key) : "—"}
          sub={
            topCountry
              ? `${share(topCountry.total, analytics?.locatedTotal ?? 0)} dos cliques`
              : "sem localização"
          }
        />
        <Metric
          label="Canal principal"
          value={
            topSource ? (SOURCE_LABELS[topSource.key] ?? topSource.key) : "—"
          }
          sub={
            topSource
              ? `${share(topSource.total, sourcesTotal)} dos cliques`
              : "sem canal marcado"
          }
        />
      </section>

      <p className="-mt-1 text-[0.8rem] text-muted">
        Criado em {fmtDay(link.createdAt)}
        {link.lastClickedAt
          ? ` · último clique ${relativeFromNow(link.lastClickedAt)}`
          : ""}
      </p>

      {!canMetrics ? (
        <Notice>Seu plano não inclui as estatísticas de clique.</Notice>
      ) : hasData && analytics ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <Panel
              title="De onde vêm os cliques"
              meta={
                analytics.locatedTotal > 0
                  ? `${fmtNum(analytics.locatedTotal)} localizados`
                  : undefined
              }
            >
              {analytics.geoCountries.length > 0 ? (
                <AccessMap
                  countries={analytics.geoCountries.map((c) => ({
                    iso: c.key,
                    total: c.total,
                  }))}
                  regions={analytics.geoRegions.map((r) => ({
                    region: r.key,
                    total: r.total,
                  }))}
                  locatedTotal={analytics.locatedTotal}
                  height={460}
                />
              ) : (
                <EmptyHint>
                  Ainda não há cliques com localização. Eles aparecem no mapa
                  assim que chegam.
                </EmptyHint>
              )}
            </Panel>

            {/* Side column scrolls within the map's height so the lists stay
                tidy no matter how many countries or states appear. */}
            <div className="lg:relative">
              <div className="scroll-soft flex flex-col gap-5 lg:absolute lg:inset-0 lg:overflow-y-auto">
                <Panel title="Países">
                  <TopCountries
                    rows={analytics.geoCountries}
                    total={analytics.locatedTotal}
                  />
                </Panel>
                <Panel title="Estados">
                  {regionTotal > 0 ? (
                    <TopRegions
                      rows={analytics.geoRegions}
                      total={regionTotal}
                    />
                  ) : (
                    <EmptyHint>Sem cliques do Brasil ainda.</EmptyHint>
                  )}
                </Panel>
              </div>
            </div>
          </div>

          <Panel title="Cliques ao longo do tempo">
            <ClicksTrend byDay={analytics.byDay} byHour={analytics.byHour} />
          </Panel>

          {channelTrends && channelTrends.series.length > 0 && (
            <Panel title="Desempenho dos canais" meta="cada linha é um canal">
              <ChannelTrends data={channelTrends} />
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Dispositivos">
              {analytics.devices.length > 0 ? (
                <DeviceDonutChart
                  rows={toRows(analytics.devices, (k) => DEVICE_LABELS[k] ?? k)}
                />
              ) : (
                <EmptyHint>Sem dados de dispositivo ainda.</EmptyHint>
              )}
            </Panel>
            <Panel title="Canais que mais trazem cliques">
              {analytics.sources.length > 0 ? (
                <BreakdownBarChart
                  rows={toRows(analytics.sources, (k) => SOURCE_LABELS[k] ?? k)}
                />
              ) : (
                <EmptyHint>
                  Nenhum canal marcado ainda. Crie canais na aba Canais para ver
                  o que mais traz cliques.
                </EmptyHint>
              )}
            </Panel>
          </div>

          {topQr.length > 0 && (
            <Panel
              title="QR Codes que mais retornam"
              meta={`${fmtNum(qrScanTotal)} ${
                qrScanTotal === 1 ? "leitura" : "leituras"
              } · ${qrShare} do total`}
            >
              <QrReturns rows={topQr} total={qrScanTotal} />
            </Panel>
          )}

          <Panel title="Cliques" meta={`${fmtNum(link.totalClicks)} no total`}>
            {clicksInitial && clicksInitial.rows.length > 0 ? (
              <ClicksTable linkId={link.id} initial={clicksInitial} />
            ) : (
              <EmptyHint>Sem cliques ainda.</EmptyHint>
            )}
          </Panel>
        </>
      ) : (
        <Panel title="Cliques nos últimos 14 dias">
          <div className="py-10 text-center">
            <p className="text-[0.95rem] font-medium text-ink-soft">
              Nenhum clique ainda
            </p>
            <p className="mx-auto mt-1 max-w-xs text-[0.85rem] text-muted">
              Compartilhe o link curto. Assim que alguém clicar, os gráficos
              aparecem aqui.
            </p>
            <div className="mt-4 flex items-center justify-center">
              <CopyButton value={shortUrl} label="Copiar link curto" />
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function TopCountries({ rows, total }: { rows: Breakdown[]; total: number }) {
  if (rows.length === 0) {
    return <EmptyHint>Sem localização ainda.</EmptyHint>;
  }
  const top = rows;
  const max = Math.max(1, ...top.map((r) => r.total));
  return (
    <ul className="flex flex-col gap-3">
      {top.map((r) => {
        const pct = total > 0 ? Math.round((r.total / total) * 100) : 0;
        return (
          <li key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
              <span className="truncate text-ink-soft">
                {regionNames(r.key)}
              </span>
              <span className="shrink-0 text-muted">
                <span className="nums font-medium text-ink">
                  {r.total.toLocaleString("pt-BR")}
                </span>{" "}
                · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[0.72rem] uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="nums mt-1 truncate text-[1.3rem] font-semibold tracking-[-0.01em] text-ink">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-[0.74rem] text-muted">{sub}</p>
      )}
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

function TopRegions({ rows, total }: { rows: Breakdown[]; total: number }) {
  // The edge may emit UF siglas or full names; fold both onto the canonical UF.
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
      {top.map((r) => {
        const pct = total > 0 ? Math.round((r.total / total) * 100) : 0;
        return (
          <li key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
              <span className="truncate text-ink-soft">{ufName(r.key)}</span>
              <span className="shrink-0 text-muted">
                <span className="nums font-medium text-ink">
                  {r.total.toLocaleString("pt-BR")}
                </span>{" "}
                · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QrReturns({ rows, total }: { rows: LinkQrCode[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.scans));
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.scans / total) * 100) : 0;
        return (
          <li key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[0.85rem]">
              <span className="truncate font-medium text-ink-soft">
                {r.name}
              </span>
              <span className="shrink-0 text-muted">
                <span className="nums font-medium text-ink">
                  {fmtNum(r.scans)}
                </span>{" "}
                {r.scans === 1 ? "leitura" : "leituras"} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(4, (r.scans / max) * 100)}%` }}
              />
            </div>
            <p className="text-[0.74rem] text-muted">
              {fmtNum(r.unique)}{" "}
              {r.unique === 1 ? "visitante distinto" : "visitantes distintos"}
            </p>
          </li>
        );
      })}
    </ul>
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
