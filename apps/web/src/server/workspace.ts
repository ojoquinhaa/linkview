import "server-only";
import { getDb, workspaceMembers, workspaces } from "@linkview/db";
import type { WorkspaceRole } from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";

export interface ActiveWorkspace {
  id: string;
  name: string;
  slug: string;
  planKey: string;
  role: WorkspaceRole;
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
