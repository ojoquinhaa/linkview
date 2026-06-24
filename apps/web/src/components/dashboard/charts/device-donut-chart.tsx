"use client";

import { useMemo } from "react";
import { ChartSkeleton } from "./clicks-area-chart";
import { type EChartsCoreOption, echarts, ReactEChartsCore } from "./echarts";
import { useChartTheme } from "./theme";

export interface DonutSlice {
  label: string;
  total: number;
}

/**
 * Compact donut for a small categorical split (devices). The hole carries the
 * total so the share reads at a glance without a separate KPI. Colors step
 * along the indigo family, keeping the surface Restrained.
 */
export function DeviceDonutChart({ rows }: { rows: DonutSlice[] }) {
  const theme = useChartTheme();
  const total = rows.reduce((s, r) => s + r.total, 0);

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;
    const palette = theme.palette;
    return {
      animationDuration: 550,
      animationEasing: "quarticOut",
      tooltip: {
        trigger: "item",
        backgroundColor: theme.ink,
        borderWidth: 0,
        padding: [6, 10],
        textStyle: { color: theme.surface, fontSize: 12 },
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; percent: number };
          return `${d.name}: <b>${d.value.toLocaleString("pt-BR")}</b> (${Math.round(d.percent)}%)`;
        },
      },
      legend: {
        orient: "vertical",
        right: 4,
        top: "center",
        itemWidth: 9,
        itemHeight: 9,
        icon: "circle",
        textStyle: { color: theme.inkSoft, fontSize: 12.5 },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "82%"],
          center: ["32%", "50%"],
          avoidLabelOverlap: false,
          padAngle: 2,
          itemStyle: {
            borderRadius: 4,
            borderColor: theme.surface,
            borderWidth: 2,
          },
          label: {
            show: true,
            position: "center",
            formatter: () =>
              `{n|${total.toLocaleString("pt-BR")}}\n{l|cliques}`,
            rich: {
              n: {
                fontSize: 22,
                fontWeight: 600,
                color: theme.ink,
                fontFamily: "var(--font-display)",
              },
              l: {
                fontSize: 11,
                color: theme.muted,
                padding: [3, 0, 0, 0],
              },
            },
          },
          emphasis: {
            label: { show: true },
            scaleSize: 4,
          },
          labelLine: { show: false },
          data: rows.map((r, i) => ({
            name: r.label,
            value: r.total,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };
  }, [theme, rows, total]);

  if (!option) return <ChartSkeleton height={200} />;

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
