"use client";
import type { BillingCycle } from "@linkview/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BillingCycleChoice,
  type BillingCyclePricing,
} from "@/components/billing/billing-cycle-choice";
import { Button } from "@/components/ui/button";
import {
  cancelSubscriptionAction,
  switchBillingCycleAction,
} from "@/server/billing/actions";

type Mode = "trial" | "active";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Action zone for the plan page. Upgrades reuse the monthly/annual checkout
 * inline (no modal); active subscribers can switch cycle in place; cancellation
 * is a two-step inline confirm so it never fires by accident.
 */
export function PlanActions({
  mode,
  canceling,
  trialDays,
  pricing,
  currentCycle,
  nextChargeLabel,
}: {
  mode: Mode;
  canceling: boolean;
  trialDays: number;
  pricing: BillingCyclePricing;
  currentCycle: BillingCycle;
  nextChargeLabel: string | null;
}) {
  // Trial users (and Pro users who already canceled) get the checkout path.
  if (mode === "trial" || canceling) {
    return (
      <Upgrade
        title={
          mode === "trial" ? "Continue no Pro" : "Mudou de ideia? Reative o Pro"
        }
        blurb={
          mode === "trial"
            ? `Escolha seu ciclo e assine antes que o teste de ${trialDays} dias acabe.`
            : "Escolha seu ciclo e volte a ter acesso Pro sem data para acabar."
        }
        cta={mode === "trial" ? "Assinar Pro" : "Reativar Pro"}
        pricing={pricing}
      />
    );
  }

  return (
    <>
      <CycleSwitch
        currentCycle={currentCycle}
        pricing={pricing}
        nextChargeLabel={nextChargeLabel}
      />
      <CancelRow />
    </>
  );
}

/**
 * In-place monthly ⇄ annual switch for an active subscriber. The change applies
 * at the next renewal with no charge today and no loss of access, so it's a
 * single inline confirm rather than a checkout.
 */
function CycleSwitch({
  currentCycle,
  pricing,
  nextChargeLabel,
}: {
  currentCycle: BillingCycle;
  pricing: BillingCyclePricing;
  nextChargeLabel: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target: BillingCycle = currentCycle === "yearly" ? "monthly" : "yearly";
  const toAnnual = target === "yearly";

  async function onSwitch() {
    setError(null);
    setLoading(true);
    const res = await switchBillingCycleAction(target);
    if (!res.ok) {
      setError(res.error ?? "Não foi possível alterar o ciclo.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  const newPriceLine = toAnnual
    ? `${brl(pricing.yearlyCents)} por ano (${brl(pricing.monthlyEquivCents)}/mês)`
    : `${brl(pricing.monthlyCents)} por mês`;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
            {toAnnual ? "Mude para o plano anual" : "Voltar ao plano mensal"}
          </h3>
          <p className="mt-1.5 text-[0.88rem] text-muted">
            {toAnnual
              ? `Pague ${newPriceLine} e economize ${brl(pricing.savingsCents)} por ano.`
              : `Pague ${newPriceLine}, sem compromisso anual.`}
          </p>
        </div>
        {toAnnual && (
          <span className="shrink-0 rounded-full border border-accent-line bg-accent-weak px-2.5 py-1 text-[0.72rem] font-semibold text-accent-deep">
            -{pricing.percentOff}%
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      {confirming ? (
        <div className="mt-5">
          <p className="text-[0.85rem] text-ink-soft">
            A mudança vale a partir da próxima cobrança
            {nextChargeLabel ? (
              <>
                {" "}
                (<span className="font-medium text-ink">{nextChargeLabel}</span>
                )
              </>
            ) : null}
            . Nada é cobrado agora e você não perde acesso.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              loading={loading}
              onClick={onSwitch}
              className="sm:w-auto"
            >
              {toAnnual ? "Confirmar plano anual" : "Confirmar plano mensal"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          variant={toAnnual ? "primary" : "secondary"}
          onClick={() => setConfirming(true)}
          className="mt-5 w-full sm:w-auto"
        >
          {toAnnual ? "Mudar para anual" : "Mudar para mensal"}
        </Button>
      )}
    </section>
  );
}

function Upgrade({
  title,
  blurb,
  cta,
  pricing,
}: {
  title: string;
  blurb: string;
  cta: string;
  pricing: BillingCyclePricing;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">{blurb}</p>
      {open ? (
        <div className="mt-5">
          <BillingCycleChoice pricing={pricing} cta={cta} />
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={() => setOpen(true)}
          className="mt-5 w-full sm:w-auto"
        >
          {cta}
        </Button>
      )}
    </section>
  );
}

function CancelRow() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    setError(null);
    setLoading(true);
    const res = await cancelSubscriptionAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível cancelar.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Cancelar assinatura
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        Cancelar o plano Pro?
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">
        Você mantém o acesso Pro até o fim do período já pago. Depois disso, o
        workspace volta ao plano gratuito.
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Button
          type="button"
          variant="danger"
          loading={loading}
          onClick={onCancel}
        >
          Confirmar cancelamento
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Voltar
        </Button>
      </div>
    </section>
  );
}
