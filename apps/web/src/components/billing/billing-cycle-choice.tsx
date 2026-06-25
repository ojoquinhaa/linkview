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

/** Bare amount, no currency symbol — "24,90". */
const amount = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
 * Pro pricing block: a monthly headline price with a single, clickable annual
 * row beneath it. Selecting the row switches the checkout to the yearly cycle
 * (and reflects the lower per-month equivalent). CPF/CNPJ + phone are already
 * on file from sign-up, so the button hands straight off to the Asaas hosted
 * checkout for the chosen cycle.
 */
export function BillingCycleChoice({
  pricing,
  secondary = false,
  defaultCycle = "monthly",
  cta = "Assinar Plano Pro",
}: {
  pricing: BillingCyclePricing;
  secondary?: boolean;
  defaultCycle?: BillingCycle;
  cta?: string;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle);
  // Default to card auto-renewal: no missed-payment lapses, no manual invoice.
  const [autopay, setAutopay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const annual = cycle === "yearly";

  async function onCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await createCheckout(cycle, autopay);
      if (res.error || !res.url) {
        setError(res.error ?? "Não foi possível continuar.");
        setLoading(false);
        return;
      }
      // Hand off to the Asaas hosted checkout (Pix / boleto / cartão).
      window.location.href = res.url;
    } catch {
      setError("Não foi possível continuar. Tente novamente.");
      setLoading(false);
    }
  }

  const headlineCents = annual
    ? pricing.monthlyEquivCents
    : pricing.monthlyCents;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[1.35rem] font-semibold text-ink">R$</span>
        <span className="nums text-[3rem] font-bold leading-none tracking-[-0.03em] text-ink">
          {amount(headlineCents)}
        </span>
        <span className="text-[0.95rem] text-muted">/mês</span>
      </div>

      <button
        type="button"
        aria-pressed={annual}
        onClick={() => setCycle(annual ? "monthly" : "yearly")}
        className={cn(
          "flex items-center justify-between gap-3 rounded-[var(--radius-input)] border px-3.5 py-2.5 text-left transition-colors duration-150 ease-[var(--ease-out-quint)]",
          annual
            ? "border-accent bg-accent-weak/60"
            : "border-line bg-paper-sunk hover:border-line-strong",
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
              annual
                ? "border-accent bg-accent text-accent-ink"
                : "border-line-strong",
            )}
          >
            {annual && <Tick />}
          </span>
          <span className="text-[0.85rem] text-ink-soft">
            Cobrança anual ·{" "}
            <span className="nums font-medium text-ink">
              {brl(pricing.yearlyCents)} por ano
            </span>
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold transition-colors",
            annual
              ? "bg-accent text-accent-ink"
              : "bg-accent-weak text-accent-deep",
          )}
        >
          Economize {pricing.percentOff}%
        </span>
      </button>

      {/* Payment method: card auto-renews; Pix/boleto is paid each cycle. */}
      <div className="grid grid-cols-2 gap-2">
        <MethodOption
          selected={autopay}
          onClick={() => setAutopay(true)}
          title="Cartão"
          subtitle="Renovação automática"
        />
        <MethodOption
          selected={!autopay}
          onClick={() => setAutopay(false)}
          title="Pix ou boleto"
          subtitle="Pago a cada ciclo"
        />
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
      <p className="flex items-center justify-center gap-1.5 text-center text-[0.78rem] text-muted">
        <Lock />
        {autopay
          ? "Cartão seguro via Asaas · cancele quando quiser"
          : "Pagamento seguro via Asaas · Pix ou boleto"}
      </p>
    </div>
  );
}

function MethodOption({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-[var(--radius-input)] border px-3.5 py-2.5 text-left transition-colors duration-150 ease-[var(--ease-out-quint)]",
        selected
          ? "border-accent bg-accent-weak/60"
          : "border-line bg-paper-sunk hover:border-line-strong",
      )}
    >
      <span className="text-[0.86rem] font-medium text-ink">{title}</span>
      <span className="text-[0.74rem] text-muted">{subtitle}</span>
    </button>
  );
}

function Tick() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Selecionado</title>
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}

function Lock() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Seguro</title>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
