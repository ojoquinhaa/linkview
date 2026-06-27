import { domains, getDb, links } from "@linkview/db";
import { and, eq, isNull } from "drizzle-orm";
import { clickIngestToken } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

/**
 * Verify a link password submitted by the redirect Worker (§14.5).
 * Bearer-protected with the same internal token as click ingest. The hash
 * never leaves the server; only a boolean result is returned.
 */
export async function POST(request: Request) {
  // Fail closed: without a configured token this becomes a password-verification
  // oracle for any protected link. Reject rather than wave the request through.
  const token = clickIngestToken();
  if (!token) {
    console.error("unlock.ingest_token_unset");
    return Response.json({ ok: false }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const { hostname, slug, password } = (body ?? {}) as {
    hostname?: string;
    slug?: string;
    password?: string;
  };
  if (!hostname || !slug || !password) {
    return Response.json({ ok: false }, { status: 422 });
  }

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: links.passwordHash, isActive: links.isActive })
    .from(links)
    .innerJoin(domains, eq(links.domainId, domains.id))
    .where(
      and(
        eq(domains.hostname, hostname),
        eq(links.slug, slug),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);

  if (!row?.passwordHash || !row.isActive) {
    return Response.json({ ok: false });
  }
  return Response.json({ ok: verifyPassword(password, row.passwordHash) });
}
