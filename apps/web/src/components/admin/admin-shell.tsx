"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/cn";

type IconProps = { className?: string };

function Icon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
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
      className={cn("size-[18px] shrink-0", className)}
    >
      {children}
    </svg>
  );
}

const OverviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13.5 12 5l9 8.5" />
    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    <path d="M9.5 20v-5h5v5" />
  </Icon>
);

const CustomersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
  </Icon>
);

const LinksIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 7.5 12.4 6a3.6 3.6 0 0 1 5.1 5.1L16 12.6" />
    <path d="M13 16.5 11.6 18a3.6 3.6 0 0 1-5.1-5.1L8 11.4" />
  </Icon>
);

const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Icon>
);

type NavItem = {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
  exact?: boolean;
};

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", Icon: OverviewIcon, exact: true },
  { href: "/admin/clientes", label: "Clientes", Icon: CustomersIcon },
  { href: "/admin/links", label: "Links", Icon: LinksIcon },
];

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Administração">
      {ADMIN_NAV.map(({ href, label, Icon, exact }) => {
        const active = isActivePath(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-[0.9rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)]",
              active
                ? "bg-accent-weak text-accent-deep"
                : "text-ink-soft hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className={cn(active ? "text-accent" : "text-muted")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="border-t border-line px-1 pt-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-[var(--radius-input)] px-3 py-2 text-[0.85rem] font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink"
      >
        <BackIcon className="text-muted" />
        Voltar ao painel
      </Link>
    </div>
  );
}

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Desktop rail */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-6 md:border-r md:border-line md:bg-paper-sunk md:px-3 md:py-5">
        <div className="flex items-center justify-center gap-2">
          <Link href="/admin" aria-label="linkview admin">
            <Wordmark size="sm" />
          </Link>
          <span className="rounded-full border border-accent-line bg-accent-weak px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-accent-deep">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <Footer />
      </aside>

      {/* Right column */}
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-sm sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-controls={drawerId}
            className="-ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink md:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="size-5"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          <p className="min-w-0 truncate text-[0.9rem] font-semibold text-ink">
            Console administrativo
          </p>

          <div className="ml-auto shrink-0">
            <UserMenu
              name={user.name}
              email={user.email}
              workspaceName="Plataforma"
              planLabel="Admin"
              roleLabel="Administrador"
            />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        inert={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-ink/25 transition-opacity duration-200 ease-[var(--ease-out-quint)]",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          id={drawerId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de administração"
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col gap-6 border-r border-line bg-paper-sunk px-3 py-5 shadow-[0_8px_40px_oklch(0.2_0.02_262/0.18)] transition-transform duration-250 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="relative flex h-8 items-center justify-center gap-2">
            <Wordmark size="sm" />
            <span className="rounded-full border border-accent-line bg-accent-weak px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-accent-deep">
              Admin
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-0 inline-flex size-9 items-center justify-center rounded-[var(--radius-input)] text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                className="size-5"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <Footer onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
