"use client";
import { useEffect, useState } from "react";

const SLUGS = ["oferta", "cardapio", "whats", "promo-junho", "agendar", "pix"];

/** Ambient brand motif: a short link being typed. Pauses for reduced motion. */
export function ShortLinkTicker() {
  const [text, setText] = useState(SLUGS[0] ?? "oferta");

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    let raf = 0;
    let phase: "hold" | "erase" | "type" = "hold";
    let index = 0;
    let next = SLUGS[index] ?? "oferta";
    let shown = next.length;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      if (phase === "hold" && dt > 1800) {
        phase = "erase";
        last = now;
      } else if (phase === "erase" && dt > 55) {
        shown -= 1;
        setText(next.slice(0, Math.max(0, shown)));
        last = now;
        if (shown <= 0) {
          index = (index + 1) % SLUGS.length;
          next = SLUGS[index] ?? "oferta";
          phase = "type";
        }
      } else if (phase === "type" && dt > 90) {
        shown += 1;
        setText(next.slice(0, shown));
        last = now;
        if (shown >= next.length) phase = "hold";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="font-mono text-[0.82rem] text-muted">
      lnkv.com.br/
      <span className="text-accent">{text}</span>
      <span className="ml-px inline-block h-[1.05em] w-px translate-y-[0.18em] animate-pulse bg-accent align-baseline" />
    </span>
  );
}
