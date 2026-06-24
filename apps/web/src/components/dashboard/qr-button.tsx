"use client";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { CopyButton } from "./copy-button";

export function QrButton({ url, slug }: { url: string; slug: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!dataUrl) {
      QRCode.toDataURL(url, {
        margin: 2,
        width: 480,
        color: { dark: "#222438", light: "#fbfbfd" },
        errorCorrectionLevel: "M",
      }).then(setDataUrl);
    }
  }, [url, dataUrl]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8rem] font-medium text-muted transition-colors hover:bg-paper-sunk hover:text-ink"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          role="img"
          aria-label="QR Code"
        >
          <path
            d="M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 1.5h1.5V10H10v1.5zM14 14v-2.5h-1.5V14H14zm-1.5-4H14v1.5h-1.5V10z"
            fill="currentColor"
          />
        </svg>
        QR
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-20px_oklch(0.2_0.05_265/0.45)] backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex w-[19rem] flex-col items-center gap-4 p-6">
          <div className="flex w-full items-center justify-between">
            <p className="font-display text-lg font-semibold tracking-[-0.01em]">
              QR Code
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fechar"
              className="rounded-md px-1.5 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>

          <div className="rounded-xl border border-line bg-[#fbfbfd] p-3">
            {dataUrl ? (
              // biome-ignore lint/performance/noImgElement: data: URL from client-side QR generation, not optimizable by next/image
              <img
                src={dataUrl}
                alt={`QR Code para ${slug}`}
                width={220}
                height={220}
                className="size-[13.75rem]"
              />
            ) : (
              <div className="size-[13.75rem] animate-pulse rounded-md bg-paper-sunk" />
            )}
          </div>

          <p className="font-mono text-[0.8rem] text-muted">{url}</p>

          <div className="flex w-full items-center justify-center gap-2">
            <a
              href={dataUrl ?? "#"}
              download={`qr-${slug}.png`}
              aria-disabled={!dataUrl}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-[var(--radius-input)] bg-accent px-3 text-[0.85rem] font-medium text-accent-ink transition-colors hover:bg-accent-deep"
            >
              Baixar PNG
            </a>
            <CopyButton
              value={url}
              className="h-9 border border-line px-3"
              label="Copiar link"
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
