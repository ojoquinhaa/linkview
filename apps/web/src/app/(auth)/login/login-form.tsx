"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Turnstile, turnstileEnabled } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signIn } from "@/lib/auth-client";

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}

const DEFAULT_REDIRECT = "/dashboard/links";

/**
 * Only allow same-origin internal paths after login. A path must start with a
 * single "/" (not "//" or "/\", which browsers treat as protocol-relative ->
 * external) and carry no scheme. Anything else — `https://evil.com`,
 * `//evil.com` — falls back to the dashboard. Blocks the open-redirect
 * (SECURITY-AUDIT F3).
 */
function safeRedirect(raw: string | null): string {
  if (!raw || raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") {
    return DEFAULT_REDIRECT;
  }
  return raw;
}

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect"));
  const justReset = params.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped to force a fresh widget after a failed attempt (tokens are single-use).
  const [captchaKey, setCaptchaKey] = useState(0);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (turnstileEnabled && !captchaToken) {
      setError("Confirme que você não é um robô.");
      return;
    }
    setLoading(true);
    const { error } = await signIn.email(
      { email, password },
      captchaToken
        ? { headers: { "x-captcha-response": captchaToken } }
        : undefined,
    );
    if (error) {
      const code = error.code ?? "";
      // Captcha rejected — the token is single-use, so force a fresh widget.
      // Checked before the 403 branch below: a failed Turnstile check also
      // returns 403, which would otherwise be misread as "email not verified".
      if (code === "VERIFICATION_FAILED" || code === "MISSING_RESPONSE") {
        setError("Verificação anti-robô falhou. Tente novamente.");
        resetCaptcha();
        setLoading(false);
        return;
      }
      // Email not yet verified — route to the confirmation notice instead.
      if (
        code === "EMAIL_NOT_VERIFIED" ||
        error.status === 403 ||
        error.message?.toLowerCase().includes("verif")
      ) {
        router.push(`/verificar-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(
        error.message === "Invalid email or password" || error.status === 401
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente de novo.",
      );
      resetCaptcha();
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Entrar
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">
        Seus links e cliques, num lugar só.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {justReset && !error && (
          <div className="rounded-[var(--radius-input)] border border-ok/30 bg-accent-weak px-3.5 py-2.5 text-[0.85rem] text-accent-deep">
            Senha redefinida. Entre com a nova senha.
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
          >
            {error}
          </div>
        )}

        <Field label="E-mail">
          {({ id, invalid }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              value={email}
              invalid={invalid}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Senha"
          hint={
            <Link href="/recuperar" className="text-accent hover:underline">
              Esqueci minha senha
            </Link>
          }
        >
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>

        {turnstileEnabled && (
          <div className="mt-1">
            <Turnstile
              key={captchaKey}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="mt-2 w-full"
        >
          Entrar
        </Button>
      </form>

      <p className="mt-7 text-center text-[0.9rem] text-muted">
        Ainda não tem conta?{" "}
        <Link
          href="/register"
          className="font-medium text-accent hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
