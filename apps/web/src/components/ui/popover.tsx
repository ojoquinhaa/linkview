"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type Coords = { left: number; top: number; width: number };

/**
 * A floating panel anchored to a trigger, rendered in a portal so no `overflow`
 * ancestor can clip it. Stays inside the viewport: width is capped, the panel
 * flips above the trigger when there's no room below, and the horizontal
 * position is clamped to the screen with a small margin. The caller owns the
 * trigger element + ref and toggles `open`.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  width = 280,
  align = "start",
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Desired panel width in px; capped to the viewport. */
  width?: number;
  /** Horizontal edge to align with the trigger before clamping. */
  align?: "start" | "end";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    const gap = 6;
    const w = Math.min(width, vw - m * 2);
    const r = anchor.getBoundingClientRect();

    let left = align === "end" ? r.right - w : r.left;
    left = Math.min(Math.max(left, m), vw - w - m);

    const h = panelRef.current?.offsetHeight ?? 0;
    let top = r.bottom + gap;
    if (top + h > vh - m && r.top - gap - h >= m) top = r.top - gap - h;
    top = Math.min(Math.max(top, m), Math.max(m, vh - h - m));

    setCoords({ left, top, width: w });
  }, [anchorRef, width, align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place, onClose, anchorRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={{
        left: coords?.left ?? -9999,
        top: coords?.top ?? -9999,
        width: coords?.width,
        visibility: coords ? "visible" : "hidden",
      }}
      className={cn(
        "fixed z-[80] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.45)]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
