import Link from "next/link";

export type BillingAlertKind = "pix_pending" | "pix_overdue" | "card_failed";

/**
 * Persistent under-topbar bar that surfaces a billing action the user must take,
 * mirroring the email we send for the same event. Three states:
 *  - `pix_pending`  a Pix renewal invoice is open but not yet due — informational
 *                   (brand tone), routes to pay it in-app.
 *  - `pix_overdue`  the Pix invoice passed its due date — urgent (danger tone),
 *                   shows how many days of access remain (7-day tolerance window).
 *  - `card_failed`  the recurring card charge was refused — urgent, routes to
 *                   update the card on the plan page.
 * Distinct from LockedBanner (already lapsed) and TrialBanner (no problem).
 */
export function BillingAlertBanner({
  kind,
  dueLabel,
  daysLeft,
}: {
  kind: BillingAlertKind;
  /** Formatted due date of the open charge, or null. */
  dueLabel: string | null;
  /** Days left in the past-due tolerance window, or null when not yet due. */
  daysLeft: number | null;
}) {
  const danger = kind !== "pix_pending";

  const remaining =
    daysLeft == null
      ? null
      : daysLeft <= 0
        ? "acesso encerra hoje"
        : daysLeft === 1
          ? "falta 1 dia de acesso"
          : `faltam ${daysLeft} dias de acesso`;

  const { title, detail, cta, href } = copyFor(kind, dueLabel, remaining);

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2 sm:px-6 ${
        danger
          ? "border-danger/25 bg-danger-weak"
          : "border-accent-line bg-accent-weak"
      }`}
    >
      <span
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white ${
          danger ? "bg-danger" : "bg-accent"
        }`}
      >
        <Alert title={title} />
      </span>
      <p
        className={`min-w-0 flex-1 truncate text-[0.82rem] ${
          danger ? "text-danger" : "text-accent-deep"
        }`}
      >
        <span className="font-semibold">{title}</span>
        {detail && (
          <span className={danger ? "text-danger/75" : "text-accent-deep/75"}>
            {" "}
            · {detail}
          </span>
        )}
      </p>
      <Link
        href={href}
        className={`shrink-0 rounded-full px-3 py-1 text-[0.78rem] font-semibold text-white transition-colors hover:opacity-90 ${
          danger ? "bg-danger" : "bg-accent"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function copyFor(
  kind: BillingAlertKind,
  dueLabel: string | null,
  remaining: string | null,
): { title: string; detail: string | null; cta: string; href: string } {
  switch (kind) {
    case "pix_pending":
      return {
        title: "Fatura Pro em aberto",
        detail: dueLabel
          ? `pague pelo Pix até ${dueLabel}`
          : "pague pelo Pix para renovar",
        cta: "Pagar agora",
        href: "/dashboard/pagamentos",
      };
    case "pix_overdue":
      return {
        title: "Fatura Pro vencida",
        detail: remaining ?? "pague para manter seu acesso",
        cta: "Pagar agora",
        href: "/dashboard/pagamentos",
      };
    case "card_failed":
      return {
        title: "Cobrança do cartão falhou",
        detail: remaining
          ? `atualize o cartão · ${remaining}`
          : "atualize o cartão para manter o Pro",
        cta: "Atualizar cartão",
        href: "/dashboard/planos",
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
