"use server";
import { getDb, userConsents, userProfiles } from "@linkview/db";
import {
  onlyDigits,
  PRIVACY_VERSION,
  type RegisterInput,
  registerSchema,
  TERMS_VERSION,
} from "@linkview/shared";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { verifyTurnstile } from "./turnstile";

export interface RegisterResult {
  ok: boolean;
  error?: string;
  /** True when the user must confirm their e-mail before signing in. */
  requiresVerification?: boolean;
}

/** Best-effort client IP from proxy headers (Vercel / Cloudflare set these). */
function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

/**
 * Create an account from the registration stepper.
 *
 * Validation is authoritative here: the document is re-checked by its
 * check-digit algorithm and consent must be granted before the account is
 * created. The IP and user-agent captured at this moment are stored alongside
 * the consent ledger as evidence (LGPD art. 7/8).
 */
export async function registerAccount(
  input: RegisterInput,
  captchaToken?: string,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = clientIp(h);
  const userAgent = h.get("user-agent");

  // Bot protection. This server action signs up through `auth.api.signUpEmail`,
  // which bypasses Better Auth's HTTP captcha middleware, so verify the
  // Turnstile token here. No-op when Turnstile isn't configured (local dev).
  if (!(await verifyTurnstile(captchaToken, ip))) {
    return {
      ok: false,
      error:
        "Verificação anti-robô falhou. Recarregue a página e tente de novo.",
    };
  }

  // Create the auth account first; Better Auth provisions the default
  // workspace via its create hook and (in production) sends the verification
  // e-mail. A duplicate e-mail throws, which we map to a friendly message.
  let userId: string;
  let hasSession: boolean;
  try {
    const result = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
      headers: h,
    });
    userId = result.user.id;
    hasSession = Boolean(result.token);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("exist") || message.includes("already")) {
      return { ok: false, error: "Já existe uma conta com esse e-mail." };
    }
    console.error("register.signup_failed", err);
    return {
      ok: false,
      error: "Não foi possível criar a conta. Tente de novo.",
    };
  }

  // Persist the fiscal profile and the append-only consent ledger together.
  // Neon's HTTP driver runs `batch` as a single transaction, so both succeed
  // or neither does.
  const db = getDb();
  try {
    await db.batch([
      db.insert(userProfiles).values({
        userId,
        personType: data.personType,
        document: onlyDigits(data.document),
        phone: onlyDigits(data.phone),
        zip: onlyDigits(data.zip),
        street: data.street,
        number: data.number,
        complement: data.complement || null,
        district: data.district,
        city: data.city,
        state: data.state,
        signupIp: ip,
      }),
      db.insert(userConsents).values([
        {
          userId,
          type: "terms",
          documentVersion: TERMS_VERSION,
          accepted: true,
          ipAddress: ip,
          userAgent,
        },
        {
          userId,
          type: "privacy",
          documentVersion: PRIVACY_VERSION,
          accepted: true,
          ipAddress: ip,
          userAgent,
        },
        {
          userId,
          type: "marketing",
          documentVersion: PRIVACY_VERSION,
          accepted: data.marketingOptIn,
          ipAddress: ip,
          userAgent,
        },
      ]),
    ]);
  } catch (err) {
    // The account exists but we failed to record profile/consent. Surface an
    // honest error so the user can retry; the orphaned profile can be repaired
    // on next sign-in rather than silently dropping the legal record.
    console.error("register.profile_failed", err);
    return {
      ok: false,
      error:
        "Conta criada, mas houve um erro ao salvar seus dados. Tente entrar; se persistir, fale com o suporte.",
    };
  }

  return { ok: true, requiresVerification: !hasSession };
}
