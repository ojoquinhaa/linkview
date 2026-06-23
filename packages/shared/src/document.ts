/**
 * Brazilian document + contact validation and masking.
 *
 * Pure functions, no dependencies, safe on client and server. Validation is by
 * the official check-digit algorithm (modulo 11), not a regex, so typos and
 * made-up numbers are rejected. Used both for inline UX feedback in the
 * register stepper and for authoritative server-side validation before an
 * account is created.
 */

/** Strip everything but digits. */
export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Validate a CPF (11 digits) by its two check digits.
 * Rejects known-invalid repeated sequences (e.g. 111.111.111-11).
 */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (sliceLength: number): number => {
    let sum = 0;
    let factor = sliceLength + 1;
    for (let i = 0; i < sliceLength; i++) {
      sum += Number(cpf[i]) * factor;
      factor--;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/**
 * Validate a CNPJ (14 digits) by its two check digits.
 * Rejects known-invalid repeated sequences.
 */
export function isValidCnpj(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (sliceLength: number): number => {
    // Weights run 2..9 cycling, applied right-to-left over the slice.
    let sum = 0;
    let factor = sliceLength - 7;
    for (let i = sliceLength - 1; i >= 0; i--) {
      sum += Number(cnpj[i]) * factor;
      factor = factor === 9 ? 2 : factor + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export type PersonType = "pf" | "pj";

/** Validate the document that matches the chosen person type. */
export function isValidDocument(value: string, type: PersonType): boolean {
  return type === "pf" ? isValidCpf(value) : isValidCnpj(value);
}

/** Format CPF as 000.000.000-00, masking partial input as the user types. */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** Format CNPJ as 00.000.000/0000-00, masking partial input. */
export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Format the document according to person type. */
export function formatDocument(value: string, type: PersonType): string {
  return type === "pf" ? formatCpf(value) : formatCnpj(value);
}

/** Format a Brazilian CEP as 00000-000. */
export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

/** A CEP is well-formed when it has exactly 8 digits. */
export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

/**
 * Format a Brazilian phone as (00) 0000-0000 or (00) 00000-0000.
 * Accepts both landline (10) and mobile (11) digit counts.
 */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/^\((\d{2})\)\s(\d{4})(\d)/, "($1) $2-$3");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/^\((\d{2})\)\s(\d{5})(\d)/, "($1) $2-$3");
}

/** A phone is valid when it has 10 (landline) or 11 (mobile) digits. */
export function isValidPhone(value: string): boolean {
  const len = onlyDigits(value).length;
  return len === 10 || len === 11;
}

/** Two-letter Brazilian state codes (UF). */
export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrState = (typeof BR_STATES)[number];

/** Shape returned by the ViaCEP public API (fields we consume). */
export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/** A resolved address, normalised to our field names. */
export interface ResolvedAddress {
  zip: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

/**
 * Look up a CEP via ViaCEP. Returns null for malformed input, unknown CEPs, or
 * network errors so callers can fall back to manual entry without throwing.
 * CORS-enabled, so this runs directly from the browser.
 */
export async function lookupCep(
  cep: string,
  signal?: AbortSignal,
): Promise<ResolvedAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) return null;
    return {
      zip: digits,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: (data.uf ?? "").toUpperCase(),
    };
  } catch {
    return null;
  }
}
