// Brazilian state helpers shared by the access map, the states ranking, and the
// clicks table. The edge may store a UF sigla ("SP") or a full name
// ("São Paulo"); `toUf` canonicalizes either to the sigla used as the map key.

export const UF_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const fold = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const NAME_TO_UF = new Map(
  Object.entries(UF_NAMES).map(([uf, name]) => [fold(name), uf]),
);

/** Accept a UF sigla or a full state name; return the canonical UF, or null. */
export function toUf(raw: string): string | null {
  const up = raw.trim().toUpperCase();
  if (UF_NAMES[up]) return up;
  return NAME_TO_UF.get(fold(raw)) ?? null;
}

/** Friendly state name from any region string, falling back to the input. */
export function ufName(raw: string): string {
  const uf = toUf(raw);
  return uf ? UF_NAMES[uf] : raw;
}
