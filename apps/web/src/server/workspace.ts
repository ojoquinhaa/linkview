import "server-only";
import { getDb, user, workspaceMembers, workspaces } from "@linkview/db";
import { generateSlug, normalizeSlug } from "@linkview/shared";
import type { WorkspaceRole } from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";

export interface ActiveWorkspace {
  id: string;
  name: string;
  slug: string;
  planKey: string;
  role: WorkspaceRole;
}

/** Build a unique workspace slug from a display name (mirrors the signup hook). */
function workspaceSlug(name: string): string {
  const base = normalizeSlug(name) || "workspace";
  return `${base.slice(0, 40)}-${generateSlug(5)}`;
}

/** Return the user's first (active) workspace with their role. */
export async function getActiveWorkspace(
  userId: string,
): Promise<ActiveWorkspace | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      planKey: workspaces.planKey,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(eq(workspaceMembers.userId, userId), isNull(workspaces.deletedAt)),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Return the user's active workspace, provisioning a fresh free one if they
 * have none. A returning customer whose only workspace was soft-deleted by the
 * retention purge (workspaces.deletedAt) would otherwise have no active
 * workspace: the dashboard layout sends them to /login, /login sees the live
 * session and bounces to the dashboard — an infinite redirect loop that bricks
 * the account with no way back to /assinar to pay again. Re-provisioning a free
 * workspace (identical to the signup hook) breaks the loop: the new workspace
 * has no subscription, so the billing gate routes them to /assinar to re-subscribe
 * (the trial stays blocked by the persistent redemption ledger — anti-abuse).
 */
export async function ensureActiveWorkspace(
  userId: string,
): Promise<ActiveWorkspace> {
  const existing = await getActiveWorkspace(userId);
  if (existing) return existing;

  const db = getDb();
  const [account] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const displayName = account?.name || account?.email || "workspace";

  const [ws] = await db
    .insert(workspaces)
    .values({
      name: displayName,
      slug: workspaceSlug(displayName),
      ownerId: userId,
      planKey: "free",
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      planKey: workspaces.planKey,
    });
  await db.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId,
    role: "owner",
  });

  return { ...ws, role: "owner" };
}
