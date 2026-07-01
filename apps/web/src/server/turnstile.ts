import "server-only";
import { turnstileSecret } from "@/lib/env";

const SITE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Single verify request must not hang the whole server action. */
const VERIFY_TIMEOUT_MS = 10_000;

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * The registration flow signs up through the server action (`auth.api.signUpEmail`),
 * which bypasses Better Auth's HTTP captcha middleware — so the token has to be
 * checked here explicitly. Fails closed: any missing token, rejected token, or
 * provider/network error returns false.
 *
 * When Turnstile isn't configured (local dev without keys) verification is
 * skipped and returns true, so sign-up keeps working.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip: string | null,
): Promise<boolean> {
  const secret = turnstileSecret();
  if (!secret) return true; // Not configured — skip.
  if (!token) return false;

  try {
    const res = await fetch(SITE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(ip && { remoteip: ip }),
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile.verify_failed", err);
    return false;
  }
}
