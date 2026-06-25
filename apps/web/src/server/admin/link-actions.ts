"use server";
import { getDb, links, workspaces } from "@linkview/db";
import type { PlanKey } from "@linkview/shared";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { removeLinkFromKv } from "@/lib/kv";
import { resolveSplashForLink, resyncLink } from "@/lib/link-sync";
import { logAudit } from "@/server/audit";
import { getSystemDomain } from "@/server/domain";
import { requireAdmin } from "./guard";
import { type AdminLinkDetail, getAdminLinkDetail } from "./links";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Lazy-load the full link detail for the management drawer. */
export async function getAdminLinkDetailAction(
  linkId: string,
): Promise<AdminLinkDetail | null> {
  await requireAdmin();
  return getAdminLinkDetail(linkId);
}

/** Load the columns needed to resync a link's KV record after an admin change. */
async function loadLinkForSync(linkId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      slug: links.slug,
      workspaceId: links.workspaceId,
      pageLayoutId: links.pageLayoutId,
      planKey: workspaces.planKey,
    })
    .from(links)
    .innerJoin(workspaces, eq(links.workspaceId, workspaces.id))
    .where(eq(links.id, linkId))
    .limit(1);
  return row ?? null;
}

/**
 * Pause or re-activate any link from the support console (no workspace scope).
 * Mirrors the change to KV so the redirect Worker honours it immediately.
 */
export async function adminSetLinkActiveAction(
  linkId: string,
  active: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = getDb();
  try {
    const meta = await loadLinkForSync(linkId);
    if (!meta) return { ok: false, error: "Link não encontrado." };

    await db
      .update(links)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(links.id, linkId));

    const splash = await resolveSplashForLink(
      meta.planKey as PlanKey,
      meta.pageLayoutId,
    );
    await resyncLink(linkId, splash);

    await logAudit({
      workspaceId: meta.workspaceId,
      userId: admin.userId,
      action: active ? "admin.link.activated" : "admin.link.paused",
      entityType: "link",
      entityId: linkId,
    });
  } catch (err) {
    console.error("admin.set_link_active_failed", err);
    return { ok: false, error: "Não foi possível alterar o link." };
  }
  revalidatePath("/admin/links");
  return { ok: true };
}

/** Soft-delete a link from the support console and drop it from KV. */
export async function adminDeleteLinkAction(
  linkId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = getDb();
  try {
    const meta = await loadLinkForSync(linkId);
    if (!meta) return { ok: false, error: "Link não encontrado." };

    await db
      .update(links)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(links.id, linkId));

    const domain = await getSystemDomain();
    await removeLinkFromKv(domain.hostname, meta.slug);

    await logAudit({
      workspaceId: meta.workspaceId,
      userId: admin.userId,
      action: "admin.link.deleted",
      entityType: "link",
      entityId: linkId,
    });
  } catch (err) {
    console.error("admin.delete_link_failed", err);
    return { ok: false, error: "Não foi possível excluir o link." };
  }
  revalidatePath("/admin/links");
  return { ok: true };
}
