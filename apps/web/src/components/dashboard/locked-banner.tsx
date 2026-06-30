import Link from "next/link";

/**
 * Persistent bar shown when a workspace's billing has lapsed (`locked` access).
 * The dashboard stays reachable read-only so the user can review their data and
 * pay — this explains why nothing saves and links are offline, and routes them
 * to reactivate. Distinct from BillingAlertBanner, which warns *before* the lapse.
 */
export function LockedBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-danger/25 bg-danger-weak px-4 py-2 sm:px-6">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white">
        <Lock />
      </span>
      <p className="min-w-0 flex-1 text-[0.82rem] text-danger">
        <span className="font-semibold">Assinatura inativa</span>
        <span className="text-danger/75">
          {" "}
          · seus links estão fora do ar e as edições estão bloqueadas. Reative
          para voltar ao normal.
        </span>
      </p>
      <Link
        href="/assinar"
        className="shrink-0 rounded-full bg-danger px-3 py-1 text-[0.78rem] font-semibold text-white transition-colors hover:opacity-90"
      >
        Reativar plano
      </Link>
    </div>
  );
}

function Lock() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>Assinatura inativa</title>
      <path d="M8 1a3 3 0 0 0-3 3v2H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 6H11V4a3 3 0 0 0-3-3Zm1.5 5h-3V4a1.5 1.5 0 0 1 3 0v2Z" />
    </svg>
  );
}
