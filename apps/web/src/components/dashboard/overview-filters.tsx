"use client";

import type { ChannelOption } from "@/server/workspace-analytics";
import { ChannelSelect } from "./channel-select";
import { DateRangePicker } from "./date-range-picker";
import { useFilterParams } from "./use-filter-params";

/**
 * Period + channel filters for the operation overview. Both write to the URL
 * search params so the server re-renders the summary; a transition keeps the
 * current view visible (dimmed) while the new data streams in.
 */
export function OverviewFilters({
  days,
  custom,
  from,
  to,
  channels,
  canal,
}: {
  days: number;
  custom: boolean;
  from: string | null;
  to: string | null;
  channels: ChannelOption[];
  canal: string | null;
}) {
  const { pending, setParams } = useFilterParams();

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <DateRangePicker
        days={days}
        custom={custom}
        from={from}
        to={to}
        setParams={setParams}
      />

      {channels.length > 0 && (
        <ChannelSelect
          channels={channels}
          value={canal}
          onChange={(key) => setParams({ canal: key })}
        />
      )}
    </div>
  );
}
