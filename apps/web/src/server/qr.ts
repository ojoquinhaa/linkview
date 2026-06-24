"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, links, qrCodes } from "@linkview/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "./audit";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

export interface QrResult {
  ok: boolean;
  error?: string;
  /** Id of the QR code created, so the client can render it immediately. */
  id?: string;
}

const MAX_QR_PER_LINK = 50;

function cleanName(raw: string): string {
  return raw.trim().slice(0, 80);
}

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

export async function createQrCodeAction(
  linkId: string,
  name: string,
): Promise<QrResult> {
  const label = cleanName(name);
  if (!label) return { ok: false, error: "Dê um nome ao QR code." };

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  const link = await ownedLink(linkId, workspace.id);
  if (!link) return { ok: false, error: "Link não encontrado." };

  const db = getDb();

  // Cap the number of QR codes per link so the scan-attribution lookup and the
  // management UI stay bounded.
  const existing = await db
    .select({ id: qrCodes.id })
    .from(qrCodes)
    .where(eq(qrCodes.linkId, linkId));
  if (existing.length >= MAX_QR_PER_LINK) {
    return {
      ok: false,
      error: `Limite de ${MAX_QR_PER_LINK} QR codes por link atingido.`,
    };
  }

  let id: string;
  try {
    const [row] = await db
      .insert(qrCodes)
      .values({ workspaceId: workspace.id, linkId, name: label })
      .returning({ id: qrCodes.id });
    id = row.id;
  } catch (err) {
    console.error("qr.create_failed", err);
    return { ok: false, error: "Não foi possível criar o QR code." };
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.qr_created",
    entityType: "link",
    entityId: linkId,
  });

  revalidatePath(`/dashboard/links/${link.slug}/qr-codes`);
  return { ok: true, id };
}

export async function renameQrCodeAction(
  qrCodeId: string,
  name: string,
): Promise<QrResult> {
  const label = cleanName(name);
  if (!label) return { ok: false, error: "Dê um nome ao QR code." };

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }

  const db = getDb();
  const [qr] = await db
    .select({ id: qrCodes.id, linkId: qrCodes.linkId })
    .from(qrCodes)
    .where(and(eq(qrCodes.id, qrCodeId), eq(qrCodes.workspaceId, workspace.id)))
    .limit(1);
  if (!qr) return { ok: false, error: "QR code não encontrado." };

  await db.update(qrCodes).set({ name: label }).where(eq(qrCodes.id, qrCodeId));

  const link = await ownedLink(qr.linkId, workspace.id);
  if (link) revalidatePath(`/dashboard/links/${link.slug}/qr-codes`);
  return { ok: true, id: qrCodeId };
}

export async function deleteQrCodeAction(qrCodeId: string): Promise<QrResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }

  const db = getDb();
  const [qr] = await db
    .select({ id: qrCodes.id, linkId: qrCodes.linkId })
    .from(qrCodes)
    .where(and(eq(qrCodes.id, qrCodeId), eq(qrCodes.workspaceId, workspace.id)))
    .limit(1);
  if (!qr) return { ok: false, error: "QR code não encontrado." };

  // Clicks keep their history: the FK is `on delete set null`, so deleting a QR
  // code detaches its past scans rather than erasing them.
  await db.delete(qrCodes).where(eq(qrCodes.id, qrCodeId));

  const link = await ownedLink(qr.linkId, workspace.id);
  if (link) revalidatePath(`/dashboard/links/${link.slug}/qr-codes`);
  return { ok: true };
}
