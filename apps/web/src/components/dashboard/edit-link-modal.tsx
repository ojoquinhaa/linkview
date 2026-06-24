"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { updateLinkAction } from "@/server/links";

export type EditableLink = {
  id: string;
  slug: string;
  destinationUrl: string;
  title: string | null;
  isActive: boolean;
};

export function EditLinkModal({
  open,
  onClose,
  link,
  domain,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  link: EditableLink;
  domain: string;
  onSaved?: (slug: string) => void;
}) {
  const [destinationUrl, setDestinationUrl] = useState(link.destinationUrl);
  const [slug, setSlug] = useState(link.slug);
  const [title, setTitle] = useState(link.title ?? "");
  const [isActive, setIsActive] = useState(link.isActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the form whenever a different link opens.
  useEffect(() => {
    if (!open) return;
    setDestinationUrl(link.destinationUrl);
    setSlug(link.slug);
    setTitle(link.title ?? "");
    setIsActive(link.isActive);
    setError(null);
  }, [open, link]);

  const slugChanged = slug.trim() !== link.slug;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateLinkAction(link.id, {
        destinationUrl: destinationUrl.trim(),
        slug: slug.trim(),
        title: title.trim(),
        isActive,
      });
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      onSaved?.(res.slug ?? link.slug);
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar link">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Link de destino">
          {({ id, invalid }) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              value={destinationUrl}
              invalid={invalid || Boolean(error)}
              onChange={(e) => setDestinationUrl(e.target.value)}
              required
            />
          )}
        </Field>

        <Field
          label="Link curto"
          hint={
            slugChanged
              ? "Mudar o slug altera a URL curta. O endereço antigo deixa de funcionar."
              : undefined
          }
        >
          {({ id }) => (
            <Input
              id={id}
              prefix={`${domain}/`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          )}
        </Field>

        <Field label="Título (opcional)">
          {({ id }) => (
            <Input
              id={id}
              value={title}
              placeholder="Promoção de junho"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

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
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out-quint)] ${
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

        <div className="mt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  );
}
