"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Width of the edge fade that hints at off-screen tabs. */
const FADE = 22;

type TabIcon = () => React.ReactElement;

const OverviewIcon: TabIcon = () => (
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </>
);

const ChannelsIcon: TabIcon = () => (
  <>
    <path d="M4 9.5v5h3l8 4V5.5l-8 4H4Z" />
    <path d="M18.5 9a3.5 3.5 0 0 1 0 6" />
  </>
);

const QrIcon: TabIcon = () => (
  <>
    <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
    <path d="M14.5 14.5h3v3M20.5 14.5v6M14.5 20.5h3" />
  </>
);

const ShareIcon: TabIcon = () => (
  <>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="17" cy="6" r="2.5" />
    <circle cx="17" cy="18" r="2.5" />
    <path d="M8.2 10.8 14.8 7.2M8.2 13.2l6.6 3.6" />
  </>
);

const SecurityIcon: TabIcon = () => (
  <>
    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.4 7 9 4-1.6 7-4.7 7-9V6l-7-2.5Z" />
    <path d="M9.3 12.2 11.2 14l3.4-3.6" />
  </>
);

const SettingsIcon: TabIcon = () => (
  <>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="9" cy="7" r="2.2" />
    <circle cx="15" cy="17" r="2.2" />
  </>
);

export function LinkTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/dashboard/links/${slug}`;
  const tabs = [
    { label: "Visão geral", href: base, exact: true, Icon: OverviewIcon },
    { label: "Canais", href: `${base}/canais`, Icon: ChannelsIcon },
    { label: "QR Codes", href: `${base}/qr-codes`, Icon: QrIcon },
    {
      label: "Compartilhamento",
      href: `${base}/compartilhamento`,
      Icon: ShareIcon,
    },
    { label: "Segurança", href: `${base}/seguranca`, Icon: SecurityIcon },
    {
      label: "Configurações",
      href: `${base}/configuracoes`,
      Icon: SettingsIcon,
    },
  ];

  // Fade only the edges that still hide tabs: left appears after scrolling,
  // right disappears at the end. No overflow (desktop) → no fade.
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setEdges({
      start: scrollLeft > 1,
      end: scrollLeft < scrollWidth - clientWidth - 1,
    });
  }, []);
  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const mask = `linear-gradient(to right, ${
    edges.start ? "transparent 0" : "#000 0"
  }, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${
    edges.end ? "transparent 100%" : "#000 100%"
  })`;

  return (
    <nav
      ref={ref}
      className="flex flex-col gap-0.5 sm:-mb-px sm:flex-row sm:gap-1 sm:overflow-x-auto sm:overflow-y-hidden sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    >
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
              "relative inline-flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors sm:w-auto sm:gap-1.5 sm:whitespace-nowrap sm:rounded-none",
              active ? "text-accent-deep" : "text-muted hover:text-ink",
              active && "bg-accent-weak sm:bg-transparent",
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
            {/* Mobile: left accent bar. Desktop: bottom underline. */}
            <span
              className={cn(
                "absolute rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)]",
                "left-0 top-1.5 bottom-1.5 w-[3px] sm:inset-x-2 sm:left-2 sm:right-2 sm:top-auto sm:bottom-[-1px] sm:h-0.5 sm:w-auto",
                active ? "bg-accent" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
