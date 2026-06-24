"use client";

import { useMemo } from "react";
import { ChartSkeleton } from "./clicks-area-chart";
import { type EChartsCoreOption, echarts, ReactEChartsCore } from "./echarts";
import { useChartTheme } from "./theme";

export interface BarRow {
  label: string;
  total: number;
}

/** Horizontal bars, biggest on top. Used for devices, sources, countries. */
export function BreakdownBarChart({ rows }: { rows: BarRow[] }) {
  const theme = useChartTheme();
  const height = Math.max(rows.length * 38, 76);

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;
    // ECharts category axis paints bottom-up, so reverse for biggest-on-top.
    const ordered = [...rows].reverse();
    const max = Math.max(1, ...rows.map((r) => r.total));
    return {
      animationDuration: 550,
      animationEasing: "quarticOut",
      grid: { top: 4, right: 40, bottom: 4, left: 4, containLabel: true },
      tooltip: {
        trigger: "item",
        backgroundColor: theme.ink,
        borderWidth: 0,
        padding: [6, 10],
        textStyle: { color: theme.surface, fontSize: 12 },
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number };
          return `${d.name}: <b>${d.value.toLocaleString("pt-BR")}</b>`;
        },
      },
      xAxis: { type: "value", max, show: false },
      yAxis: {
        type: "category",
        data: ordered.map((r) => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.inkSoft, fontSize: 12.5 },
      },
      series: [
        {
          type: "bar",
          // Color by rank (biggest = indigo) so categories read apart at a
          // glance; `ordered` is reversed, so undo it to index the palette.
          data: ordered.map((r, i) => ({
            value: r.total,
            itemStyle: {
              color:
                theme.palette[(ordered.length - 1 - i) % theme.palette.length],
              borderRadius: 6,
            },
          })),
          barWidth: 12,
          label: {
            show: true,
            position: "right",
            color: theme.muted,
            fontSize: 12,
            formatter: (p: { value: number }) =>
              p.value.toLocaleString("pt-BR"),
          },
        },
      ],
    };
  }, [theme, rows]);

  if (!option) return <ChartSkeleton height={height} />;

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
