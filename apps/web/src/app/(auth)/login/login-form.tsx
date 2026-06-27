"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
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

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard/links";
  const justReset = params.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    if (error) {
      // Email not yet verified — route to the confirmation notice instead.
      if (
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
