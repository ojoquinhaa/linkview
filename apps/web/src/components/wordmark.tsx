import { cn } from "@/lib/cn";

const sizes = {
  sm: "text-[0.95rem]",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-[2.6rem] leading-none",
} as const;

/**
 * Brand wordmark. The trailing accent mark nods to a URL cursor / domain dot,
 * the product's recurring motif.
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
        "inline-flex items-end font-display font-semibold tracking-[-0.02em] text-ink select-none",
        sizes[size],
        className,
      )}
    >
      linkview
      <span
        aria-hidden
        className={cn(
          "ml-[0.12em] mb-[0.16em] inline-block rounded-[2px] bg-accent",
          size === "xl" ? "size-2" : "size-1.5",
        )}
      />
    </span>
  );
}
