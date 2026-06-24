/**
 * ISO 3166-1 alpha-2 countries with Portuguese names, ordered with the markets
 * linkview users care about most near the top. Flag emoji is derived from the
 * code (regional indicator symbols), so there are no image assets to ship.
 */
export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  { code: "BR", name: "Brasil" },
  { code: "PT", name: "Portugal" },
  { code: "US", name: "Estados Unidos" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colômbia" },
  { code: "PE", name: "Peru" },
  { code: "UY", name: "Uruguai" },
  { code: "PY", name: "Paraguai" },
  { code: "BO", name: "Bolívia" },
  { code: "EC", name: "Equador" },
  { code: "VE", name: "Venezuela" },
  { code: "CA", name: "Canadá" },
  { code: "ES", name: "Espanha" },
  { code: "FR", name: "França" },
  { code: "IT", name: "Itália" },
  { code: "DE", name: "Alemanha" },
  { code: "GB", name: "Reino Unido" },
  { code: "IE", name: "Irlanda" },
  { code: "NL", name: "Países Baixos" },
  { code: "BE", name: "Bélgica" },
  { code: "CH", name: "Suíça" },
  { code: "AT", name: "Áustria" },
  { code: "SE", name: "Suécia" },
  { code: "NO", name: "Noruega" },
  { code: "DK", name: "Dinamarca" },
  { code: "FI", name: "Finlândia" },
  { code: "PL", name: "Polônia" },
  { code: "CZ", name: "Tchéquia" },
  { code: "GR", name: "Grécia" },
  { code: "RO", name: "Romênia" },
  { code: "HU", name: "Hungria" },
  { code: "UA", name: "Ucrânia" },
  { code: "RU", name: "Rússia" },
  { code: "TR", name: "Turquia" },
  { code: "IL", name: "Israel" },
  { code: "SA", name: "Arábia Saudita" },
  { code: "AE", name: "Emirados Árabes Unidos" },
  { code: "ZA", name: "África do Sul" },
  { code: "NG", name: "Nigéria" },
  { code: "EG", name: "Egito" },
  { code: "MA", name: "Marrocos" },
  { code: "AO", name: "Angola" },
  { code: "MZ", name: "Moçambique" },
  { code: "CV", name: "Cabo Verde" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japão" },
  { code: "KR", name: "Coreia do Sul" },
  { code: "IN", name: "Índia" },
  { code: "ID", name: "Indonésia" },
  { code: "PH", name: "Filipinas" },
  { code: "VN", name: "Vietnã" },
  { code: "TH", name: "Tailândia" },
  { code: "MY", name: "Malásia" },
  { code: "SG", name: "Singapura" },
  { code: "AU", name: "Austrália" },
  { code: "NZ", name: "Nova Zelândia" },
];

/** Flag emoji for an ISO 3166-1 alpha-2 code (e.g. "BR" → 🇧🇷). */
export function flagEmoji(code: string): string {
  const up = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return "🏳️";
  return String.fromCodePoint(
    ...[...up].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

/** Display name for a code, falling back to the raw code when unknown. */
export function countryName(code: string): string {
  return NAME_BY_CODE.get(code.toUpperCase()) ?? code.toUpperCase();
}

/** E.164 country calling codes (no leading +), keyed by ISO 3166-1 alpha-2. */
const DIAL_CODES: Record<string, string> = {
  BR: "55",
  PT: "351",
  US: "1",
  AR: "54",
  MX: "52",
  CL: "56",
  CO: "57",
  PE: "51",
  UY: "598",
  PY: "595",
  BO: "591",
  EC: "593",
  VE: "58",
  CA: "1",
  ES: "34",
  FR: "33",
  IT: "39",
  DE: "49",
  GB: "44",
  IE: "353",
  NL: "31",
  BE: "32",
  CH: "41",
  AT: "43",
  SE: "46",
  NO: "47",
  DK: "45",
  FI: "358",
  PL: "48",
  CZ: "420",
  GR: "30",
  RO: "40",
  HU: "36",
  UA: "380",
  RU: "7",
  TR: "90",
  IL: "972",
  SA: "966",
  AE: "971",
  ZA: "27",
  NG: "234",
  EG: "20",
  MA: "212",
  AO: "244",
  MZ: "258",
  CV: "238",
  CN: "86",
  JP: "81",
  KR: "82",
  IN: "91",
  ID: "62",
  PH: "63",
  VN: "84",
  TH: "66",
  MY: "60",
  SG: "65",
  AU: "61",
  NZ: "64",
};

/** Calling code (no +) for an ISO country code; empty string when unknown. */
export function dialCode(code: string): string {
  return DIAL_CODES[code.toUpperCase()] ?? "";
}
