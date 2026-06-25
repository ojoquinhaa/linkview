"use client";

/** Decode a `data:` PNG URL into a Blob for download / clipboard use. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Save a QR PNG. Prefers the native share sheet when it can take files (the
 * only reliable "save image" path on iOS Safari); otherwise downloads via an
 * object URL. A plain `data:` href download is silently ignored by several
 * browsers, which is why the old `<a download>` "did nothing".
 */
export async function downloadQrPng(
  dataUrl: string,
  fileName: string,
): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName, { type: "image/png" });
  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // user dismissed the sheet or share failed → fall back to a download
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * Copy the QR image to the clipboard. Falls back to copying the link text when
 * image clipboard write is unsupported. Returns what actually got copied.
 */
export async function copyQrImage(
  dataUrl: string,
  url: string,
): Promise<"image" | "link" | "fail"> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "image";
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      return "link";
    } catch {
      return "fail";
    }
  }
}
