import Link from "next/link";

/**
 * Slim bar shown under the topbar while a workspace is on its free trial. Tells
 * the user they're on the trial, how long is left, and offers a one-tap path to
 * subscribe before it ends.
 */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const remaining =
    daysLeft <= 0
      ? "termina hoje"
      : daysLeft === 1
        ? "falta 1 dia"
        : `faltam ${daysLeft} dias`;

  return (
    <div className="flex items-center gap-3 border-b border-accent-line bg-accent-weak/60 px-4 py-2 sm:px-6">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
        <Sparkle />
      </span>
      <p className="min-w-0 flex-1 truncate text-[0.82rem] text-accent-deep">
        <span className="font-semibold">Teste grátis do Pro</span>
        <span className="text-accent-deep/70"> · {remaining}</span>
      </p>
      <Link
        href="/dashboard/planos"
        className="shrink-0 rounded-full bg-accent px-3 py-1 text-[0.78rem] font-semibold text-accent-ink transition-colors hover:bg-accent-deep"
      >
        Assinar agora
      </Link>
    </div>
  );
}

function Sparkle() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>Teste grátis</title>
      <path d="M8 0.5l1.6 4.3a3 3 0 0 0 1.6 1.6L15.5 8l-4.3 1.6a3 3 0 0 0-1.6 1.6L8 15.5l-1.6-4.3a3 3 0 0 0-1.6-1.6L0.5 8l4.3-1.6a3 3 0 0 0 1.6-1.6z" />
    </svg>
  );
}
