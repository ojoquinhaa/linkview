"use client";

import { useMemo, useState } from "react";
import { ClicksAreaChart, type TrendPoint } from "./clicks-area-chart";

type View = "dia" | "hora";

const dayShort = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${iso}T00:00:00`),
  );
const dayLong = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(
    new Date(`${iso}T00:00:00`),
  );
const hourShort = (iso: string) => `${new Date(iso).getHours()}h`;
const hourLong = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(d);
  return `${day}, ${d.getHours()}h`;
};

/**
 * Clicks-over-time with a Dia / Hora toggle. Daily spans the 14-day window;
 * hourly spans the last 48 h. The peak bucket is called out above the chart and
 * marked on the line.
 */
export function ClicksTrend({
  byDay,
  byHour,
}: {
  byDay: { date: string; total: number; unique: number }[];
  byHour: { hour: string; total: number; unique: number }[];
}) {
  const [view, setView] = useState<View>("dia");

  const { points, axisLabel, tooltipLabel, peak } = useMemo(() => {
    if (view === "hora") {
      const pts: TrendPoint[] = byHour.map((d) => ({
        key: d.hour,
        value: d.total,
        unique: d.unique,
      }));
      return {
        points: pts,
        axisLabel: hourShort,
        tooltipLabel: hourLong,
        peak: peakOf(pts, hourLong),
      };
    }
    const pts: TrendPoint[] = byDay.map((d) => ({
      key: d.date,
      value: d.total,
      unique: d.unique,
    }));
    return {
      points: pts,
      axisLabel: dayShort,
      tooltipLabel: dayLong,
      peak: peakOf(pts, dayLong),
    };
  }, [view, byDay, byHour]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {peak && peak.value > 0 ? (
          <p className="text-[0.82rem] text-muted">
            Pico:{" "}
            <span className="nums font-semibold text-ink">
              {peak.value.toLocaleString("pt-BR")}
            </span>{" "}
            {peak.value === 1 ? "clique" : "cliques"} {peak.when}
          </p>
        ) : (
          <span />
        )}
        <fieldset
          aria-label="Granularidade"
          className="inline-flex shrink-0 rounded-full border border-line bg-paper p-0.5 text-[0.8rem] font-medium"
        >
          {(["dia", "hora"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-3 py-1 transition-colors ${
                view === v
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v === "dia" ? "Por dia" : "Por hora"}
            </button>
          ))}
        </fieldset>
      </div>

      <ClicksAreaChart
        points={points}
        axisLabel={axisLabel}
        tooltipLabel={tooltipLabel}
      />
    </div>
  );
}

function peakOf(points: TrendPoint[], fmt: (key: string) => string) {
  let best: TrendPoint | null = null;
  for (const p of points) if (!best || p.value > best.value) best = p;
  if (!best) return null;
  return {
    value: best.value,
    when: best.value > 0 ? `(${fmt(best.key)})` : "",
  };
}
