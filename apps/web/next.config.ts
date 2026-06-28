import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Load monorepo-root .env into the Next process (env lives at the repo root,
// not in apps/web). Server runtime reads these via process.env.
config({ path: resolve(process.cwd(), "../../.env") });

// Baseline security headers applied to every route. `frame-ancestors 'none'`
// (plus X-Frame-Options) stops the app — including the card checkout — from
// being embedded in an attacker's iframe (clickjacking). A full script CSP is
// intentionally omitted: it needs per-request nonces to coexist with Next's
// inline runtime, and getting it wrong silently breaks the app.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@linkview/config", "@linkview/db", "@linkview/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
