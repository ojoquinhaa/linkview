"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { COUNTRIES, countryName, dialCode, flagEmoji } from "@/lib/countries";

/**
 * Country picker that sits flush inside a phone field shell: it renders only the
 * trigger (flag + DDI) and a searchable popover. The surrounding shell owns the
 * border and focus ring, so the trigger keeps just a right divider.
 */
export function PhoneCountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
    const focus = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focus);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/\D/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (digits.length > 0 && dialCode(c.code).includes(digits)),
    );
  }, [query]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`País: ${countryName(value)} (+${dialCode(value)})`}
        className="flex h-11 items-center gap-1.5 rounded-l-[var(--radius-input)] border-r border-line pl-3 pr-2.5 text-sm transition-colors hover:bg-paper-sunk"
      >
        <span className="text-[1.05rem] leading-none">{flagEmoji(value)}</span>
        <span className="font-mono text-[0.82rem] text-muted">
          +{dialCode(value)}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(
            "text-muted transition-transform duration-150 ease-[var(--ease-out-quint)]",
            open && "rotate-180",
          )}
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.45)]">
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país ou DDI"
              className="h-9 w-full rounded-[var(--radius-input)] border border-line bg-paper px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] placeholder:text-muted/80 focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]"
            />
          </div>
          <ul id={listId} className="max-h-60 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-[0.82rem] text-muted">
                Nenhum país encontrado.
              </li>
            ) : (
              results.map((c) => {
                const active = c.code === value;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      aria-current={active || undefined}
                      onClick={() => {
                        onChange(c.code);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-accent-weak text-ink"
                          : "text-ink-soft hover:bg-paper-sunk",
                      )}
                    >
                      <span className="text-[1.05rem] leading-none">
                        {flagEmoji(c.code)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-[0.8rem] text-muted">
                        +{dialCode(c.code)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
