import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "@linkview/db";
import { createAuth } from "./index";

// One-off helper: create a platform admin account with a known password (valid
// better-auth hash), mark its email verified, and promote it to role "admin".
// Usage: tsx src/create-admin.ts <email> <password> [name]

/** Minimal .env loader (no dependency): KEY=VALUE per line. */
function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "../../../.env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  const name = process.argv[4] ?? "Admin";
  if (!email || !password) {
    throw new Error("Usage: tsx src/create-admin.ts <email> <password> [name]");
  }

  loadEnv();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET not set");

  const db = getDb();
  const auth = createAuth({
    db,
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    requireEmailVerification: false,
  });

  await auth.api.signUpEmail({ body: { email, password, name } });
  console.log(`Signed up ${email}. Now run the verify+promote step.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
