"use client";

import { useEffect, useState } from "react";

export interface ChartTheme {
  accent: string;
  accentDeep: string;
  accentWeak: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  surface: string;
  paperSunk: string;
  /** Categorical palette for charts that compare discrete series (donut, bars). */
  palette: string[];
}

const TOKENS: Record<Exclude<keyof ChartTheme, "palette">, string> = {
  accent: "--accent",
  accentDeep: "--accent-deep",
  accentWeak: "--accent-weak",
  ink: "--ink",
  inkSoft: "--ink-soft",
  muted: "--muted",
  line: "--line",
  surface: "--surface",
  paperSunk: "--paper-sunk",
};

// Distinct but muted hues, indigo first so the brand accent stays the anchor.
// Derived from OKLCH (lightness ~0.5-0.74, low-mid chroma) and kept as hex so
// ECharts can interpolate and reuse them safely. Used for categorical charts
// only; the choropleth stays a single-hue sequential ramp on purpose.
const PALETTE = [
  "#385db8", // indigo (accent family)
  "#279ea4", // teal
  "#50a064", // green
  "#d2a249", // amber
  "#ce505b", // rose
  "#835cbe", // violet
];

/**
 * Normalize a CSS color to whatever the canvas serializes it to (hex / rgba).
 * ECharts paints solid OKLCH fills fine, but its color interpolator (visualMap
 * ramps, gradient stops) can't parse `oklch(...)` and falls back to black. The
 * canvas 2d context resolves OKLCH to an interpolatable hex; a sentinel guards
 * the rare engine that rejects the input so we never silently ship black.
 */
function normalizeColor(input: string): string {
  if (typeof document === "undefined") return input;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return input;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = input;
  const out = ctx.fillStyle;
  return out === sentinel && input !== sentinel ? input : out;
}

/**
 * Resolve the design tokens to concrete, canvas-interpolatable colors.
 * Read once on mount: tokens are static (light only) so no observer needed.
 */
export function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const read = (v: string) => normalizeColor(cs.getPropertyValue(v).trim());
    const next = { palette: PALETTE.map(normalizeColor) } as ChartTheme;
    for (const key of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
      next[key] = read(TOKENS[key]);
    }
    setTheme(next);
  }, []);

  return theme;
}
