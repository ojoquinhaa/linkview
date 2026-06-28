"use client";
import type { BillingCycle } from "@linkview/shared";
import { useRouter } from "next/navigation";
import { CardForm } from "@/components/billing/card-form";
import type { RawCard } from "@/lib/card";
import { createCardCheckoutAction } from "@/server/billing/actions";

/**
 * Client wrapper that drives our own card checkout. Hands the card to the server
 * action; on approval it routes straight into the app (the charge is
 * synchronous), or to the confirmation poll if the charge is still settling.
 */
export function CheckoutCardForm({
  cycle,
  holderName,
}: {
  cycle: BillingCycle;
  holderName: string;
}) {
  const router = useRouter();

  async function onSubmit(card: RawCard): Promise<string | null> {
    const res = await createCardCheckoutAction(cycle, card);
    if (!res.ok) return res.error ?? "Não foi possível concluir o pagamento.";
    router.push(
      res.status === "active" ? "/dashboard/links" : "/assinar/confirmando",
    );
    return null;
  }

  return (
    <CardForm
      onSubmit={onSubmit}
      submitLabel="Pagar e ativar o Pro"
      initialHolderName={holderName}
    />
  );
}
