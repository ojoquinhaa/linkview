/**
 * Visual themes for public bio (link-tree) pages. Shared by the public
 * renderer and the dashboard editor's theme picker. Pure presentation —
 * each theme is a self-contained set of CSS values.
 */
export interface BioTheme {
  key: string;
  name: string;
  /** Page background (CSS background value). */
  background: string;
  /** Primary text color. */
  text: string;
  /** Muted/secondary text. */
  muted: string;
  /** Link button background. */
  button: string;
  /** Link button text. */
  buttonText: string;
  /** Link button border. */
  buttonBorder: string;
  /** Button background on hover/active. */
  buttonHover: string;
}

export const BIO_THEMES: BioTheme[] = [
  {
    key: "default",
    name: "Claro",
    background: "#f6f6f8",
    text: "#1c1c24",
    muted: "#6b6b78",
    button: "#ffffff",
    buttonText: "#1c1c24",
    buttonBorder: "#e4e4ec",
    buttonHover: "#f0f0f4",
  },
  {
    key: "midnight",
    name: "Meia-noite",
    background: "#0c0c12",
    text: "#f4f4f8",
    muted: "#9a9aab",
    button: "#16161f",
    buttonText: "#f4f4f8",
    buttonBorder: "#26263a",
    buttonHover: "#1f1f2e",
  },
  {
    key: "indigo",
    name: "Índigo",
    background: "linear-gradient(160deg,#4338ca,#6d28d9 55%,#9333ea)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    button: "rgba(255,255,255,0.14)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.28)",
    buttonHover: "rgba(255,255,255,0.24)",
  },
  {
    key: "sunset",
    name: "Pôr do sol",
    background: "linear-gradient(160deg,#f97316,#ef4444 55%,#db2777)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.82)",
    button: "rgba(255,255,255,0.16)",
    buttonText: "#ffffff",
    buttonBorder: "rgba(255,255,255,0.3)",
    buttonHover: "rgba(255,255,255,0.26)",
  },
  {
    key: "mint",
    name: "Menta",
    background: "linear-gradient(160deg,#0f766e,#10b981 60%,#34d399)",
    text: "#04231d",
    muted: "rgba(4,35,29,0.7)",
    button: "rgba(255,255,255,0.85)",
    buttonText: "#04231d",
    buttonBorder: "rgba(255,255,255,0.6)",
    buttonHover: "#ffffff",
  },
];

const THEME_MAP = new Map(BIO_THEMES.map((t) => [t.key, t]));

export function getBioTheme(key: string): BioTheme {
  const theme = THEME_MAP.get(key) ?? BIO_THEMES[0];
  if (!theme) throw new Error("BIO_THEMES está vazio.");
  return theme;
}
