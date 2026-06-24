"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function CopyButton({
  value,
  className,
  label = "Copiar",
  variant = "ghost",
}: {
  value: string;
  className?: string;
  label?: string;
  /** "ghost": borderless inline link. "primary": accent pill for action bars. */
  variant?: "ghost" | "primary";
}) {
  const [copied, setCopied] = useState(false);
  const styles =
    variant === "primary"
      ? cn(
          "h-9 rounded-[var(--radius-input)] border px-3 text-[0.83rem]",
          copied
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-accent-line bg-accent-weak text-accent-deep hover:border-accent/40 hover:text-accent",
        )
      : cn(
          "rounded-md px-2 py-1 text-[0.8rem]",
          copied ? "text-ok" : "text-muted hover:bg-paper-sunk hover:text-ink",
        );
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked; no-op */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors",
        styles,
        className,
      )}
      aria-label={copied ? "Copiado" : label}
    >
      {copied ? (
        <>
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            role="img"
          >
            <title>Copiado</title>
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            role="img"
          >
            <title>Copiar</title>
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M3.5 10.5A1.5 1.5 0 012 9V3.5A1.5 1.5 0 013.5 2H9a1.5 1.5 0 011.5 1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
