/** Synthetic channel key for QR scans — folds every QR code into one line.
 * Lives here (not the server-only query module) so the client chart can import
 * it without pulling server code into the browser bundle. */
export const QR_CHANNEL_KEY = "__qr__";

/** Human label for a UTM source. Shared by the click table, the channels chart
 * and the auto-created channel rows so a source reads the same everywhere. */
const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube",
  google: "Google",
  bing: "Bing",
  yahoo: "Yahoo",
  email: "E-mail",
  newsletter: "Newsletter",
  "disparo-promocional": "Disparo promocional",
  "fluxo-automacao": "Fluxo de automação",
  "site-parceiro": "Site parceiro",
  influenciador: "Influenciador",
  "google-ads": "Google Ads",
  "meta-ads": "Meta Ads",
  afiliados: "Afiliados",
  bio: "Bio",
};

/** Title-case a raw source slug ("minha-campanha" -> "Minha Campanha"). */
function titleCase(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function channelLabel(source: string): string {
  return SOURCE_LABELS[source] ?? titleCase(source);
}
