import { can } from "@linkview/auth/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyButton } from "@/components/dashboard/copy-button";
import { LinkActions } from "@/components/dashboard/link-actions";
import { RealtimeRefresher } from "@/components/dashboard/realtime-refresher";
import { LinksTour } from "@/components/onboarding/link-tours";
import { systemDomain } from "@/lib/env";
import type { LinkListItem } from "@/server/links-query";
import { listLinks } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    d,
  );

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const domain = systemDomain();
  const query = ((await searchParams).q ?? "").trim();
  const all = await listLinks(workspace.id);
  const links = query
    ? all.filter((l) => {
        const q = norm(query);
        return (
          norm(l.slug).includes(q) ||
          norm(l.title ?? "").includes(q) ||
          norm(l.destinationUrl).includes(q)
        );
      })
    : all;
  const totalClicks = links.reduce((sum, l) => sum + l.totalClicks, 0);

  const canEdit = can(workspace.role, "link.edit");
  const canDelete = can(workspace.role, "link.delete");

  return (
    <div className="flex flex-col">
      <RealtimeRefresher />
      {/* Title band: flush under the topbar, same paper tone. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line bg-paper px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
            {query ? "Resultados" : "Seus links"}
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted">
            {query ? (
              <>
                {fmtNum(links.length)}{" "}
                {links.length === 1 ? "link encontrado" : "links encontrados"}{" "}
                para <span className="font-medium text-ink-soft">{query}</span>.{" "}
                <Link
                  href="/dashboard/links"
                  className="font-medium text-accent-deep hover:underline"
                >
                  Limpar
                </Link>
              </>
            ) : all.length === 0 ? (
              "Crie um link e comece a contar os cliques."
            ) : (
              `${fmtNum(all.length)} ${all.length === 1 ? "link" : "links"} · ${fmtNum(totalClicks)} ${totalClicks === 1 ? "clique" : "cliques"} no total.`
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {!query && <LinksTour />}
          <Link
            href="/dashboard/links/new"
            data-tour="links-create"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="size-4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Criar link
          </Link>
        </div>
      </div>

      {/* Content segment. */}
      <div data-tour="links-content" className="px-6 py-7 sm:px-8">
        {links.length === 0 ? (
          query ? (
            <NoResults query={query} />
          ) : (
            <EmptyState domain={domain} />
          )
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((item) => (
              <LinkCard
                key={item.id}
                item={item}
                domain={domain}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LinkCard({
  item,
  domain,
  canEdit,
  canDelete,
}: {
  item: LinkListItem;
  domain: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const shortUrl = `https://${domain}/${item.slug}`;
  const detailHref = `/dashboard/links/${item.slug}`;
  const expired = item.expiresAt && item.expiresAt.getTime() <= Date.now();
  const paused = !item.isActive;

  return (
    <li className="group relative flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] hover:border-line-strong hover:shadow-[0_6px_20px_-8px_oklch(0.42_0.12_265/0.18)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={detailHref}
          className="block min-w-0 truncate font-mono text-[0.9rem] font-medium before:absolute before:inset-0 before:content-['']"
        >
          <span className="text-muted">{domain}/</span>
          <span className="text-accent-deep">{item.slug}</span>
        </Link>
        <div className="relative z-10 -mt-1 -mr-1 shrink-0">
          <LinkActions
            variant="menu"
            link={{
              id: item.id,
              slug: item.slug,
              destinationUrl: item.destinationUrl,
              title: item.title,
              isActive: item.isActive,
            }}
            domain={domain}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>

      <p className="mt-1.5 truncate text-[0.83rem] text-muted">
        {item.title ? (
          <span className="font-medium text-ink-soft">{item.title}</span>
        ) : (
          item.destinationUrl.replace(/^https?:\/\//, "")
        )}
      </p>
      {item.title && (
        <p className="mt-0.5 truncate text-[0.78rem] text-muted">
          {item.destinationUrl.replace(/^https?:\/\//, "")}
        </p>
      )}

      {(paused || expired) && (
        <div className="relative z-10 mt-2.5 flex gap-1.5">
          {paused && <Chip>Pausado</Chip>}
          {expired && !paused && <Chip>Expirado</Chip>}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-end gap-5">
            <div>
              <p className="nums text-[1.05rem] font-semibold leading-none text-ink">
                {fmtNum(item.totalClicks)}
              </p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-muted">
                {item.totalClicks === 1 ? "clique" : "cliques"}
              </p>
            </div>
            <div>
              <p className="nums text-[1.05rem] font-semibold leading-none text-ink">
                {fmtNum(item.uniqueClicks)}
              </p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-muted">
                {item.uniqueClicks === 1 ? "visitante" : "visitantes"}
              </p>
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center">
            <CopyButton value={shortUrl} />
          </div>
        </div>
        <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-muted">
          {fmtDate(item.createdAt)}
        </p>
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line-strong bg-paper-sunk px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink">
        Nada encontrado
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
        Nenhum link combina com{" "}
        <span className="font-medium text-ink-soft">{query}</span>. Tente outro
        termo ou{" "}
        <Link
          href="/dashboard/links"
          className="font-medium text-accent-deep hover:underline"
        >
          veja todos os links
        </Link>
        .
      </p>
    </div>
  );
}

function EmptyState({ domain }: { domain: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-ink">
        Nenhum link ainda
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
        Clique em <span className="font-medium text-ink-soft">Criar link</span>.
        Você cola o endereço, recebe um link curto e um QR Code na hora.
      </p>
      <Link
        href="/dashboard/links/new"
        className="mx-auto mt-5 flex h-10 w-fit items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="size-4"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Criar primeiro link
      </Link>
      <p className="mx-auto mt-5 block w-fit rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[0.82rem] text-muted">
        {domain}/<span className="text-accent-deep">sua-promo</span>
      </p>
    </div>
  );
}
