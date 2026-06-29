import { cn } from "@/lib/cn";

const sizes = {
  sm: "text-[0.95rem]",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-[2.6rem] leading-none",
} as const;

/**
 * Brand lockup: the eye-in-chain mark leading the "linkview" wordmark. The mark
 * scales in `em` so it tracks the type size at every breakpoint.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-semibold tracking-[-0.02em] text-ink select-none",
        sizes[size],
        className,
      )}
    >
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        className="mr-[0.42em] h-[0.92em] w-auto"
      />
      linkview
    </span>
  );
}
