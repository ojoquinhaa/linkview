"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/cn";
import { PastDueBanner } from "./past-due-banner";
import { NavLinks, SupportLink, WorkspaceFooter } from "./sidebar";
import { TopBar } from "./topbar";
import { TrialBanner } from "./trial-banner";

export function DashboardShell({
  user,
  workspaceName,
  planLabel,
  roleLabel,
  isAdmin,
  trialDaysLeft,
  pastDueDaysLeft,
  children,
}: {
  user: { name: string; email: string };
  workspaceName: string;
  planLabel: string;
  roleLabel: string;
  isAdmin?: boolean;
  /** Days left on the free trial, or null when not trialing. */
  trialDaysLeft?: number | null;
  /** Days left in the past-due tolerance window, or null when not past due. */
  pastDueDaysLeft?: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll + close on Esc while the mobile drawer is open.
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
      {/* Desktop: persistent rail, logo centered */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-6 md:border-r md:border-line md:bg-paper-sunk md:px-3 md:py-5">
        <div className="flex justify-center">
          <Link href="/dashboard/links" aria-label="linkview">
            <Wordmark size="sm" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks isAdmin={isAdmin} />
        </div>
        <SupportLink />
        <WorkspaceFooter workspaceName={workspaceName} planLabel={planLabel} />
      </aside>

      {/* Right column: topbar + page */}
      <div className="flex min-h-screen min-w-0 flex-col">
        <TopBar
          user={user}
          workspaceName={workspaceName}
          planLabel={planLabel}
          roleLabel={roleLabel}
          onMenu={() => setOpen(true)}
          menuId={drawerId}
        />
        {trialDaysLeft != null && <TrialBanner daysLeft={trialDaysLeft} />}
        {pastDueDaysLeft != null && (
          <PastDueBanner daysLeft={pastDueDaysLeft} />
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile: drawer */}
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
          aria-label="Menu de navegação"
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col gap-6 border-r border-line bg-paper-sunk px-3 py-5 shadow-[0_8px_40px_oklch(0.2_0.02_262/0.18)] transition-transform duration-250 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="relative flex h-8 items-center justify-center">
            <Wordmark size="sm" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-0 inline-flex size-9 items-center justify-center rounded-[var(--radius-input)] text-muted transition-colors hover:bg-surface hover:text-ink"
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
                className="size-5"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
          </div>
          <SupportLink onNavigate={() => setOpen(false)} />
          <WorkspaceFooter
            workspaceName={workspaceName}
            planLabel={planLabel}
          />
        </div>
      </div>
    </div>
  );
}
