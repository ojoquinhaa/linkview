import "server-only";
import { domains, getDb } from "@linkview/db";
import { eq } from "drizzle-orm";
import { systemDomain } from "@/lib/env";

export interface ResolvedDomain {
  id: string;
  hostname: string;
}

/** Resolve the default system domain row (must be seeded). */
export async function getSystemDomain(): Promise<ResolvedDomain> {
  const db = getDb();
  const hostname = systemDomain();
  const [row] = await db
    .select({ id: domains.id, hostname: domains.hostname })
    .from(domains)
    .where(eq(domains.hostname, hostname))
    .limit(1);
  if (!row) {
    throw new Error(
      `System domain "${hostname}" not found. Run \`pnpm db:seed\`.`,
    );
  }
  return row;
}
