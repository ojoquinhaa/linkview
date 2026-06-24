"use client";
import { normalizeSlug } from "@linkview/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBioPage } from "@/server/bio-pages";

export default function NewPagePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createBioPage({ slug, title });
    if (!res.ok || !res.data) {
      setError(res.ok ? "Não foi possível criar a página." : res.error);
      setLoading(false);
      return;
    }
    router.push(`/dashboard/paginas/${res.data.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-8 sm:px-8">
      <Link
        href="/dashboard/paginas"
        className="text-[0.85rem] font-medium text-muted hover:text-ink"
      >
        ← Páginas
      </Link>
      <h1 className="mt-4 font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-ink">
        Nova página de links
      </h1>
      <p className="mt-1.5 text-[0.92rem] text-muted">
        Dê um nome e escolha o endereço. Você adiciona os links no próximo
        passo.
      </p>

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger"
          >
            {error}
          </div>
        )}

        <Field label="Nome da página">
          {({ id, invalid }) => (
            <Input
              id={id}
              placeholder="Loja do João"
              value={title}
              invalid={invalid}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug) setSlug(normalizeSlug(e.target.value));
              }}
              required
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Endereço"
          hint="É o link que você vai compartilhar. Só letras, números e hífen."
        >
          {({ id, invalid }) => (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[0.85rem] text-muted">/p/</span>
              <Input
                id={id}
                placeholder="lojadojoao"
                value={slug}
                invalid={invalid}
                onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                required
              />
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" loading={loading} className="mt-2">
          Criar e adicionar links
        </Button>
      </form>
    </div>
  );
}
