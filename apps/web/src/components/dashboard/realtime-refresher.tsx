"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useWorkspaceClicks } from "@/lib/use-workspace-clicks";

/**
 * Refreshes the current route's server components whenever a click lands — so
 * every tab (overview, channels, QR codes, …) stays live without a reload. Pass
 * `slug` on a link's detail pages to ignore clicks that belong to other links.
 */
export function RealtimeRefresher({ slug }: { slug?: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWorkspaceClicks((data) => {
    if (slug && data.slug && data.slug !== slug) return;
    // Coalesce click bursts into a single refresh.
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, 600);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return null;
}
