import "server-only";
import { getDb, user, workspaces } from "@linkview/db";
import { eq } from "drizzle-orm";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "./subscription";

/** Shown when a locked (lapsed-billing) workspace attempts a write. */
export const LOCKED_WRITE_MESSAGE =
  "Sua assinatura está inativa. Reative o plano para criar ou editar.";

/**
 * Whether the workspace's owner account is still active. A suspended or closed
 * owner (`user.status` ≠ `active`) freezes the whole workspace to read-only,
 * independent of billing. This is what makes admin suspension and LGPD account
 * closure actually bite at write time (they previously only revoked sessions,
 * which a re-login restored — see SECURITY-AUDIT F1).
 */
async function workspaceOwnerActive(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ status: user.status })
    .from(workspaces)
    .innerJoin(user, eq(workspaces.ownerId, user.id))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  // Missing owner row: fail closed.
  return row?.status === "active";
}

/**
 * Whether the workspace may mutate content right now. Denied when the owner
 * account is suspended/closed, when billing has lapsed (`locked`, read-only
 * until it reactivates), or when it never subscribed; only an active owner with
 * `full` billing access writes. Server actions call this as the authoritative
 * gate — the read-only UI is a hint, this is the enforcement.
 */
export async function workspaceCanWrite(workspaceId: string): Promise<boolean> {
  if (!(await workspaceOwnerActive(workspaceId))) return false;
  const sub = await getWorkspaceSubscription(workspaceId);
  return resolveSubscriptionAccess(sub) === "full";
}
