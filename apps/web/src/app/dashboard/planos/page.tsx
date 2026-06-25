import {
  getAnnualSavings,
  getPlan,
  type PlanKey,
  TRIAL_DURATION_DAYS,
} from "@linkview/shared";
import { redirect } from "next/navigation";
import { getWorkspaceSubscription } from "@/server/billing/subscription";
import { getTrialStatus } from "@/server/billing/trial";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";
import { PlanActions } from "./plan-actions";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

/** Pro-tier perks, derived from the plan's own flags so the list never drifts
 * from what the workspace actually gets. Trial mirrors Pro, so both render the
 * same set. */
function perksFor(planKey: PlanKey): string[] {
  const p = getPlan(planKey);
  const perks = [`Até ${p.maxLinks.toLocaleString("pt-BR")} links rastreáveis`];
  if (p.qrCodesEnabled) perks.push("QR Code para cada link");
  if (p.bioPagesEnabled) perks.push("Páginas de bio e canais");
  perks.push("Relatórios de origem, dispositivo e região");
  if (p.analyticsRetentionDays >= 365) {
    perks.push("Histórico de cliques por 1 ano");
  } else {
    perks.push(`Histórico de cliques por ${p.analyticsRetentionDays} dias`);
  }
  if (p.passwordLinksEnabled && p.expirationEnabled) {
    perks.push("Links com senha e expiração");
  }
  if (p.csvExportEnabled) perks.push("Exportar relatórios em CSV");
  return perks;
}

export default async function PlanosPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const sub = await getWorkspaceSubscription(workspace.id);
  // The dashboard layout already guarantees an active/trialing subscription;
  // bail defensively if that ever changes.
  if (!sub) redirect("/assinar");

  const onTrial = sub.status === "trialing";
  const trial = onTrial ? await getTrialStatus(workspace.id) : null;
  const pro = getPlan("pro");
  const savings = getAnnualSavings("pro");
  const pricing = {
    monthlyCents: pro.priceCents,
    yearlyCents: savings.yearlyCents,
    monthlyEquivCents: savings.monthlyEquivalentCents,
    savingsCents: savings.savingsCents,
    percentOff: savings.percentOff,
  };
  // What the workspace pays today, by its chosen cycle.
  const annual = sub.billingCycle === "yearly";
  const priceCents = annual ? savings.yearlyCents : pro.priceCents;
  const cadence = annual ? "ano" : "mês";
  const perks = perksFor(onTrial ? "trial" : (sub.planKey as PlanKey));
  const renewsAt = sub.currentPeriodEnd;

  // Title-band summary line, one sentence, state-aware.
  const summary = onTrial
    ? trial
      ? `Teste Pro ativo. ${trial.daysLeft} ${trial.daysLeft === 1 ? "dia restante" : "dias restantes"}.`
      : "Teste Pro ativo."
    : sub.cancelAtPeriodEnd && renewsAt
      ? `Plano Pro. Acesso até ${fmtDate(renewsAt)}.`
      : renewsAt
        ? `Plano Pro. Renova em ${fmtDate(renewsAt)}.`
        : "Plano Pro ativo.";

  return (
    <div className="flex flex-col">
      {/* Title band: flush under the topbar, same paper tone as Links. */}
      <div className="border-b border-line bg-paper px-6 py-6 sm:px-8">
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
          Seu plano
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">{summary}</p>
      </div>

      {/* Content segment. */}
      <div className="px-6 py-7 sm:px-8">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-5">
          {/* Current-plan panel. */}
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
                  <Bolt />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-ink">
                      {onTrial ? "Teste Pro" : "Pro"}
                    </h2>
                    <StatusPill
                      onTrial={onTrial}
                      canceling={sub.cancelAtPeriodEnd}
                    />
                  </div>
                  <p className="mt-1.5 text-[0.9rem] text-muted">
                    {onTrial
                      ? "Acesso Pro completo durante o teste."
                      : "Tudo para criar e medir seus links. Cancele quando quiser."}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="nums text-[1.5rem] font-semibold leading-none text-ink">
                  {onTrial ? "Grátis" : brl(priceCents)}
                </span>
                {!onTrial && (
                  <span className="text-[0.8rem] text-muted">/{cadence}</span>
                )}
                {onTrial && (
                  <p className="mt-1 text-[0.78rem] text-muted">
                    depois {brl(pro.priceCents)}/mês
                  </p>
                )}
              </div>
            </div>

            {/* Tracking row: what changes by state. */}
            {onTrial && trial ? (
              <TrialMeter daysLeft={trial.daysLeft} endsAt={trial.endsAt} />
            ) : (
              renewsAt && (
                <p className="mt-5 border-t border-line pt-4 text-[0.88rem] text-ink-soft">
                  {sub.cancelAtPeriodEnd ? (
                    <>
                      Assinatura cancelada. Seu acesso Pro continua até{" "}
                      <span className="font-medium text-ink">
                        {fmtDate(renewsAt)}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      Próxima cobrança em{" "}
                      <span className="font-medium text-ink">
                        {fmtDate(renewsAt)}
                      </span>
                      .
                    </>
                  )}
                </p>
              )
            )}
          </section>

          {/* What's included. */}
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
            <h3 className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
              O que está incluído
            </h3>
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-start gap-2.5 text-[0.88rem] text-ink-soft"
                >
                  <Check />
                  {perk}
                </li>
              ))}
            </ul>
          </section>

          {/* Action zone. */}
          <PlanActions
            mode={onTrial ? "trial" : "active"}
            canceling={sub.cancelAtPeriodEnd}
            trialDays={TRIAL_DURATION_DAYS}
            pricing={pricing}
            currentCycle={annual ? "yearly" : "monthly"}
            nextChargeLabel={renewsAt ? fmtDate(renewsAt) : null}
          />
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  onTrial,
  canceling,
}: {
  onTrial: boolean;
  canceling: boolean;
}) {
  if (onTrial) {
    return (
      <span className="rounded-full border border-accent-line bg-accent-weak px-2.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-accent-deep">
        Em teste
      </span>
    );
  }
  if (canceling) {
    return (
      <span className="rounded-full border border-line-strong bg-paper-sunk px-2.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-muted">
        Cancelado
      </span>
    );
  }
  return (
    <span className="rounded-full border border-accent-line bg-accent-weak px-2.5 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-accent-deep">
      Ativo
    </span>
  );
}

function TrialMeter({ daysLeft, endsAt }: { daysLeft: number; endsAt: Date }) {
  const pct = Math.max(6, Math.round((daysLeft / TRIAL_DURATION_DAYS) * 100));
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.88rem] text-ink-soft">
          <span className="nums font-semibold text-ink">{daysLeft}</span>{" "}
          {daysLeft === 1 ? "dia restante" : "dias restantes"}
        </p>
        <p className="text-[0.8rem] text-muted">termina {fmtDate(endsAt)}</p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-sunk"
        role="progressbar"
        aria-valuenow={daysLeft}
        aria-valuemin={0}
        aria-valuemax={TRIAL_DURATION_DAYS}
        aria-label="Dias restantes do teste"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Bolt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Pro</title>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[3px] size-3.5 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Incluído</title>
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}
