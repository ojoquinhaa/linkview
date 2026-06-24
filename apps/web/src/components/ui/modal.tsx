"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Mirror React state onto the native dialog.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Esc (cancel) and backdrop click both close.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === d) onClose();
    };
    d.addEventListener("cancel", onCancel);
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("click", onClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.45)] backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col">
          <header className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-[0.85rem] text-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-1.5 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-muted transition-colors hover:bg-paper-sunk hover:text-ink"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                className="size-4"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </header>
          <div className="px-5 pt-4 pb-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
