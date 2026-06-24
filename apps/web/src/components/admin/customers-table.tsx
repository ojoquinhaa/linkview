"use client";

import { useState } from "react";
import type { CustomerRow } from "@/server/admin/customers";
import { CustomerDrawer } from "./customer-drawer";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const PLAN_LABELS: Record<string, string> = {
  free: "Grátis",
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const STATUS: Record<string, { label: string; tone: string }> = {
  active: {
    label: "Ativa",
    tone: "bg-accent-weak text-accent-deep border-accent-line",
  },
  trialing: { label: "Trial", tone: "bg-surface text-ink-soft border-line" },
  past_due: {
    label: "Atrasada",
    tone: "bg-surface text-danger border-danger/30",
  },
  unpaid: {
    label: "Não paga",
    tone: "bg-surface text-danger border-danger/30",
  },
  canceled: { label: "Cancelada", tone: "bg-surface text-muted border-line" },
  expired: { label: "Expirada", tone: "bg-surface text-muted border-line" },
  pending: { label: "Pendente", tone: "bg-surface text-muted border-line" },
};

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)]">
        <table className="w-full min-w-[820px] text-left text-[0.86rem]">
          <thead>
            <tr className="border-b border-line text-[0.72rem] uppercase tracking-wide text-muted">
              <Th>Workspace</Th>
              <Th>Plano</Th>
              <Th>Assinatura</Th>
              <Th right>Mensalidade</Th>
              <Th right>Links</Th>
              <Th right>Redirects</Th>
              <Th right>Criado</Th>
              <Th right> </Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const status = c.subStatus ? STATUS[c.subStatus] : null;
              return (
                <tr
                  key={c.workspaceId}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-b border-line/70 last:border-0 transition-colors hover:bg-paper-sunk/60"
                >
                  <td className="px-4 py-3">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    <p className="truncate text-[0.78rem] text-muted">
                      {c.ownerName} · {c.ownerEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-line bg-paper-sunk px-2 py-0.5 text-[0.72rem] font-medium text-ink-soft">
                      {PLAN_LABELS[c.planKey] ?? c.planKey}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {status ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.72rem] font-medium ${status.tone}`}
                      >
                        {status.label}
                      </span>
                    ) : (
                      <span className="text-[0.78rem] text-muted">—</span>
                    )}
                  </td>
                  <td className="nums px-4 py-3 text-right text-ink-soft">
                    {c.planPriceCents != null && c.planPriceCents > 0
                      ? fmtBRL(c.planPriceCents)
                      : "—"}
                  </td>
                  <td className="nums px-4 py-3 text-right text-ink-soft">
                    {fmtNum(c.links)}
                  </td>
                  <td className="nums px-4 py-3 text-right text-ink-soft">
                    {fmtNum(c.clicks)}
                  </td>
                  <td className="nums px-4 py-3 text-right text-muted">
                    {fmtDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto size-4"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}
