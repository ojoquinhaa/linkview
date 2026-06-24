"use client";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
}

/**
 * Two-or-more segment toggle built on native radio inputs (keyboard arrow
 * navigation comes for free). Used for the person-type choice. The selected
 * segment carries a raised surface; the track sits on the sunk paper tone so
 * the contrast reads as "this one is active".
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset
      className="grid grid-flow-col gap-1 rounded-[var(--radius-input)] border border-line bg-paper-sunk p-1"
      style={{ gridAutoColumns: "1fr" }}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-[calc(var(--radius-input)-2px)] px-3 py-2 text-center text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease-out-quint)] has-[:focus-visible]:shadow-[0_0_0_3px_var(--ring)]",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.12)]"
                : "text-muted hover:text-ink-soft",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
            {opt.hint && (
              <span className="mt-0.5 text-[0.7rem] font-normal text-muted">
                {opt.hint}
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
