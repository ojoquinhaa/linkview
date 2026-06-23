/** Destination URL validation (ARCHITECTURE.md section 14.1). */

// http/https are the network protocols. tel/mailto carry no fetchable host, so
// they add no SSRF surface (the worker only forwards them as a Location header);
// they back the "Telefone" and "E-mail" link builders.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "tel:", "mailto:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal", // GCP metadata
]);

export type UrlValidationError =
  | "invalid_url"
  | "blocked_protocol"
  | "blocked_host"
  | "private_ip";

/** Detect RFC1918 / link-local / loopback IPv4 and the cloud metadata IP. */
function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function validateDestinationUrl(input: string): UrlValidationError | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return "invalid_url";
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return "blocked_protocol";

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return "blocked_host";
  if (host.endsWith(".localhost")) return "blocked_host";
  if (isPrivateIpv4(host)) return "private_ip";
  // IPv6 private/link-local ranges
  if (host.startsWith("[fc") || host.startsWith("[fd")) return "private_ip"; // ULA
  if (host.startsWith("[fe80")) return "private_ip"; // link-local

  return null;
}

export function isValidDestinationUrl(input: string): boolean {
  return validateDestinationUrl(input) === null;
}

/** Build a WhatsApp click-to-chat URL (ARCHITECTURE.md section 19). */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Append/override UTM params on a destination URL. */
export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export function applyUtm(input: string, utm: UtmParams): string {
  const url = new URL(input);
  for (const [key, value] of Object.entries(utm)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
