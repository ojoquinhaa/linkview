"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  PasswordStrength,
  scorePassword,
} from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (next.length < 8) {
      setError("A nova senha precisa de ao menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error: err } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    });
    setLoading(false);

    if (err) {
      const stale =
        err.status === 403 || err.message?.toLowerCase().includes("fresh");
      setError(
        stale
          ? "Sua sessão expirou. Saia e entre de novo para alterar a senha."
          : err.status === 400 ||
              err.message?.toLowerCase().includes("password")
            ? "Senha atual incorreta."
            : "Não foi possível alterar a senha. Tente de novo.",
      );
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Senha atual">
        {({ id }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setSaved(false);
            }}
            required
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nova senha">
          {({ id }) => (
            <div>
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setSaved(false);
                }}
                required
              />
              {next && <PasswordStrength password={next} />}
            </div>
          )}
        </Field>
        <Field label="Confirmar nova senha">
          {({ id, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              invalid={invalid || (confirm.length > 0 && confirm !== next)}
              onChange={(e) => {
                setConfirm(e.target.value);
                setSaved(false);
              }}
              required
            />
          )}
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[0.85rem] text-ink-soft">
        <input
          type="checkbox"
          checked={revokeOthers}
          onChange={(e) => setRevokeOthers(e.target.checked)}
          className="size-4 rounded border-line-strong text-accent accent-[var(--accent)]"
        />
        Sair dos outros dispositivos ao trocar a senha
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-[0.82rem] font-medium text-ok">
            Senha alterada.
          </span>
        )}
        <Button
          type="submit"
          loading={loading}
          disabled={!current || !next || !confirm || scorePassword(next) < 1}
        >
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
