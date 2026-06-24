"use client";

import { useEffect, useState } from "react";

/**
 * True on touch / pen devices. Used to disable ECharts map `roam`: on a phone,
 * panning the map would otherwise capture the gesture and trap page scroll.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return coarse;
}

/**
 * Pick a chart height by viewport: tall charts (maps) shrink on phones so they
 * don't swallow the screen. Starts at `desktop` for SSR, corrects on mount.
 */
export function useChartHeight(desktop: number, mobile: number): number {
  const [height, setHeight] = useState(desktop);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setHeight(mq.matches ? mobile : desktop);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [desktop, mobile]);
  return height;
}
