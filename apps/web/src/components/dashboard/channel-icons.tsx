import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Brand marks for the known divulgation channels. Each glyph is hand-drawn to
 * match the project's stroke/fill SVG convention and is always rendered in white
 * on top of the brand-colored tile, so `currentColor` resolves to white for both
 * stroke- and fill-based paths.
 */

type Glyph = () => React.ReactElement;

interface Brand {
  /** Matched against a channel's `utm_source`. */
  source: string;
  /** Display name used by the preset chips. */
  name: string;
  /** Default `utm_medium` the preset fills in. */
  medium: string;
  /** Group the chip is shown under in the picker. */
  category: ChannelCategory;
  /** Tile background: a brand color or gradient. */
  tile: string;
  Glyph: Glyph;
}

export type ChannelCategory =
  | "Redes Sociais"
  | "Motores de Busca"
  | "E-mail Marketing"
  | "Parcerias / Afiliados"
  | "Tráfego Direto / Anúncios";

/** Render order for the grouped preset picker. */
export const CHANNEL_CATEGORY_ORDER: ChannelCategory[] = [
  "Redes Sociais",
  "Motores de Busca",
  "E-mail Marketing",
  "Parcerias / Afiliados",
  "Tráfego Direto / Anúncios",
];

const InstagramGlyph: Glyph = () => (
  <>
    <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.6" cy="7.4" r="1.05" fill="currentColor" stroke="none" />
  </>
);

const WhatsAppGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5 0a6.7 6.7 0 0 1-2-1.2 7.5 7.5 0 0 1-1.3-1.7c-.1-.3 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.1 5 5 0 0 0 1.1 2.7 11.4 11.4 0 0 0 4.3 3.8c2.2.9 2.2.6 2.6.5a2.5 2.5 0 0 0 1.6-1.1 2 2 0 0 0 .2-1.1c-.1-.1-.3-.2-.5-.3Z"
  />
);

const FacebookGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M13.4 21v-7.3h2.4l.4-2.8h-2.8V9c0-.8.2-1.4 1.5-1.4h1.4V5.2a21 21 0 0 0-2.2-.1c-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2v2.8h2.3V21Z"
  />
);

const TikTokGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M14.8 3c.3 2 1.6 3.5 3.7 3.7v2.5c-1.3 0-2.6-.4-3.7-1.1v6a5 5 0 1 1-4.3-4.9v2.6a2.4 2.4 0 1 0 1.7 2.3V3Z"
  />
);

const YouTubeGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M21.1 8.3a2.4 2.4 0 0 0-1.7-1.7C17.9 6.1 12 6.1 12 6.1s-5.9 0-7.4.5A2.4 2.4 0 0 0 2.9 8.3 25 25 0 0 0 2.6 12a25 25 0 0 0 .3 3.7 2.4 2.4 0 0 0 1.7 1.7c1.5.5 7.4.5 7.4.5s5.9 0 7.4-.5a2.4 2.4 0 0 0 1.7-1.7 25 25 0 0 0 .3-3.7 25 25 0 0 0-.3-3.7ZM10.2 14.7V9.3l4.7 2.7Z"
  />
);

const EmailGlyph: Glyph = () => (
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4.3 7.2 12 12.4l7.7-5.2" />
  </>
);

const BioGlyph: Glyph = () => (
  <>
    <circle cx="12" cy="8.7" r="3" />
    <path d="M5.8 19a6.4 6.4 0 0 1 12.4 0" />
  </>
);

const LinkGlyph: Glyph = () => (
  <>
    <path d="M10.3 13.7a3.4 3.4 0 0 0 5 .2l2-2a3.4 3.4 0 0 0-4.8-4.8l-1 1" />
    <path d="M13.7 10.3a3.4 3.4 0 0 0-5-.2l-2 2a3.4 3.4 0 0 0 4.8 4.8l1-1" />
  </>
);

const LinkedInGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M7.2 9.3H4.9V19h2.3V9.3Zm-1.15-1a1.33 1.33 0 1 0 0-2.66 1.33 1.33 0 0 0 0 2.66ZM19 19v-5.6c0-2.6-1.4-3.8-3.26-3.8a2.8 2.8 0 0 0-2.54 1.4V9.3H10.9c.03.65 0 9.7 0 9.7h2.3v-5.4c0-.29.02-.57.1-.78.24-.57.76-1.16 1.64-1.16 1.15 0 1.61.88 1.61 2.17V19H19Z"
  />
);

const PinterestGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 4a8 8 0 0 0-2.9 15.45c-.07-.65-.13-1.65.03-2.36.14-.66.92-4.2.92-4.2s-.24-.47-.24-1.17c0-1.1.64-1.92 1.43-1.92.67 0 1 .5 1 1.11 0 .68-.43 1.69-.65 2.63-.19.78.4 1.42 1.17 1.42 1.4 0 2.48-1.48 2.48-3.62 0-1.9-1.36-3.22-3.3-3.22a3.43 3.43 0 0 0-3.57 3.44c0 .68.26 1.41.59 1.81a.24.24 0 0 1 .05.23l-.22.9c-.04.15-.12.18-.27.11-1-.47-1.63-1.92-1.63-3.1 0-2.52 1.83-4.84 5.29-4.84 2.77 0 4.93 1.98 4.93 4.62 0 2.76-1.74 4.98-4.15 4.98-.81 0-1.57-.42-1.83-.92l-.5 1.9c-.18.69-.66 1.56-.98 2.09A8 8 0 1 0 12 4Z"
  />
);

const GoogleGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 10.2v2.65h3.75a3.6 3.6 0 0 1-3.75 2.75 4.05 4.05 0 1 1 2.6-7.1l1.92-1.9A6.7 6.7 0 1 0 12 18.7c3.85 0 6.45-2.7 6.45-6.55 0-.6-.06-1.1-.16-1.6L12 10.2Z"
  />
);

const BingGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M8 3.6 10.6 4.6V14l2.5-1.45-1.45-.6-1-2.45 5.35 1.9v2.6L9 20l-1-.55V3.6Z"
  />
);

const YahooGlyph: Glyph = () => (
  <>
    <path
      fill="currentColor"
      stroke="none"
      d="M4.8 6.2h2.9l2.3 4 2.2-4h2.9l-3.9 6.4V18H8.7v-5.4L4.8 6.2Z"
    />
    <circle cx="16.6" cy="16.6" r="1.2" fill="currentColor" stroke="none" />
  </>
);

const NewsletterGlyph: Glyph = () => (
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4.3 7.2 12 12.4l7.7-5.2" />
    <path d="M7.5 15.4h5" />
  </>
);

const SendGlyph: Glyph = () => (
  <path
    fill="currentColor"
    stroke="none"
    d="M21 3 2.5 10.6l5.7 2.1L18 6.2l-7.6 8 .0 .0v4.4l2.9-3.5L19 21 21 3Z"
  />
);

const FlowGlyph: Glyph = () => (
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 6h8M6 8v2.5A2.5 2.5 0 0 0 8.5 13H12M18 8v2.5a2.5 2.5 0 0 1-2.5 2.5H12v3" />
  </>
);

const MegaphoneGlyph: Glyph = () => (
  <>
    <path d="M5 10v4h3l8 4V6l-8 4H5Z" />
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
  </>
);

const TagGlyph: Glyph = () => (
  <>
    <path d="M4 4h7l9 9-7 7-9-9V4Z" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
  </>
);

const GlobeGlyph: Glyph = () => (
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16" />
    <path d="M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" />
  </>
);

const InfluencerGlyph: Glyph = () => (
  <>
    <circle cx="10.5" cy="8.5" r="3" />
    <path d="M5 19a5.5 5.5 0 0 1 11 0" />
    <path
      d="M17.8 3.4l.66 1.4 1.54.2-1.13 1.06.29 1.53-1.36-.74-1.36.74.29-1.53-1.13-1.06 1.54-.2.66-1.4Z"
      fill="currentColor"
      stroke="none"
    />
  </>
);

const INSTAGRAM_TILE =
  "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 52%, #6228d7 100%)";
const META_TILE = "linear-gradient(135deg, #0064e0 0%, #0866ff 100%)";

/**
 * Preset chips grouped by category. Order within a category is the order the
 * chips render. Affiliate/partner presets are templates: they prefill a generic
 * name and source the user renames (e.g. swap "Influenciador" for the handle).
 */
export const CHANNEL_PRESETS: Brand[] = [
  // Redes Sociais
  {
    source: "instagram",
    name: "Instagram",
    medium: "social",
    category: "Redes Sociais",
    tile: INSTAGRAM_TILE,
    Glyph: InstagramGlyph,
  },
  {
    source: "facebook",
    name: "Facebook",
    medium: "social",
    category: "Redes Sociais",
    tile: "#1877f2",
    Glyph: FacebookGlyph,
  },
  {
    source: "linkedin",
    name: "LinkedIn",
    medium: "social",
    category: "Redes Sociais",
    tile: "#0a66c2",
    Glyph: LinkedInGlyph,
  },
  {
    source: "tiktok",
    name: "TikTok",
    medium: "social",
    category: "Redes Sociais",
    tile: "#0b0b0f",
    Glyph: TikTokGlyph,
  },
  {
    source: "pinterest",
    name: "Pinterest",
    medium: "social",
    category: "Redes Sociais",
    tile: "#e60023",
    Glyph: PinterestGlyph,
  },
  {
    source: "youtube",
    name: "YouTube",
    medium: "social",
    category: "Redes Sociais",
    tile: "#ff0000",
    Glyph: YouTubeGlyph,
  },
  {
    source: "whatsapp",
    name: "WhatsApp",
    medium: "chat",
    category: "Redes Sociais",
    tile: "#25d366",
    Glyph: WhatsAppGlyph,
  },
  // Motores de Busca
  {
    source: "google",
    name: "Google",
    medium: "organic",
    category: "Motores de Busca",
    tile: "#4285f4",
    Glyph: GoogleGlyph,
  },
  {
    source: "bing",
    name: "Bing",
    medium: "organic",
    category: "Motores de Busca",
    tile: "#0c8484",
    Glyph: BingGlyph,
  },
  {
    source: "yahoo",
    name: "Yahoo",
    medium: "organic",
    category: "Motores de Busca",
    tile: "#5f01d1",
    Glyph: YahooGlyph,
  },
  // E-mail Marketing
  {
    source: "newsletter",
    name: "Newsletter",
    medium: "email",
    category: "E-mail Marketing",
    tile: "oklch(0.48 0.15 265)",
    Glyph: NewsletterGlyph,
  },
  {
    source: "disparo-promocional",
    name: "Disparo promocional",
    medium: "email",
    category: "E-mail Marketing",
    tile: "#ea580c",
    Glyph: SendGlyph,
  },
  {
    source: "fluxo-automacao",
    name: "Fluxo de automação",
    medium: "email",
    category: "E-mail Marketing",
    tile: "#0d9488",
    Glyph: FlowGlyph,
  },
  {
    source: "email",
    name: "E-mail",
    medium: "email",
    category: "E-mail Marketing",
    tile: "oklch(0.55 0.12 265)",
    Glyph: EmailGlyph,
  },
  // Parcerias / Afiliados
  {
    source: "site-parceiro",
    name: "Site parceiro",
    medium: "referral",
    category: "Parcerias / Afiliados",
    tile: "#475569",
    Glyph: GlobeGlyph,
  },
  {
    source: "influenciador",
    name: "Influenciador",
    medium: "referral",
    category: "Parcerias / Afiliados",
    tile: "#db2777",
    Glyph: InfluencerGlyph,
  },
  // Tráfego Direto / Anúncios
  {
    source: "google-ads",
    name: "Google Ads",
    medium: "cpc",
    category: "Tráfego Direto / Anúncios",
    tile: "#1a73e8",
    Glyph: MegaphoneGlyph,
  },
  {
    source: "meta-ads",
    name: "Meta Ads",
    medium: "cpc",
    category: "Tráfego Direto / Anúncios",
    tile: META_TILE,
    Glyph: MegaphoneGlyph,
  },
  {
    source: "afiliados",
    name: "Afiliados",
    medium: "affiliate",
    category: "Tráfego Direto / Anúncios",
    tile: "#7c3aed",
    Glyph: TagGlyph,
  },
  {
    source: "bio",
    name: "Bio",
    medium: "referral",
    category: "Tráfego Direto / Anúncios",
    tile: "oklch(0.55 0.018 258)",
    Glyph: BioGlyph,
  },
];

const BY_SOURCE = new Map(CHANNEL_PRESETS.map((b) => [b.source, b]));

/** Brand for a `utm_source`, or null for a custom source with no known mark. */
export function brandForSource(source: string): Brand | null {
  return BY_SOURCE.get(source.toLowerCase()) ?? null;
}

const TILE_SIZES = {
  sm: "size-5 rounded-md [&_svg]:size-3",
  md: "size-10 rounded-xl [&_svg]:size-[1.15rem]",
} as const;

/**
 * Brand-colored square holding the channel mark. Unknown sources fall back to a
 * neutral tile with a link glyph, keeping the row legible without inventing a color.
 */
export function ChannelIcon({
  source,
  size = "md",
  className,
}: {
  source: string;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}) {
  const brand = brandForSource(source);
  const Glyph = brand?.Glyph ?? LinkGlyph;
  const branded = brand !== null;
  const style: CSSProperties | undefined = branded
    ? { background: brand.tile }
    : undefined;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        branded ? "text-white" : "bg-paper-sunk text-muted",
        TILE_SIZES[size],
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <Glyph />
      </svg>
    </span>
  );
}
