"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export interface OrderSummaryProps {
  planName: string;
  annual: boolean;
  /** Charged amount for the chosen cycle. */
  priceCents: number;
  /** Yearly price ÷ 12, shown as the per-month equivalent on the annual cycle. */
  perMonthCents: number;
  /** Saved per year vs. paying monthly (annual cycle only). */
  savingsCents: number;
  perks: string[];
  /** Cycle switch in progress: unused days are credited as extra time. */
  switching: boolean;
}

/**
 * Commercial order summary for the checkout split, from a single source of
 * truth. {@link DesktopSummary} is the static panel on the right at `lg+`;
 * {@link MobileSummary} is the collapsible bar at the top on mobile so the page
 * still fits without a long scroll. They're placed separately in the grid (form
 * first, summary last in the DOM) so the form sits left on desktop while the
 * mobile bar still sits above it. Accent shows only on the cycle pill and the
 * Total, never as decoration.
 */
function CyclePill({ annual }: { annual: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent-line bg-accent-weak px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-accent-deep">
      {annual ? "Anual" : "Mensal"}
    </span>
  );
}

function EquivLine({
  annual,
  perMonthCents,
  savingsCents,
}: {
  annual: boolean;
  perMonthCents: number;
  savingsCents: number;
}) {
  if (!annual) return null;
  return (
    <p className="text-[0.8rem] text-muted">
      Equivale a{" "}
      <span className="nums font-medium text-ink-soft">
        {brl(perMonthCents)}
      </span>
      /mês · você economiza{" "}
      <span className="nums font-medium text-accent-deep">
        {brl(savingsCents)}
      </span>{" "}
      por ano.
    </p>
  );
}

function PerkList({ perks }: { perks: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {perks.map((perk) => (
        <li
          key={perk}
          className="flex items-start gap-2.5 text-[0.86rem] text-ink-soft"
        >
          <Check />
          {perk}
        </li>
      ))}
    </ul>
  );
}

function SwitchNote() {
  return (
    <p className="rounded-[var(--radius-input)] bg-accent-weak/60 px-3 py-2 text-[0.78rem] leading-relaxed text-ink-soft">
      Você está trocando de ciclo. Paga o valor acima agora; os dias restantes
      do período atual entram como tempo extra no novo período.
    </p>
  );
}

function SecureLine() {
  return (
    <p className="flex items-center gap-2 text-[0.78rem] text-muted">
      <Shield />
      Pagamento criptografado · cancele quando quiser.
    </p>
  );
}

export function DesktopSummary({
  planName,
  annual,
  priceCents,
  perMonthCents,
  savingsCents,
  perks,
  switching,
}: OrderSummaryProps) {
  return (
    <aside className="hidden border-l border-line bg-accent-weak/30 lg:flex lg:min-h-0 lg:flex-col lg:justify-between lg:overflow-y-auto lg:px-10 lg:py-9 xl:px-12">
      <div className="flex flex-col gap-6">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Resumo da assinatura
        </p>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
              <Bolt />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-[1.2rem] font-semibold tracking-[-0.02em] text-ink">
                  Plano {planName}
                </h2>
                <CyclePill annual={annual} />
              </div>
              <p className="mt-1 text-[0.83rem] text-muted">
                Para quem leva links a sério.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="nums text-[1.35rem] font-semibold leading-none text-ink">
              {brl(priceCents)}
            </span>
            <span className="text-[0.78rem] text-muted">
              /{annual ? "ano" : "mês"}
            </span>
          </div>
        </div>

        <EquivLine
          annual={annual}
          perMonthCents={perMonthCents}
          savingsCents={savingsCents}
        />

        <div className="border-t border-line pt-6">
          <PerkList perks={perks} />
        </div>

        {switching && <SwitchNote />}
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-line pt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.92rem] font-medium text-ink">
            Total hoje
          </span>
          <span className="nums text-[1.4rem] font-semibold text-accent-deep">
            {brl(priceCents)}
          </span>
        </div>
        <SecureLine />
      </div>
    </aside>
  );
}

export function MobileSummary({
  planName,
  annual,
  priceCents,
  perMonthCents,
  savingsCents,
  perks,
  switching,
}: OrderSummaryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-line bg-accent-weak/30 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-3.5 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-weak text-accent">
            <Bolt />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-2 text-[0.9rem] font-medium text-ink">
              Plano {planName}
              <CyclePill annual={annual} />
            </span>
            <span className="flex items-center gap-1 text-[0.78rem] text-accent-deep">
              {open ? "Ocultar detalhes" : "Ver detalhes"}
              <Chevron open={open} />
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="nums text-[1.05rem] font-semibold text-ink">
            {brl(priceCents)}
          </span>
          <span className="text-[0.74rem] text-muted">
            /{annual ? "ano" : "mês"}
          </span>
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 px-6 pb-4">
            <EquivLine
              annual={annual}
              perMonthCents={perMonthCents}
              savingsCents={savingsCents}
            />
            <PerkList perks={perks} />
            {switching && <SwitchNote />}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[0.88rem] font-medium text-ink">
                Total hoje
              </span>
              <span className="nums text-[1.15rem] font-semibold text-accent-deep">
                {brl(priceCents)}
              </span>
            </div>
            <SecureLine />
          </div>
        </div>
      </div>
    </div>
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn(
        "size-3 transition-transform duration-200 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
        open && "rotate-180",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Alternar</title>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function Shield() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Seguro</title>
      <path d="M8 1.5l5 2v4c0 3-2.2 4.8-5 6-2.8-1.2-5-3-5-6v-4z" />
      <path d="M5.8 8l1.6 1.6L10.4 6.5" />
    </svg>
  );
}
