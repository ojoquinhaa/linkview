/**
 * Pure, dependency-free credit-card helpers shared by the checkout form (live
 * UX) and the server action (never trust the client). No PAN is stored or
 * logged anywhere — these only validate and format in memory.
 */

/** Digits only. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Luhn checksum — rejects mistyped numbers before they reach the gateway. */
export function luhnValid(number: string): boolean {
  const digits = onlyDigits(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Brand from the PAN prefix, for the form's inline icon. "unknown" if unsure. */
export function cardBrand(number: string): string {
  const d = onlyDigits(number);
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(60|65|50|6[37])/.test(d)) return "elo";
  return "unknown";
}

/** True when MM/YYYY is a real month and not in the past. */
export function expiryValid(month: string, year: string): boolean {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(y) || y < 2000 || y > 2099) return false;
  // Last valid instant is the end of the expiry month.
  const expiry = new Date(y, m, 1).getTime();
  return expiry > Date.now();
}

/** CCV is 3 digits (4 for Amex). */
export function ccvValid(ccv: string, number: string): boolean {
  const d = onlyDigits(ccv);
  return cardBrand(number) === "amex" ? d.length === 4 : d.length === 3;
}

export interface RawCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

/** Full server-side validation. Returns an error message or null when valid. */
export function validateCard(card: RawCard): string | null {
  if (!card.holderName?.trim()) return "Informe o nome impresso no cartão.";
  if (!luhnValid(card.number)) return "Número do cartão inválido.";
  if (!expiryValid(card.expiryMonth, card.expiryYear)) {
    return "Validade do cartão inválida.";
  }
  if (!ccvValid(card.ccv, card.number)) return "Código de segurança inválido.";
  return null;
}

/** Format a PAN as groups of 4 (Amex 4-6-5) for the input display. */
export function formatCardNumber(value: string): string {
  const d = onlyDigits(value).slice(0, 19);
  if (cardBrand(d) === "amex") {
    return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" "),
    );
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
