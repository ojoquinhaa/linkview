import Link from "next/link";
import { AdminAreaChart } from "@/components/admin/charts/admin-area-chart";
import { BreakdownBarChart } from "@/components/dashboard/charts/breakdown-bar-chart";
import { ADMIN_PERIODS, getPlatformOverview } from "@/server/admin/analytics";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = Number(sp.periodo);
  const days = (ADMIN_PERIODS as readonly number[]).includes(periodo)
    ? periodo
    : 30;

  const o = await getPlatformOverview(days);
  const k = o.kpis;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-4 border-b border-line bg-paper px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
            Visão geral da plataforma
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted">
            Receita, clientes, crescimento e tráfego — últimos {days} dias.
          </p>
        </div>
        <PeriodFilter days={days} />
      </div>

      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8">
        {/* Money */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Receita recorrente (MRR)"
            value={fmtBRL(k.mrrCents)}
            sub={`${fmtNum(k.payingWorkspaces)} assinaturas ativas`}
            tone="accent"
          />
          <Metric
            label="Receita no período"
            value={fmtBRL(k.revenueCents)}
            delta={<Delta current={k.revenueCents} prev={k.revenuePrevCents} />}
          />
          <Metric
            label="Reembolsos"
            value={fmtBRL(k.refundsCents)}
            sub={
              k.refundsCount === 1
                ? "1 reembolso no período"
                : `${fmtNum(k.refundsCount)} reembolsos no período`
            }
            tone={k.refundsCents > 0 ? "danger" : undefined}
          />
          <Metric
            label="Em trial"
            value={fmtNum(k.trialingWorkspaces)}
            sub="workspaces testando"
          />
        </section>

        {/* Customers + assets */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label="Usuários"
            value={fmtNum(k.totalUsers)}
            delta={<Delta current={k.newUsers} prev={k.newUsersPrev} suffix />}
          />
          <Metric label="Workspaces" value={fmtNum(k.totalWorkspaces)} />
          <Metric label="Novos no período" value={fmtNum(k.newUsers)} />
          <Metric
            label="Links"
            value={fmtNum(k.totalLinks)}
            sub={`${fmtNum(k.activeLinks)} ativos`}
          />
          <Metric
            label="Redirecionamentos"
            value={fmtNum(k.totalClicks)}
            sub="total acumulado"
          />
          <Metric
            label="Redirects hoje"
            value={fmtNum(k.clicksToday)}
            sub={`${fmtNum(k.clicksWindow)} no período`}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Receita confirmada" meta="por dia">
            <AdminAreaChart
              points={o.revenueByDay}
              format="brl"
              accent="green"
            />
          </Panel>
          <Panel title="Novos cadastros" meta="por dia">
            <AdminAreaChart points={o.signupsByDay} format="number" />
          </Panel>
        </div>

        <Panel title="Redirecionamentos" meta="por dia">
          <AdminAreaChart points={o.clicksByDay} format="number" />
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Panel title="Workspaces por plano">
            {o.planDistribution.length > 0 ? (
              <BreakdownBarChart
                rows={o.planDistribution.map((p) => ({
                  label: PLAN_LABELS[p.key] ?? p.key,
                  total: p.total,
                }))}
              />
            ) : (
              <EmptyHint>Nenhum workspace ainda.</EmptyHint>
            )}
          </Panel>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-[1rem] font-semibold tracking-[-0.01em] text-ink">
                Gerenciar clientes
              </h2>
              <Link
                href="/admin/clientes"
                className="shrink-0 text-[0.8rem] font-medium text-accent-deep hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <p className="mt-3 text-[0.88rem] text-muted">
              Acesse a lista completa de workspaces com plano, status de
              assinatura, volume de links e redirecionamentos para acompanhar e
              ajustar a operação.
            </p>
            <Link
              href="/admin/clientes"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
            >
              Abrir lista de clientes
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function PeriodFilter({ days }: { days: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[var(--radius-input)] border border-line bg-surface p-1">
      {ADMIN_PERIODS.map((p) => {
        const active = p === days;
        return (
          <Link
            key={p}
            href={`/admin?periodo=${p}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[0.8rem] font-medium transition-colors ${
              active
                ? "bg-accent-weak text-accent-deep"
                : "text-muted hover:text-ink"
            }`}
          >
            {p}d
          </Link>
        );
      })}
    </div>
  );
}

function Delta({
  current,
  prev,
  suffix,
}: {
  current: number;
  prev: number;
  suffix?: boolean;
}) {
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
      {Math.abs(pct)}%{suffix ? " novos vs anterior" : " vs anterior"}
    </span>
  );
}

function Metric({
  label,
  value,
  sub,
  delta,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: React.ReactNode;
  tone?: "accent" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        tone === "accent"
          ? "border-accent-line bg-accent-weak"
          : tone === "danger"
            ? "border-danger/30 bg-surface"
            : "border-line bg-surface"
      }`}
    >
      <p className="text-[0.72rem] uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`nums mt-1 truncate text-[1.45rem] font-semibold tracking-[-0.01em] ${
          tone === "accent" ? "text-accent-deep" : "text-ink"
        }`}
      >
        {value}
      </p>
      <div className="mt-1">
        {delta ??
          (sub && <span className="text-[0.74rem] text-muted">{sub}</span>)}
      </div>
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
