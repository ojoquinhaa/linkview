"use client";
import type { BillingCycle } from "@linkview/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { computeFingerprint } from "@/lib/fingerprint";
import { startTrialAction } from "@/server/billing/actions";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/** Bare amount, no symbol: "24,90". */
const amount = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export interface PlansPricing {
  monthlyCents: number;
  yearlyCents: number;
  /** Yearly price ÷ 12, the headline on the annual cycle. */
  monthlyEquivCents: number;
  savingsCents: number;
  percentOff: number;
}

/**
 * Plan chooser for /assinar. One paid plan (Pro) plus the free trial when the
 * workspace is eligible. A central cycle toggle drives the Pro price; the whole
 * thing is sized to sit in one viewport. When the trial is offered the two cards
 * share the row and Pro is the emphasized one; otherwise Pro stands alone,
 * centered. Accent is reserved for the active toggle, the savings badge, and the
 * primary action.
 */
export function Plans({
  pricing,
  perks,
  trialEligible,
  trialDays,
}: {
  pricing: PlansPricing;
  perks: string[];
  trialEligible: boolean;
  trialDays: number;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <CycleToggle
        cycle={cycle}
        onChange={setCycle}
        percentOff={pricing.percentOff}
      />

      <div
        className={cn(
          "mt-7 grid w-full items-stretch gap-4",
          trialEligible
            ? "max-w-3xl sm:grid-cols-[0.85fr_1fr]"
            : "max-w-sm grid-cols-1",
        )}
      >
        {trialEligible && <TrialCard days={trialDays} />}
        <ProCard pricing={pricing} cycle={cycle} perks={perks} />
      </div>
    </div>
  );
}

function CycleToggle({
  cycle,
  onChange,
  percentOff,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
  percentOff: number;
}) {
  const annual = cycle === "yearly";
  return (
    <div
      role="tablist"
      aria-label="Ciclo de cobrança"
      className="inline-flex items-center gap-1 rounded-full border border-line bg-paper-sunk p-1"
    >
      <Segment
        selected={!annual}
        onClick={() => onChange("monthly")}
        label="Mensal"
      />
      <Segment
        selected={annual}
        onClick={() => onChange("yearly")}
        label="Anual"
        badge={`-${percentOff}%`}
      />
    </div>
  );
}

function Segment({
  selected,
  onClick,
  label,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.86rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)]",
        selected
          ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.2_0.03_265/0.08)]"
          : "text-muted hover:text-ink-soft",
      )}
    >
      {label}
      {badge && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[0.66rem] font-semibold",
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

function ProCard({
  pricing,
  cycle,
  perks,
}: {
  pricing: PlansPricing;
  cycle: BillingCycle;
  perks: string[];
}) {
  const router = useRouter();
  const [autopay, setAutopay] = useState(true);
  const [loading, setLoading] = useState(false);
  const annual = cycle === "yearly";
  const headlineCents = annual
    ? pricing.monthlyEquivCents
    : pricing.monthlyCents;

  function onCheckout() {
    setLoading(true);
    const method = autopay ? "card" : "pix";
    router.push(`/assinar/pagamento?cycle=${cycle}&method=${method}`);
  }

  return (
    <section className="relative flex flex-col rounded-2xl border border-accent-line bg-surface p-6 shadow-[0_4px_24px_oklch(0.42_0.16_265/0.08)] sm:p-7">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
          <Bolt />
        </span>
        <div>
          <h2 className="font-display text-[1.2rem] font-semibold tracking-[-0.02em] text-ink">
            Plano Pro
          </h2>
          <p className="text-[0.82rem] text-muted">
            Tudo para criar e medir seus links.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[1.15rem] font-semibold text-ink">R$</span>
        <span className="nums text-[2.6rem] font-bold leading-none tracking-[-0.03em] text-ink">
          {amount(headlineCents)}
        </span>
        <span className="text-[0.9rem] text-muted">/mês</span>
      </div>
      <p className="mt-1.5 text-[0.8rem] text-muted">
        {annual ? (
          <>
            {brl(pricing.yearlyCents)} por ano · economize{" "}
            <span className="font-medium text-accent-deep">
              {brl(pricing.savingsCents)}
            </span>
          </>
        ) : (
          "Cobrança mensal, cancele quando quiser"
        )}
      </p>

      <ul className="mt-5 grid gap-2 border-t border-line pt-5">
        {perks.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2.5 text-[0.85rem] text-ink-soft"
          >
            <Check />
            {perk}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Method
          selected={autopay}
          onClick={() => setAutopay(true)}
          title="Cartão"
          subtitle="Renova sozinho"
        />
        <Method
          selected={!autopay}
          onClick={() => setAutopay(false)}
          title="Pix"
          subtitle="A cada ciclo"
        />
      </div>

      <Button
        type="button"
        size="lg"
        loading={loading}
        onClick={onCheckout}
        className="mt-4 w-full"
      >
        Assinar Plano Pro
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[0.76rem] text-muted">
        <Lock />
        {autopay
          ? "Checkout criptografado · cancele quando quiser"
          : "Pague com Pix · QR Code na próxima tela"}
      </p>
    </section>
  );
}

function TrialCard({ days }: { days: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    setError(null);
    setLoading(true);
    try {
      const fingerprint = await computeFingerprint();
      const res = await startTrialAction(fingerprint ?? undefined);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível iniciar o teste.");
        setLoading(false);
        return;
      }
      // Keep the button busy through the navigation; never call router.refresh()
      // here (it re-renders /assinar, which now redirects an active plan to the
      // dashboard and would race this push). Replace drops /assinar from history.
      router.replace("/dashboard/links");
    } catch {
      setError("Não foi possível iniciar o teste. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
          <Gift />
        </span>
        <div>
          <h2 className="font-display text-[1.2rem] font-semibold tracking-[-0.02em] text-ink">
            Teste grátis
          </h2>
          <p className="text-[0.82rem] text-muted">
            {days} dias no Pro completo.
          </p>
        </div>
      </div>

      <p className="mt-5 text-[0.85rem] leading-relaxed text-ink-soft">
        Experimente todos os recursos do Plano Pro por {days} dias. Sem cartão,
        sem compromisso.
      </p>

      <div className="mt-auto pt-6">
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
          >
            {error}
          </div>
        )}
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={loading}
          onClick={onStart}
          className="w-full"
        >
          Começar teste grátis
        </Button>
        <p className="mt-3 text-center text-[0.76rem] text-muted">
          Depois, {""}
          <span className="text-ink-soft">só assine se quiser continuar.</span>
        </p>
      </div>
    </section>
  );
}

function Method({
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
        "flex flex-col items-start rounded-[var(--radius-input)] border px-3.5 py-2 text-left transition-colors duration-150 ease-[var(--ease-out-quint)]",
        selected
          ? "border-accent bg-accent-weak/60"
          : "border-line bg-paper-sunk hover:border-line-strong",
      )}
    >
      <span className="text-[0.85rem] font-medium text-ink">{title}</span>
      <span className="text-[0.72rem] text-muted">{subtitle}</span>
    </button>
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

function Gift() {
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
      <title>Presente</title>
      <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[2px] size-3.5 shrink-0 text-accent"
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
