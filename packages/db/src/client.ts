import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

/** Create a Drizzle client bound to a Neon connection string.
 * Use this in the Worker (pass the binding) or anywhere the URL is explicit. */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

let _db: Database | undefined;

/** Lazy singleton for the Next.js runtime (reads process.env.DATABASE_URL). */
export function getDb(): Database {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _db = createDb(url);
  return _db;
}
