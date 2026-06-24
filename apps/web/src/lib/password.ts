import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash a link password as `salt:derivedKey` (hex). Never store plaintext (§14.5). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const derived = scryptSync(plain, Buffer.from(saltHex, "hex"), 64);
  const key = Buffer.from(keyHex, "hex");
  return derived.length === key.length && timingSafeEqual(derived, key);
}
