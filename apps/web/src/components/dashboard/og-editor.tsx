"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { requestOgUploadAction, updateLinkOgAction } from "@/server/og";

interface OgLink {
  title: string | null;
  description: string | null;
  destinationUrl: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
}

export function OgEditor({
  linkId,
  slug,
  domain,
  link,
  canEdit,
  uploadEnabled,
}: {
  linkId: string;
  slug: string;
  domain: string;
  link: OgLink;
  canEdit: boolean;
  uploadEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [ogTitle, setOgTitle] = useState(link.ogTitle ?? "");
  const [ogDescription, setOgDescription] = useState(link.ogDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(link.ogImageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const previewTitle = ogTitle.trim() || link.title || `${domain}/${slug}`;
  const previewDesc =
    ogDescription.trim() ||
    link.description ||
    "Adicione uma descrição para o card de compartilhamento.";

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const ticket = await requestOgUploadAction({
        linkId,
        contentType: file.type,
        size: file.size,
      });
      if (!ticket.ok || !ticket.uploadUrl || !ticket.fileUrl) {
        setError(ticket.error ?? "Falha no upload.");
        return;
      }
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError("Não foi possível enviar a imagem.");
        return;
      }
      setOgImageUrl(ticket.fileUrl);
    } catch {
      setError("Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateLinkOgAction(linkId, {
        ogTitle: ogTitle.trim() || undefined,
        ogDescription: ogDescription.trim() || undefined,
        ogImageUrl: ogImageUrl.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-6"
      >
        <div>
          <h2 className="font-display text-[1rem] font-semibold tracking-[-0.01em] text-ink">
            Cartão de compartilhamento
          </h2>
          <p className="mt-1 text-[0.85rem] text-muted">
            Controle o título, a descrição e a imagem que aparecem quando o link
            é colado no WhatsApp, Instagram ou redes sociais.
          </p>
        </div>

        <Field label="Título" hint={`${ogTitle.length}/120`}>
          {({ id }) => (
            <Input
              id={id}
              value={ogTitle}
              maxLength={120}
              placeholder={link.title ?? "Título chamativo do link"}
              onChange={(e) => setOgTitle(e.target.value)}
              disabled={!canEdit}
            />
          )}
        </Field>

        <Field label="Descrição" hint={`${ogDescription.length}/300`}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={ogDescription}
              maxLength={300}
              placeholder="Uma frase que faz a pessoa querer clicar."
              onChange={(e) => setOgDescription(e.target.value)}
              disabled={!canEdit}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-[0.85rem] font-medium text-ink-soft">
            Imagem
          </span>
          {uploadEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onPickFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={uploading}
                disabled={!canEdit}
                onClick={() => fileRef.current?.click()}
              >
                {ogImageUrl ? "Trocar imagem" : "Enviar imagem"}
              </Button>
              {ogImageUrl && (
                <button
                  type="button"
                  onClick={() => setOgImageUrl("")}
                  disabled={!canEdit}
                  className="text-[0.82rem] font-medium text-muted transition-colors hover:text-danger"
                >
                  Remover
                </button>
              )}
              <span className="text-[0.78rem] text-muted">
                PNG, JPG ou WebP, até 4 MB. Ideal 1200x630.
              </span>
            </div>
          ) : (
            <Field
              label="URL da imagem"
              hint="Cole a URL de uma imagem (upload direto indisponível)."
            >
              {({ id }) => (
                <Input
                  id={id}
                  type="url"
                  value={ogImageUrl}
                  placeholder="https://..."
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  disabled={!canEdit}
                />
              )}
            </Field>
          )}
        </div>

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
            <Button type="submit" loading={pending}>
              Salvar cartão
            </Button>
          </div>
        )}
      </form>

      {/* Live preview. */}
      <div className="flex flex-col gap-2">
        <span className="text-[0.78rem] uppercase tracking-wide text-muted">
          Prévia
        </span>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)]">
          <div className="aspect-[1.91/1] w-full bg-paper-sunk">
            {ogImageUrl ? (
              // biome-ignore lint/performance/noImgElement: arbitrary user/R2 URL, not optimizable by next/image
              <img
                src={ogImageUrl}
                alt="Prévia do compartilhamento"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[0.8rem] text-muted">
                Sem imagem
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[0.68rem] uppercase tracking-wide text-muted">
              {domain}
            </span>
            <span className="line-clamp-1 text-[0.92rem] font-semibold text-ink">
              {previewTitle}
            </span>
            <span className="line-clamp-2 text-[0.82rem] text-muted">
              {previewDesc}
            </span>
          </div>
        </div>
        <p className="text-[0.78rem] text-muted">
          A aparência exata varia por aplicativo. Esta é uma referência.
        </p>
      </div>
    </div>
  );
}
