import "server-only";
import { type AuthSecondaryStorage, createAuth } from "@linkview/auth";
import { getDb } from "@linkview/db";
import Redis from "ioredis";
import {
  emailConfigured,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "./email";
import { authEnv, redisConfigured, redisUrl } from "./env";

// Shared store for Better Auth's rate-limit counters. Lazily connect a single
// Redis client (module scope survives within a warm instance). Falls back to
// in-memory rate limiting when Redis isn't configured (local dev).
let authRedis: Redis | null = null;
function getAuthRedis(): Redis {
  if (!authRedis) {
    authRedis = new Redis(redisUrl(), { maxRetriesPerRequest: 3 });
    authRedis.on("error", (err) => console.error("auth.redis_error", err));
  }
  return authRedis;
}

type Auth = ReturnType<typeof createAuth>;

// Build the Better Auth instance lazily. Reading env / opening the DB at module
// scope makes `next build` fail while it imports route modules for prerendering
// (DATABASE_URL et al. aren't present at build time). Defer construction to the
// first request, where the runtime env is available.
let _auth: Auth | undefined;
function getAuth(): Auth {
  if (_auth) return _auth;

  const env = authEnv();
  // Email delivery is optional in local dev; when unconfigured we skip the
  // callbacks so sign-up still works without a Resend key.
  const withEmail = emailConfigured();

  const secondaryStorage: AuthSecondaryStorage | undefined = redisConfigured()
    ? {
        get: (key) => getAuthRedis().get(key),
        set: async (key, value, ttl) => {
          if (ttl) await getAuthRedis().set(key, value, "EX", ttl);
          else await getAuthRedis().set(key, value);
        },
        delete: async (key) => {
          await getAuthRedis().del(key);
        },
      }
    : undefined;

  _auth = createAuth({
    db: getDb(),
    secret: env.secret,
    baseURL: env.baseURL,
    trustedOrigins: [env.baseURL],
    requireEmailVerification: withEmail,
    secondaryStorage,
    sendResetPassword: withEmail
      ? async ({ user, token }) => {
          // Drive the reset through our own page rather than Better Auth's
          // default /reset-password path.
          const url = `${env.baseURL}/redefinir-senha?token=${token}`;
          await sendResetPasswordEmail({ to: user.email, name: user.name, url });
        }
      : undefined,
    sendVerificationEmail: withEmail
      ? async ({ user, url }) => {
          await sendVerificationEmail({ to: user.email, name: user.name, url });
        }
      : undefined,
  });
  return _auth;
}

// Transparent lazy proxy: call sites keep using `auth.api.…` / `auth.handler`,
// but the instance is only constructed on first property access (request time).
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
