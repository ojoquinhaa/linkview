"use client";

import { useMemo, useRef, useState } from "react";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

const WEEKDAYS = [
  { id: "dom", label: "D" },
  { id: "seg", label: "S" },
  { id: "ter", label: "T" },
  { id: "qua", label: "Q" },
  { id: "qui", label: "Q" },
  { id: "sex", label: "S" },
  { id: "sab", label: "S" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseISO(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d: Date) => iso(startOfDay(d));

const fmtShort = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    d,
  );
const fmtMonth = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    d,
  );

type Patch = Record<string, string | null>;

/**
 * Period filter built around a calendar: quick presets (today, yesterday, last
 * N days) plus a month grid to pick a specific range or a single day. Writes
 * `periodo` for presets and `de`/`ate` for custom ranges; the two are mutually
 * exclusive, so picking one clears the other.
 */
export function DateRangePicker({
  days,
  custom,
  from,
  to,
  setParams,
}: {
  days: number;
  custom: boolean;
  from: string | null;
  to: string | null;
  setParams: (patch: Patch) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const fromD = parseISO(from);
  const toD = parseISO(to);

  // Calendar working state, seeded from the active selection each time it opens.
  const [view, setView] = useState(() => fromD ?? today);
  const [selStart, setSelStart] = useState<Date | null>(fromD);
  const [selEnd, setSelEnd] = useState<Date | null>(toD);

  const openPicker = () => {
    setView(fromD ?? today);
    setSelStart(fromD);
    setSelEnd(toD);
    setOpen(true);
  };

  const label =
    custom && fromD
      ? dayKey(fromD) === dayKey(toD ?? fromD)
        ? fmtShort(fromD)
        : `${fmtShort(fromD)} – ${fmtShort(toD ?? fromD)}`
      : `Últimos ${days} dias`;

  const preset = (n: number) => {
    setParams({ periodo: String(n), de: null, ate: null });
    setOpen(false);
  };
  const pickDays = (count: number) => {
    const end = today;
    const start = addDays(today, -(count - 1));
    setParams({ de: iso(start), ate: iso(end), periodo: null });
    setOpen(false);
  };
  const applyRange = () => {
    if (!selStart) return;
    const a = selEnd && selEnd < selStart ? selEnd : selStart;
    const b = selEnd && selEnd < selStart ? selStart : (selEnd ?? selStart);
    setParams({ de: iso(a), ate: iso(b), periodo: null });
    setOpen(false);
  };
  const clear = () => {
    setParams({ de: null, ate: null });
    setOpen(false);
  };

  const onDay = (d: Date) => {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(d);
      setSelEnd(null);
    } else if (d < selStart) {
      setSelStart(d);
    } else {
      setSelEnd(d);
    }
  };

  const cells = useMemo(() => {
    const y = view.getFullYear();
    const mo = view.getMonth();
    const lead = new Date(y, mo, 1).getDay();
    const count = new Date(y, mo + 1, 0).getDate();
    const list: { key: string; date: Date | null }[] = [];
    for (let i = 0; i < lead; i++) list.push({ key: `blank-${i}`, date: null });
    for (let d = 1; d <= count; d++) {
      const date = new Date(y, mo, d);
      list.push({ key: dayKey(date), date });
    }
    return list;
  }, [view]);

  const canNext =
    view.getFullYear() < today.getFullYear() ||
    (view.getFullYear() === today.getFullYear() &&
      view.getMonth() < today.getMonth());

  const inRange = (d: Date) => {
    if (!selStart) return false;
    const lo = selEnd && selEnd < selStart ? selEnd : selStart;
    const hi = selEnd && selEnd < selStart ? selStart : selEnd;
    if (!hi) return dayKey(d) === dayKey(lo);
    return d >= lo && d <= hi;
  };
  const isEdge = (d: Date) =>
    (selStart && dayKey(d) === dayKey(selStart)) ||
    (selEnd && dayKey(d) === dayKey(selEnd));

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border bg-paper pl-2.5 pr-2.5 text-[0.8rem] font-medium text-ink-soft transition-colors",
          open ? "border-line-strong" : "border-line hover:border-line-strong",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4 text-muted"
        >
          <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
          <path d="M3.5 9h17M8 3v3M16 3v3" />
        </svg>
        <span className="max-w-[11rem] truncate">{label}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "size-3.5 text-muted transition-transform duration-150 ease-[var(--ease-out-quint)]",
            open && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        width={320}
        align="end"
      >
        <div className="flex flex-col">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
            <Chip onClick={() => pickDays(1)}>Hoje</Chip>
            <Chip onClick={() => preset(7)} active={!custom && days === 7}>
              7 dias
            </Chip>
            <Chip onClick={() => preset(14)} active={!custom && days === 14}>
              14 dias
            </Chip>
            <Chip onClick={() => preset(30)} active={!custom && days === 30}>
              30 dias
            </Chip>
            <Chip onClick={() => preset(90)} active={!custom && days === 90}>
              90 dias
            </Chip>
          </div>

          {/* Month grid */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                }
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper-sunk hover:text-ink"
              >
                <Arrow dir="left" />
              </button>
              <span className="text-[0.85rem] font-semibold capitalize text-ink">
                {fmtMonth(view)}
              </span>
              <button
                type="button"
                aria-label="Próximo mês"
                disabled={!canNext}
                onClick={() =>
                  canNext &&
                  setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                }
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                <Arrow dir="right" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {WEEKDAYS.map((w) => (
                <span
                  key={w.id}
                  className="grid h-7 place-items-center text-[0.7rem] font-medium text-muted"
                >
                  {w.label}
                </span>
              ))}
              {cells.map(({ key, date: d }) => {
                if (!d)
                  return <span key={key} aria-hidden="true" className="h-9" />;
                const future = d > today;
                const edge = isEdge(d);
                const within = inRange(d);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={future}
                    onClick={() => onDay(d)}
                    className={cn(
                      "relative grid h-9 place-items-center text-[0.82rem] transition-colors",
                      within && !edge && "bg-accent-weak",
                      edge && "rounded-lg",
                      future
                        ? "text-muted/40"
                        : edge
                          ? "bg-accent font-semibold text-accent-ink"
                          : within
                            ? "text-accent-deep"
                            : "text-ink-soft hover:bg-paper-sunk",
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
            <span className="min-w-0 truncate text-[0.78rem] text-muted">
              {selStart
                ? selEnd && dayKey(selEnd) !== dayKey(selStart)
                  ? `${fmtShort(selStart < selEnd ? selStart : selEnd)} – ${fmtShort(selStart < selEnd ? selEnd : selStart)}`
                  : `${fmtShort(selStart)} · um dia`
                : "Escolha as datas"}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {custom && (
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-[0.8rem] font-medium text-muted transition-colors hover:text-ink"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={applyRange}
                disabled={!selStart}
                className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[0.8rem] font-medium text-accent-ink transition-colors hover:bg-accent-deep disabled:pointer-events-none disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-[0.78rem] font-medium transition-colors",
        active
          ? "border-accent-line bg-accent-weak text-accent-deep"
          : "border-line bg-paper text-ink-soft hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
