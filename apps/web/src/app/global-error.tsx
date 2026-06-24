"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the entire document, so the app stylesheet and fonts are not available here;
 * everything is inlined and kept deliberately minimal, while still holding the
 * "Tinta" identity (cool paper, deep ink, single indigo accent).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app.global_error", error);
  }, [error]);

  const paper = "oklch(0.985 0.004 250)";
  const ink = "oklch(0.2 0.02 262)";
  const muted = "oklch(0.54 0.018 258)";
  const accent = "oklch(0.48 0.15 265)";
  const accentInk = "oklch(0.985 0.01 265)";
  const lineStrong = "oklch(0.84 0.01 258)";
  const danger = "oklch(0.53 0.18 25)";
  const sans =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  return (
    <html lang="pt-BR">
      <body
        style={{ margin: 0, background: paper, color: ink, fontFamily: sans }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem 1.5rem",
            textAlign: "center",
            background:
              "radial-gradient(120% 75% at 50% -10%, oklch(0.955 0.028 265), transparent 55%)",
          }}
        >
          <div style={{ width: "100%", maxWidth: "30rem" }}>
            <svg
              viewBox="0 0 120 64"
              fill="none"
              aria-hidden
              style={{ height: "4rem", color: lineStrong }}
            >
              <title>Erro no link</title>
              <path
                d="M44 22 H30 a10 10 0 0 0 0 20 H44 M76 22 H90 a10 10 0 0 1 0 20 H76 M44 32 H52 M68 32 H76"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M60 23 V19 M60 45 V41 M53 26 l-2.5 -2.5 M67 26 l2.5 -2.5 M53 38 l-2.5 2.5 M67 38 l2.5 2.5"
                stroke={danger}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="60" cy="32" r="4.5" fill={accent} />
            </svg>

            <p
              style={{
                marginTop: "2rem",
                fontSize: "0.72rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: muted,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Erro · 500
            </p>
            <h1
              style={{
                margin: "0.75rem 0 0",
                fontSize: "2rem",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                fontWeight: 600,
              }}
            >
              Algo quebrou do nosso lado.
            </h1>
            <p
              style={{
                margin: "1rem auto 0",
                maxWidth: "26rem",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                color: muted,
              }}
            >
              Um erro inesperado interrompeu o aplicativo. Já registramos o
              ocorrido. Recarregue a página para tentar de novo.
            </p>

            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: "2rem",
                height: "3rem",
                padding: "0 1.25rem",
                border: "none",
                borderRadius: "0.625rem",
                background: accent,
                color: accentInk,
                fontSize: "0.95rem",
                fontWeight: 500,
                fontFamily: sans,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
