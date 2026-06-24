import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-input)] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-quint)] active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-deep shadow-[0_1px_2px_oklch(0.42_0.16_265/0.35),0_2px_8px_oklch(0.42_0.16_265/0.2)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-paper-sunk hover:border-line-strong",
  ghost: "text-ink-soft hover:bg-paper-sunk hover:text-ink",
  danger: "bg-danger text-accent-ink hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[0.95rem]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      data-loading={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="absolute size-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-90"
        />
      )}
      <span
        className={cn("inline-flex items-center gap-2", loading && "opacity-0")}
      >
        {children}
      </span>
    </button>
  );
}
