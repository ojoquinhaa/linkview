"use client";

import { useMemo } from "react";
import { ChartSkeleton } from "@/components/dashboard/charts/clicks-area-chart";
import {
  type EChartsCoreOption,
  echarts,
  ReactEChartsCore,
} from "@/components/dashboard/charts/echarts";
import { useChartTheme } from "@/components/dashboard/charts/theme";

export interface AdminPoint {
  date: string;
  total: number;
}

/** Value display modes. `brl` formats cents as Brazilian currency. */
export type AdminValueFormat = "number" | "brl";

const fmtNumber = (n: number) => n.toLocaleString("pt-BR");
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

/**
 * Generic single-series area trend for the admin console. Feed it daily points
 * plus a value format (currency or count); the busiest day is marked. Kept
 * separate from the dashboard's stacked clicks chart, which is visitor-specific.
 * Takes a string `format` rather than a function so a server component can
 * render it (functions can't cross the server/client boundary).
 */
export function AdminAreaChart({
  points,
  format = "number",
  height = 240,
  accent,
}: {
  points: AdminPoint[];
  format?: AdminValueFormat;
  height?: number;
  /** Override the line color; defaults to the brand accent. */
  accent?: "indigo" | "green";
}) {
  const theme = useChartTheme();

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;
    const formatValue = format === "brl" ? fmtBRL : fmtNumber;
    const everyNth = Math.max(1, Math.floor(points.length / 7));
    const color = accent === "green" ? theme.palette[2] : theme.accent;

    let peakIdx = -1;
    let peakMax = -1;
    points.forEach((d, i) => {
      if (d.total > peakMax) {
        peakMax = d.total;
        peakIdx = i;
      }
    });
    const peakKey = peakIdx >= 0 ? points[peakIdx].date : null;

    const fmtDay = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
    };

    return {
      animationDuration: 600,
      animationEasing: "quarticOut",
      grid: { top: 28, right: 16, bottom: 26, left: 48 },
      tooltip: {
        trigger: "axis",
        backgroundColor: theme.ink,
        borderWidth: 0,
        padding: [6, 10],
        textStyle: { color: theme.surface, fontSize: 12 },
        axisPointer: {
          type: "line",
          lineStyle: { color: theme.line, width: 1 },
        },
        formatter: (params: unknown) => {
          const arr = params as { name: string; value: number }[];
          if (!arr.length) return "";
          return (
            `<b>${formatValue(arr[0].value)}</b>` +
            `<br/><span style="opacity:.55">${fmtDay(arr[0].name)}</span>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: points.map((d) => d.date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.line } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          interval: everyNth,
          formatter: (key: string) => fmtDay(key),
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitNumber: 3,
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          formatter: (v: number) => formatValue(v),
        },
        splitLine: { lineStyle: { color: theme.line, type: "dashed" } },
      },
      series: [
        {
          type: "line",
          data: points.map((d) => d.total),
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color },
                { offset: 1, color: theme.surface },
              ],
            },
          },
          markPoint:
            peakKey == null
              ? undefined
              : {
                  symbol: "circle",
                  symbolSize: 9,
                  data: [{ coord: [peakKey, peakMax], value: peakMax }],
                  itemStyle: {
                    color: theme.surface,
                    borderColor: color,
                    borderWidth: 2.5,
                  },
                  label: {
                    show: true,
                    position: "top",
                    color,
                    fontSize: 11,
                    fontWeight: 600,
                    formatter: (p: { value: number }) => formatValue(p.value),
                  },
                },
        },
      ],
    };
  }, [theme, points, format, accent]);

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
