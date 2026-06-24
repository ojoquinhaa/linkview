"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startTrialAction } from "@/server/billing/actions";

/**
 * "Start free trial" option shown above the Pro checkout. On success the
 * workspace is already on the trial plan, so we send the user straight into the
 * dashboard.
 */
export function TrialCta({ days }: { days: number }) {
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
    <div className="mt-6 flex flex-col gap-3 border-b border-line pb-6">
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
        loading={loading}
        onClick={onStart}
        className="w-full"
      >
        Começar teste grátis de {days} dias
      </Button>
      <p className="text-center text-[0.78rem] text-muted">
        Sem cobrança. Acesso Pro completo · cancele quando quiser.
      </p>
    </div>
  );
}
