import "server-only";
import { auditLogs, getDb } from "@linkview/db";

export async function logAudit(params: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLogs).values({
    workspaceId: params.workspaceId,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
  });
}
