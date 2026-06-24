type ClassValue = string | false | null | undefined;

/** Tiny class joiner — no dependency, last-write-wins not handled (keep classes orthogonal). */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
