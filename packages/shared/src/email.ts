/**
 * Canonicalize an e-mail for *identity/abuse* comparison (not for storage or
 * delivery). Lowercases and trims always. For Gmail (and its googlemail alias),
 * strips the dots and any `+tag` from the local part, since `j.l.+x@gmail.com`
 * and `jl@gmail.com` reach the same inbox — treating them as one person closes
 * the cheapest trial-farming trick. Other providers keep their local part as-is
 * (dots/`+` can be significant elsewhere).
 */
export function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at === -1) return email;

  let local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\+.*$/, "").replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}
