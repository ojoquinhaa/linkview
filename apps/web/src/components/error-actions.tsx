"use client";

/**
 * Client-only actions for the error pages: stepping back through history, and
 * retrying a failed render. Kept out of `error-screen.tsx` so that component
 * stays server-safe for `not-found.tsx`.
 */

const base =
  "inline-flex h-12 w-full select-none items-center justify-center gap-2 rounded-[var(--radius-input)] px-5 text-[0.95rem] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quint)] active:translate-y-px sm:w-auto";

const primary =
  "bg-accent text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] hover:bg-accent-deep";
const secondary =
  "border border-line-strong bg-surface text-ink hover:bg-paper-sunk";

export function BackButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className={`${base} ${secondary}`}
    >
      {label}
    </button>
  );
}

export function RetryButton({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <button type="button" onClick={onRetry} className={`${base} ${primary}`}>
      {label}
    </button>
  );
}
