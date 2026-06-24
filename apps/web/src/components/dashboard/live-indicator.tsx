"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceClicks } from "@/lib/use-workspace-clicks";

/**
 * Minimal "ao vivo" badge: a dot that breathes while connected and emits a ping
 * ring each time a click lands on the workspace (or one link, when `slug` is
 * set). Visual only — RealtimeRefresher owns the data refresh.
 */
export function LiveIndicator({ slug }: { slug?: string }) {
  const [hit, setHit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWorkspaceClicks((data) => {
    if (slug && data.slug && data.slug !== slug) return;
    setHit(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHit(false), 1200);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <span
      className={`inline-flex select-none items-center gap-1.5 rounded-full border border-accent-line bg-accent-weak px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-wide text-accent-deep transition-colors ${
        hit ? "border-accent/40" : ""
      }`}
    >
      <span className="relative flex size-1.5">
        {hit && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
        )}
        <span className="relative inline-flex size-1.5 animate-pulse rounded-full bg-accent" />
      </span>
      Ao vivo
    </span>
  );
}
