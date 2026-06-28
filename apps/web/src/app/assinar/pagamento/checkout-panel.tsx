"use client";
import type { BillingCycle } from "@linkview/shared";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CheckoutCardForm } from "./checkout-card-form";
import { PixPanel } from "./pix-panel";

type Method = "card" | "pix";

/**
 * Method switcher for our own checkout: a card tab (synchronous charge) and a
 * Pix tab (in-app QR + copy-paste code). Both tabs stay mounted so the Pix QR
 * and its activation poll survive a toggle back and forth — only their
 * visibility changes. The Pix charge is generated lazily the first time its tab
 * is shown, so a card buyer never triggers a Pix charge.
 */
export function CheckoutPanel({
  cycle,
  holderName,
  initialMethod,
}: {
  cycle: BillingCycle;
  holderName: string;
  initialMethod: Method;
}) {
  const [method, setMethod] = useState<Method>(initialMethod);

  return (
    <div>
      <div role="tablist" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
        <Tab
          selected={method === "card"}
          onClick={() => setMethod("card")}
          title="Cartão"
          subtitle="Aprovação na hora"
        />
        <Tab
          selected={method === "pix"}
          onClick={() => setMethod("pix")}
          title="Pix"
          subtitle="QR Code"
        />
      </div>

      <div className={cn("mt-5", method === "card" ? "" : "hidden")}>
        <p className="mb-3.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Dados do cartão
        </p>
        <CheckoutCardForm cycle={cycle} holderName={holderName} />
      </div>

      <div className={cn("mt-5", method === "pix" ? "" : "hidden")}>
        <PixPanel cycle={cycle} active={method === "pix"} />
      </div>
    </div>
  );
}

function Tab({
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
      role="tab"
      aria-selected={selected}
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
