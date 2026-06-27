"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, links, pageLayouts } from "@linkview/db";
import {
  getPlan,
  type PageLayoutInput,
  type PlanKey,
  pageLayoutSchema,
  resolveSplash,
} from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { r2Configured } from "@/lib/env";
import { resyncLink, resyncLinksUsingLayout } from "@/lib/link-sync";
import { presignUpload } from "@/lib/r2";
import { logAudit } from "./audit";
import { getPageLayout } from "./page-layouts-query";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

// SVG is intentionally excluded: it can carry inline scripts (stored-XSS risk
// if ever served on a trusted origin). Matches the OG-image allowlist.
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024;

type Guard =
  | { ok: false; error: string }
  | { ok: true; workspaceId: string; planKey: PlanKey; userId: string };

/** Shared auth + plan gate for layout mutations (Starter+ feature). */
async function guard(): Promise<Guard> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar." };
  }
  const planKey = (workspace.planKey as PlanKey) ?? "free";
  if (!getPlan(planKey).customSplashEnabled) {
    return {
      ok: false,
      error:
        "Páginas personalizadas estão disponíveis a partir do plano Starter.",
    };
  }
  return {
    ok: true,
    workspaceId: workspace.id,
    planKey,
    userId: session.user.id,
  };
}

export interface UploadTicket {
  ok: boolean;
  error?: string;
  uploadUrl?: string;
  fileUrl?: string;
}

/** Presign a direct browser upload of a logo or background image to R2. */
export async function requestLayoutUploadAction(input: {
  kind: "logo" | "background";
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  if (!r2Configured()) {
    return { ok: false, error: "Uploads de imagem não estão configurados." };
  }
  const ext = EXT[input.contentType];
  if (!ext) {
    return { ok: false, error: "Use uma imagem PNG, JPG, WebP ou GIF." };
  }
  if (input.size > MAX_BYTES) {
    return { ok: false, error: "Imagem muito grande (máximo 8 MB)." };
  }
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const key = `splash/${g.workspaceId}/${input.kind}/${crypto.randomUUID()}.${ext}`;
  try {
    const { uploadUrl, fileUrl } = await presignUpload({
      key,
      contentType: input.contentType,
      contentLength: input.size,
    });
    return { ok: true, uploadUrl, fileUrl };
  } catch (err) {
    console.error("layout.presign_failed", err);
    return { ok: false, error: "Não foi possível preparar o upload." };
  }
}

export interface SaveLayoutResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function columns(data: PageLayoutInput) {
  return {
    name: data.name.trim(),
    logoUrl: data.logoUrl?.trim() || null,
    bgType: data.bgType,
    bgColor: data.bgColor,
    bgImageUrl: data.bgImageUrl?.trim() || null,
    blur: data.blur,
    logoPosition: data.logoPosition,
    accentColor: data.accentColor,
    textColor: data.textColor,
    countdownSeconds: data.countdownSeconds,
    showBranding: data.showBranding,
  };
}

export async function createPageLayoutAction(
  input: PageLayoutInput,
): Promise<SaveLayoutResult> {
  const parsed = pageLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const db = getDb();
  const [created] = await db
    .insert(pageLayouts)
    .values({
      workspaceId: g.workspaceId,
      createdByUserId: g.userId,
      ...columns(parsed.data),
    })
    .returning({ id: pageLayouts.id });
  if (!created) return { ok: false, error: "Falha ao criar a página." };

  await logAudit({
    workspaceId: g.workspaceId,
    userId: g.userId,
    action: "page_layout.created",
    entityType: "page_layout",
    entityId: created.id,
  });
  revalidatePath("/dashboard/paginas");
  return { ok: true, id: created.id };
}

export async function updatePageLayoutAction(
  id: string,
  input: PageLayoutInput,
): Promise<SaveLayoutResult> {
  const parsed = pageLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const existing = await getPageLayout(g.workspaceId, id);
  if (!existing) return { ok: false, error: "Página não encontrada." };

  const db = getDb();
  await db
    .update(pageLayouts)
    .set({ ...columns(parsed.data), updatedAt: new Date() })
    .where(eq(pageLayouts.id, id));

  // Propagate the new look to every link that uses this layout.
  await resyncLinksUsingLayout(
    id,
    resolveSplash(g.planKey, columns(parsed.data)),
  );

  await logAudit({
    workspaceId: g.workspaceId,
    userId: g.userId,
    action: "page_layout.updated",
    entityType: "page_layout",
    entityId: id,
  });
  revalidatePath("/dashboard/paginas");
  revalidatePath(`/dashboard/paginas/${id}`);
  return { ok: true, id };
}

export async function deletePageLayoutAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const existing = await getPageLayout(g.workspaceId, id);
  if (!existing) return { ok: false, error: "Página não encontrada." };

  const db = getDb();
  // Reset assigned links to a direct redirect, then unlink and soft-delete.
  await resyncLinksUsingLayout(id, null);
  await db
    .update(links)
    .set({ pageLayoutId: null, updatedAt: new Date() })
    .where(and(eq(links.pageLayoutId, id), isNull(links.deletedAt)));
  await db
    .update(pageLayouts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(pageLayouts.id, id));

  await logAudit({
    workspaceId: g.workspaceId,
    userId: g.userId,
    action: "page_layout.deleted",
    entityType: "page_layout",
    entityId: id,
  });
  revalidatePath("/dashboard/paginas");
  return { ok: true };
}

/** Assign a layout to a link (or `null` to clear it) and resync its KV record. */
export async function assignLayoutToLinkAction(
  linkId: string,
  layoutId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g.ok) return { ok: false, error: g.error };

  const db = getDb();
  const [link] = await db
    .select({ id: links.id, slug: links.slug })
    .from(links)
    .where(
      and(
        eq(links.id, linkId),
        eq(links.workspaceId, g.workspaceId),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  if (!link) return { ok: false, error: "Link não encontrado." };

  const layout = layoutId ? await getPageLayout(g.workspaceId, layoutId) : null;
  if (layoutId && !layout)
    return { ok: false, error: "Página não encontrada." };

  await db
    .update(links)
    .set({ pageLayoutId: layoutId, updatedAt: new Date() })
    .where(eq(links.id, linkId));

  await resyncLink(linkId, resolveSplash(g.planKey, layout));

  revalidatePath(`/dashboard/links/${link.slug}`);
  revalidatePath(`/dashboard/links/${link.slug}/configuracoes`);
  return { ok: true };
}
