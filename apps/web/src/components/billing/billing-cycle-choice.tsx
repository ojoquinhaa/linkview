"use client";
import type { BillingCycle } from "@linkview/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createCheckout } from "@/server/billing/actions";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export interface BillingCyclePricing {
  monthlyCents: number;
  yearlyCents: number;
  /** Yearly price ÷ 12, the headline figure on the annual plan. */
  monthlyEquivCents: number;
  /** Saved per year vs. paying monthly. */
  savingsCents: number;
  percentOff: number;
}

/**
 * Monthly / annual segmented control with a price that swaps under it and a
 * checkout button. CPF/CNPJ + phone are already on file from sign-up, so the
 * button hands straight off to the Asaas hosted checkout for the chosen cycle.
 * `secondary` quiets the button when the free trial is the primary action above.
 */
export function BillingCycleChoice({
  pricing,
  secondary = false,
  defaultCycle = "yearly",
  cta = "Ir para o pagamento",
}: {
  pricing: BillingCyclePricing;
  secondary?: boolean;
  defaultCycle?: BillingCycle;
  cta?: string;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const annual = cycle === "yearly";

  async function onCheckout() {
    setError(null);
    setLoading(true);
    const res = await createCheckout(cycle);
    if (res.error || !res.url) {
      setError(res.error ?? "Não foi possível continuar.");
      setLoading(false);
      return;
    }
    // Hand off to the Asaas hosted checkout (Pix / boleto / cartão).
    window.location.href = res.url;
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-1 rounded-[calc(var(--radius-input)+0.25rem)] border-0 bg-paper-sunk p-1">
        <legend className="sr-only">Ciclo de cobrança</legend>
        <Segment
          selected={!annual}
          onSelect={() => setCycle("monthly")}
          label="Mensal"
        />
        <Segment
          selected={annual}
          onSelect={() => setCycle("yearly")}
          label="Anual"
          badge={`-${pricing.percentOff}%`}
        />
      </fieldset>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1">
            <span className="nums text-[2rem] font-semibold leading-none tracking-[-0.02em] text-ink">
              {brl(annual ? pricing.monthlyEquivCents : pricing.monthlyCents)}
            </span>
            <span className="text-[0.85rem] text-muted">/mês</span>
          </p>
          <p className="mt-1.5 text-[0.8rem] text-muted">
            {annual ? (
              <>
                <span className="nums font-medium text-ink-soft">
                  {brl(pricing.yearlyCents)}
                </span>{" "}
                por ano, cobrança única
              </>
            ) : (
              "Cobrado todo mês. Cancele quando quiser."
            )}
          </p>
        </div>
        {annual && (
          <span className="shrink-0 rounded-full border border-accent-line bg-accent-weak px-2.5 py-1 text-[0.72rem] font-semibold text-accent-deep">
            Economize {brl(pricing.savingsCents)}
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        size="lg"
        variant={secondary ? "secondary" : "primary"}
        loading={loading}
        onClick={onCheckout}
        className="w-full"
      >
        {cta}
      </Button>
      <p className="text-center text-[0.78rem] text-muted">
        Pagamento seguro via Asaas · Pix, boleto ou cartão
      </p>
    </div>
  );
}

function Segment({
  selected,
  onSelect,
  label,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-input)] text-[0.85rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)]",
        selected
          ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.1)]"
          : "text-muted hover:text-ink-soft",
      )}
    >
      {label}
      {badge && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none transition-colors",
            selected
              ? "bg-accent text-accent-ink"
              : "bg-accent-weak text-accent-deep",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
