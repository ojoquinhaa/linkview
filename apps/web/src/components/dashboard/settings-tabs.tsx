"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type TabIcon = () => React.ReactElement;

const ProfileIcon: TabIcon = () => (
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 19.5a7 7 0 0 1 14 0" />
  </>
);

const SecurityIcon: TabIcon = () => (
  <>
    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.4 7 9 4-1.6 7-4.7 7-9V6l-7-2.5Z" />
    <path d="M9.3 12.2 11.2 14l3.4-3.6" />
  </>
);

const AccountIcon: TabIcon = () => (
  <>
    <rect x="4" y="4.5" width="16" height="15" rx="2" />
    <path d="M8 8.5h4M8 12h8M8 15.5h8" />
  </>
);

const BASE = "/dashboard/configuracoes";

export function SettingsTabs() {
  const pathname = usePathname();
  const tabs = [
    { label: "Perfil", href: BASE, exact: true, Icon: ProfileIcon },
    { label: "Segurança", href: `${BASE}/seguranca`, Icon: SecurityIcon },
    { label: "Conta", href: `${BASE}/conta`, Icon: AccountIcon },
  ];

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
              active ? "text-accent-deep" : "text-muted hover:text-ink",
            )}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0"
            >
              <t.Icon />
            </svg>
            {t.label}
            <span
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)]",
                active ? "bg-accent" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
