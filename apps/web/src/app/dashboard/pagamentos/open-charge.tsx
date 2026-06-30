"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkOpenChargePaidAction } from "@/server/billing/actions";

const POLL_MS = 4000;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export interface OpenChargeView {
  amountCents: number;
  /** Formatted due date, or null. */
  dueLabel: string | null;
  /** Unpaid state — drives the tone (overdue = urgent). */
  state: "pending" | "overdue";
  /** Hosted invoice URL (fallback / boleto). */
  invoiceUrl: string | null;
  /** Pix QR + copy-paste, present when the charge is Pix. */
  pix: { encodedImage: string; payload: string } | null;
}

/**
 * In-app payment for the workspace's open renewal invoice. Renders the existing
 * Asaas charge's Pix QR + copy-paste code (never creates a new charge) and polls
 * until it clears, refreshing to the paid state the moment the Pix lands. Falls
 * back to the hosted invoice link when no Pix QR is available (e.g. boleto).
 */
export function OpenChargePay({ charge }: { charge: OpenChargeView }) {
  const [copied, setCopied] = useState(false);
  const refreshedRef = useRef(false);

  // Poll for clearance while the open charge is shown. Reload to the paid state
  // once it settles. Stops itself after triggering a single refresh.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stopped) return;
      try {
        const res = await checkOpenChargePaidAction();
        if (res.paid && !refreshedRef.current) {
          refreshedRef.current = true;
          stopped = true;
          window.location.reload();
          return;
        }
      } catch {
        // Transient failure: keep polling.
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  async function copy() {
    if (!charge.pix) return;
    try {
      await navigator.clipboard.writeText(charge.pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is still visible to copy by hand.
    }
  }

  const overdue = charge.state === "overdue";

  return (
    <section
      className={`mb-5 overflow-hidden rounded-2xl border bg-surface shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] ${
        overdue ? "border-danger/30" : "border-accent-line"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-4 ${
          overdue ? "bg-danger-weak" : "bg-accent-weak"
        }`}
      >
        <div className="min-w-0">
          <h2
            className={`font-display text-[1.05rem] font-semibold tracking-[-0.01em] ${
              overdue ? "text-danger" : "text-accent-deep"
            }`}
          >
            {overdue ? "Fatura vencida" : "Fatura em aberto"}
          </h2>
          <p className="mt-0.5 text-[0.82rem] text-ink-soft">
            {charge.dueLabel
              ? overdue
                ? `Venceu em ${charge.dueLabel}. Pague para manter seu acesso.`
                : `Pague até ${charge.dueLabel} para renovar seu Pro.`
              : "Pague para renovar seu Pro."}
          </p>
        </div>
        <span className="nums shrink-0 text-[1.15rem] font-semibold text-ink">
          {brl(charge.amountCents)}
        </span>
      </div>

      <div className="px-6 py-6">
        {charge.pix ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-[0.85rem] text-muted">
              Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou
              use o código abaixo.
            </p>
            <div className="rounded-2xl border border-line bg-surface p-3">
              {/** biome-ignore lint/performance/noImgElement: base64 Pix QR, not a remote asset. */}
              <img
                src={`data:image/png;base64,${charge.pix.encodedImage}`}
                alt="QR Code Pix"
                width={200}
                height={200}
                className="size-48 rounded-lg"
              />
            </div>
            <div className="w-full max-w-md">
              <p className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted">
                Pix copia e cola
              </p>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 truncate rounded-[var(--radius-input)] border border-line bg-paper-sunk px-3 py-2.5 font-mono text-[0.78rem] text-ink-soft">
                  {charge.pix.payload}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copy()}
                  className="shrink-0"
                >
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
            <p className="flex items-center justify-center gap-2 text-center text-[0.8rem] text-muted">
              <Spinner className="size-3.5 text-accent" />
              Aguardando o pagamento. Atualizamos assim que cair.
            </p>
          </div>
        ) : charge.invoiceUrl ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[0.85rem] text-muted">
              Sua fatura está pronta. Abra para pagar com Pix ou boleto.
            </p>
            <a
              href={charge.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-[var(--radius-input)] bg-accent px-4 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35)] transition-colors hover:bg-accent-deep"
            >
              Pagar fatura
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className ?? ""}`}
    />
  );
}
