"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

const STORAGE_KEY = "linkview.onboarding.links.v1";

const STEPS = [
  {
    n: "1",
    title: "Cole um link e encurte",
    body: "Transforme qualquer endereço longo num link curto e fácil de compartilhar.",
  },
  {
    n: "2",
    title: "Compartilhe onde quiser",
    body: "Copie o link ou baixe o QR Code para o WhatsApp, Instagram, balcão ou impresso.",
  },
  {
    n: "3",
    title: "Acompanhe os cliques",
    body: "Abra um link para ver de onde vêm os acessos: origem, dispositivo e horário.",
  },
];

export function LinksOnboarding() {
  const router = useRouter();
  // null = not yet read from storage (avoids opening before we know).
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setOpen(localStorage.getItem(STORAGE_KEY) !== "done");
  }, []);

  const remember = () => localStorage.setItem(STORAGE_KEY, "done");

  // Close without persisting: user may want it back next visit.
  const close = () => setOpen(false);

  // Close and never auto-open again.
  const dismiss = () => {
    remember();
    setOpen(false);
  };

  const startCreating = () => {
    remember();
    setOpen(false);
    router.push("/dashboard/links/new");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-1.5 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        Como funciona
      </button>

      <Modal
        open={open === true}
        onClose={close}
        title="Bem-vindo ao linkview"
        description="Crie links curtos e descubra de onde vem cada clique. Em três passos:"
        className="w-[min(30rem,calc(100vw-2rem))]"
      >
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3.5">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-weak font-mono text-[0.8rem] font-semibold text-accent-deep">
                  {s.n}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[0.88rem] font-semibold text-ink">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-[0.83rem] font-medium text-muted transition-colors hover:text-ink"
            >
              Não mostrar de novo
            </button>
            <button
              type="button"
              onClick={startCreating}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-input)] bg-accent px-4 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
            >
              Criar meu primeiro link
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
