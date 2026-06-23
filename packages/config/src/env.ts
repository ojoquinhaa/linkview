import { z } from "zod";

/**
 * Centralized environment validation.
 *
 * Schemas are exported (not parsed at import time) so that both the Next.js
 * runtime (process.env) and the Cloudflare Worker runtime (bindings object)
 * can validate their own env shape against the relevant slice.
 */

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database (Neon Postgres)
  DATABASE_URL: z.string().url(),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),

  // Billing (Asaas)
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_WEBHOOK_TOKEN: z.string().min(1),
  // Defaults to production; set the sandbox URL while testing.
  ASAAS_API_URL: z.string().url().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1).optional(),

  // Cloudflare KV sync (from the web app)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_KV_NAMESPACE_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),

  // Privacy: salt used to hash visitor IPs before storage
  IP_HASH_SALT: z.string().min(16),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Env shape required by the redirect Worker (Cloudflare). */
export const workerEnvSchema = z.object({
  // KV namespace binding is validated structurally at runtime by Workers; here
  // we only validate the scalar config the Worker needs.
  IP_HASH_SALT: z.string().min(16),
  CLICK_INGEST_URL: z.string().url().optional(),
  CLICK_INGEST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/** Parse and validate an env object, throwing a readable error on failure. */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
