import "server-only";

function requireEnv(name: string): string {
  // `.trim()` strips a trailing newline/space pasted into the env var on the
  // host. For R2 this is load-bearing: a stray `\r\n` on R2_BUCKET or
  // R2_ACCESS_KEY_ID gets signed into the presigned URL (as `%0D%0A`),
  // corrupting both the object path and the AWS credential scope, so every
  // upload fails with a 400 (surfacing in the browser as a missing CORS header).
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/** Auth + database — required to run the app. */
export function authEnv() {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").trim(),
  };
}

/** Cloudflare KV REST credentials — required for link sync. */
export function kvEnv() {
  return {
    accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
    namespaceId: requireEnv("CLOUDFLARE_KV_NAMESPACE_ID"),
    apiToken: requireEnv("CLOUDFLARE_API_TOKEN"),
  };
}

/** Cloudflare R2 (S3-compatible) credentials for image uploads. */
export function r2Env() {
  return {
    accountId: requireEnv("R2_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    // Public base URL of the bucket (r2.dev domain or a custom domain).
    publicUrl: requireEnv("R2_PUBLIC_URL").replace(/\/$/, ""),
  };
}

/** True when every R2 variable is present, so uploads can be offered. */
export function r2Configured(): boolean {
  return [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL",
  ].every((name) => Boolean(process.env[name]));
}

/** Cloudflare Turnstile secret key (server-side siteverify). */
export function turnstileSecret(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
}

/** True when Turnstile is configured, so captcha verification is enforced. */
export function turnstileConfigured(): boolean {
  return Boolean(turnstileSecret());
}

/** Token the redirect Worker must present to POST clicks. */
export function clickIngestToken(): string | undefined {
  return process.env.CLICK_INGEST_TOKEN;
}

/** Upstash Redis TCP connection string (rediss://…) for realtime pub/sub. */
export function redisUrl(): string {
  return requireEnv("REDIS_URL");
}

/** True when REDIS_URL is set, so realtime push can be wired up. */
export function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/** Hostname of the default system domain used for short links. `.trim()` guards
 * against a trailing newline/space pasted into the env var on the host, which
 * would otherwise never match the seeded `domains.hostname`. */
export function systemDomain(): string {
  return (process.env.SYSTEM_DOMAIN ?? "lnkv.com.br").trim();
}
