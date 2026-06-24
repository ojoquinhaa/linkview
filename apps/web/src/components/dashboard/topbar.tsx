"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { NAV } from "./sidebar";
import { UserMenu } from "./user-menu";

const CRUMB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  links: "Links",
  new: "Novo link",
  campanhas: "Campanhas",
  planos: "Planos",
  pagamentos: "Pagamentos",
  configuracoes: "Configurações",
};

const cap = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function useCrumbs(pathname: string) {
  return useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    let acc = "";
    return segs.map((seg) => {
      acc += `/${seg}`;
      return { href: acc, label: CRUMB_LABELS[seg] ?? cap(seg) };
    });
  }, [pathname]);
}

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

function Search() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const pages = useMemo(() => {
    const q = norm(query.trim());
    const all = NAV.map((n) => ({ href: n.href, label: n.label }));
    if (!q) return all;
    return all.filter((p) => norm(p.label).includes(q));
  }, [query]);

  const trimmed = query.trim();
  // Results = matching pages, then a "search in links" action when there's a query.
  const results = useMemo(
    () => [
      ...pages.map((p) => ({ kind: "page" as const, ...p })),
      ...(trimmed
        ? [
            {
              kind: "links" as const,
              href: `/dashboard/links?q=${encodeURIComponent(trimmed)}`,
              label: trimmed,
            },
          ]
        : []),
    ],
    [pages, trimmed],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight when the query (result set) changes.
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Focus with "/" from anywhere on the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (r: (typeof results)[number]) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active] ?? results[0]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
        <Glyph className="size-[18px]">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </Glyph>
      </div>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        placeholder="Buscar páginas e links"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface pr-12 pl-10 text-[0.85rem] text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-5 select-none items-center rounded border border-line bg-paper-sunk px-1.5 font-mono text-[0.7rem] text-muted sm:flex">
        /
      </kbd>

      {open && results.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[0_8px_36px_oklch(0.2_0.02_262/0.16)]"
        >
          <p className="px-2.5 pt-1 pb-1.5 text-[0.68rem] font-medium uppercase tracking-wide text-muted">
            {trimmed ? "Resultados" : "Ir para"}
          </p>
          {results.map((r, i) => {
            const isActive = i === active;
            const current = r.kind === "page" && r.href === pathname;
            return (
              <button
                key={`${r.kind}-${r.href}`}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-2 text-left text-[0.85rem] transition-colors",
                  isActive
                    ? "bg-accent-weak text-accent-deep"
                    : "text-ink-soft",
                )}
              >
                <Glyph
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-accent" : "text-muted",
                  )}
                >
                  {r.kind === "links" ? (
                    <>
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </>
                  ) : (
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  )}
                </Glyph>
                {r.kind === "links" ? (
                  <span className="truncate">
                    Buscar{" "}
                    <span className="font-medium text-ink">“{r.label}”</span>{" "}
                    nos links
                  </span>
                ) : (
                  <span className="flex-1 truncate font-medium">{r.label}</span>
                )}
                {current && (
                  <span className="ml-auto text-[0.7rem] text-muted">
                    atual
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  user,
  workspaceName,
  planLabel,
  roleLabel,
  onMenu,
  menuId,
}: {
  user: { name: string; email: string };
  workspaceName: string;
  planLabel: string;
  roleLabel: string;
  onMenu: () => void;
  menuId: string;
}) {
  const pathname = usePathname();
  const crumbs = useCrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-sm sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir menu"
        aria-controls={menuId}
        className="-ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink md:hidden"
      >
        <Glyph className="size-5">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </Glyph>
      </button>

      <nav aria-label="Trilha" className="min-w-0 shrink">
        <ol className="flex items-center gap-1.5">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li
                key={c.href}
                className={cn(
                  "items-center gap-1.5",
                  last ? "flex" : "hidden sm:flex",
                )}
              >
                {i > 0 && (
                  <Glyph className="hidden size-3.5 text-line-strong sm:block">
                    <path d="m9 6 6 6-6 6" />
                  </Glyph>
                )}
                {last ? (
                  <span
                    aria-current="page"
                    className="truncate text-[0.9rem] font-semibold text-ink"
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    className="text-[0.9rem] text-muted transition-colors hover:text-ink"
                  >
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="ml-auto hidden flex-1 justify-center px-2 sm:flex md:px-6">
        <Search />
      </div>

      <div className="ml-auto shrink-0 sm:ml-0">
        <UserMenu
          name={user.name}
          email={user.email}
          workspaceName={workspaceName}
          planLabel={planLabel}
          roleLabel={roleLabel}
        />
      </div>
    </header>
  );
}
