"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { copyQrImage, downloadQrPng } from "@/lib/qr-image";
import type { LinkQrCode } from "@/server/links-query";
import { createQrCodeAction, deleteQrCodeAction } from "@/server/qr";
import { CopyButton } from "./copy-button";

/** Tracked URL the QR encodes: the short link plus its `?qr=` marker. */
function qrUrl(domain: string, slug: string, id: string): string {
  return `https://${domain}/${slug}?qr=${id}`;
}

const qrActionCls =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[0.78rem] font-medium text-ink-soft transition-colors hover:bg-paper-sunk disabled:pointer-events-none disabled:opacity-50";

/** QR image for a tracked URL with working PNG download + copy-image actions. */
function QrThumb({ url, name }: { url: string; name: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      margin: 2,
      width: 640,
      color: { dark: "#222438", light: "#fbfbfd" },
      errorCorrectionLevel: "M",
    }).then((d) => {
      if (alive) setDataUrl(d);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const fileName = `qr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "code"}.png`;

  async function onCopy() {
    if (!dataUrl) return;
    const res = await copyQrImage(dataUrl, url);
    if (res !== "fail") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-line bg-[#fbfbfd] p-2.5">
        {dataUrl ? (
          // biome-ignore lint/performance/noImgElement: data: URL from client-side QR generation, not optimizable by next/image
          <img
            src={dataUrl}
            alt={`QR Code ${name}`}
            width={128}
            height={128}
            className="size-32 sm:size-24"
          />
        ) : (
          <div className="size-32 animate-pulse rounded-md bg-paper-sunk sm:size-24" />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => dataUrl && downloadQrPng(dataUrl, fileName)}
          disabled={!dataUrl}
          className={qrActionCls}
        >
          Baixar
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={!dataUrl}
          className={qrActionCls}
        >
          {copied ? "Copiado!" : "Copiar imagem"}
        </button>
      </div>
    </div>
  );
}

export function QrCodesManager({
  linkId,
  slug,
  domain,
  qrCodes,
  canEdit,
}: {
  linkId: string;
  slug: string;
  domain: string;
  qrCodes: LinkQrCode[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<LinkQrCode | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createQrCodeAction(linkId, name);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível criar o QR code.");
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    startTransition(async () => {
      await deleteQrCodeAction(id);
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-[0.9rem] text-muted">
        Crie um QR code para cada material onde você divulga o link — cartaz,
        cardápio, embalagem. Cada um conta as leituras e os visitantes únicos
        separadamente, então você sabe qual material funciona.
      </p>

      {canEdit && (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_oklch(0.2_0.03_265/0.04)] sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Nome do QR code"
              hint="Onde ele vai ficar. Ex.: Cartaz da vitrine, Cardápio, Flyer"
            >
              {({ id }) => (
                <Input
                  id={id}
                  placeholder="Cartaz da vitrine, Cardápio..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  invalid={Boolean(error)}
                  required
                />
              )}
            </Field>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Criar QR code
            </Button>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
            >
              {error}
            </p>
          )}
        </form>
      )}

      {qrCodes.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 16 16"
            fill="none"
            role="img"
            aria-label="QR Code"
            className="text-muted"
          >
            <path
              d="M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 1.5h1.5V10H10v1.5zM14 14v-2.5h-1.5V14H14zm-1.5-4H14v1.5h-1.5V10z"
              fill="currentColor"
            />
          </svg>
          <p className="mt-4 font-display text-lg font-semibold text-ink">
            Nenhum QR code ainda
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[0.9rem] text-muted">
            Crie um QR code acima. Cada leitura é contada e atribuída ao QR que
            foi escaneado.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {qrCodes.map((q) => {
            const url = qrUrl(domain, slug, q.id);
            return (
              <li
                key={q.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:gap-5 sm:p-4"
              >
                <QrThumb url={url} name={q.name} />

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <span className="font-medium text-ink">{q.name}</span>
                  <p className="mt-1 truncate font-mono text-[0.8rem] text-muted">
                    {url.replace(/^https?:\/\//, "")}
                  </p>
                  <div className="mt-2 flex justify-center sm:justify-start">
                    <CopyButton value={url} label="Copiar link" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
                    <span className="nums text-[1.05rem] font-semibold leading-none text-ink">
                      {q.scans.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-wide text-muted sm:mt-1">
                      {q.scans === 1 ? "leitura" : "leituras"}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 sm:ml-3 sm:flex-col sm:items-end sm:gap-0 sm:border-l sm:border-line sm:pl-3 sm:text-right">
                    <span className="nums text-[1.05rem] font-semibold leading-none text-ink">
                      {q.unique.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-wide text-muted sm:mt-1">
                      {q.unique === 1 ? "única" : "únicas"}
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center sm:ml-3 sm:border-l sm:border-line sm:pl-3">
                      <button
                        type="button"
                        onClick={() => setToDelete(q)}
                        aria-label={`Excluir QR code ${q.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-weak hover:text-danger"
                      >
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir QR code"
        description="O QR impresso para de ser rastreado, mas continua redirecionando. As leituras já registradas permanecem no histórico do link."
      >
        <p className="text-[0.9rem] text-ink-soft">
          Excluir o QR code{" "}
          <span className="font-medium text-ink">{toDelete?.name}</span>?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setToDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={pending}
            onClick={confirmDelete}
          >
            Excluir QR code
          </Button>
        </div>
      </Modal>
    </div>
  );
}
