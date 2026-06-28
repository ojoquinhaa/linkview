import { resyncPendingLinks } from "@/lib/link-sync";

/**
 * KV resync job (§11.6). Drains the backlog of links flagged `kvSyncPending`
 * because an earlier Cloudflare KV write failed: each is rebuilt from
 * authoritative Postgres state and re-pushed, clearing the flag on success.
 * Postgres stays the source of truth; this is the eventual-consistency path that
 * keeps the redirect Worker's KV in step. Authenticated by `Bearer ${CRON_SECRET}`.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await resyncPendingLinks();
  return Response.json({ ok: true, ...result });
}

// Vercel Cron issues GET requests; accept both.
export async function GET(request: Request) {
  return POST(request);
}
