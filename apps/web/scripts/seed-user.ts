import { resolve } from "node:path";
import { createAuth } from "@linkview/auth";
import { getDb } from "@linkview/db";
import { config } from "dotenv";

// Load monorepo-root .env (script runs from apps/web).
config({ path: resolve(process.cwd(), "../../.env") });

const NAME = process.env.SEED_USER_NAME ?? "Loja Demo";
const EMAIL = process.env.SEED_USER_EMAIL ?? "demo@linkview.com.br";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "demo12345";

async function main() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET not set");

  const auth = createAuth({
    db: getDb(),
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });

  try {
    await auth.api.signUpEmail({
      body: { name: NAME, email: EMAIL, password: PASSWORD },
    });
    console.log(`Usuário criado: ${EMAIL} / ${PASSWORD}`);
    console.log("Workspace inicial provisionado pelo hook (plano free).");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("exist")) {
      console.log(`Usuário ${EMAIL} já existe. Nada a fazer.`);
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
