"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type TourStep = {
  /** Value of the `data-tour="…"` attribute to spotlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: ReactNode;
  /** Preferred balloon side on desktop; falls back to whichever side has room. */
  placement?: "top" | "bottom";
};

const storageKey = (id: string) => `linkview.tour.${id}.v1`;
const OPEN_EVENT = "linkview:tour-open";

/** Reopen a tour on demand (e.g. from a "Como funciona" button). */
export function openTour(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

type Pos = { left: number; top: number };

export function SpotlightTour({
  id,
  steps,
}: {
  id: string;
  steps: TourStep[];
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const balloonRef = useRef<HTMLDivElement>(null);

  const step = steps[i];
  const last = i === steps.length - 1;

  // Portal only after mount (no SSR document).
  useEffect(() => setMounted(true), []);

  const start = useCallback(() => {
    setI(0);
    setActive(true);
  }, []);

  // Auto-start on first visit; allow manual reopen via openTour(id).
  useEffect(() => {
    if (localStorage.getItem(storageKey(id)) !== "done") start();
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) start();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id, start]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey(id), "done");
    setActive(false);
    setRect(null);
    setPos(null);
  }, [id]);

  // Find + scroll to the current target, then capture its box.
  const measure = useCallback(() => {
    setIsMobile(window.innerWidth < 640);
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`,
    );
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", inline: "center" });
    setRect(el.getBoundingClientRect());
  }, [step]);

  useLayoutEffect(() => {
    if (active) measure();
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [active, measure]);

  // Place the balloon: pinned to the bottom on mobile, beside the target on desktop.
  useLayoutEffect(() => {
    if (!active) return;
    const b = balloonRef.current;
    if (!b) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = b.offsetWidth;
    const bh = b.offsetHeight;
    const m = 12;

    if (!rect) {
      setPos({ left: (vw - bw) / 2, top: (vh - bh) / 2 });
      return;
    }
    if (isMobile) {
      setPos({ left: clamp((vw - bw) / 2, m, vw - bw - m), top: vh - bh - m });
      return;
    }
    const gap = 14;
    const roomBelow = vh - rect.bottom >= bh + gap + m;
    const below =
      step?.placement === "bottom" || (step?.placement !== "top" && roomBelow);
    const top = below ? rect.bottom + gap : rect.top - bh - gap;
    const left = rect.left + rect.width / 2 - bw / 2;
    setPos({
      left: clamp(left, m, vw - bw - m),
      top: clamp(top, m, vh - bh - m),
    });
  }, [active, rect, isMobile, step]);

  // Keyboard: Esc skips, ← → / Enter navigate.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (last) finish();
        else setI((n) => Math.min(steps.length - 1, n + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, last, steps.length, finish]);

  if (!mounted || !active || !step) return null;

  const pad = 6;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className="fixed inset-0 z-[100]"
    >
      {/* Click guard — keeps the user on the buttons during the tour. */}
      <button
        type="button"
        aria-label="Pular tour"
        onClick={finish}
        className={cn(
          "absolute inset-0 cursor-default",
          // No target → dim the whole screen here; with a target the hole div carries the scrim.
          !rect && "bg-[oklch(0.2_0.04_265/0.55)]",
        )}
      />

      {/* Spotlight hole: a giant box-shadow paints the scrim around a rounded cut-out. */}
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl transition-all duration-200 ease-[var(--ease-out-quint)]"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow:
              "0 0 0 9999px oklch(0.2 0.04 265 / 0.55), 0 0 0 2px oklch(0.985 0.002 265 / 0.9)",
          }}
        />
      )}

      {/* Balloon */}
      <div
        ref={balloonRef}
        className="absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-4 text-ink shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.55)]"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          // Hide the very first frame before position is known.
          visibility: pos ? "visible" : "hidden",
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[0.72rem] font-medium uppercase tracking-wide text-muted">
            Passo {i + 1} de {steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-[0.78rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Pular
          </button>
        </div>

        <p className="font-display text-[1.02rem] font-semibold tracking-[-0.01em] text-ink">
          {step.title}
        </p>
        <div className="mt-1 text-[0.86rem] leading-relaxed text-muted">
          {step.body}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {steps.map((s, n) => (
              <span
                key={s.title}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  n === i ? "bg-accent" : "bg-line-strong",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="inline-flex h-9 items-center rounded-[var(--radius-input)] px-3 text-[0.84rem] font-medium text-muted transition-colors hover:text-ink"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                last ? finish() : setI((n) => Math.min(steps.length - 1, n + 1))
              }
              className="inline-flex h-9 items-center rounded-[var(--radius-input)] bg-accent px-4 text-[0.84rem] font-medium text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35)] transition-colors hover:bg-accent-deep"
            >
              {last ? "Entendi" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Inline "Como funciona" link that reopens a tour. Mirrors the dashboard's muted-link style. */
export function TourTrigger({
  id,
  label = "Como funciona",
  className,
}: {
  id: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openTour(id)}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      {label}
    </button>
  );
}
