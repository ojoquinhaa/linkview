"use client";
import { useEffect, useId, useRef, useState } from "react";
import { QR_CHANNEL_KEY } from "@/lib/channel-labels";
import { cn } from "@/lib/cn";
import type { ChannelOption } from "@/server/workspace-analytics";
import { ChannelIcon } from "./channel-icons";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

/** Square mark for an option: brand tile, QR tile, or the "all" grid tile. */
function OptionMark({ channelKey }: { channelKey: string | null }) {
  if (channelKey === null) {
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-paper-sunk text-muted">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="size-3"
        >
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
        </svg>
      </span>
    );
  }
  if (channelKey === QR_CHANNEL_KEY) {
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-ink text-white">
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="size-3"
        >
          <path d="M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 1.5h1.5V10H10v1.5zM14 14v-2.5h-1.5V14H14zm-1.5-4H14v1.5h-1.5V10z" />
        </svg>
      </span>
    );
  }
  return <ChannelIcon source={channelKey} size="sm" />;
}

/**
 * Channel filter for the operation overview. Replaces a native select with an
 * icon dropdown so each channel reads with its brand mark and click count. Keeps
 * the period pill's shape; writes the chosen channel back via {@link onChange}.
 */
export function ChannelSelect({
  channels,
  value,
  onChange,
}: {
  channels: ChannelOption[];
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = value ? channels.find((c) => c.key === value) : null;
  const allTotal = channels.reduce((sum, c) => sum + c.total, 0);

  const choose = (key: string | null) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border bg-paper pl-1.5 pr-2.5 text-[0.8rem] font-medium text-ink-soft transition-colors",
          open ? "border-line-strong" : "border-line hover:border-line-strong",
        )}
      >
        <OptionMark channelKey={selected ? selected.key : null} />
        <span className="max-w-[10rem] truncate">
          {selected ? selected.label : "Todos os canais"}
        </span>
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

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.45)]">
          <ul id={listId} className="max-h-[19rem] overflow-y-auto p-1">
            <Row
              mark={<OptionMark channelKey={null} />}
              label="Todos os canais"
              count={allTotal}
              active={!value}
              onClick={() => choose(null)}
            />
            <li aria-hidden="true" className="mx-2 my-1 border-t border-line" />
            {channels.map((c) => (
              <Row
                key={c.key}
                mark={<OptionMark channelKey={c.key} />}
                label={c.label}
                count={c.total}
                active={c.key === value}
                onClick={() => choose(c.key)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  mark,
  label,
  count,
  active,
  onClick,
}: {
  mark: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={active || undefined}
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[0.83rem] transition-colors",
          active
            ? "bg-accent-weak text-ink"
            : "text-ink-soft hover:bg-paper-sunk",
        )}
      >
        {mark}
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="shrink-0 font-mono text-[0.76rem] tabular-nums text-muted">
          {fmtNum(count)}
        </span>
        {active ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="size-3.5 shrink-0 text-accent"
          >
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span aria-hidden="true" className="size-3.5 shrink-0" />
        )}
      </button>
    </li>
  );
}
