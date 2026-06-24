"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startTrialAction } from "@/server/billing/actions";

/**
 * Primary "start free trial" choice shown after sign-up. No fiscal data is
 * asked — it was captured at registration. On success the workspace is already
 * on the trial plan, so we go straight into the dashboard.
 */
export function TrialCta({
  days,
  priceLabel,
}: {
  days: number;
  priceLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onStart() {
    setError(null);
    setLoading(true);
    const res = await startTrialAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível iniciar o teste.");
      setLoading(false);
      return;
    }
    router.push("/dashboard/links");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-accent-line bg-accent-weak/60 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[0.72rem] font-semibold text-accent-ink">
          <Sparkle />
          {days} dias grátis
        </span>
        <span className="text-[0.8rem] font-medium text-accent-deep">
          Acesso Pro completo
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
      )}

      <Button
        type="button"
        size="lg"
        loading={loading}
        onClick={onStart}
        className="mt-3 w-full"
      >
        Começar teste grátis de {days} dias
      </Button>
      <p className="mt-2.5 text-center text-[0.78rem] text-muted">
        Sem cobrança hoje. Depois, {priceLabel}/mês · cancele quando quiser.
      </p>
    </div>
  );
}

function Sparkle() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>Teste grátis</title>
      <path d="M8 0.5l1.6 4.3a3 3 0 0 0 1.6 1.6L15.5 8l-4.3 1.6a3 3 0 0 0-1.6 1.6L8 15.5l-1.6-4.3a3 3 0 0 0-1.6-1.6L0.5 8l4.3-1.6a3 3 0 0 0 1.6-1.6z" />
    </svg>
  );
}
