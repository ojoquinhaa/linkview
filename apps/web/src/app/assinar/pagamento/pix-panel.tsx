"use client";
import type { BillingCycle } from "@linkview/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkActivationAction,
  createPixCheckoutAction,
  type PixCheckoutActionResult,
} from "@/server/billing/actions";

type Pix = NonNullable<PixCheckoutActionResult["pix"]>;

const POLL_MS = 3500;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * In-app Pix checkout. Generates a dynamic Pix charge on the server (no hosted
 * page), renders its QR + copy-paste code, and polls for activation — routing to
 * the success screen the instant the payment clears. Generation is lazy (only
 * once the tab is shown) and polling only runs while the tab is active.
 */
export function PixPanel({
  cycle,
  active,
}: {
  cycle: BillingCycle;
  active: boolean;
}) {
  const router = useRouter();
  const [pix, setPix] = useState<Pix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createPixCheckoutAction(cycle);
      if (!res.ok || !res.pix) {
        setError(res.error ?? "Não foi possível gerar o Pix.");
        return;
      }
      setPix(res.pix);
    } catch {
      setError("Não foi possível gerar o Pix. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [cycle]);

  // Generate the charge the first time the Pix tab is shown — never before, so a
  // card buyer doesn't create a stray Pix charge.
  useEffect(() => {
    if (active && !startedRef.current) {
      startedRef.current = true;
      void generate();
    }
  }, [active, generate]);

  // Poll for activation while the QR is visible. The "Já paguei" reconcile in
  // checkActivationAction clears the charge even if the webhook is late.
  useEffect(() => {
    if (!active || !pix) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stopped) return;
      try {
        const res = await checkActivationAction();
        if (res.status === "active") {
          stopped = true;
          router.push("/assinar/sucesso");
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
  }, [active, pix, router]);

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is still visible to copy by hand.
    }
  }

  if (loading || (!pix && !error)) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner className="size-5 text-accent" />
        <p className="text-[0.85rem] text-muted">Gerando seu código Pix…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
        >
          {error}
        </div>
        <Button type="button" onClick={() => void generate()} className="w-full">
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!pix) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-[0.85rem] text-muted">
        Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou use o
        código abaixo.
      </p>

      <div className="rounded-2xl border border-line bg-surface p-3">
        {/** biome-ignore lint/performance/noImgElement: base64 Pix QR, not a remote asset. */}
        <img
          src={`data:image/png;base64,${pix.encodedImage}`}
          alt="QR Code Pix"
          width={208}
          height={208}
          className="size-52 rounded-lg"
        />
      </div>

      <p className="nums text-[0.9rem] font-medium text-ink">
        {brl(pix.amountCents)}
      </p>

      <div className="w-full">
        <p className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted">
          Pix copia e cola
        </p>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[var(--radius-input)] border border-line bg-paper-sunk px-3 py-2.5 font-mono text-[0.78rem] text-ink-soft">
            {pix.payload}
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
        Aguardando o pagamento. Liberamos seu acesso assim que cair.
      </p>
    </div>
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
