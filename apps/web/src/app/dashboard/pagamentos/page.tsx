import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listWorkspacePayments,
  type PaymentMethod,
  type PaymentRow,
  type PaymentState,
} from "@/server/billing/payments";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);

const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  card: "Cartão",
  unknown: "—",
};

const STATE_LABEL: Record<PaymentState, string> = {
  paid: "Confirmado",
  pending: "Pendente",
  overdue: "Vencido",
  refunded: "Estornado",
};

export default async function PagamentosPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const { payments, neverPaid, unavailable } = await listWorkspacePayments(
    workspace.id,
  );

  const lastPaid = payments.find((p) => p.state === "paid");
  const summary = unavailable
    ? "Não foi possível carregar agora."
    : payments.length === 0
      ? "Acompanhe aqui suas cobranças e recibos."
      : `${payments.length} ${payments.length === 1 ? "pagamento" : "pagamentos"}${
          lastPaid?.date ? ` · último em ${fmtDate(lastPaid.date)}` : ""
        }.`;

  return (
    <div className="flex flex-col">
      <div className="border-b border-line bg-paper px-6 py-6 sm:px-8">
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
          Pagamentos
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">{summary}</p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        <div className="mx-auto w-full max-w-[52rem]">
          {unavailable ? (
            <Unavailable />
          ) : payments.length === 0 ? (
            <Empty neverPaid={neverPaid} />
          ) : (
            <PaymentsTable payments={payments} />
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)]">
      {/* Desktop: real table. */}
      <table className="hidden w-full border-collapse sm:table">
        <thead>
          <tr className="border-b border-line">
            <Th className="pl-6">Data</Th>
            <Th>Descrição</Th>
            <Th>Forma</Th>
            <Th className="text-right">Valor</Th>
            <Th>Status</Th>
            <Th className="pr-6 text-right">Recibo</Th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr
              key={p.id}
              className="border-b border-line transition-colors last:border-0 hover:bg-paper-sunk"
            >
              <td className="py-4 pl-6 text-[0.86rem] text-ink-soft tabular-nums">
                {p.date ? fmtDate(p.date) : "—"}
              </td>
              <td className="py-4 pr-4 text-[0.88rem] text-ink">
                {p.description ?? "Assinatura Pro"}
              </td>
              <td className="py-4 pr-4">
                <Method method={p.method} />
              </td>
              <td className="py-4 pr-4 text-right text-[0.9rem] font-medium text-ink tabular-nums">
                {brl(p.amountCents)}
              </td>
              <td className="py-4 pr-4">
                <StatusPill state={p.state} />
              </td>
              <td className="py-4 pr-6 text-right">
                <Receipt url={p.invoiceUrl} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: stacked rows. */}
      <ul className="divide-y divide-line sm:hidden">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.9rem] font-medium text-ink">
                  {p.description ?? "Assinatura Pro"}
                </p>
                <p className="mt-0.5 text-[0.78rem] text-muted tabular-nums">
                  {p.date ? fmtDate(p.date) : "—"}
                </p>
              </div>
              <p className="shrink-0 text-[0.95rem] font-semibold text-ink tabular-nums">
                {brl(p.amountCents)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Method method={p.method} />
                <StatusPill state={p.state} />
              </div>
              <Receipt url={p.invoiceUrl} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`py-3 pr-4 text-left text-[0.68rem] font-medium uppercase tracking-wide text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function StatusPill({ state }: { state: PaymentState }) {
  const tone =
    state === "paid"
      ? "border-accent-line bg-accent-weak text-accent-deep"
      : state === "overdue"
        ? "border-danger/25 bg-danger-weak text-danger"
        : "border-line-strong bg-paper-sunk text-muted";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${tone}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

function Method({ method }: { method: PaymentMethod }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.84rem] text-ink-soft">
      <MethodIcon method={method} />
      {METHOD_LABEL[method]}
    </span>
  );
}

function MethodIcon({ method }: { method: PaymentMethod }) {
  const cls = "size-4 shrink-0 text-muted";
  if (method === "pix") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cls}
        fill="currentColor"
      >
        <path d="M12 2.6a2 2 0 0 1 1.43.6l6.77 6.77a2 2 0 0 1 0 2.83l-6.77 6.77a2 2 0 0 1-2.86 0L3.8 12.8a2 2 0 0 1 0-2.83L10.57 3.2A2 2 0 0 1 12 2.6Zm0 2.23L5.23 11.6a.57.57 0 0 0 0 .8L12 19.17l6.77-6.77a.57.57 0 0 0 0-.8Z" />
      </svg>
    );
  }
  if (method === "boleto") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14" />
      </svg>
    );
  }
  if (method === "card") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cls}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
        <line x1="6" y1="14.5" x2="9" y2="14.5" />
      </svg>
    );
  }
  return null;
}

function Receipt({ url }: { url: string | null }) {
  if (!url) return <span className="text-[0.82rem] text-muted">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[0.84rem] font-medium text-accent-deep transition-colors hover:text-accent hover:underline"
    >
      Ver
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}

function Empty({ neverPaid }: { neverPaid: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink">
        Nenhum pagamento ainda
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
        {neverPaid
          ? "Você está no teste grátis, então ainda não há cobranças. Quando assinar o Pro, cada pagamento aparece aqui com o recibo."
          : "Assim que sua primeira cobrança for processada, ela aparece aqui."}
      </p>
      <Link
        href="/dashboard/planos"
        className="mt-5 inline-flex h-10 items-center rounded-[var(--radius-input)] bg-accent px-4 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
      >
        Ver meu plano
      </Link>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink">
        Não foi possível carregar
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
        Tivemos um problema para buscar seus pagamentos agora. Atualize a página
        em alguns instantes.
      </p>
    </div>
  );
}
