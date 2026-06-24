"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { resetPassword } from "@/lib/auth-client";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirForm />
    </Suspense>
  );
}

function RedefinirForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Link inválido
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
          Este link de redefinição está incompleto ou expirou. Peça um novo.
        </p>
        <Link
          href="/recuperar"
          className="mt-7 inline-block text-[0.9rem] font-medium text-accent hover:underline"
        >
          Pedir novo link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword({ newPassword: password, token });
    if (error) {
      setError(
        "Não foi possível redefinir. O link pode ter expirado — peça um novo.",
      );
      setLoading(false);
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Criar nova senha
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">
        Escolha uma senha nova para sua conta.
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

        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
