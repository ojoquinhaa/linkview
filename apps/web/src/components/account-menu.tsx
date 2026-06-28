"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/**
 * Slim account menu for pages outside the dashboard (the /assinar flow). Shares
 * the dashboard {@link UserMenu}'s visual language, the avatar chip and the
 * dropdown shell, but carries only what these pages need: who you're signed in
 * as, a way back to the app, and sign out. The dashboard link is shown only when
 * the caller says the workspace can actually reach it, so a never-subscribed user
 * is never bounced into a redirect loop.
 */
export function AccountMenu({
  name,
  email,
  canAccessDashboard = false,
}: {
  name: string;
  email: string;
  canAccessDashboard?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
    } finally {
      // Hard navigation, not router.push: a soft nav keeps cached signed-in RSC
      // and can bounce the user back. A full reload re-runs the server with the
      // cleared session cookie.
      window.location.href = "/login";
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-input)] py-1 pr-1 pl-1.5 transition-colors duration-150 ease-[var(--ease-out-quint)] hover:bg-paper-sunk",
          open && "bg-paper-sunk",
        )}
      >
        <span className="hidden max-w-[10rem] truncate pl-1 text-[0.82rem] font-medium text-ink-soft sm:block">
          {name || email}
        </span>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent-line bg-accent-weak text-[0.8rem] font-semibold text-accent-deep"
        >
          {initials(name, email)}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Conta"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-[0_8px_36px_oklch(0.2_0.02_262/0.16)]"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[0.9rem] font-semibold text-ink">
              {name || "Sua conta"}
            </p>
            <p className="truncate text-[0.8rem] text-muted">{email}</p>
          </div>

          <div className="mx-1.5 my-1 border-t border-line" />

          {canAccessDashboard && (
            <Link
              href="/dashboard/links"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-input)] px-3 py-2 text-[0.85rem] font-medium text-ink-soft transition-colors duration-150 ease-[var(--ease-out-quint)] hover:bg-paper-sunk hover:text-ink"
            >
              <Icon>
                <path d="M3 12h18M3 6h18M3 18h18" opacity="0" />
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </Icon>
              Ir para o painel
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={loading}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-input)] px-3 py-2 text-[0.85rem] font-medium text-ink-soft transition-colors duration-150 ease-[var(--ease-out-quint)] hover:bg-paper-sunk hover:text-ink disabled:opacity-55"
          >
            <Icon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icon>
            {loading ? "Saindo…" : "Sair da conta"}
          </button>
        </div>
      )}
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
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
      className="size-[18px] text-muted"
    >
      {children}
    </svg>
  );
}
