"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { checkActivationAction } from "@/server/billing/actions";

type Phase = "confirming" | "done" | "slow";
type StepStatus = "done" | "active" | "pending";

const POLL_MS = 3000;
/** After this long with no confirmation, assume a slow method (boleto) and
 *  reassure instead of pretending it's seconds away. */
const SLOW_AFTER_MS = 30_000;
/** Once slow, back off so we don't hammer Asaas for a charge that clears in
 *  days, while still catching it if it does land during the session. */
const SLOW_POLL_MS = 10_000;

/**
 * Live confirmation tracker. Polls the activation endpoint, advances a three
 * step progress trail, and routes to the thank-you screen the moment the charge
 * clears. If it drags on (boleto), it switches to a calm "we'll email you"
 * state rather than spinning forever.
 */
export function Confirming() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("confirming");
  const startedAt = useRef(Date.now());
  const stopped = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stopped.current) return;

      let active = false;
      try {
        const res = await checkActivationAction();
        active = res.status === "active";
      } catch {
        // Transient failure: keep polling.
      }
      if (stopped.current) return;

      if (active) {
        stopped.current = true;
        setPhase("done");
        // Let the completed trail register before navigating.
        setTimeout(() => router.replace("/assinar/sucesso"), 750);
        return;
      }

      const slow = Date.now() - startedAt.current > SLOW_AFTER_MS;
      if (slow) setPhase("slow");
      timer = setTimeout(poll, slow ? SLOW_POLL_MS : POLL_MS);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [router]);

  const done = phase === "done";
  const slow = phase === "slow";

  const steps: { label: string; status: StepStatus }[] = [
    { label: "Pagamento recebido", status: "done" },
    {
      label: "Confirmando pagamento",
      status: done ? "done" : "active",
    },
    {
      label: "Liberando seu acesso",
      status: done ? "done" : "pending",
    },
  ];

  const heading = done
    ? "Tudo certo!"
    : slow
      ? "Aguardando a confirmação"
      : "Confirmando seu pagamento";

  const blurb = done
    ? "Acesso liberado. Levando você para o painel."
    : slow
      ? "O boleto pode levar alguns dias úteis para compensar. Avisamos por e-mail assim que o pagamento cair: você não precisa esperar aqui."
      : "Pix e cartão costumam liberar em segundos. Pode deixar esta janela aberta.";

  return (
    <div className="w-full max-w-[27rem] animate-rise rounded-2xl border border-line bg-surface p-7 shadow-[0_4px_24px_oklch(0.42_0.16_265/0.07)]">
      <h1 className="font-display text-[1.4rem] font-semibold tracking-[-0.02em] text-ink">
        {heading}
      </h1>
      <p className="mt-2 text-pretty text-[0.9rem] leading-relaxed text-muted">
        {blurb}
      </p>

      {!slow && (
        <div
          className="mt-5 h-1 overflow-hidden rounded-full bg-paper-sunk"
          role="progressbar"
          aria-label="Confirmando pagamento"
        >
          <div
            className={cn(
              "h-full w-1/4 rounded-full bg-accent",
              done ? "w-full transition-[width] duration-500" : "animate-sweep",
            )}
          />
        </div>
      )}

      <ol className="mt-7">
        {steps.map((step, i) => (
          <Step
            key={step.label}
            label={step.label}
            status={step.status}
            last={i === steps.length - 1}
          />
        ))}
      </ol>

      {slow && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="flex items-center justify-center gap-2 text-[0.8rem] text-muted">
            <Spinner className="size-3.5 text-accent" />
            Verificando automaticamente
          </p>
          <Link
            href="/"
            className="mt-4 block text-center text-[0.85rem] font-medium text-accent hover:underline"
          >
            Voltar ao início
          </Link>
        </div>
      )}
    </div>
  );
}

function Step({
  label,
  status,
  last,
}: {
  label: string;
  status: StepStatus;
  last: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[0.6875rem] top-[1.625rem] bottom-1 w-px transition-colors duration-300",
            status === "done" ? "bg-accent" : "bg-line",
          )}
        />
      )}
      <StepIcon status={status} />
      <p
        className={cn(
          "pt-[0.1875rem] text-[0.9rem] font-medium transition-colors duration-300",
          status === "pending" ? "text-muted" : "text-ink",
        )}
      >
        {label}
      </p>
    </li>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
        <Check />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full border-2 border-accent-line bg-surface">
        <Spinner className="size-3 text-accent" />
      </span>
    );
  }
  return (
    <span className="relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full border-2 border-line bg-surface">
      <span className="size-1.5 rounded-full bg-line-strong" />
    </span>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      )}
    />
  );
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Concluído</title>
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}
