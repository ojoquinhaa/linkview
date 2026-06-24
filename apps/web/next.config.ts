import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Load monorepo-root .env into the Next process (env lives at the repo root,
// not in apps/web). Server runtime reads these via process.env.
config({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@linkview/config", "@linkview/db", "@linkview/shared"],
};

export default nextConfig;
