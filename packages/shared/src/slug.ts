import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from "./constants";

const RANDOM_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars

/** Normalize user-provided slug: lowercase, strip accents, collapse separators. */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-") // non-allowed -> hyphen
    .replace(/-{2,}/g, "-") // collapse repeats
    .replace(/^[-_]+|[-_]+$/g, ""); // trim leading/trailing separators
}

export type SlugValidationError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "reserved";

/** Validate a (already-normalized) slug. Returns null when valid. */
export function validateSlug(slug: string): SlugValidationError | null {
  if (slug.length < SLUG_MIN_LENGTH) return "too_short";
  if (slug.length > SLUG_MAX_LENGTH) return "too_long";
  if (!SLUG_PATTERN.test(slug)) return "invalid_chars";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

export function isValidSlug(slug: string): boolean {
  return validateSlug(slug) === null;
}

/** Generate a random URL-safe slug (default length 7). */
export function generateSlug(length = 7): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += RANDOM_ALPHABET[bytes[i]! % RANDOM_ALPHABET.length];
  }
  return out;
}
