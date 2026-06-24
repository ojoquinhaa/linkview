"use client";

import { useCallback, useState, useTransition } from "react";
import { ufName } from "@/lib/br-states";
import { CLICKS_PAGE_SIZE } from "@/lib/clicks";
import { fetchClicksPage } from "@/server/link-clicks";
import type { ClickRow, ClicksPage } from "@/server/links-query";
import { ChannelIcon } from "./channel-icons";

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
};
const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  email: "E-mail",
  bio: "Bio",
};

const countryName = (() => {
  try {
    const dn = new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return (iso: string) => {
      try {
        return dn.of(iso.toUpperCase()) ?? iso;
      } catch {
        return iso;
      }
    };
  } catch {
    return (iso: string) => iso;
  }
})();

/** ISO alpha-2 to its flag emoji via regional indicator symbols. */
function flagEmoji(iso: string | null): string {
  if (!iso || !/^[a-z]{2}$/i.test(iso)) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65),
  );
}

const fmtWhen = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/**
 * Paginated clicks table. The first page is server-rendered; later pages load
 * on demand through a server action and are cached, so navigating back and
 * forth never refetches and the wire stays light (10 rows at a time).
 */
export function ClicksTable({
  linkId,
  initial,
}: {
  linkId: string;
  initial: ClicksPage;
}) {
  const total = initial.total;
  const pageCount = Math.max(1, Math.ceil(total / CLICKS_PAGE_SIZE));
  const [page, setPage] = useState(initial.page);
  const [cache, setCache] = useState<Record<number, ClickRow[]>>({
    [initial.page]: initial.rows,
  });
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= pageCount) return;
      if (cache[next]) {
        setPage(next);
        return;
      }
      startTransition(async () => {
        const res = await fetchClicksPage(linkId, next);
        setCache((c) => ({ ...c, [next]: res.rows }));
        setPage(next);
      });
    },
    [cache, linkId, pageCount],
  );

  const rows = cache[page] ?? [];
  const from = page * CLICKS_PAGE_SIZE + 1;
  const to = page * CLICKS_PAGE_SIZE + rows.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.85rem]">
          <thead>
            <tr className="text-[0.72rem] uppercase tracking-wide text-muted">
              <Th>Local</Th>
              <Th className="hidden md:table-cell">Estado</Th>
              <Th className="hidden sm:table-cell">Dispositivo</Th>
              <Th className="hidden lg:table-cell">Origem</Th>
              <Th className="text-right">Quando</Th>
            </tr>
          </thead>
          <tbody
            className={pending ? "opacity-50 transition-opacity" : undefined}
          >
            {rows.map((c, i) => {
              const place = [c.city, c.country && countryName(c.country)]
                .filter(Boolean)
                .join(", ");
              return (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: read-only click rows, never reordered
                  key={`${c.occurredAt.toISOString()}-${i}`}
                  className="border-t border-line"
                >
                  <Td>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="text-[1.05rem] leading-none">
                        {flagEmoji(c.country)}
                      </span>
                      <span className="truncate text-ink-soft">
                        {place || "Origem desconhecida"}
                      </span>
                    </span>
                  </Td>
                  <Td className="hidden text-muted md:table-cell">
                    {c.country === "BR" && c.region ? ufName(c.region) : "—"}
                  </Td>
                  <Td className="hidden text-muted sm:table-cell">
                    {c.device ? (DEVICE_LABELS[c.device] ?? c.device) : "—"}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {c.source ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-soft">
                        <ChannelIcon source={c.source} size="sm" />
                        {SOURCE_LABELS[c.source] ?? c.source}
                      </span>
                    ) : (
                      <span className="text-muted">Direto</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-muted">
                    {fmtWhen(c.occurredAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-[0.8rem]">
          <span className="text-muted">
            <span className="nums">
              {from}
              {"–"}
              {to}
            </span>{" "}
            de <span className="nums">{total.toLocaleString("pt-BR")}</span>
          </span>
          <div className="flex items-center gap-1">
            <PagerButton
              onClick={() => go(page - 1)}
              disabled={page === 0 || pending}
              label="Página anterior"
            >
              Anterior
            </PagerButton>
            <span className="nums px-2 text-muted">
              {page + 1} / {pageCount}
            </span>
            <PagerButton
              onClick={() => go(page + 1)}
              disabled={page >= pageCount - 1 || pending}
              label="Próxima página"
            >
              Próxima
            </PagerButton>
          </div>
        </div>
      )}
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
  return <th className={`pb-2 font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`py-2.5 ${className}`}>{children}</td>;
}

function PagerButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-paper-sunk disabled:pointer-events-none disabled:opacity-45"
    >
      {children}
    </button>
  );
}
