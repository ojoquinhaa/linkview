import Link from "next/link";

export type AccountStatusKind = "suspended" | "deleted";

/**
 * Persistent under-topbar bar shown when the account itself is no longer active
 * — admin-suspended or closed (LGPD erasure). The dashboard stays reachable
 * read-only so the owner can review and export; this explains why nothing saves
 * and links are offline, and counts down the days until the data is purged.
 * Distinct from LockedBanner (billing lapsed) — this is account-level.
 */
export function AccountStatusBanner({
  kind,
  daysLeft,
}: {
  kind: AccountStatusKind;
  /** Days left before the retention purge deletes the data. */
  daysLeft: number;
}) {
  const deadline =
    daysLeft <= 0
      ? "seus dados serão excluídos em breve"
      : daysLeft === 1
        ? "seus dados serão excluídos em 1 dia"
        : `seus dados serão excluídos em ${daysLeft} dias`;

  const { title, detail, cta, href } = copyFor(kind, deadline);

  return (
    <div className="flex items-center gap-3 border-b border-danger/25 bg-danger-weak px-4 py-2 sm:px-6">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white">
        <Alert title={title} />
      </span>
      <p className="min-w-0 flex-1 text-[0.82rem] text-danger">
        <span className="font-semibold">{title}</span>
        <span className="text-danger/75">
          {" "}
          · {detail} · {deadline}.
        </span>
      </p>
      <Link
        href={href}
        className="shrink-0 rounded-full bg-danger px-3 py-1 text-[0.78rem] font-semibold text-white transition-colors hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}

function copyFor(
  kind: AccountStatusKind,
  _deadline: string,
): { title: string; detail: string; cta: string; href: string } {
  switch (kind) {
    case "suspended":
      return {
        title: "Conta suspensa",
        detail:
          "acesso somente leitura e seus links estão fora do ar. Regularize para reativar",
        cta: "Falar com suporte",
        href: "/dashboard/suporte",
      };
    case "deleted":
      return {
        title: "Conta encerrada",
        detail:
          "acesso somente leitura e seus links estão fora do ar. Mudou de ideia? Fale com o suporte",
        cta: "Falar com suporte",
        href: "/dashboard/suporte",
      };
  }
}

function Alert({ title }: { title: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <title>{title}</title>
      <path d="M8 1.5a.9.9 0 0 1 .8.46l6.1 11A.9.9 0 0 1 14.1 14H1.9a.9.9 0 0 1-.8-1.04l6.1-11A.9.9 0 0 1 8 1.5Zm0 3.4a.7.7 0 0 0-.7.74l.2 3.3a.5.5 0 0 0 1 0l.2-3.3A.7.7 0 0 0 8 4.9Zm0 5.6a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z" />
    </svg>
  );
}
