/**
 * Lightweight, dependency-free device fingerprint for trial abuse-detection.
 * Hashes a handful of stable, low-entropy browser attributes — deliberately
 * NOT a hardened tracker. It's only ever a *weak* signal (paired with IP before
 * it can block anything), so a coarse, spoofable hash is acceptable and keeps
 * the data minimal for LGPD. Returns null if anything goes wrong (e.g. no
 * SubtleCrypto), and the trial flow proceeds without the signal.
 */
export async function computeFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const nav = window.navigator;
    const parts = [
      nav.userAgent,
      nav.language,
      (nav.languages ?? []).join(","),
      String(nav.hardwareConcurrency ?? ""),
      // deviceMemory is non-standard; guarded read.
      String((nav as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
      `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
      String(new Date().getTimezoneOffset()),
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    ];
    const raw = parts.join("|");

    const subtle = window.crypto?.subtle;
    if (!subtle) return null;
    const digest = await subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
