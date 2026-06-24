"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="13.5" y="12.5" width="7.5" height="8.5" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
  </Icon>
);

const LinksIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </Icon>
);

const PlansIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </Icon>
);

const PaymentsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <line x1="2" y1="9.5" x2="22" y2="9.5" />
    <line x1="6" y1="14.5" x2="9" y2="14.5" />
  </Icon>
);

const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </Icon>
);

const AdminIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4 6v5c0 4.5 3.2 7.8 8 10 4.8-2.2 8-5.5 8-10V6Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

const SupportIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  </Icon>
);

type NavItem = {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.ReactElement;
  exact?: boolean;
};

/** Single source of truth for dashboard navigation. Reused by the topbar search. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon, exact: true },
  { href: "/dashboard/links", label: "Links", Icon: LinksIcon },
  { href: "/dashboard/planos", label: "Planos", Icon: PlansIcon },
  { href: "/dashboard/pagamentos", label: "Pagamentos", Icon: PaymentsIcon },
  {
    href: "/dashboard/configuracoes",
    label: "Configurações",
    Icon: SettingsIcon,
  },
];

export function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  onNavigate,
  isAdmin,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...NAV, { href: "/admin", label: "Admin", Icon: AdminIcon } as NavItem]
    : NAV;
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Principal">
      {items.map(({ href, label, Icon, exact }) => {
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

/** Quiet escape hatch to human support, pinned just above the workspace footer. */
export function SupportLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, "/dashboard/suporte");
  return (
    <Link
      href="/dashboard/suporte"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-input)] px-3 py-2 text-[0.9rem] font-medium transition-colors duration-150 ease-[var(--ease-out-quint)]",
        active
          ? "bg-accent-weak text-accent-deep"
          : "text-ink-soft hover:bg-surface hover:text-ink",
      )}
    >
      <SupportIcon className={cn(active ? "text-accent" : "text-muted")} />
      Suporte
    </Link>
  );
}

export function WorkspaceFooter({
  workspaceName,
  planLabel,
}: {
  workspaceName: string;
  planLabel: string;
}) {
  return (
    <div className="border-t border-line px-1 pt-4">
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="min-w-0 truncate text-[0.85rem] font-medium text-ink-soft">
          {workspaceName}
        </p>
        <span className="shrink-0 rounded-full border border-accent-line bg-accent-weak px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-accent-deep">
          {planLabel}
        </span>
      </div>
    </div>
  );
}
