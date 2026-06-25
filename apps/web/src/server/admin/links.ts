import "server-only";
import { auditLogs, getDb, links, user, workspaces } from "@linkview/db";
import { desc, eq, isNull } from "drizzle-orm";

export interface AdminLinkRow {
  linkId: string;
  slug: string;
  destinationUrl: string;
  title: string | null;
  isActive: boolean;
  passwordProtected: boolean;
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
  workspaceId: string;
  workspaceName: string;
  planKey: string;
  ownerName: string;
  ownerEmail: string;
}

/**
 * Flat link roster for the admin console: every live link with its destination,
 * status, volume, and owning workspace/owner. Powers support lookups ("find this
 * short link and tell me why it 403s"). Soft-deleted links are excluded.
 */
export async function listLinks(limit = 300): Promise<AdminLinkRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      linkId: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      title: links.title,
      isActive: links.isActive,
      passwordHash: links.passwordHash,
      clicks: links.totalClicks,
      createdAt: links.createdAt,
      expiresAt: links.expiresAt,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      planKey: workspaces.planKey,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(links)
    .innerJoin(workspaces, eq(links.workspaceId, workspaces.id))
    .innerJoin(user, eq(workspaces.ownerId, user.id))
    .where(isNull(links.deletedAt))
    .orderBy(desc(links.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    linkId: r.linkId,
    slug: r.slug,
    destinationUrl: r.destinationUrl,
    title: r.title,
    isActive: r.isActive,
    passwordProtected: Boolean(r.passwordHash),
    clicks: Number(r.clicks ?? 0),
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    workspaceId: r.workspaceId,
    workspaceName: r.workspaceName,
    planKey: r.planKey,
    ownerName: r.ownerName,
    ownerEmail: r.ownerEmail,
  }));
}

export interface AdminLinkAuditRow {
  action: string;
  createdAt: Date;
  metadata: unknown;
}

export interface AdminLinkDetail {
  linkId: string;
  slug: string;
  destinationUrl: string;
  title: string | null;
  isActive: boolean;
  passwordProtected: boolean;
  blockBots: boolean;
  allowedCountries: string[];
  blockedCountries: string[];
  rateLimitPerMinute: number | null;
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
  lastClickedAt: Date | null;
  workspaceId: string;
  workspaceName: string;
  planKey: string;
  ownerName: string;
  ownerEmail: string;
  audit: AdminLinkAuditRow[];
}

/** Full management detail for one link, loaded lazily by the drawer. */
export async function getAdminLinkDetail(
  linkId: string,
): Promise<AdminLinkDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      linkId: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      title: links.title,
      isActive: links.isActive,
      passwordHash: links.passwordHash,
      blockBots: links.blockBots,
      allowedCountries: links.allowedCountries,
      blockedCountries: links.blockedCountries,
      rateLimitPerMinute: links.rateLimitPerMinute,
      clicks: links.totalClicks,
      createdAt: links.createdAt,
      expiresAt: links.expiresAt,
      lastClickedAt: links.lastClickedAt,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      planKey: workspaces.planKey,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(links)
    .innerJoin(workspaces, eq(links.workspaceId, workspaces.id))
    .innerJoin(user, eq(workspaces.ownerId, user.id))
    .where(eq(links.id, linkId))
    .limit(1);
  if (!row) return null;

  const audit = await db
    .select({
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(eq(auditLogs.entityId, linkId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);

  return {
    linkId: row.linkId,
    slug: row.slug,
    destinationUrl: row.destinationUrl,
    title: row.title,
    isActive: row.isActive,
    passwordProtected: Boolean(row.passwordHash),
    blockBots: row.blockBots ?? false,
    allowedCountries: row.allowedCountries ?? [],
    blockedCountries: row.blockedCountries ?? [],
    rateLimitPerMinute: row.rateLimitPerMinute,
    clicks: Number(row.clicks ?? 0),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastClickedAt: row.lastClickedAt,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    planKey: row.planKey,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    audit,
  };
}
