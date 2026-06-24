"use client";

import { useMemo } from "react";
import { ChartSkeleton } from "./clicks-area-chart";
import { type EChartsCoreOption, echarts, ReactEChartsCore } from "./echarts";
import { useChartTheme } from "./theme";

export interface GeoDatum {
  /** Matches a GeoJSON feature `name` (ISO alpha-2 for world, UF for Brazil). */
  key: string;
  total: number;
}

interface GeoJson {
  features: { properties: { name: string }; geometry: unknown }[];
}

const registered = new Set<string>();
/** Register a map under `name` exactly once. */
export function ensureMap(name: string, geo: GeoJson) {
  if (registered.has(name)) return;
  echarts.registerMap(name, geo as never);
  registered.add(name);
}

/** Center + zoom that frames one feature, from its geometry bounding box. */
function frameFor(geo: GeoJson, key: string) {
  const feature = geo.features.find((f) => f.properties.name === key);
  if (!feature) return null;
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) {
      for (const n of c) walk(n);
    }
  };
  walk((feature.geometry as { coordinates: unknown }).coordinates);
  const lonSpan = Math.max(maxX - minX, 1);
  const latSpan = Math.max(maxY - minY, 1);
  const zoom = Math.min(
    12,
    Math.max(1.6, Math.min(340 / lonSpan, 150 / latSpan) * 0.55),
  );
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2] as [number, number],
    zoom,
  };
}

/**
 * Generic choropleth over a registered ECharts map. Features with no data stay
 * neutral; the rest fill on an indigo scale. `focusKey` frames a single feature
 * (used to zoom onto the dominant country on the world view).
 */
export function GeoChoropleth({
  mapName,
  geo,
  data,
  total,
  label,
  focusKey,
  baseZoom = 1.05,
  height = 360,
}: {
  mapName: string;
  geo: GeoJson;
  data: GeoDatum[];
  total: number;
  label: (key: string) => string;
  focusKey?: string | null;
  baseZoom?: number;
  height?: number;
}) {
  const theme = useChartTheme();

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!theme) return null;
    ensureMap(mapName, geo);

    const points = data.map((d) => ({ name: d.key, value: d.total }));
    const max = Math.max(1, ...points.map((p) => p.value));
    const frame = focusKey ? frameFor(geo, focusKey) : null;

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
          const d = p as { name: string; value?: number };
          const v = Number.isFinite(d.value) ? (d.value as number) : 0;
          if (!v) return `${label(d.name)}: sem cliques`;
          const pct = total ? Math.round((v / total) * 100) : 0;
          return `${label(d.name)}: <b>${v.toLocaleString("pt-BR")}</b> (${pct}%)`;
        },
      },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        showLabel: false,
        itemHeight: 84,
        itemWidth: 10,
        left: 8,
        bottom: 12,
        text: ["mais", "menos"],
        textStyle: { color: theme.muted, fontSize: 10.5 },
        inRange: { color: [theme.accentWeak, theme.accent, theme.accentDeep] },
      },
      series: [
        {
          type: "map",
          map: mapName,
          roam: true,
          scaleLimit: { min: 1, max: 14 },
          center: frame?.center,
          zoom: frame?.zoom ?? baseZoom,
          itemStyle: {
            areaColor: theme.paperSunk,
            borderColor: theme.line,
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: { areaColor: theme.accentDeep },
            label: { show: false },
          },
          select: { disabled: true },
          label: { show: false },
          data: points,
        },
      ],
    };
  }, [theme, mapName, geo, data, total, focusKey, baseZoom, label]);

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
