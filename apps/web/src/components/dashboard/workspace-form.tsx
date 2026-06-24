"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { renameWorkspaceAction } from "@/server/account";

export function WorkspaceForm({
  name: initial,
  canEdit,
}: {
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = name.trim() !== initial && name.trim().length >= 2;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await renameWorkspaceAction(name);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Nome do workspace"
        hint={!canEdit ? "Apenas o dono pode renomear." : undefined}
      >
        {({ id }) => (
          <Input
            id={id}
            value={name}
            disabled={!canEdit}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
          />
        )}
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
        >
          {error}
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-[0.82rem] font-medium text-ok">Salvo.</span>
          )}
          <Button type="submit" loading={pending} disabled={!changed}>
            Salvar
          </Button>
        </div>
      )}
    </form>
  );
}
