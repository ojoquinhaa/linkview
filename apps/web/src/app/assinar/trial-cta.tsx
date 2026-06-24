"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startTrialAction } from "@/server/billing/actions";

const TRIAL_PERKS = [
  "Acesso completo ao Plano Pro",
  "Todos os recursos inclusos",
  "Cancele quando quiser",
];

/**
 * Left "free trial" card shown after sign-up. No fiscal data is asked — it was
 * captured at registration. On success the workspace is already on the trial
 * plan, so we go straight into the dashboard.
 */
export function TrialCta({ days }: { days: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onStart() {
    setError(null);
    setLoading(true);
    try {
      const res = await startTrialAction();
      if (!res.ok) {
        setError(res.error ?? "Não foi possível iniciar o teste.");
        return;
      }
      // Navigating away; keep the button busy through the transition.
      router.push("/dashboard/links");
      router.refresh();
    } catch {
      setError("Não foi possível iniciar o teste. Tente de novo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-accent-weak text-accent">
        <Gift />
      </span>

      <h2 className="mt-5 text-center font-display text-[1.35rem] font-semibold tracking-[-0.02em] text-ink">
        Teste grátis
      </h2>
      <span className="mx-auto mt-2 inline-flex items-center rounded-full bg-accent-weak px-3 py-1 text-[0.78rem] font-semibold text-accent-deep">
        {days} dias grátis
      </span>
      <p className="mx-auto mt-3 max-w-[16rem] text-center text-[0.88rem] leading-relaxed text-muted">
        Experimente todos os recursos do Plano Pro por {days} dias. Sem
        compromisso.
      </p>

      <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
        {TRIAL_PERKS.map((perk) => (
          <li
            key={perk}
            className="flex items-center gap-2.5 text-[0.88rem] text-ink-soft"
          >
            <Check />
            {perk}
          </li>
        ))}
      </ul>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        size="lg"
        loading={loading}
        onClick={onStart}
        className="mt-6 w-full"
      >
        Começar teste grátis
      </Button>
    </div>
  );
}

function Gift() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-6"
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
      className="size-4 shrink-0 text-accent"
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
