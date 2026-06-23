import type { WorkspaceRole } from "@urlsimples/shared";

/** Workspace-scoped capabilities (ARCHITECTURE.md section 13). */
export type Permission =
  | "link.create"
  | "link.edit"
  | "link.delete"
  | "metrics.view"
  | "campaign.manage"
  | "billing.manage"
  | "members.manage"
  | "domain.manage"
  | "audit.view";

const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<Permission>> = {
  owner: new Set<Permission>([
    "link.create",
    "link.edit",
    "link.delete",
    "metrics.view",
    "campaign.manage",
    "billing.manage",
    "members.manage",
    "domain.manage",
    "audit.view",
  ]),
  admin: new Set<Permission>([
    "link.create",
    "link.edit",
    "link.delete",
    "metrics.view",
    "campaign.manage",
    "domain.manage",
    "audit.view",
  ]),
  member: new Set<Permission>([
    "link.create",
    "link.edit",
    "metrics.view",
  ]),
  viewer: new Set<Permission>(["metrics.view"]),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Throw if the role lacks the permission. */
export function assertCan(role: WorkspaceRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: role "${role}" lacks "${permission}"`);
  }
}
