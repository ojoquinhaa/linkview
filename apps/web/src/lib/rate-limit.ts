import "server-only";
import Redis from "ioredis";
import { redisConfigured, redisUrl } from "./env";

// Single shared client (module scope survives within a warm instance). Lazily
// connected so importing this module never opens a socket at build time.
let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    client = new Redis(redisUrl(), { maxRetriesPerRequest: 3 });
    client.on("error", (err) => console.error("ratelimit.redis_error", err));
  }
  return client;
}

/**
 * Fixed-window rate limiter. Returns true when the action is allowed, false when
 * the caller has exceeded `limit` within `windowSeconds`. Fail-open: if Redis is
 * unconfigured (local dev) or unreachable, the action proceeds — a limiter must
 * never lock real users out of paying. Use a narrow window for abuse-sensitive
 * actions (e.g. card tokenization, to blunt card-testing).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!redisConfigured()) return true;
  try {
    const r = redis();
    const k = `rl:${key}`;
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, windowSeconds);
    return count <= limit;
  } catch (err) {
    console.error("ratelimit.failed_open", key, err);
    return true;
  }
}
