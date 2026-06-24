import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/cn";

type Variant = "404" | "500";

const actionBase =
  "inline-flex h-12 w-full select-none items-center justify-center gap-2 rounded-[var(--radius-input)] px-5 text-[0.95rem] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quint)] active:translate-y-px sm:w-auto";

const actionVariants = {
  primary:
    "bg-accent text-accent-ink shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)] hover:bg-accent-deep",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-paper-sunk",
} as const;

/** Button-styled internal link, matched to the app's primary/secondary buttons
 * so the error pages stay consistent without pulling in the client Button. */
export function ActionLink({
  href,
  variant = "secondary",
  children,
}: {
  href: string;
  variant?: keyof typeof actionVariants;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(actionBase, actionVariants[variant])}>
      {children}
    </Link>
  );
}

/**
 * Full-screen error surface shared by the 404 and 500 pages. Keeps the brand
 * chrome (paper + radial indigo glow, wordmark) and leans on a single motif:
 * a broken link, which is literally the product's subject. The break carries
 * the wordmark's accent dot so the pages feel of a piece with the rest of the
 * app. Server-safe (no hooks) so `not-found.tsx` can render it directly and the
 * client `error.tsx` can wrap it.
 */
export function ErrorScreen({
  variant,
  eyebrow,
  title,
  body,
  children,
}: {
  variant: Variant;
  eyebrow: string;
  title: string;
  body: string;
  /** Action row (buttons / links). */
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_75%_at_50%_-10%,var(--accent-weak),transparent_55%)] opacity-70"
      />
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Link href="/" aria-label="linkview" className="inline-block">
          <Wordmark size="md" />
        </Link>
      </header>

      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-16">
        <div className="w-full max-w-[30rem] text-center">
          <BrokenLink
            variant={variant}
            className="animate-rise mx-auto h-16 w-auto text-line-strong"
          />

          <p
            className="animate-rise mt-8 flex items-center justify-center gap-2 font-mono text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted"
            style={{ animationDelay: "60ms" }}
          >
            {eyebrow}
            <span aria-hidden className="size-1 rounded-[2px] bg-accent" />
            {variant}
          </p>

          <h1
            className="animate-rise mt-3 text-balance font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.4rem]"
            style={{ animationDelay: "120ms" }}
          >
            {title}
          </h1>

          <p
            className="animate-rise mx-auto mt-4 max-w-[26rem] text-pretty text-[0.95rem] leading-relaxed text-muted"
            style={{ animationDelay: "180ms" }}
          >
            {body}
          </p>

          <div
            className="animate-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Two rounded link segments with a gap between them. For 404 the break holds
 * the calm accent dot; for 500 it sparks, signalling something fired wrong
 * without resorting to alarm-red across the whole page.
 */
function BrokenLink({
  variant,
  className,
}: {
  variant: Variant;
  className?: string;
}) {
  const broke = variant === "500";
  return (
    <svg viewBox="0 0 120 64" fill="none" aria-hidden className={cn(className)}>
      <title>{broke ? "Erro no link" : "Link quebrado"}</title>
      {/* Left link segment */}
      <path
        d="M44 22 H30 a10 10 0 0 0 0 20 H44"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Right link segment */}
      <path
        d="M76 22 H90 a10 10 0 0 1 0 20 H76"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Connector stubs reaching toward the break */}
      <path
        d="M44 32 H52"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M68 32 H76"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {broke ? (
        <g className="text-danger" stroke="currentColor">
          {/* Spark at the break */}
          <path
            d="M60 23 V19 M60 45 V41 M53 26 l-2.5 -2.5 M67 26 l2.5 -2.5 M53 38 l-2.5 2.5 M67 38 l2.5 2.5"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="32"
            r="4.5"
            className="text-accent"
            fill="currentColor"
            stroke="none"
          />
        </g>
      ) : (
        <circle
          cx="60"
          cy="32"
          r="5"
          className="text-accent"
          fill="currentColor"
        />
      )}
    </svg>
  );
}
