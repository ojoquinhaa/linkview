"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { updateLinkAction } from "@/server/links";

interface SettingsLink {
  destinationUrl: string;
  title: string | null;
  description: string | null;
  isActive: boolean;
}

export function LinkSettingsForm({
  linkId,
  slug,
  domain,
  link,
  canEdit,
}: {
  linkId: string;
  slug: string;
  domain: string;
  link: SettingsLink;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [destinationUrl, setDestinationUrl] = useState(link.destinationUrl);
  const [nextSlug, setNextSlug] = useState(slug);
  const [title, setTitle] = useState(link.title ?? "");
  const [description, setDescription] = useState(link.description ?? "");
  const [isActive, setIsActive] = useState(link.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const slugChanged = nextSlug.trim() !== slug;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateLinkAction(linkId, {
        destinationUrl: destinationUrl.trim(),
        slug: nextSlug.trim(),
        title: title.trim(),
        description: description.trim(),
        isActive,
      });
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      if (res.slug && res.slug !== slug) {
        router.push(`/dashboard/links/${res.slug}/configuracoes`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6"
    >
      <header className="flex items-start gap-3.5 border-b border-line pb-5">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-paper-sunk text-ink-soft">
          <GearGlyph />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-ink">Detalhes do link</h3>
          <p className="mt-0.5 text-[0.82rem] leading-snug text-muted">
            Destino, endereço curto e informações de identificação.
          </p>
        </div>
      </header>

      <Field label="Link de destino">
        {({ id }) => (
          <Input
            id={id}
            type="url"
            inputMode="url"
            value={destinationUrl}
            invalid={Boolean(error)}
            onChange={(e) => setDestinationUrl(e.target.value)}
            disabled={!canEdit}
            required
          />
        )}
      </Field>

      <Field
        label="Link curto"
        hint={
          slugChanged
            ? "Mudar o slug troca a URL. O endereço antigo para de funcionar."
            : "O endereço curto que as pessoas acessam."
        }
      >
        {({ id }) => (
          <Input
            id={id}
            prefix={`${domain}/`}
            value={nextSlug}
            onChange={(e) => setNextSlug(e.target.value)}
            disabled={!canEdit}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Título (opcional)">
          {({ id }) => (
            <Input
              id={id}
              value={title}
              placeholder="Promoção de junho"
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
            />
          )}
        </Field>
        <Field label="Descrição (opcional)">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={description}
              placeholder="Nota interna sobre este link."
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          )}
        </Field>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-[var(--radius-input)] border border-line bg-paper-sunk/50 px-3.5 py-3">
        <span className="text-[0.85rem]">
          <span className="block font-medium text-ink-soft">Link ativo</span>
          <span className="block text-[0.78rem] text-muted">
            Pausado, ele para de redirecionar.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive((v) => !v)}
          disabled={!canEdit}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)] disabled:opacity-55 ${
            isActive ? "bg-accent" : "bg-line-strong"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[left] duration-150 ease-[var(--ease-out-quint)] ${
              isActive ? "left-[1.125rem]" : "left-0.5"
            }`}
          />
        </button>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
        >
          {error}
        </p>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          {saved && (
            <span className="text-[0.82rem] font-medium text-ok">Salvo.</span>
          )}
          <Button type="submit" loading={pending}>
            Salvar alterações
          </Button>
        </div>
      )}
    </form>
  );
}

function GearGlyph() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.05rem]"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
