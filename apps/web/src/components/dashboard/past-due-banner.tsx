import Link from "next/link";

/**
 * Slim bar shown under the topbar while a workspace's subscription is past due.
 * There is no card on file, so renewal is a manual invoice — this nudges the
 * user to pay before access is cut off. Links to the payments page where the
 * open invoice is listed.
 */
export function PastDueBanner({ daysLeft }: { daysLeft: number }) {
  const remaining =
    daysLeft <= 0
      ? "acesso encerra hoje"
      : daysLeft === 1
        ? "falta 1 dia de acesso"
        : `faltam ${daysLeft} dias de acesso`;

  return (
    <div className="flex items-center gap-3 border-b border-danger/25 bg-danger-weak px-4 py-2 sm:px-6">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white">
        <Alert />
      </span>
      <p className="min-w-0 flex-1 truncate text-[0.82rem] text-danger">
        <span className="font-semibold">Fatura em aberto</span>
        <span className="text-danger/75"> · {remaining}</span>
      </p>
      <Link
        href="/dashboard/pagamentos"
        className="shrink-0 rounded-full bg-danger px-3 py-1 text-[0.78rem] font-semibold text-white transition-colors hover:opacity-90"
      >
        Pagar agora
      </Link>
    </div>
  );
}

function Alert() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>Fatura em aberto</title>
      <path d="M8 1.5a.9.9 0 0 1 .8.46l6.1 11A.9.9 0 0 1 14.1 14H1.9a.9.9 0 0 1-.8-1.04l6.1-11A.9.9 0 0 1 8 1.5Zm0 3.4a.7.7 0 0 0-.7.74l.2 3.3a.5.5 0 0 0 1 0l.2-3.3A.7.7 0 0 0 8 4.9Zm0 5.6a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z" />
    </svg>
  );
}
