"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  name,
  email,
  workspaceName,
  planLabel,
  roleLabel,
}: {
  name: string;
  email: string;
  workspaceName: string;
  planLabel: string;
  roleLabel: string;
}) {
  const router = useRouter();
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
    await signOut();
    router.push("/login");
    router.refresh();
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
        <span className="hidden min-w-0 text-right sm:block">
          <span className="block max-w-[10rem] truncate text-[0.8rem] font-medium text-ink">
            {name || email}
          </span>
          <span className="block text-[0.7rem] text-muted">{roleLabel}</span>
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

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3 py-2 text-[0.8rem]">
            <dt className="text-muted">Workspace</dt>
            <dd className="truncate text-right font-medium text-ink-soft">
              {workspaceName}
            </dd>
            <dt className="text-muted">Plano</dt>
            <dd className="text-right font-medium text-ink-soft">
              {planLabel}
            </dd>
            <dt className="text-muted">Acesso</dt>
            <dd className="text-right font-medium text-ink-soft">
              {roleLabel}
            </dd>
          </dl>

          <div className="mx-1.5 my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={loading}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-input)] px-3 py-2 text-[0.85rem] font-medium text-ink-soft transition-colors duration-150 ease-[var(--ease-out-quint)] hover:bg-paper-sunk hover:text-ink disabled:opacity-55"
          >
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loading ? "Saindo…" : "Sair da conta"}
          </button>
        </div>
      )}
    </div>
  );
}
