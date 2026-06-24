import { can } from "@linkview/auth/permissions";
import { getPlan, type PlanKey } from "@linkview/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { systemDomain } from "@/lib/env";
import { type BioPageListItem, listBioPages } from "@/server/bio-pages-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function PagesPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const planKey = (workspace.planKey as PlanKey) ?? "free";
  const enabled = getPlan(planKey).bioPagesEnabled;
  const canCreate = can(workspace.role, "link.create");
  const pages = enabled ? await listBioPages(workspace.id) : [];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line bg-paper px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-[1.5rem] font-semibold tracking-[-0.02em] text-ink">
            Páginas de links
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted">
            Sua árvore de links — uma página só sua para reunir tudo, com cada
            botão rastreado.
          </p>
        </div>
        {enabled && canCreate && (
          <Link
            href="/dashboard/paginas/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] transition-colors hover:bg-accent-deep"
          >
            <PlusGlyph />
            Nova página
          </Link>
        )}
      </div>

      <div className="px-6 py-6 sm:px-8">
        {!enabled ? (
          <UpgradeCard />
        ) : pages.length === 0 ? (
          <EmptyState canCreate={canCreate} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PageCard({ page }: { page: BioPageListItem }) {
  const domain = systemDomain();
  return (
    <li>
      <Link
        href={`/dashboard/paginas/${page.id}`}
        className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {page.title || page.slug}
            </p>
            <p className="mt-0.5 truncate text-[0.82rem] text-muted">
              {domain}/p/{page.slug}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[0.72rem] font-medium ${
              page.isActive
                ? "bg-accent-weak text-accent-deep"
                : "bg-paper-sunk text-muted"
            }`}
          >
            {page.isActive ? "Ativa" : "Inativa"}
          </span>
        </div>
        <p className="text-[0.82rem] text-muted">
          {page.linkCount} {page.linkCount === 1 ? "link" : "links"}
        </p>
      </Link>
    </li>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="text-[0.95rem] font-medium text-ink-soft">
        Nenhuma página ainda
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[0.85rem] text-muted">
        Crie uma página de links para colocar na bio do Instagram, WhatsApp ou
        onde quiser. Cada botão usa seus links rastreáveis.
      </p>
      {canCreate && (
        <Link
          href="/dashboard/paginas/new"
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] bg-accent pr-4 pl-3.5 text-[0.88rem] font-medium text-accent-ink transition-colors hover:bg-accent-deep"
        >
          <PlusGlyph />
          Criar primeira página
        </Link>
      )}
    </div>
  );
}

function UpgradeCard() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="text-[0.95rem] font-medium text-ink-soft">
        Páginas de links são um recurso Pro
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[0.85rem] text-muted">
        Reúna todos os seus links numa página só, bonita e rastreável.
        Disponível no plano Pro.
      </p>
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <title>Adicionar</title>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}
