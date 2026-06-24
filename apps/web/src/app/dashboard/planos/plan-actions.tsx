"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckoutForm } from "@/app/assinar/checkout-form";
import { Button } from "@/components/ui/button";
import { cancelSubscriptionAction } from "@/server/billing/actions";

type Mode = "trial" | "active";

/**
 * Action zone for the plan page. Upgrades reuse the Asaas checkout form inline
 * (no modal); cancellation is a two-step inline confirm so it never fires by
 * accident.
 */
export function PlanActions({
  mode,
  canceling,
  trialDays,
}: {
  mode: Mode;
  canceling: boolean;
  trialDays: number;
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
            ? `Assine antes que o teste de ${trialDays} dias acabe e mantenha tudo sem interrupção.`
            : "Volte a ter cobrança recorrente e mantenha seu acesso sem data para acabar."
        }
        cta={mode === "trial" ? "Assinar Pro" : "Reativar Pro"}
      />
    );
  }

  return <CancelRow />;
}

function Upgrade({
  title,
  blurb,
  cta,
}: {
  title: string;
  blurb: string;
  cta: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-7">
      <h3 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[0.88rem] text-muted">{blurb}</p>
      {open ? (
        <CheckoutForm />
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
