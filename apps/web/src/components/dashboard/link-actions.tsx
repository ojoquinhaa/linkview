"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { toggleLinkAction } from "@/server/links";
import { DeleteLinkModal } from "./delete-link-modal";
import { type EditableLink, EditLinkModal } from "./edit-link-modal";
import { PauseLinkModal } from "./pause-link-modal";

function Glyph({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
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
      className={className}
    >
      {children}
    </svg>
  );
}

const EditGlyph = (p: { className?: string }) => (
  <Glyph {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Glyph>
);
const PauseGlyph = (p: { className?: string }) => (
  <Glyph {...p}>
    <line x1="9" y1="6" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="18" />
  </Glyph>
);
const PlayGlyph = (p: { className?: string }) => (
  <Glyph {...p}>
    <path d="m6 4 14 8-14 8Z" />
  </Glyph>
);
const TrashGlyph = (p: { className?: string }) => (
  <Glyph {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
  </Glyph>
);
const DetailGlyph = (p: { className?: string }) => (
  <Glyph {...p}>
    <path d="M3 12h12" />
    <path d="m11 8 4 4-4 4" />
    <path d="M21 4v16" />
  </Glyph>
);

export function LinkActions({
  variant,
  link,
  domain,
  canEdit,
  canDelete,
  afterDelete = "stay",
}: {
  variant: "menu" | "bar";
  link: EditableLink;
  domain: string;
  canEdit: boolean;
  canDelete: boolean;
  /** "toLinks" navigates back to the list after delete; "stay" just refreshes. */
  afterDelete?: "stay" | "toLinks";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Pausing is gated behind a confirmation modal (it breaks the live link);
  // re-activating is harmless, so it fires immediately.
  const togglePause = () => {
    setMenuOpen(false);
    if (link.isActive) {
      setPauseOpen(true);
      return;
    }
    startTransition(async () => {
      await toggleLinkAction(link.id, true);
      router.refresh();
    });
  };

  const handleSaved = (slug: string) => {
    if (variant === "bar" && slug !== link.slug) {
      router.push(`/dashboard/links/${slug}`);
    } else {
      router.refresh();
    }
  };

  const handleDeleted = () => {
    if (afterDelete === "toLinks") router.push("/dashboard/links");
    else router.refresh();
  };

  const modals = (
    <>
      {canEdit && (
        <EditLinkModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          link={link}
          domain={domain}
          onSaved={handleSaved}
        />
      )}
      {canEdit && (
        <PauseLinkModal
          open={pauseOpen}
          onClose={() => setPauseOpen(false)}
          id={link.id}
          label={`${domain}/${link.slug}`}
          onPaused={() => router.refresh()}
        />
      )}
      {canDelete && (
        <DeleteLinkModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          id={link.id}
          label={`${domain}/${link.slug}`}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );

  // Detail page: explicit buttons.
  if (variant === "bar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-input)] border border-line-strong bg-surface px-3 text-[0.83rem] font-medium text-ink transition-colors hover:bg-paper-sunk"
            >
              <EditGlyph className="size-4 text-muted" />
              Editar
            </button>
            <button
              type="button"
              onClick={togglePause}
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-input)] border border-line-strong bg-surface px-3 text-[0.83rem] font-medium text-ink transition-colors hover:bg-paper-sunk disabled:opacity-55"
            >
              {link.isActive ? (
                <PauseGlyph className="size-4 text-muted" />
              ) : (
                <PlayGlyph className="size-4 text-muted" />
              )}
              {link.isActive ? "Pausar" : "Ativar"}
            </button>
          </>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-input)] border border-line-strong bg-surface px-3 text-[0.83rem] font-medium text-ink-soft transition-colors hover:border-danger/40 hover:bg-danger-weak hover:text-danger"
          >
            <TrashGlyph className="size-4" />
            Excluir
          </button>
        )}
        {modals}
      </div>
    );
  }

  // List row: kebab menu.
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Ações do link"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-sunk hover:text-ink",
          menuOpen && "bg-paper-sunk text-ink",
        )}
      >
        <Glyph className="size-[18px]">
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </Glyph>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[0_8px_28px_oklch(0.2_0.02_262/0.16)]"
        >
          <a
            role="menuitem"
            href={`/dashboard/links/${link.slug}`}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
          >
            <DetailGlyph className="size-4 text-muted" />
            Ver detalhes
          </a>
          {canEdit && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setEditOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
              >
                <EditGlyph className="size-4 text-muted" />
                Editar
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={togglePause}
                disabled={pending}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink disabled:opacity-55"
              >
                {link.isActive ? (
                  <PauseGlyph className="size-4 text-muted" />
                ) : (
                  <PlayGlyph className="size-4 text-muted" />
                )}
                {link.isActive ? "Pausar" : "Ativar"}
              </button>
            </>
          )}
          {canDelete && (
            <>
              <div className="mx-1 my-1 border-t border-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] text-ink-soft transition-colors hover:bg-danger-weak hover:text-danger"
              >
                <TrashGlyph className="size-4" />
                Excluir
              </button>
            </>
          )}
        </div>
      )}
      {modals}
    </div>
  );
}
