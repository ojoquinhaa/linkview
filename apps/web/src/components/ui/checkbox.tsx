"use client";
import { type ReactNode, useId } from "react";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Label content; can hold links (rendered outside the control's hit area). */
  children: ReactNode;
  invalid?: boolean;
  id?: string;
  name?: string;
}

/**
 * Accessible consent checkbox. The native input drives state and focus; the
 * visual box is a sibling so the label can contain links without nesting
 * interactive elements inside a <label>'s activation target.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  children,
  invalid,
  id,
  name,
}: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-start gap-3">
      <span className="relative grid place-items-center pt-px">
        <input
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer size-[18px] cursor-pointer appearance-none rounded-[6px] border bg-surface outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] checked:border-accent checked:bg-accent focus-visible:shadow-[0_0_0_3px_var(--ring)] aria-[invalid=true]:border-danger"
          style={{
            borderColor: invalid && !checked ? "var(--danger)" : undefined,
          }}
          aria-invalid={invalid || undefined}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute size-3 scale-50 text-accent-ink opacity-0 transition-[opacity,transform] duration-150 ease-[var(--ease-out-quint)] peer-checked:scale-100 peer-checked:opacity-100"
        >
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <label
        htmlFor={inputId}
        className="cursor-pointer select-none text-[0.85rem] leading-snug text-ink-soft"
      >
        {children}
      </label>
    </div>
  );
}
