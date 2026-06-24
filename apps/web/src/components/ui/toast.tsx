"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "ok" | "danger";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Lightweight, self-contained toast queue. Auto-dismisses each entry. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2600,
    );
  }, []);

  return { toasts, toast };
}

function ToastItem({ toast }: { toast: Toast }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[var(--radius-input)] border bg-surface px-3.5 py-2.5 text-[0.85rem] font-medium text-ink shadow-[0_8px_24px_-8px_oklch(0.2_0.05_265/0.3)]",
        "transition-[opacity,transform] duration-200 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        toast.tone === "danger" ? "border-danger/30" : "border-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full",
          toast.tone === "danger"
            ? "bg-danger-weak text-danger"
            : "bg-accent-weak text-ok",
        )}
      >
        {toast.tone === "danger" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            className="size-3"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {toast.message}
    </div>
  );
}

export function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
