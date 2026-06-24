import "server-only";
import { getDb, user } from "@linkview/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/session";

/** Read the platform role for a user (defaults to `user` if the row is gone). */
export async function getPlatformRole(
  userId: string,
): Promise<"user" | "admin"> {
  const db = getDb();
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.role ?? "user";
}

/** True when the signed-in user is a platform admin. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return (await getPlatformRole(userId)) === "admin";
}

export interface AdminSession {
  userId: string;
  name: string;
  email: string;
}

/**
 * Require a platform admin. Redirects unauthenticated users to /login and
 * non-admins to /dashboard, so the /admin console is never enumerable.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await requireSession();
  if (!(await isPlatformAdmin(session.user.id))) {
    redirect("/dashboard");
  }
  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email,
  };
}
