"use client";

import { cn } from "@/lib/cn";
import { DateRangePicker } from "./date-range-picker";
import { useFilterParams } from "./use-filter-params";

/** Date-range filter for a single link's overview. Writes `periodo` / `de` / `ate`. */
export function LinkPeriodFilter({
  days,
  custom,
  from,
  to,
}: {
  days: number;
  custom: boolean;
  from: string | null;
  to: string | null;
}) {
  const { pending, setParams } = useFilterParams();
  return (
    <div className={cn("transition-opacity", pending && "opacity-60")}>
      <DateRangePicker
        days={days}
        custom={custom}
        from={from}
        to={to}
        setParams={setParams}
      />
    </div>
  );
}
