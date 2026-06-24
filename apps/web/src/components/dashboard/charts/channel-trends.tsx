"use client";

import { useMemo, useState } from "react";
import { QR_CHANNEL_KEY } from "@/lib/channel-labels";
import type { ChannelTrends as ChannelTrendsData } from "@/server/links-query";
import { ChartSkeleton } from "./clicks-area-chart";
import { type EChartsCoreOption, echarts, ReactEChartsCore } from "./echarts";
import { useChartTheme } from "./theme";

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
 * One line per channel over time, with a Dia / Hora toggle that mirrors the
 * overview's clicks trend. UTM sources cycle the indigo-anchored categorical
 * palette; the aggregated QR Code line is reserved a warm rose so scans read as
 * a distinct origin, not just another source.
 */
export function ChannelTrends({
  data,
  height = 280,
}: {
  data: ChannelTrendsData;
  height?: number;
}) {
  const [view, setView] = useState<View>("dia");
  const theme = useChartTheme();

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;

    const isDay = view === "dia";
    const axisKeys = isDay ? data.days : data.hours;
    const axisLabel = isDay ? dayShort : hourShort;
    const tooltipLabel = isDay ? dayLong : hourLong;
    const everyNth = Math.max(1, Math.floor(axisKeys.length / 7));

    // Reserve rose (palette[4]) for QR; sources walk the rest, indigo first.
    const sourceColors = [
      theme.palette[0],
      theme.palette[1],
      theme.palette[2],
      theme.palette[5],
      theme.palette[3],
    ];
    const qrColor = theme.palette[4];

    let nextSource = 0;
    const series = data.series.map((s) => {
      const isQr = s.key === QR_CHANNEL_KEY;
      const color = isQr
        ? qrColor
        : sourceColors[nextSource++ % sourceColors.length];
      return {
        name: s.label,
        type: "line" as const,
        data: isDay ? s.byDay : s.byHour,
        smooth: 0.3,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: {
          width: 2,
          color,
          type: isQr ? ("dashed" as const) : ("solid" as const),
        },
        itemStyle: { color },
        emphasis: { focus: "series" as const },
      };
    });

    return {
      animationDuration: 600,
      animationEasing: "quarticOut",
      color: series.map((s) => s.itemStyle.color),
      grid: { top: 40, right: 14, bottom: 26, left: 30 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 11,
        itemHeight: 11,
        icon: "roundRect",
        textStyle: { color: theme.muted, fontSize: 11 },
        data: series.map((s) => s.name),
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: theme.ink,
        borderWidth: 0,
        padding: [8, 11],
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
            marker: string;
          }[];
          if (!arr.length) return "";
          const rows = arr
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(
              (p) =>
                `${p.marker}${p.seriesName}: <b>${p.value.toLocaleString(
                  "pt-BR",
                )}</b>`,
            )
            .join("<br/>");
          const head = `<span style="opacity:.55">${tooltipLabel(
            arr[0].name,
          )}</span>`;
          return rows
            ? `${head}<br/>${rows}`
            : `${head}<br/><span style="opacity:.55">sem cliques</span>`;
        },
      },
      xAxis: {
        type: "category",
        data: axisKeys,
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
      series,
    };
  }, [theme, view, data]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
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

      {option ? (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      ) : (
        <ChartSkeleton height={height} />
      )}
    </div>
  );
}
