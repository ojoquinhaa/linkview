"use client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset } from "@/lib/auth-client";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: "/login",
    });
    setLoading(false);
    if (error) {
      setError("Não foi possível enviar o e-mail. Tente de novo.");
      return;
    }
    // Always confirm without revealing whether the e-mail exists.
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Verifique seu e-mail
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
          Se houver uma conta para <span className="text-ink">{email}</span>,
          enviamos um link para criar uma nova senha. Pode levar alguns minutos
          — confira também o spam.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-block text-[0.9rem] font-medium text-accent hover:underline"
        >
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Recuperar senha
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">
        Informe seu e-mail e enviamos um link para redefinir a senha.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
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

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="mt-2 w-full"
        >
          Enviar link de recuperação
        </Button>
      </form>

      <p className="mt-7 text-center text-[0.9rem] text-muted">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
