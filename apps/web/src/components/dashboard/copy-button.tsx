"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function CopyButton({
  value,
  className,
  label = "Copiar",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8rem] font-medium transition-colors",
        copied ? "text-ok" : "text-muted hover:bg-paper-sunk hover:text-ink",
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
