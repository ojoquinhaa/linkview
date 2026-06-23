import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load the monorepo-root .env (drizzle-kit runs from packages/db).
config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
