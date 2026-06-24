import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Resolve the current session (or null) from request headers. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Require an authenticated session; redirect to /login otherwise. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
