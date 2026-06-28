"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, links } from "@linkview/db";
import { type OgInput, ogSchema } from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { r2Configured } from "@/lib/env";
import { presignUpload } from "@/lib/r2";
import { logAudit } from "./audit";
import { LOCKED_WRITE_MESSAGE, workspaceCanWrite } from "./billing/guard";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 4 * 1024 * 1024;

async function ownedLink(id: string, workspaceId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: links.id, slug: links.slug })
    .from(links)
    .where(
      and(
        eq(links.id, id),
        eq(links.workspaceId, workspaceId),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export interface UploadTicket {
  ok: boolean;
  error?: string;
  uploadUrl?: string;
  fileUrl?: string;
}

/** Presign a direct browser upload of an OG image to R2. */
export async function requestOgUploadAction(input: {
  linkId: string;
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
    return { ok: false, error: "Imagem muito grande (máximo 4 MB)." };
  }

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }
  const link = await ownedLink(input.linkId, workspace.id);
  if (!link) return { ok: false, error: "Link não encontrado." };

  const key = `og/${workspace.id}/${link.id}/${crypto.randomUUID()}.${ext}`;
  try {
    const { uploadUrl, fileUrl } = await presignUpload({
      key,
      contentType: input.contentType,
      contentLength: input.size,
    });
    return { ok: true, uploadUrl, fileUrl };
  } catch (err) {
    console.error("og.presign_failed", err);
    return { ok: false, error: "Não foi possível preparar o upload." };
  }
}

export async function updateLinkOgAction(
  linkId: string,
  input: OgInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }
  const link = await ownedLink(linkId, workspace.id);
  if (!link) return { ok: false, error: "Link não encontrado." };

  const db = getDb();
  await db
    .update(links)
    .set({
      ogTitle: data.ogTitle?.trim() || null,
      ogDescription: data.ogDescription?.trim() || null,
      ogImageUrl: data.ogImageUrl?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(links.id, linkId));

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.og_updated",
    entityType: "link",
    entityId: linkId,
  });

  revalidatePath(`/dashboard/links/${link.slug}/compartilhamento`);
  revalidatePath(`/dashboard/links/${link.slug}`);
  return { ok: true };
}
