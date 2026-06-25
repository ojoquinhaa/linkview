"use client";

import { useMemo, useState } from "react";
import type { AdminLinkRow } from "@/server/admin/links";
import { IconSearch, IconX } from "./icons";
import { LinkDrawer } from "./link-drawer";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
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

export function LinksTable({
  links,
  hostname,
}: {
  links: AdminLinkRow[];
  hostname: string;
}) {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return links;
    return links.filter((l) =>
      [
        l.slug,
        l.destinationUrl,
        l.title ?? "",
        l.ownerName,
        l.ownerEmail,
        l.workspaceName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [links, q]);

  const selected = selectedId
    ? (links.find((l) => l.linkId === selectedId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
          <IconSearch className="size-[17px]" />
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código, destino, dono ou workspace"
          className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface pr-9 pl-10 text-[0.85rem] text-ink placeholder:text-muted transition-colors focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Limpar busca"
            className="absolute inset-y-0 right-2.5 my-auto inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-paper-sunk hover:text-ink"
          >
            <IconX className="size-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)]">
        <table className="w-full min-w-[860px] text-left text-[0.86rem]">
          <thead>
            <tr className="border-b border-line text-[0.72rem] uppercase tracking-wide text-muted">
              <Th>Link</Th>
              <Th>Destino</Th>
              <Th>Dono</Th>
              <Th>Status</Th>
              <Th right>Cliques</Th>
              <Th right>Criado</Th>
              <Th right> </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.linkId}
                onClick={() => setSelectedId(l.linkId)}
                className="cursor-pointer border-b border-line/70 last:border-0 transition-colors hover:bg-paper-sunk/60"
              >
                <td className="px-4 py-3">
                  <p className="truncate font-mono font-medium text-ink">
                    {hostname}/{l.slug}
                  </p>
                  {l.title && (
                    <p className="truncate text-[0.78rem] text-muted">
                      {l.title}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="max-w-[22rem] truncate text-ink-soft">
                    {l.destinationUrl}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="truncate text-ink-soft">{l.ownerName}</p>
                  <p className="truncate text-[0.78rem] text-muted">
                    {l.workspaceName} · {PLAN_LABELS[l.planKey] ?? l.planKey}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={l.isActive} expiresAt={l.expiresAt} />
                </td>
                <td className="nums px-4 py-3 text-right text-ink-soft">
                  {fmtNum(l.clicks)}
                </td>
                <td className="nums px-4 py-3 text-right text-muted">
                  {fmtDate(l.createdAt)}
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
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-[0.86rem] text-muted">
            Nenhum link corresponde à busca.
          </p>
        )}
      </div>

      <LinkDrawer
        link={selected}
        hostname={hostname}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function StatusBadge({
  active,
  expiresAt,
}: {
  active: boolean;
  expiresAt: Date | null;
}) {
  const expired =
    expiresAt != null && new Date(expiresAt).getTime() < Date.now();
  if (expired) {
    return (
      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[0.72rem] font-medium text-muted">
        Expirado
      </span>
    );
  }
  return active ? (
    <span className="rounded-full border border-accent-line bg-accent-weak px-2 py-0.5 text-[0.72rem] font-medium text-accent-deep">
      Ativo
    </span>
  ) : (
    <span className="rounded-full border border-danger/30 bg-surface px-2 py-0.5 text-[0.72rem] font-medium text-danger">
      Pausado
    </span>
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
