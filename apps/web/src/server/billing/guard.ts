import "server-only";
import {
  getWorkspaceSubscription,
  resolveSubscriptionAccess,
} from "./subscription";

/** Shown when a locked (lapsed-billing) workspace attempts a write. */
export const LOCKED_WRITE_MESSAGE =
  "Sua assinatura está inativa. Reative o plano para criar ou editar.";

/**
 * Whether the workspace may mutate content right now. A `locked` workspace
 * (billing lapsed, read-only until it reactivates) and a never-subscribed one
 * are denied; only `full` access writes. Server actions call this as the
 * authoritative gate — the read-only UI is a hint, this is the enforcement.
 */
export async function workspaceCanWrite(workspaceId: string): Promise<boolean> {
  const sub = await getWorkspaceSubscription(workspaceId);
  return resolveSubscriptionAccess(sub) === "full";
}
