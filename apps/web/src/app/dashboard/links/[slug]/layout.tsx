import { can } from "@linkview/auth/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/components/dashboard/copy-button";
import { LinkActions } from "@/components/dashboard/link-actions";
import { LinkTabs } from "@/components/dashboard/link-tabs";
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { RealtimeRefresher } from "@/components/dashboard/realtime-refresher";
import { systemDomain } from "@/lib/env";
import { getLinkBySlug } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const { slug } = await params;
  const link = await getLinkBySlug(workspace.id, slug);
  if (!link) notFound();

  const domain = systemDomain();
  const shortUrl = `https://${domain}/${link.slug}`;
  const expired = link.expiresAt && link.expiresAt.getTime() <= Date.now();
  const paused = !link.isActive;

  const canEdit = can(workspace.role, "link.edit");
  const canDelete = can(workspace.role, "link.delete");

  return (
    <div className="flex flex-col">
      <RealtimeRefresher slug={link.slug} />
      {/* Shared header band, flush under the topbar. */}
      <div className="bg-paper px-6 pt-5 sm:px-8">
        <Link
          href="/dashboard/links"
          className="inline-flex w-fit items-center gap-1.5 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink"
        >
          <BackGlyph />
          Todos os links
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={shortUrl}
                target="_blank"
                className="font-mono text-[1.35rem] font-semibold tracking-[-0.01em] text-ink hover:text-accent-deep"
              >
                <span className="text-muted">{domain}/</span>
                <span className="text-accent-deep">{link.slug}</span>
              </Link>
              {paused && <Badge tone="muted">Pausado</Badge>}
              {expired && !paused && <Badge tone="muted">Expirado</Badge>}
              {!paused && !expired && <Badge tone="ok">Ativo</Badge>}
              <LiveIndicator slug={link.slug} />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.85rem] text-muted">
              {link.title && (
                <span className="font-medium text-ink-soft">{link.title}</span>
              )}
              {link.title && <span className="text-line-strong">·</span>}
              <span className="truncate">
                {link.destinationUrl.replace(/^https?:\/\//, "")}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-1">
              <CopyButton value={shortUrl} />
              <Link
                href={shortUrl}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8rem] font-medium text-muted transition-colors hover:bg-paper-sunk hover:text-ink"
              >
                <OpenGlyph />
                Abrir
              </Link>
            </div>
            {(canEdit || canDelete) && (
              <LinkActions
                variant="bar"
                link={{
                  id: link.id,
                  slug: link.slug,
                  destinationUrl: link.destinationUrl,
                  title: link.title,
                  isActive: link.isActive,
                }}
                domain={domain}
                canEdit={canEdit}
                canDelete={canDelete}
                afterDelete="toLinks"
              />
            )}
          </div>
        </div>

        <div className="mt-4 border-b border-line">
          <LinkTabs slug={link.slug} />
        </div>
      </div>

      {/* Active tab content. */}
      <div className="px-6 py-7 sm:px-8">{children}</div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "ok";
}) {
  const cls =
    tone === "ok"
      ? "border-ok/30 bg-ok/10 text-ok"
      : "border-line-strong bg-paper-sunk text-muted";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function BackGlyph() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function OpenGlyph() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
