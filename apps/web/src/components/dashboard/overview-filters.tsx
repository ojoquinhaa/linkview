"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { ChannelOption } from "@/server/workspace-analytics";
import { ChannelSelect } from "./channel-select";

/**
 * Period + channel filters for the operation overview. Both write to the URL
 * search params so the server re-renders the summary; a transition keeps the
 * current view visible (dimmed) while the new data streams in.
 */
export function OverviewFilters({
  periods,
  days,
  channels,
  canal,
}: {
  periods: readonly number[];
  days: number;
  channels: ChannelOption[];
  canal: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <fieldset
        aria-label="Período"
        className="inline-flex shrink-0 rounded-full border border-line bg-paper p-0.5 text-[0.8rem] font-medium"
      >
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setParam("periodo", String(p))}
            aria-pressed={p === days}
            className={`rounded-full px-3 py-1 transition-colors ${
              p === days
                ? "bg-accent text-accent-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {p}d
          </button>
        ))}
      </fieldset>

      {channels.length > 0 && (
        <ChannelSelect
          channels={channels}
          value={canal}
          onChange={(key) => setParam("canal", key)}
        />
      )}
    </div>
  );
}
