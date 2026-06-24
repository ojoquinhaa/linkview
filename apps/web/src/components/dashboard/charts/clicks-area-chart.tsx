"use client";

import { useMemo } from "react";
import { type EChartsCoreOption, echarts, ReactEChartsCore } from "./echarts";
import { useChartTheme } from "./theme";

export interface TrendPoint {
  /** Opaque key for the bucket (ISO date or ISO hour). */
  key: string;
  /** Total clicks in the bucket. */
  value: number;
  /** Distinct visitors in the bucket (`unique` ≤ `value`). */
  unique: number;
}

/**
 * Stacked-area trend over time. The stack decomposes each bucket into distinct
 * visitors (bottom band) plus repeat clicks (top band), so the stack height is
 * the total click count while the colors separate "clique" from "clique único".
 * Generic over the bucket: feed it daily or hourly points plus label
 * formatters. The busiest bucket is marked in a contrasting color on both bands.
 */
export function ClicksAreaChart({
  points,
  axisLabel,
  tooltipLabel,
  height = 224,
}: {
  points: TrendPoint[];
  axisLabel: (key: string) => string;
  tooltipLabel: (key: string) => string;
  height?: number;
}) {
  const theme = useChartTheme();

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;
    const everyNth = Math.max(1, Math.floor(points.length / 7));

    // Distinct visitors form the bottom band; the remainder (repeat clicks)
    // stacks on top so the combined height stays the total click count.
    const uniques = points.map((d) => Math.min(d.unique, d.value));
    const repeats = points.map((d) => Math.max(0, d.value - d.unique));

    // Busiest bucket by total clicks — highlighted in a contrasting hue on both
    // bands so the peak the header calls out is unmistakable in the chart.
    let peakIdx = -1;
    let peakMax = 0;
    points.forEach((d, i) => {
      if (d.value > peakMax) {
        peakMax = d.value;
        peakIdx = i;
      }
    });
    const peakKey = peakIdx >= 0 ? points[peakIdx].key : null;
    const visitorColor = theme.palette[1]; // teal
    const peakColor = theme.palette[4]; // rose

    const verticalGradient = (top: string, bottom: string) => ({
      type: "linear" as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: top },
        { offset: 1, color: bottom },
      ],
    });

    const peakMark = (color: string, atTotal: boolean) =>
      peakKey == null
        ? undefined
        : {
            symbol: "circle",
            symbolSize: 9,
            data: [
              {
                // Anchor to the bucket value: for the top band that is the
                // stack total, for the bottom band it is the visitor count.
                coord: [peakKey, atTotal ? peakMax : uniques[peakIdx]],
                value: peakMax,
              },
            ],
            itemStyle: {
              color: theme.surface,
              borderColor: peakColor,
              borderWidth: 2.5,
            },
            label: atTotal
              ? {
                  show: true,
                  position: "top",
                  color,
                  fontSize: 11,
                  fontWeight: 600,
                  formatter: (p: { value: number }) =>
                    p.value.toLocaleString("pt-BR"),
                }
              : { show: false },
          };

    return {
      animationDuration: 600,
      animationEasing: "quarticOut",
      grid: { top: 36, right: 14, bottom: 26, left: 28 },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        icon: "roundRect",
        textStyle: { color: theme.muted, fontSize: 11 },
        data: ["Visitantes", "Cliques recorrentes"],
      },
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
          const arr = params as {
            name: string;
            seriesName: string;
            value: number;
          }[];
          if (!arr.length) return "";
          const uniq =
            arr.find((p) => p.seriesName === "Visitantes")?.value ?? 0;
          const rep =
            arr.find((p) => p.seriesName === "Cliques recorrentes")?.value ?? 0;
          const total = uniq + rep;
          return (
            `<b>${total.toLocaleString("pt-BR")}</b> ${
              total === 1 ? "clique" : "cliques"
            }` +
            `<br/><span style="opacity:.7">${uniq.toLocaleString(
              "pt-BR",
            )} visitante${uniq === 1 ? "" : "s"}</span>` +
            `<br/><span style="opacity:.55">${tooltipLabel(arr[0].name)}</span>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: points.map((d) => d.key),
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.line } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          interval: everyNth,
          formatter: (key: string) => axisLabel(key),
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitNumber: 3,
        axisLabel: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.line, type: "dashed" } },
      },
      series: [
        {
          name: "Visitantes",
          type: "line",
          stack: "cliques",
          data: uniques,
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2, color: visitorColor },
          itemStyle: { color: visitorColor },
          emphasis: { focus: "series" },
          areaStyle: { color: verticalGradient(visitorColor, theme.surface) },
          markPoint: peakMark(visitorColor, false),
        },
        {
          name: "Cliques recorrentes",
          type: "line",
          stack: "cliques",
          data: repeats,
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2, color: theme.accent },
          itemStyle: { color: theme.accent },
          emphasis: { focus: "series" },
          areaStyle: {
            color: verticalGradient(theme.accentWeak, theme.surface),
          },
          markPoint: peakMark(theme.accent, true),
        },
      ],
    };
  }, [theme, points, axisLabel, tooltipLabel]);

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

export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-paper-sunk"
      style={{ height }}
    />
  );
}
